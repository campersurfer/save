import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  requests: number;
  window: number; // milliseconds
  burst?: number; // allow burst requests
  cooldown?: number; // cooldown period after limit hit
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

class RateLimiter {
  private redis: Redis;
  private buckets: Map<string, TokenBucket>;
  private defaultOptions: RateLimitOptions;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    this.buckets = new Map();
    
    this.defaultOptions = {
      requests: 60,
      window: 60000, // 1 minute
      burst: 10,
      cooldown: 300000 // 5 minutes
    };
  }

  /**
   * Check if request is allowed (token bucket algorithm)
   */
  async checkLimit(
    key: string, 
    options: RateLimitOptions = this.defaultOptions
  ): Promise<RateLimitResult> {
    const bucket = this.getBucket(key, options);
    const now = Date.now();
    
    // Refill tokens based on time elapsed
    this.refillTokens(bucket, now);
    
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      
      // Store bucket state in Redis for persistence
      await this.storeBucket(key, bucket);
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: this.calculateResetTime(bucket, options)
      };
    }
    
    // Request denied - calculate retry after
    const retryAfter = this.calculateRetryAfter(bucket, options);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: this.calculateResetTime(bucket, options),
      retryAfter
    };
  }

  /**
   * Get or create token bucket for key
   */
  private getBucket(key: string, options: RateLimitOptions): TokenBucket {
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      const refillRate = options.requests / (options.window / 1000);
      
      bucket = {
        tokens: options.requests,
        lastRefill: Date.now(),
        capacity: options.requests,
        refillRate
      };
      
      this.buckets.set(key, bucket);
    }
    
    return bucket;
  }

  /**
   * Refill tokens in bucket based on elapsed time
   */
  private refillTokens(bucket: TokenBucket, now: number): void {
    const timeSinceRefill = now - bucket.lastRefill;
    const tokensToAdd = (timeSinceRefill / 1000) * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Calculate when the bucket will reset
   */
  private calculateResetTime(bucket: TokenBucket, options: RateLimitOptions): number {
    const timeToFull = ((bucket.capacity - bucket.tokens) / bucket.refillRate) * 1000;
    return Date.now() + timeToFull;
  }

  /**
   * Calculate retry after time
   */
  private calculateRetryAfter(bucket: TokenBucket, options: RateLimitOptions): number {
    const timeToNextToken = (1 / bucket.refillRate) * 1000;
    return Math.ceil(timeToNextToken / 1000);
  }

  /**
   * Store bucket state in Redis
   */
  private async storeBucket(key: string, bucket: TokenBucket): Promise<void> {
    try {
      await this.redis.setex(
        `bucket:${key}`,
        3600, // 1 hour TTL
        JSON.stringify({
          tokens: bucket.tokens,
          lastRefill: bucket.lastRefill,
          capacity: bucket.capacity,
          refillRate: bucket.refillRate
        })
      );
    } catch (error) {
      logger.error('Failed to store bucket state:', error);
    }
  }

  /**
   * Load bucket state from Redis
   */
  private async loadBucket(key: string): Promise<TokenBucket | null> {
    try {
      const data = await this.redis.get(`bucket:${key}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to load bucket state:', error);
    }
    return null;
  }

  /**
   * Domain-specific rate limiting
   */
  async checkDomainLimit(domain: string, proxyType?: string): Promise<RateLimitResult> {
    const domainLimits = this.getDomainLimits(domain);
    const key = proxyType ? `${domain}:${proxyType}` : domain;
    
    return this.checkLimit(key, domainLimits);
  }

  /**
   * Get domain-specific limits
   */
  private getDomainLimits(domain: string): RateLimitOptions {
    const limits: { [key: string]: RateLimitOptions } = {
      'twitter.com': {
        requests: 30,
        window: 60000,
        burst: 5,
        cooldown: 300000
      },
      'instagram.com': {
        requests: 20,
        window: 60000,
        burst: 3,
        cooldown: 600000
      },
      'linkedin.com': {
        requests: 10,
        window: 60000,
        burst: 2,
        cooldown: 900000
      },
      'tiktok.com': {
        requests: 25,
        window: 60000,
        burst: 5,
        cooldown: 300000
      },
      'nytimes.com': {
        requests: 60,
        window: 60000,
        burst: 10
      },
      'wsj.com': {
        requests: 40,
        window: 60000,
        burst: 8
      },
      'washingtonpost.com': {
        requests: 30,
        window: 60000,
        burst: 6
      },
      'archive.is': {
        requests: 10,
        window: 60000,
        burst: 2,
        cooldown: 1800000 // 30 minutes
      }
    };

    return limits[domain] || this.defaultOptions;
  }

  /**
   * Sliding window rate limiter (Redis-based)
   */
  async checkSlidingWindow(
    key: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - window;
    const redisKey = `sliding:${key}`;
    
    try {
      // Remove expired entries
      await this.redis.zremrangebyscore(redisKey, '-inf', windowStart);
      
      // Count current requests
      const current = await this.redis.zcard(redisKey);
      
      if (current < limit) {
        // Add current request
        await this.redis.zadd(redisKey, now, `${now}-${Math.random()}`);
        await this.redis.expire(redisKey, Math.ceil(window / 1000));
        
        return {
          allowed: true,
          remaining: limit - current - 1,
          resetTime: now + window
        };
      }
      
      // Get oldest request time to calculate retry after
      const oldest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const retryAfter = oldest.length > 0 
        ? Math.ceil((parseInt(oldest[1]) + window - now) / 1000)
        : Math.ceil(window / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + window,
        retryAfter
      };
      
    } catch (error) {
      logger.error('Sliding window rate limit error:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + window
      };
    }
  }

  /**
   * Hierarchical rate limiting (IP -> User -> API Key)
   */
  async checkHierarchicalLimit(
    ip: string,
    userId?: string,
    apiKey?: string
  ): Promise<{ level: string; result: RateLimitResult }> {
    // Check IP limit first (most restrictive)
    const ipResult = await this.checkLimit(`ip:${ip}`, {
      requests: 100,
      window: 60000
    });
    
    if (!ipResult.allowed) {
      return { level: 'ip', result: ipResult };
    }
    
    // Check user limit if user is authenticated
    if (userId) {
      const userResult = await this.checkLimit(`user:${userId}`, {
        requests: 1000,
        window: 60000
      });
      
      if (!userResult.allowed) {
        return { level: 'user', result: userResult };
      }
    }
    
    // Check API key limit if provided
    if (apiKey) {
      const apiResult = await this.checkLimit(`api:${apiKey}`, {
        requests: 10000,
        window: 60000
      });
      
      if (!apiResult.allowed) {
        return { level: 'api', result: apiResult };
      }
    }
    
    return { 
      level: 'allowed', 
      result: { 
        allowed: true, 
        remaining: 999, 
        resetTime: Date.now() + 60000 
      } 
    };
  }

  /**
   * Adaptive rate limiting based on system load
   */
  async checkAdaptiveLimit(
    key: string,
    baseLimit: number,
    systemLoad: number // 0.0 to 1.0
  ): Promise<RateLimitResult> {
    // Reduce limit based on system load
    const adaptedLimit = Math.floor(baseLimit * (1 - systemLoad * 0.5));
    
    return this.checkLimit(key, {
      requests: Math.max(1, adaptedLimit),
      window: 60000
    });
  }

  /**
   * Burst handling with penalty
   */
  async checkBurstLimit(
    key: string,
    options: RateLimitOptions & { penaltyMultiplier?: number }
  ): Promise<RateLimitResult> {
    const penaltyKey = `penalty:${key}`;
    const penaltyMultiplier = options.penaltyMultiplier || 2;
    
    // Check if user is in penalty period
    const penalty = await this.redis.get(penaltyKey);
    if (penalty) {
      const penaltyEnd = parseInt(penalty);
      if (Date.now() < penaltyEnd) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: penaltyEnd,
          retryAfter: Math.ceil((penaltyEnd - Date.now()) / 1000)
        };
      }
    }
    
    // Check normal limit
    const result = await this.checkLimit(key, options);
    
    // If burst limit exceeded, apply penalty
    if (!result.allowed && options.burst) {
      const penaltyDuration = (options.cooldown || 300000) * penaltyMultiplier;
      const penaltyEnd = Date.now() + penaltyDuration;
      
      await this.redis.setex(
        penaltyKey,
        Math.ceil(penaltyDuration / 1000),
        penaltyEnd.toString()
      );
      
      return {
        ...result,
        retryAfter: Math.ceil(penaltyDuration / 1000)
      };
    }
    
    return result;
  }

  /**
   * Get rate limit statistics
   */
  async getStats(pattern: string = '*'): Promise<{
    totalBuckets: number;
    activeBuckets: number;
    totalRequests: number;
    blockedRequests: number;
  }> {
    try {
      const keys = await this.redis.keys(`bucket:${pattern}`);
      const stats = {
        totalBuckets: keys.length,
        activeBuckets: 0,
        totalRequests: 0,
        blockedRequests: 0
      };
      
      for (const key of keys) {
        const bucket = await this.loadBucket(key.replace('bucket:', ''));
        if (bucket && bucket.tokens < bucket.capacity) {
          stats.activeBuckets++;
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get rate limit stats:', error);
      return {
        totalBuckets: 0,
        activeBuckets: 0,
        totalRequests: 0,
        blockedRequests: 0
      };
    }
  }

  /**
   * Reset rate limit for key
   */
  async resetLimit(key: string): Promise<void> {
    this.buckets.delete(key);
    await this.redis.del(`bucket:${key}`);
    await this.redis.del(`sliding:${key}`);
    await this.redis.del(`penalty:${key}`);
  }

  /**
   * Clean up expired buckets
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, bucket] of this.buckets.entries()) {
      // Remove buckets that haven't been used for over an hour
      if (now - bucket.lastRefill > 3600000) {
        this.buckets.delete(key);
        await this.redis.del(`bucket:${key}`);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

export default RateLimiter;
export { RateLimitOptions, RateLimitResult };