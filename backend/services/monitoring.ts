import * as prometheus from 'prom-client';
import { logger } from '../utils/logger';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

// Register default metrics
const register = new prometheus.Registry();

// Add default metrics
prometheus.collectDefaultMetrics({
  register,
  prefix: 'save_app_',
});

// Custom metrics for Save App
export const extractionMetrics = {
  // Extraction success counter
  success: new prometheus.Counter({
    name: 'save_extraction_success_total',
    help: 'Total successful content extractions',
    labelNames: ['type', 'method', 'domain'],
    registers: [register]
  }),

  // Extraction failure counter
  failure: new prometheus.Counter({
    name: 'save_extraction_failure_total',
    help: 'Total failed content extractions',
    labelNames: ['type', 'method', 'domain', 'error_type'],
    registers: [register]
  }),

  // Extraction duration histogram
  duration: new prometheus.Histogram({
    name: 'save_extraction_duration_seconds',
    help: 'Content extraction duration in seconds',
    labelNames: ['type', 'method'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register]
  }),

  // Queue size gauge
  queueSize: new prometheus.Gauge({
    name: 'save_extraction_queue_size',
    help: 'Current number of items in extraction queue',
    registers: [register]
  })
};

export const apiMetrics = {
  // HTTP request counter
  requests: new prometheus.Counter({
    name: 'save_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
  }),

  // HTTP request duration
  requestDuration: new prometheus.Histogram({
    name: 'save_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 2.0, 5.0],
    registers: [register]
  }),

  // Active connections gauge
  activeConnections: new prometheus.Gauge({
    name: 'save_http_active_connections',
    help: 'Current number of active HTTP connections',
    registers: [register]
  })
};

export const cacheMetrics = {
  // Cache hit counter
  hits: new prometheus.Counter({
    name: 'save_cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['tier', 'key_type'],
    registers: [register]
  }),

  // Cache miss counter
  misses: new prometheus.Counter({
    name: 'save_cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['tier', 'key_type'],
    registers: [register]
  }),

  // Cache operation duration
  operationDuration: new prometheus.Histogram({
    name: 'save_cache_operation_duration_seconds',
    help: 'Cache operation duration in seconds',
    labelNames: ['operation', 'tier'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
    registers: [register]
  }),

  // Cache size gauge
  size: new prometheus.Gauge({
    name: 'save_cache_size_bytes',
    help: 'Current cache size in bytes',
    labelNames: ['tier'],
    registers: [register]
  })
};

export const databaseMetrics = {
  // Database query counter
  queries: new prometheus.Counter({
    name: 'save_database_queries_total',
    help: 'Total database queries',
    labelNames: ['operation', 'table'],
    registers: [register]
  }),

  // Database query duration
  queryDuration: new prometheus.Histogram({
    name: 'save_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
    registers: [register]
  }),

  // Database connections gauge
  connections: new prometheus.Gauge({
    name: 'save_database_connections',
    help: 'Current number of database connections',
    registers: [register]
  }),

  // Database size gauge
  size: new prometheus.Gauge({
    name: 'save_database_size_bytes',
    help: 'Database size in bytes',
    registers: [register]
  })
};

export const userMetrics = {
  // Active users gauge
  activeUsers: new prometheus.Gauge({
    name: 'save_active_users',
    help: 'Current number of active users',
    labelNames: ['timeframe'],
    registers: [register]
  }),

  // User actions counter
  actions: new prometheus.Counter({
    name: 'save_user_actions_total',
    help: 'Total user actions',
    labelNames: ['action_type', 'user_type'],
    registers: [register]
  }),

  // Content saves counter
  saves: new prometheus.Counter({
    name: 'save_content_saves_total',
    help: 'Total content saves',
    labelNames: ['content_type', 'source_domain'],
    registers: [register]
  })
};

export const businessMetrics = {
  // Revenue counter (if applicable)
  revenue: new prometheus.Counter({
    name: 'save_revenue_total',
    help: 'Total revenue in cents',
    labelNames: ['plan_type', 'billing_period'],
    registers: [register]
  }),

  // Subscription gauge
  subscriptions: new prometheus.Gauge({
    name: 'save_active_subscriptions',
    help: 'Current number of active subscriptions',
    labelNames: ['plan_type'],
    registers: [register]
  }),

  // User retention rate
  retention: new prometheus.Gauge({
    name: 'save_user_retention_rate',
    help: 'User retention rate percentage',
    labelNames: ['period'],
    registers: [register]
  })
};

class MonitoringService {
  private metricsCollectionInterval?: NodeJS.Timeout;

  constructor() {
    this.startPeriodicCollection();
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicCollection(): void {
    // Collect system metrics every 30 seconds
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectSystemMetrics();
      await this.collectBusinessMetrics();
    }, 30000);

    logger.info('Started periodic metrics collection');
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      // Update system metrics
      register.getSingleMetric('save_app_process_resident_memory_bytes')?.set(memUsage.rss);
      register.getSingleMetric('save_app_process_heap_bytes')?.set(memUsage.heapUsed);

      // Custom system metrics
      const systemMemoryUsage = new prometheus.Gauge({
        name: 'save_system_memory_usage_ratio',
        help: 'System memory usage ratio',
        registers: [register]
      });
      systemMemoryUsage.set((totalMem - freeMem) / totalMem);

      // CPU usage (approximation)
      const cpuUsage = process.cpuUsage();
      const cpuGauge = new prometheus.Gauge({
        name: 'save_process_cpu_usage_ratio',
        help: 'Process CPU usage ratio',
        registers: [register]
      });
      
      // Calculate CPU usage percentage (simplified)
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / (process.uptime() * 1000000);
      cpuGauge.set(Math.min(cpuPercent, 1.0));

    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      // This would typically query the database for business metrics
      // For now, we'll simulate some metrics
      
      // Simulate active users
      userMetrics.activeUsers.set({ timeframe: '1h' }, Math.floor(Math.random() * 1000) + 100);
      userMetrics.activeUsers.set({ timeframe: '24h' }, Math.floor(Math.random() * 5000) + 1000);
      userMetrics.activeUsers.set({ timeframe: '7d' }, Math.floor(Math.random() * 20000) + 5000);

    } catch (error) {
      logger.error('Failed to collect business metrics:', error);
    }
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics in JSON format for dashboards
   */
  async getMetricsJSON(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Health check endpoint
   */
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    memory: any;
    database: boolean;
    cache: boolean;
    dependencies: any;
  }> {
    try {
      const memUsage = process.memoryUsage();
      
      // Check database health
      const dbHealthy = await this.checkDatabaseHealth();
      
      // Check cache health
      const cacheHealthy = await this.checkCacheHealth();
      
      // Check dependencies
      const dependencies = await this.checkDependencies();

      const isHealthy = dbHealthy && cacheHealthy && 
                       Object.values(dependencies).every(status => status === 'healthy');

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        },
        database: dbHealthy,
        cache: cacheHealthy,
        dependencies
      };

    } catch (error) {
      logger.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: false,
        cache: false,
        dependencies: {}
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // This would check database connectivity
      // For now, return true as placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<boolean> {
    try {
      // This would check Redis connectivity
      // For now, return true as placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check external dependencies
   */
  private async checkDependencies(): Promise<Record<string, 'healthy' | 'unhealthy'>> {
    const dependencies: Record<string, 'healthy' | 'unhealthy'> = {};

    // Check external services
    const services = [
      'aws_s3',
      'bright_data_proxy',
      'openai_api',
      'external_apis'
    ];

    for (const service of services) {
      try {
        // This would make actual health check requests
        // For now, simulate health status
        dependencies[service] = Math.random() > 0.1 ? 'healthy' : 'unhealthy';
      } catch (error) {
        dependencies[service] = 'unhealthy';
      }
    }

    return dependencies;
  }

  /**
   * Create custom metric
   */
  createCustomMetric(
    type: 'counter' | 'gauge' | 'histogram',
    name: string,
    help: string,
    labelNames: string[] = []
  ): prometheus.Counter<string> | prometheus.Gauge<string> | prometheus.Histogram<string> {
    const config = {
      name: `save_${name}`,
      help,
      labelNames,
      registers: [register]
    };

    switch (type) {
      case 'counter':
        return new prometheus.Counter(config);
      case 'gauge':
        return new prometheus.Gauge(config);
      case 'histogram':
        return new prometheus.Histogram({
          ...config,
          buckets: [0.001, 0.01, 0.1, 1, 10]
        });
      default:
        throw new Error(`Unknown metric type: ${type}`);
    }
  }

  /**
   * Record extraction metrics
   */
  recordExtraction(
    success: boolean,
    type: string,
    method: string,
    domain: string,
    duration: number,
    errorType?: string
  ): void {
    if (success) {
      extractionMetrics.success.inc({ type, method, domain });
    } else {
      extractionMetrics.failure.inc({ type, method, domain, error_type: errorType || 'unknown' });
    }
    
    extractionMetrics.duration.observe({ type, method }, duration);
  }

  /**
   * Record API metrics
   */
  recordAPIRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    apiMetrics.requests.inc({ method, route, status_code: statusCode.toString() });
    apiMetrics.requestDuration.observe({ method, route }, duration);
  }

  /**
   * Record cache metrics
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    tier: string,
    keyType: string,
    hit: boolean,
    duration: number
  ): void {
    if (operation === 'get') {
      if (hit) {
        cacheMetrics.hits.inc({ tier, key_type: keyType });
      } else {
        cacheMetrics.misses.inc({ tier, key_type: keyType });
      }
    }
    
    cacheMetrics.operationDuration.observe({ operation, tier }, duration);
  }

  /**
   * Record user action
   */
  recordUserAction(actionType: string, userType: string = 'standard'): void {
    userMetrics.actions.inc({ action_type: actionType, user_type: userType });
  }

  /**
   * Record content save
   */
  recordContentSave(contentType: string, sourceDomain: string): void {
    userMetrics.saves.inc({ content_type: contentType, source_domain: sourceDomain });
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }
    
    register.clear();
    logger.info('Stopped monitoring service');
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;
export { register, MonitoringService };