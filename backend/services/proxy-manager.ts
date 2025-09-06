import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

interface Proxy {
  id: string;
  type: 'residential' | 'datacenter' | 'mobile';
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
  provider: string;
  cost: {
    perRequest: number;
    perGB: number;
    monthly: number;
  };
  stats: {
    usage: number;
    failures: number;
    successRate: number;
    avgResponseTime: number;
    lastUsed: number;
    dataUsed: number; // in bytes
    totalRequests: number;
  };
  status: 'active' | 'failed' | 'suspended' | 'maintenance';
  limits: {
    maxConcurrent: number;
    requestsPerMinute: number;
    dailyDataLimit: number; // in bytes
  };
}

interface ProxyPool {
  residential: Proxy[];
  datacenter: Proxy[];
  mobile: Proxy[];
}

interface RateLimitRule {
  domain: string;
  requests: number;
  window: number; // in milliseconds
  proxyType?: 'residential' | 'datacenter' | 'mobile';
  cooldown?: number; // cooldown period after hitting limit
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;
  proxyType?: 'residential' | 'datacenter' | 'mobile';
  userAgent?: string;
  priority?: number; // 1-10, higher is more important
}

class ProxyManager {
  private proxies: ProxyPool;
  private redis: Redis;
  private rateLimitRules: Map<string, RateLimitRule>;
  private activeConnections: Map<string, number>;
  private requestQueue: Array<{
    options: RequestOptions;
    resolve: Function;
    reject: Function;
    timestamp: number;
    priority: number;
  }>;
  private isProcessingQueue = false;

  constructor() {
    this.proxies = {
      residential: [],
      datacenter: [],
      mobile: []
    };

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    this.rateLimitRules = new Map();
    this.activeConnections = new Map();
    this.requestQueue = [];

    this.initializeProxies();
    this.setupRateLimitRules();
    this.startHealthChecker();
    this.startQueueProcessor();
  }

  /**
   * Initialize proxy pools from configuration
   */
  private async initializeProxies(): Promise<void> {
    try {
      // Load proxies from environment variables or configuration
      await this.loadBrightDataProxies();
      await this.loadDatacenterProxies();
      await this.loadMobileProxies();
      
      logger.info(`Initialized ${this.getTotalProxyCount()} proxies`);
    } catch (error) {
      logger.error('Failed to initialize proxies:', error);
    }
  }

  /**
   * Load residential proxies from Bright Data (formerly Luminati)
   */
  private async loadBrightDataProxies(): Promise<void> {
    const brightDataConfig = {
      host: process.env.BRIGHTDATA_HOST || 'zproxy.lum-superproxy.io',
      port: parseInt(process.env.BRIGHTDATA_PORT || '22225'),
      username: process.env.BRIGHTDATA_USERNAME || '',
      password: process.env.BRIGHTDATA_PASSWORD || ''
    };

    if (!brightDataConfig.username || !brightDataConfig.password) {
      logger.warn('Bright Data credentials not provided');
      return;
    }

    // Generate multiple session IDs for rotation
    for (let i = 1; i <= 10; i++) {
      const proxy: Proxy = {
        id: `brightdata_${i}`,
        type: 'residential',
        host: brightDataConfig.host,
        port: brightDataConfig.port,
        username: `${brightDataConfig.username}-session-${i}`,
        password: brightDataConfig.password,
        provider: 'BrightData',
        cost: {
          perRequest: 0.01,
          perGB: 15.00,
          monthly: 500.00
        },
        stats: {
          usage: 0,
          failures: 0,
          successRate: 1.0,
          avgResponseTime: 0,
          lastUsed: 0,
          dataUsed: 0,
          totalRequests: 0
        },
        status: 'active',
        limits: {
          maxConcurrent: 100,
          requestsPerMinute: 120,
          dailyDataLimit: 10 * 1024 * 1024 * 1024 // 10GB
        }
      };

      this.proxies.residential.push(proxy);
    }
  }

  /**
   * Load datacenter proxies
   */
  private async loadDatacenterProxies(): Promise<void> {
    const datacenterProxies = [
      { host: 'proxy1.datacenter.com', port: 8080 },
      { host: 'proxy2.datacenter.com', port: 8080 },
      { host: 'proxy3.datacenter.com', port: 8080 }
    ];

    datacenterProxies.forEach((config, index) => {
      const proxy: Proxy = {
        id: `datacenter_${index + 1}`,
        type: 'datacenter',
        host: config.host,
        port: config.port,
        provider: 'DatacenterProvider',
        cost: {
          perRequest: 0.001,
          perGB: 5.00,
          monthly: 50.00
        },
        stats: {
          usage: 0,
          failures: 0,
          successRate: 1.0,
          avgResponseTime: 0,
          lastUsed: 0,
          dataUsed: 0,
          totalRequests: 0
        },
        status: 'active',
        limits: {
          maxConcurrent: 50,
          requestsPerMinute: 300,
          dailyDataLimit: 100 * 1024 * 1024 * 1024 // 100GB
        }
      };

      this.proxies.datacenter.push(proxy);
    });
  }

  /**
   * Load mobile proxies
   */
  private async loadMobileProxies(): Promise<void> {
    // Mobile proxy configuration would go here
    // Placeholder for mobile proxy providers
    logger.info('Mobile proxies not configured');
  }

  /**
   * Set up domain-specific rate limiting rules
   */
  private setupRateLimitRules(): void {
    const rules: RateLimitRule[] = [
      {
        domain: 'twitter.com',
        requests: 30,
        window: 60000, // 1 minute
        proxyType: 'residential',
        cooldown: 300000 // 5 minutes
      },
      {
        domain: 'instagram.com',
        requests: 20,
        window: 60000,
        proxyType: 'residential',
        cooldown: 600000 // 10 minutes
      },
      {
        domain: 'linkedin.com',
        requests: 10,
        window: 60000,
        proxyType: 'residential',
        cooldown: 900000 // 15 minutes
      },
      {
        domain: 'tiktok.com',
        requests: 25,
        window: 60000,
        proxyType: 'mobile',
        cooldown: 300000
      },
      {
        domain: 'nytimes.com',
        requests: 60,
        window: 60000,
        proxyType: 'datacenter'
      },
      {
        domain: 'wsj.com',
        requests: 40,
        window: 60000,
        proxyType: 'datacenter'
      }
    ];

    rules.forEach(rule => {
      this.rateLimitRules.set(rule.domain, rule);
    });

    logger.info(`Configured rate limiting for ${rules.length} domains`);
  }

  /**
   * Get the best proxy for a domain
   */
  async getProxy(domain: string, options: { type?: 'residential' | 'datacenter' | 'mobile'; country?: string } = {}): Promise<Proxy | null> {
    const rule = this.rateLimitRules.get(domain);
    const preferredType = options.type || rule?.proxyType || 'datacenter';
    
    // Check rate limiting first
    if (!(await this.canMakeRequest(domain))) {
      throw new Error(`Rate limit exceeded for domain: ${domain}`);
    }

    const pool = this.proxies[preferredType];
    
    if (pool.length === 0) {
      logger.warn(`No ${preferredType} proxies available`);
      return null;
    }

    // Filter active proxies
    const activeProxies = pool.filter(proxy => 
      proxy.status === 'active' && 
      this.isWithinLimits(proxy) &&
      (!options.country || proxy.country === options.country)
    );

    if (activeProxies.length === 0) {
      logger.warn(`No active ${preferredType} proxies available for ${domain}`);
      return null;
    }

    // Select proxy with lowest usage and best success rate
    const bestProxy = activeProxies.reduce((best, current) => {
      const bestScore = this.calculateProxyScore(best);
      const currentScore = this.calculateProxyScore(current);
      return currentScore > bestScore ? current : best;
    });

    // Update usage stats
    this.updateProxyStats(bestProxy.id, 'usage');
    
    return bestProxy;
  }

  /**
   * Calculate proxy selection score
   */
  private calculateProxyScore(proxy: Proxy): number {
    const usageWeight = 0.4;
    const successRateWeight = 0.4;
    const responseTimeWeight = 0.2;

    const usageScore = Math.max(0, 1 - (proxy.stats.usage / proxy.limits.maxConcurrent));
    const successRateScore = proxy.stats.successRate;
    const responseTimeScore = proxy.stats.avgResponseTime > 0 
      ? Math.max(0, 1 - (proxy.stats.avgResponseTime / 5000)) // 5s max
      : 1;

    return (usageScore * usageWeight) + 
           (successRateScore * successRateWeight) + 
           (responseTimeScore * responseTimeWeight);
  }

  /**
   * Check if proxy is within its limits
   */
  private isWithinLimits(proxy: Proxy): boolean {
    const now = Date.now();
    const currentConnections = this.activeConnections.get(proxy.id) || 0;
    
    // Check concurrent connections
    if (currentConnections >= proxy.limits.maxConcurrent) {
      return false;
    }

    // Check daily data limit
    const todayStart = new Date().setHours(0, 0, 0, 0);
    if (proxy.stats.lastUsed > todayStart && 
        proxy.stats.dataUsed >= proxy.limits.dailyDataLimit) {
      return false;
    }

    // Check requests per minute (would need Redis tracking for accuracy)
    // This is a simplified check
    const recentUsage = proxy.stats.usage;
    if (recentUsage >= proxy.limits.requestsPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Check if a request can be made to a domain
   */
  private async canMakeRequest(domain: string): Promise<boolean> {
    const rule = this.rateLimitRules.get(domain);
    if (!rule) return true;

    const key = `ratelimit:${domain}`;
    const current = await this.redis.get(key);
    
    if (!current) {
      await this.redis.setex(key, Math.ceil(rule.window / 1000), '1');
      return true;
    }

    const count = parseInt(current);
    if (count >= rule.requests) {
      return false;
    }

    await this.redis.incr(key);
    return true;
  }

  /**
   * Make HTTP request through proxy
   */
  async makeRequest(options: RequestOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: options.priority || 5
      });

      // Sort queue by priority
      this.requestQueue.sort((a, b) => b.priority - a.priority);
    });
  }

  /**
   * Process request queue
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessingQueue || this.requestQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;

      try {
        const batchSize = Math.min(10, this.requestQueue.length);
        const batch = this.requestQueue.splice(0, batchSize);

        await Promise.all(batch.map(item => this.executeRequest(item)));
      } catch (error) {
        logger.error('Queue processing error:', error);
      } finally {
        this.isProcessingQueue = false;
      }
    }, 100); // Process queue every 100ms
  }

  /**
   * Execute individual request
   */
  private async executeRequest(item: {
    options: RequestOptions;
    resolve: Function;
    reject: Function;
    timestamp: number;
    priority: number;
  }): Promise<void> {
    const { options, resolve, reject } = item;
    const startTime = Date.now();
    
    try {
      const domain = new URL(options.url).hostname;
      const proxy = await this.getProxy(domain, { type: options.proxyType });
      
      if (!proxy) {
        throw new Error(`No proxy available for domain: ${domain}`);
      }

      const proxyAgent = proxy.host.startsWith('https') 
        ? new HttpsProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`)
        : new HttpProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`);

      // Track active connection
      const currentConnections = this.activeConnections.get(proxy.id) || 0;
      this.activeConnections.set(proxy.id, currentConnections + 1);

      const response = await fetch(options.url, {
        method: options.method || 'GET',
        headers: {
          'User-Agent': options.userAgent || this.getRandomUserAgent(),
          ...options.headers
        },
        body: options.body,
        agent: proxyAgent,
        timeout: options.timeout || 30000
      });

      // Update proxy stats
      const responseTime = Date.now() - startTime;
      this.updateProxyStats(proxy.id, 'success', responseTime, response.headers.get('content-length'));

      // Release connection
      this.activeConnections.set(proxy.id, Math.max(0, currentConnections));

      const data = await response.text();
      resolve({ status: response.status, headers: response.headers, data });

    } catch (error) {
      // Update failure stats
      if (item.options.proxyType) {
        // Find the proxy that was used and update its failure count
        const domain = new URL(options.url).hostname;
        const proxy = await this.getProxy(domain, { type: options.proxyType });
        if (proxy) {
          this.updateProxyStats(proxy.id, 'failure');
        }
      }

      reject(error);
    }
  }

  /**
   * Update proxy statistics
   */
  private updateProxyStats(
    proxyId: string, 
    type: 'usage' | 'success' | 'failure', 
    responseTime?: number, 
    dataSize?: string | null
  ): void {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) return;

    switch (type) {
      case 'usage':
        proxy.stats.usage++;
        proxy.stats.lastUsed = Date.now();
        break;
      
      case 'success':
        proxy.stats.totalRequests++;
        proxy.stats.usage = Math.max(0, proxy.stats.usage - 1);
        
        if (responseTime) {
          proxy.stats.avgResponseTime = 
            (proxy.stats.avgResponseTime + responseTime) / 2;
        }
        
        if (dataSize) {
          proxy.stats.dataUsed += parseInt(dataSize) || 0;
        }
        
        proxy.stats.successRate = 
          (proxy.stats.totalRequests - proxy.stats.failures) / proxy.stats.totalRequests;
        break;
      
      case 'failure':
        proxy.stats.failures++;
        proxy.stats.usage = Math.max(0, proxy.stats.usage - 1);
        
        if (proxy.stats.totalRequests > 0) {
          proxy.stats.successRate = 
            (proxy.stats.totalRequests - proxy.stats.failures) / proxy.stats.totalRequests;
        }
        
        // Suspend proxy if failure rate is too high
        if (proxy.stats.failures > 5 && proxy.stats.successRate < 0.5) {
          proxy.status = 'failed';
          logger.warn(`Proxy ${proxyId} suspended due to high failure rate`);
        }
        break;
    }
  }

  /**
   * Find proxy by ID
   */
  private findProxyById(id: string): Proxy | null {
    for (const pool of Object.values(this.proxies)) {
      const proxy = pool.find(p => p.id === id);
      if (proxy) return proxy;
    }
    return null;
  }

  /**
   * Health check for all proxies
   */
  private startHealthChecker(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform health check on all proxies
   */
  private async performHealthCheck(): Promise<void> {
    const testUrl = 'http://httpbin.org/ip';
    
    for (const pool of Object.values(this.proxies)) {
      for (const proxy of pool) {
        if (proxy.status === 'maintenance') continue;
        
        try {
          const startTime = Date.now();
          await this.testProxy(proxy, testUrl);
          const responseTime = Date.now() - startTime;
          
          proxy.status = 'active';
          proxy.stats.avgResponseTime = 
            (proxy.stats.avgResponseTime + responseTime) / 2;
          
        } catch (error) {
          logger.warn(`Health check failed for proxy ${proxy.id}:`, error);
          proxy.status = 'failed';
        }
      }
    }
  }

  /**
   * Test individual proxy
   */
  private async testProxy(proxy: Proxy, testUrl: string): Promise<void> {
    const proxyAgent = new HttpProxyAgent(
      `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    );

    const response = await fetch(testUrl, {
      agent: proxyAgent,
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  /**
   * Get random user agent
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Get proxy statistics
   */
  getStats(): {
    total: number;
    active: number;
    failed: number;
    byType: Record<string, number>;
    totalRequests: number;
    totalCost: number;
  } {
    const stats = {
      total: this.getTotalProxyCount(),
      active: 0,
      failed: 0,
      byType: { residential: 0, datacenter: 0, mobile: 0 },
      totalRequests: 0,
      totalCost: 0
    };

    for (const [type, pool] of Object.entries(this.proxies)) {
      stats.byType[type] = pool.length;
      
      for (const proxy of pool) {
        if (proxy.status === 'active') stats.active++;
        if (proxy.status === 'failed') stats.failed++;
        
        stats.totalRequests += proxy.stats.totalRequests;
        stats.totalCost += proxy.stats.totalRequests * proxy.cost.perRequest;
        stats.totalCost += proxy.stats.dataUsed * (proxy.cost.perGB / (1024 * 1024 * 1024));
      }
    }

    return stats;
  }

  /**
   * Get total proxy count
   */
  private getTotalProxyCount(): number {
    return this.proxies.residential.length + 
           this.proxies.datacenter.length + 
           this.proxies.mobile.length;
  }

  /**
   * Manual proxy override for specific domains
   */
  setManualOverride(domain: string, proxyId: string): void {
    // Implementation for manual proxy assignment
    logger.info(`Manual override set for ${domain} to use proxy ${proxyId}`);
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

export default ProxyManager;
export { Proxy, RequestOptions, RateLimitRule };