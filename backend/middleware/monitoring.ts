import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import client from 'prom-client';
import os from 'os';

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status', 'route'],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'status', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const extractionTotal = new client.Counter({
  name: 'extraction_total',
  help: 'Total extractions attempted',
  labelNames: ['type', 'source'],
});

const extractionSuccess = new client.Counter({
  name: 'extraction_success_total',
  help: 'Total successful extractions',
  labelNames: ['type', 'source'],
});

const extractionFailures = new client.Counter({
  name: 'extraction_failures_total',
  help: 'Total failed extractions',
  labelNames: ['type', 'source', 'reason'],
});

const extractionDuration = new client.Histogram({
  name: 'extraction_duration_seconds',
  help: 'Extraction duration in seconds',
  labelNames: ['type', 'source'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
});

const queueLength = new client.Gauge({
  name: 'queue_length',
  help: 'Current queue length',
  labelNames: ['queue_name'],
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
});

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type'],
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Register metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(extractionTotal);
register.registerMetric(extractionSuccess);
register.registerMetric(extractionFailures);
register.registerMetric(extractionDuration);
register.registerMetric(queueLength);
register.registerMetric(activeConnections);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(dbQueryDuration);

// HTTP request monitoring middleware
export const httpMetrics = (req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (performance.now() - start) / 1000;
    const labels = {
      method: req.method,
      status: res.statusCode.toString(),
      route: route,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
};

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private connectionCount = 0;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Track extraction metrics
  trackExtraction(type: string, source: string) {
    extractionTotal.inc({ type, source });
    return performance.now();
  }

  trackExtractionSuccess(type: string, source: string, startTime: number) {
    const duration = (performance.now() - startTime) / 1000;
    extractionSuccess.inc({ type, source });
    extractionDuration.observe({ type, source }, duration);
  }

  trackExtractionFailure(type: string, source: string, reason: string) {
    extractionFailures.inc({ type, source, reason });
  }

  // Track queue metrics
  updateQueueLength(queueName: string, length: number) {
    queueLength.set({ queue_name: queueName }, length);
  }

  // Track connection metrics
  incrementConnections() {
    this.connectionCount++;
    activeConnections.set(this.connectionCount);
  }

  decrementConnections() {
    this.connectionCount--;
    activeConnections.set(this.connectionCount);
  }

  // Track cache metrics
  trackCacheHit(cacheType: string) {
    cacheHits.inc({ cache_type: cacheType });
  }

  trackCacheMiss(cacheType: string) {
    cacheMisses.inc({ cache_type: cacheType });
  }

  // Track database metrics
  trackDbQuery(operation: string, table: string) {
    return performance.now();
  }

  trackDbQueryComplete(operation: string, table: string, startTime: number) {
    const duration = (performance.now() - startTime) / 1000;
    dbQueryDuration.observe({ operation, table }, duration);
  }

  // Get metrics endpoint
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

// Health check endpoint with detailed metrics
export const healthCheck = async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const loadAverage = os.loadavg();
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      heapUsedPercentage: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
      userPercentage: ((cpuUsage.user / (cpuUsage.user + cpuUsage.system)) * 100).toFixed(2),
    },
    system: {
      loadAverage: loadAverage,
      freeMemory: freeMemory,
      totalMemory: totalMemory,
      memoryUsagePercentage: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2),
      platform: os.platform(),
      arch: os.arch(),
    },
  };

  // Set health status based on thresholds
  if (
    parseFloat(health.memory.heapUsedPercentage) > 90 ||
    parseFloat(health.system.memoryUsagePercentage) > 90 ||
    loadAverage[0] > os.cpus().length * 2
  ) {
    health.status = 'unhealthy';
    res.status(503);
  }

  res.json(health);
};

// Metrics endpoint
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    const metrics = await PerformanceMonitor.getInstance().getMetrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    console.error('Failed to get metrics:', error);
    res.status(500).send('Failed to get metrics');
  }
};

// APM integration for popular services
export class APMIntegration {
  private static instance: APMIntegration;
  
  static getInstance(): APMIntegration {
    if (!APMIntegration.instance) {
      APMIntegration.instance = new APMIntegration();
    }
    return APMIntegration.instance;
  }

  // Initialize APM based on configuration
  initialize() {
    const apmProvider = process.env.APM_PROVIDER;
    
    switch (apmProvider) {
      case 'newrelic':
        this.initializeNewRelic();
        break;
      case 'datadog':
        this.initializeDatadog();
        break;
      case 'elastic':
        this.initializeElasticAPM();
        break;
      default:
        console.log('No APM provider configured');
    }
  }

  private initializeNewRelic() {
    try {
      require('newrelic');
      console.log('New Relic APM initialized');
    } catch (error) {
      console.error('Failed to initialize New Relic APM:', error);
    }
  }

  private initializeDatadog() {
    try {
      const tracer = require('dd-trace').init({
        service: 'save-app-backend',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
      });
      console.log('Datadog APM initialized');
    } catch (error) {
      console.error('Failed to initialize Datadog APM:', error);
    }
  }

  private initializeElasticAPM() {
    try {
      const apm = require('elastic-apm-node').start({
        serviceName: 'save-app-backend',
        environment: process.env.NODE_ENV || 'development',
        serviceVersion: process.env.APP_VERSION || '1.0.0',
        serverUrl: process.env.ELASTIC_APM_SERVER_URL || 'http://localhost:8200',
        captureBody: 'all',
        captureHeaders: true,
        metricsInterval: '10s',
        transactionSampleRate: 1.0,
      });
      console.log('Elastic APM initialized');
    } catch (error) {
      console.error('Failed to initialize Elastic APM:', error);
    }
  }

  // Custom transaction tracking
  trackTransaction(name: string, type: string, callback: () => Promise<any>) {
    const apmProvider = process.env.APM_PROVIDER;
    
    if (apmProvider === 'elastic') {
      const apm = require('elastic-apm-node');
      return apm.startTransaction(name, type, callback);
    } else if (apmProvider === 'newrelic') {
      const newrelic = require('newrelic');
      return newrelic.startWebTransaction(name, callback);
    } else if (apmProvider === 'datadog') {
      const tracer = require('dd-trace');
      const span = tracer.startSpan(name, { tags: { type } });
      return callback().finally(() => span.finish());
    } else {
      return callback();
    }
  }

  // Error tracking
  recordError(error: Error, context?: any) {
    const apmProvider = process.env.APM_PROVIDER;
    
    if (apmProvider === 'elastic') {
      const apm = require('elastic-apm-node');
      apm.captureError(error, context);
    } else if (apmProvider === 'newrelic') {
      const newrelic = require('newrelic');
      newrelic.recordCustomEvent('Error', { error: error.message, ...context });
    } else if (apmProvider === 'datadog') {
      const tracer = require('dd-trace');
      const span = tracer.scope().active();
      if (span) {
        span.setTag('error', true);
        span.log({ error: error.message, ...context });
      }
    }
    
    console.error('Error recorded:', error.message, context);
  }
}

export default PerformanceMonitor;