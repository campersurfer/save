import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * k6 Load Testing Suite for Save App
 * Comprehensive performance testing covering all critical endpoints
 */

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3000';

// Custom metrics
const extractionSuccess = new Rate('extraction_success_rate');
const extractionDuration = new Trend('extraction_duration');
const websocketConnections = new Counter('websocket_connections');
const paywallBypassSuccess = new Rate('paywall_bypass_success_rate');

// Test data
const testUrls = [
  'https://www.example.com/article-1',
  'https://www.example.com/article-2',
  'https://www.nytimes.com/test-article',
  'https://www.wsj.com/test-article',
  'https://twitter.com/test/status/123456',
  'https://instagram.com/p/ABC123/',
  'https://tiktok.com/@test/video/123456'
];

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
];

// Load testing options
export const options = {
  stages: [
    // Warm up
    { duration: '2m', target: 10 },
    
    // Ramp up to normal load
    { duration: '5m', target: 50 },
    
    // Stay at normal load
    { duration: '10m', target: 50 },
    
    // Peak load test
    { duration: '3m', target: 100 },
    
    // Spike test
    { duration: '1m', target: 200 },
    
    // Recovery
    { duration: '2m', target: 50 },
    
    // Cool down
    { duration: '2m', target: 0 }
  ],
  
  thresholds: {
    // Overall performance targets
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
    
    // Custom metrics thresholds
    extraction_success_rate: ['rate>0.8'], // 80% extraction success rate
    extraction_duration: ['p(95)<5000'],   // 95% of extractions under 5s
    paywall_bypass_success_rate: ['rate>0.6'], // 60% paywall bypass success
    
    // WebSocket thresholds
    ws_connecting: ['p(95)<1000'],
    ws_msgs_received: ['rate>10']
  }
};

// Setup function
export function setup() {
  console.log('Starting load test setup...');
  
  // Health check
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'API is healthy': (r) => r.status === 200
  });
  
  // Frontend health check
  const frontendCheck = http.get(FRONTEND_URL);
  check(frontendCheck, {
    'Frontend is accessible': (r) => r.status === 200
  });
  
  return {
    baseUrl: BASE_URL,
    frontendUrl: FRONTEND_URL
  };
}

// Main test function
export default function(data) {
  const headers = {
    'User-Agent': randomItem(userAgents),
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  
  group('API Health Checks', () => {
    testHealthEndpoints(data.baseUrl, headers);
  });
  
  group('Content Extraction Tests', () => {
    testContentExtraction(data.baseUrl, headers);
  });
  
  group('Frontend Performance', () => {
    testFrontendPerformance(data.frontendUrl, headers);
  });
  
  group('WebSocket Connectivity', () => {
    testWebSocketConnection(data.baseUrl);
  });
  
  group('Concurrent Extraction Load', () => {
    testConcurrentExtractions(data.baseUrl, headers);
  });
  
  // Realistic user behavior - random delay between actions
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

function testHealthEndpoints(baseUrl, headers) {
  // Test health endpoint
  const healthRes = http.get(`${baseUrl}/api/health`, { headers });
  check(healthRes, {
    'Health endpoint responds': (r) => r.status === 200,
    'Health response time OK': (r) => r.timings.duration < 100
  });
  
  // Test status endpoint
  const statusRes = http.get(`${baseUrl}/api/status`, { headers });
  check(statusRes, {
    'Status endpoint responds': (r) => r.status === 200
  });
  
  // Test metrics endpoint (may be restricted)
  const metricsRes = http.get(`${baseUrl}/api/metrics`, { headers });
  check(metricsRes, {
    'Metrics accessible or properly restricted': (r) => r.status === 200 || r.status === 401 || r.status === 403
  });
}

function testContentExtraction(baseUrl, headers) {
  const testUrl = randomItem(testUrls);
  const extractionType = getExtractionType(testUrl);
  
  const payload = JSON.stringify({
    url: testUrl,
    type: extractionType,
    priority: Math.random() > 0.8 ? 'high' : 'normal'
  });
  
  const startTime = Date.now();
  
  const response = http.post(`${baseUrl}/api/extract`, payload, { 
    headers,
    timeout: '30s'
  });
  
  const duration = Date.now() - startTime;
  extractionDuration.add(duration);
  
  const success = check(response, {
    'Extraction request accepted': (r) => r.status === 200 || r.status === 202,
    'Response has job ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('jobId') || body.hasOwnProperty('content');
      } catch (e) {
        return false;
      }
    }
  });
  
  extractionSuccess.add(success);
  
  // Test paywall bypass specifically for news sites
  if (testUrl.includes('nytimes.com') || testUrl.includes('wsj.com')) {
    const bypassSuccess = check(response, {
      'Paywall bypass attempted': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.bypassMethod !== undefined;
        } catch (e) {
          return false;
        }
      }
    });
    
    paywallBypassSuccess.add(bypassSuccess);
  }
  
  // If we got a job ID, check the status
  if (success && response.status === 202) {
    try {
      const responseBody = JSON.parse(response.body);
      if (responseBody.jobId) {
        sleep(1); // Wait a bit for processing
        
        const statusCheck = http.get(`${baseUrl}/api/extract/status/${responseBody.jobId}`, { headers });
        check(statusCheck, {
          'Job status check works': (r) => r.status === 200,
          'Status response valid': (r) => {
            try {
              const status = JSON.parse(r.body);
              return ['queued', 'processing', 'completed', 'failed'].includes(status.status);
            } catch (e) {
              return false;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse extraction response:', e);
    }
  }
}

function testFrontendPerformance(frontendUrl, headers) {
  // Test main page load
  const mainPageRes = http.get(frontendUrl, { headers });
  check(mainPageRes, {
    'Frontend loads successfully': (r) => r.status === 200,
    'Frontend response time OK': (r) => r.timings.duration < 2000,
    'Frontend has content': (r) => r.body.length > 1000
  });
  
  // Test static assets (if they exist)
  const staticAssetPaths = ['/static/css/main.css', '/static/js/main.js', '/favicon.ico'];
  
  staticAssetPaths.forEach(path => {
    const assetRes = http.get(`${frontendUrl}${path}`, { 
      headers,
      tags: { asset_type: path.split('.').pop() }
    });
    
    check(assetRes, {
      [`Static asset ${path} loads`]: (r) => r.status === 200 || r.status === 404,
      [`Asset ${path} cached properly`]: (r) => {
        const cacheControl = r.headers['Cache-Control'];
        return cacheControl && (cacheControl.includes('max-age') || cacheControl.includes('immutable'));
      }
    });
  });
}

function testWebSocketConnection(baseUrl) {
  const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/ws';
  
  const response = ws.connect(wsUrl, {}, function (socket) {
    websocketConnections.add(1);
    
    socket.on('open', () => {
      console.log('WebSocket connected');
      
      // Send a test message
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'extractions'
      }));
    });
    
    socket.on('message', (data) => {
      check(data, {
        'WebSocket message received': (d) => d.length > 0,
        'WebSocket message valid JSON': (d) => {
          try {
            JSON.parse(d);
            return true;
          } catch (e) {
            return false;
          }
        }
      });
    });
    
    socket.on('error', (e) => {
      console.error('WebSocket error:', e);
    });
    
    // Keep connection open for a short time
    sleep(2);
  });
  
  check(response, {
    'WebSocket connection successful': (r) => r && r.url !== undefined
  });
}

function testConcurrentExtractions(baseUrl, headers) {
  // Simulate multiple concurrent extraction requests
  const concurrentRequests = Math.floor(Math.random() * 3) + 2; // 2-4 concurrent requests
  const requests = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    const testUrl = randomItem(testUrls);
    const extractionType = getExtractionType(testUrl);
    
    const payload = JSON.stringify({
      url: testUrl + `?concurrent=${i}`,
      type: extractionType,
      priority: 'normal'
    });
    
    requests.push({
      method: 'POST',
      url: `${baseUrl}/api/extract`,
      body: payload,
      params: { headers }
    });
  }
  
  // Execute all requests concurrently
  const responses = http.batch(requests);
  
  check(responses, {
    'All concurrent requests handled': (responses) => responses.length === concurrentRequests,
    'No concurrent request failures': (responses) => {
      return responses.every(r => r.status === 200 || r.status === 202);
    }
  });
}

// Utility functions
function getExtractionType(url) {
  if (url.includes('twitter.com')) return 'tweet';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  return 'article';
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Base URL: ${data.baseUrl}`);
  console.log(`Frontend URL: ${data.frontendUrl}`);
}

// Export test configuration for k6 Cloud (optional)
export const cloudConfig = {
  name: 'Save App Load Test',
  projectID: 3537069,
  distribution: {
    distributionLabel1: { loadZone: 'amazon:us:ashburn', percent: 50 },
    distributionLabel2: { loadZone: 'amazon:eu:dublin', percent: 50 }
  }
};