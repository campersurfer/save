import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * k6 Spike Testing for Save App
 * Tests system behavior under sudden traffic spikes
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Custom metrics for spike testing
const spikeRecovery = new Rate('spike_recovery_rate');
const spikeLatency = new Trend('spike_latency');

export const options = {
  stages: [
    // Normal load
    { duration: '2m', target: 10 },
    
    // Sudden spike to 10x normal load
    { duration: '30s', target: 100 },
    
    // Hold spike
    { duration: '1m', target: 100 },
    
    // Sudden drop
    { duration: '30s', target: 10 },
    
    // Recovery period
    { duration: '3m', target: 10 },
    
    // Second spike - even higher
    { duration: '30s', target: 200 },
    
    // Hold extreme spike
    { duration: '1m', target: 200 },
    
    // Recovery
    { duration: '2m', target: 0 }
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Relaxed during spikes
    http_req_failed: ['rate<0.05'],    // Allow slightly higher error rate
    spike_recovery_rate: ['rate>0.8'], // System should recover well
    spike_latency: ['p(90)<2000']      // Spike latency target
  }
};

export default function() {
  const startTime = Date.now();
  
  group('Basic API Load', () => {
    const response = http.get(`${BASE_URL}/api/health`);
    const latency = Date.now() - startTime;
    
    spikeLatency.add(latency);
    
    const success = check(response, {
      'Health endpoint responds during spike': (r) => r.status === 200,
      'Response time acceptable during spike': (r) => r.timings.duration < 2000
    });
    
    spikeRecovery.add(success);
  });
  
  group('Extraction Load', () => {
    const payload = JSON.stringify({
      url: 'https://www.example.com/spike-test',
      type: 'article'
    });
    
    const response = http.post(`${BASE_URL}/api/extract`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    check(response, {
      'Extraction handles spike': (r) => r.status === 200 || r.status === 202 || r.status === 429,
      'No server errors during spike': (r) => r.status < 500
    });
  });
  
  // Minimal sleep to maximize load
  sleep(0.1);
}

export function teardown() {
  console.log('Spike test completed - checking for system recovery');
}