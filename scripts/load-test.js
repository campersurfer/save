#!/usr/bin/env node

/**
 * Load Testing and Scaling Validation Script
 * Tests KEDA auto-scaling and load balancer performance
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');

class LoadTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3001',
      concurrency: config.concurrency || 50,
      duration: config.duration || 300, // 5 minutes
      rampUp: config.rampUp || 30, // 30 seconds
      scenarios: config.scenarios || ['api', 'extraction', 'websocket'],
      ...config
    };
    
    this.stats = {
      requests: 0,
      responses: 0,
      errors: 0,
      timeouts: 0,
      latencies: [],
      startTime: null,
      endTime: null
    };
    
    this.active = false;
  }

  async runLoadTest() {
    console.log('🚀 Starting Load Test...');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log(`Duration: ${this.config.duration}s`);
    
    this.stats.startTime = Date.now();
    this.active = true;

    // Run different test scenarios
    const promises = [];
    
    if (this.config.scenarios.includes('api')) {
      promises.push(this.runApiLoadTest());
    }
    
    if (this.config.scenarios.includes('extraction')) {
      promises.push(this.runExtractionLoadTest());
    }
    
    if (this.config.scenarios.includes('websocket')) {
      promises.push(this.runWebSocketLoadTest());
    }

    // Schedule test termination
    setTimeout(() => {
      this.active = false;
      this.stats.endTime = Date.now();
    }, this.config.duration * 1000);

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Load test error:', error);
    }

    this.printResults();
    await this.validateScaling();
  }

  async runApiLoadTest() {
    const workers = Array.from({ length: this.config.concurrency }, (_, i) => 
      this.createApiWorker(i)
    );
    
    return Promise.all(workers);
  }

  async createApiWorker(workerId) {
    while (this.active) {
      try {
        const startTime = Date.now();
        await this.makeApiRequest();
        const latency = Date.now() - startTime;
        
        this.stats.requests++;
        this.stats.responses++;
        this.stats.latencies.push(latency);
        
        // Random delay between requests (simulate realistic traffic)
        await this.sleep(Math.random() * 1000);
        
      } catch (error) {
        this.stats.errors++;
        console.error(`Worker ${workerId} error:`, error.message);
      }
    }
  }

  makeApiRequest() {
    return new Promise((resolve, reject) => {
      const paths = ['/api/health', '/api/status', '/api/metrics'];
      const path = paths[Math.floor(Math.random() * paths.length)];
      
      const url = new URL(path, this.config.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        this.stats.timeouts++;
        reject(new Error('Request timeout'));
      });
    });
  }

  async runExtractionLoadTest() {
    console.log('📊 Running extraction load test...');
    
    const extractionUrls = [
      'https://example.com/article1',
      'https://example.com/article2',
      'https://example.com/article3',
      'https://twitter.com/test/status/123',
      'https://instagram.com/p/test123'
    ];

    const workers = Array.from({ length: Math.floor(this.config.concurrency / 2) }, 
      () => this.createExtractionWorker(extractionUrls)
    );
    
    return Promise.all(workers);
  }

  async createExtractionWorker(urls) {
    while (this.active) {
      try {
        const url = urls[Math.floor(Math.random() * urls.length)];
        const startTime = Date.now();
        
        await this.makeExtractionRequest(url);
        
        const latency = Date.now() - startTime;
        this.stats.latencies.push(latency);
        this.stats.responses++;
        
        // Longer delay for extraction requests
        await this.sleep(2000 + Math.random() * 3000);
        
      } catch (error) {
        this.stats.errors++;
      }
    }
  }

  makeExtractionRequest(url) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        url: url,
        type: 'auto'
      });
      
      const options = {
        hostname: new URL(this.config.baseUrl).hostname,
        port: new URL(this.config.baseUrl).port || (this.config.baseUrl.includes('https') ? 443 : 80),
        path: '/api/extract',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const client = this.config.baseUrl.includes('https') ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Extraction timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  async runWebSocketLoadTest() {
    console.log('🔌 Running WebSocket load test...');
    // Simplified WebSocket load test
    // In a real scenario, you'd use a WebSocket client library
    return Promise.resolve();
  }

  printResults() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const rps = this.stats.responses / duration;
    const errorRate = (this.stats.errors / (this.stats.responses + this.stats.errors)) * 100;
    
    // Calculate latency percentiles
    const sortedLatencies = this.stats.latencies.sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedLatencies, 50);
    const p95 = this.getPercentile(sortedLatencies, 95);
    const p99 = this.getPercentile(sortedLatencies, 99);
    
    console.log('\n📊 Load Test Results:');
    console.log('=====================================');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.stats.requests}`);
    console.log(`Successful Responses: ${this.stats.responses}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Timeouts: ${this.stats.timeouts}`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
    console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
    console.log('\nLatency Distribution:');
    console.log(`  50th percentile: ${p50}ms`);
    console.log(`  95th percentile: ${p95}ms`);
    console.log(`  99th percentile: ${p99}ms`);
    
    // Save results to file
    const results = {
      timestamp: new Date().toISOString(),
      config: this.config,
      stats: {
        ...this.stats,
        duration,
        rps,
        errorRate,
        latency: { p50, p95, p99 }
      }
    };
    
    fs.writeFileSync(
      `load-test-results-${Date.now()}.json`, 
      JSON.stringify(results, null, 2)
    );
  }

  getPercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  async validateScaling() {
    console.log('\n🔍 Validating Auto-scaling...');
    
    try {
      // Check KEDA scaled objects
      await this.checkKedaScaling();
      
      // Check HPA status
      await this.checkHPAScaling();
      
      // Check pod counts
      await this.checkPodCounts();
      
    } catch (error) {
      console.error('Scaling validation error:', error);
    }
  }

  async checkKedaScaling() {
    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', [
        'get', 'scaledobjects', 
        '-n', 'save-app', 
        '-o', 'json'
      ]);
      
      let output = '';
      kubectl.stdout.on('data', data => output += data);
      
      kubectl.on('close', (code) => {
        if (code === 0) {
          try {
            const scaledObjects = JSON.parse(output);
            console.log(`Found ${scaledObjects.items.length} KEDA ScaledObjects:`);
            
            scaledObjects.items.forEach(so => {
              console.log(`  - ${so.metadata.name}: Current replicas = ${so.status?.currentReplicas || 0}, Desired = ${so.status?.desiredReplicas || 0}`);
            });
            
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`kubectl failed with code ${code}`));
        }
      });
    });
  }

  async checkHPAScaling() {
    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', [
        'get', 'hpa', 
        '-n', 'save-app', 
        '-o', 'json'
      ]);
      
      let output = '';
      kubectl.stdout.on('data', data => output += data);
      
      kubectl.on('close', (code) => {
        if (code === 0) {
          try {
            const hpas = JSON.parse(output);
            console.log(`Found ${hpas.items.length} HPAs:`);
            
            hpas.items.forEach(hpa => {
              const current = hpa.status?.currentReplicas || 0;
              const desired = hpa.status?.desiredReplicas || 0;
              const cpu = hpa.status?.currentCPUUtilizationPercentage || 0;
              
              console.log(`  - ${hpa.metadata.name}: ${current}/${desired} replicas, ${cpu}% CPU`);
            });
            
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(); // HPA might not exist, that's okay
        }
      });
    });
  }

  async checkPodCounts() {
    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', [
        'get', 'pods', 
        '-n', 'save-app', 
        '-l', 'app=save-app',
        '--no-headers'
      ]);
      
      let output = '';
      kubectl.stdout.on('data', data => output += data);
      
      kubectl.on('close', (code) => {
        if (code === 0) {
          const pods = output.trim().split('\n').filter(line => line.trim());
          console.log(`\nCurrent pod count: ${pods.length}`);
          
          const runningPods = pods.filter(line => line.includes('Running')).length;
          console.log(`Running pods: ${runningPods}`);
          
          resolve();
        } else {
          reject(new Error(`kubectl failed with code ${code}`));
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    baseUrl: process.env.LOAD_TEST_URL || 'http://localhost:3001',
    concurrency: parseInt(process.env.CONCURRENCY) || 50,
    duration: parseInt(process.env.DURATION) || 300,
    scenarios: process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : ['api', 'extraction']
  };
  
  const tester = new LoadTester(config);
  tester.runLoadTest().catch(console.error);
}

module.exports = LoadTester;