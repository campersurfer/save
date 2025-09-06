import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Pool, PoolClient } from 'pg';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  skipLevels?: ('memory' | 'redis' | 'database' | 's3')[];
}

interface CacheStats {
  hits: { memory: number; redis: number; database: number; s3: number };
  misses: number;
  hitRate: number;
  totalRequests: number;
}

interface CacheItem {
  data: any;
  metadata: {
    url: string;
    contentType?: string;
    size: number;
    compressed: boolean;
    createdAt: number;
    expiresAt?: number;
    checksum: string;
    accessCount: number;
    lastAccessed: number;
  };
}

class MultiTierCache {
  private redis: Redis;
  private postgres: Pool;
  private s3: S3Client;
  private memoryCache: NodeCache;
  private stats: CacheStats;
  private deduplicationMap = new Map<string, string>();
  
  constructor() {
    // Initialize Redis (L1 - Hot Cache)
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    // Initialize PostgreSQL (L2 - Warm Cache)
    this.postgres = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'save_cache',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 20
    });

    // Initialize S3 (L3 - Cold Storage)
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    // Memory cache for frequently accessed items
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // Check for expired keys every minute
      maxKeys: 1000
    });

    this.stats = {
      hits: { memory: 0, redis: 0, database: 0, s3: 0 },
      misses: 0,
      hitRate: 0,
      totalRequests: 0
    };

    this.initializeDatabase();
  }

  /**
   * Initialize PostgreSQL cache tables
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.postgres.query(`
        CREATE TABLE IF NOT EXISTS cached_content (
          url VARCHAR(2048) PRIMARY KEY,
          data_hash VARCHAR(64) NOT NULL,
          metadata JSONB NOT NULL,
          s3_key VARCHAR(1024),
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          access_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP DEFAULT NOW(),
          size_bytes INTEGER NOT NULL,
          compressed BOOLEAN DEFAULT FALSE
        );
        
        CREATE INDEX IF NOT EXISTS idx_cached_content_expires ON cached_content(expires_at);
        CREATE INDEX IF NOT EXISTS idx_cached_content_hash ON cached_content(data_hash);
        CREATE INDEX IF NOT EXISTS idx_cached_content_accessed ON cached_content(last_accessed);
        CREATE INDEX IF NOT EXISTS idx_cached_content_size ON cached_content(size_bytes);
      `);
      
      logger.info('Cache database initialized');
    } catch (error) {
      logger.error('Failed to initialize cache database:', error);
    }
  }

  /**
   * Generate cache key hash
   */
  private generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate S3 key from URL
   */
  private generateS3Key(url: string): string {
    const hash = this.generateHash(url);
    return `cache/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${hash}`;
  }

  /**
   * Compress data if beneficial
   */
  private async compressData(data: string): Promise<{ data: Buffer; compressed: boolean }> {
    if (data.length < 1024) {
      // Don't compress small data
      return { data: Buffer.from(data), compressed: false };
    }

    const compressed = await gzip(data);
    
    // Only use compressed version if it's significantly smaller
    if (compressed.length < data.length * 0.8) {
      return { data: compressed, compressed: true };
    }

    return { data: Buffer.from(data), compressed: false };
  }

  /**
   * Decompress data if needed
   */
  private async decompressData(data: Buffer, compressed: boolean): Promise<string> {
    if (!compressed) {
      return data.toString();
    }

    const decompressed = await gunzip(data);
    return decompressed.toString();
  }

  /**
   * Get item from cache (checking all tiers)
   */
  async get(url: string, options: CacheOptions = {}): Promise<any> {
    this.stats.totalRequests++;
    
    const cacheKey = `cache:${this.generateHash(url)}`;
    const skipLevels = options.skipLevels || [];

    try {
      // L0: Memory Cache (fastest)
      if (!skipLevels.includes('memory')) {
        const memoryResult = this.memoryCache.get(cacheKey);
        if (memoryResult) {
          this.stats.hits.memory++;
          this.updateStats();
          return memoryResult;
        }
      }

      // L1: Redis Cache (hot cache)
      if (!skipLevels.includes('redis')) {
        const redisResult = await this.redis.get(cacheKey);
        if (redisResult) {
          const parsed = JSON.parse(redisResult);
          
          // Warm memory cache
          this.memoryCache.set(cacheKey, parsed.data, 300);
          
          // Update access tracking
          this.updateAccessTracking(url);
          
          this.stats.hits.redis++;
          this.updateStats();
          return parsed.data;
        }
      }

      // L2: PostgreSQL Cache (warm cache)
      if (!skipLevels.includes('database')) {
        const dbResult = await this.postgres.query(
          'SELECT data_hash, metadata, s3_key FROM cached_content WHERE url = $1 AND (expires_at IS NULL OR expires_at > NOW())',
          [url]
        );

        if (dbResult.rows.length > 0) {
          const row = dbResult.rows[0];
          let data: any;

          // Check if we have the data in deduplication map
          if (this.deduplicationMap.has(row.data_hash)) {
            data = this.deduplicationMap.get(row.data_hash);
          } else if (row.s3_key) {
            // L3: S3 Storage (cold storage)
            data = await this.getFromS3(row.s3_key, row.metadata.compressed);
            if (data) {
              this.stats.hits.s3++;
            }
          }

          if (data) {
            // Warm all upper caches
            await this.warmCache(url, data, cacheKey);
            
            // Update access tracking
            await this.updateAccessTracking(url);
            
            this.stats.hits.database++;
            this.updateStats();
            return data;
          }
        }
      }

      // Cache miss
      this.stats.misses++;
      this.updateStats();
      return null;

    } catch (error) {
      logger.error('Cache get error:', error);
      this.stats.misses++;
      this.updateStats();
      return null;
    }
  }

  /**
   * Set item in cache (all tiers)
   */
  async set(url: string, data: any, options: CacheOptions = {}): Promise<void> {
    const { ttl = 86400, compress = true } = options; // Default 1 day TTL
    const cacheKey = `cache:${this.generateHash(url)}`;
    const jsonData = JSON.stringify(data);
    const dataHash = this.generateHash(jsonData);

    try {
      // Check for deduplication
      if (this.deduplicationMap.has(dataHash)) {
        logger.debug(`Content deduplicated for URL: ${url}`);
        await this.linkDuplicate(url, dataHash, data);
        return;
      }

      const { data: processedData, compressed } = await this.compressData(jsonData);
      const expiresAt = new Date(Date.now() + ttl * 1000);

      const cacheItem: CacheItem = {
        data,
        metadata: {
          url,
          size: processedData.length,
          compressed,
          createdAt: Date.now(),
          expiresAt: Date.now() + ttl * 1000,
          checksum: dataHash,
          accessCount: 0,
          lastAccessed: Date.now()
        }
      };

      // Memory cache (immediate access)
      this.memoryCache.set(cacheKey, data, Math.min(ttl, 300));

      // Redis cache (hot cache)
      await this.redis.setex(cacheKey, Math.min(ttl, 3600), JSON.stringify(cacheItem));

      // S3 storage for large items
      let s3Key: string | null = null;
      if (processedData.length > 10240) { // > 10KB goes to S3
        s3Key = await this.saveToS3(url, processedData, compressed);
      }

      // PostgreSQL metadata
      await this.postgres.query(`
        INSERT INTO cached_content (
          url, data_hash, metadata, s3_key, expires_at, size_bytes, compressed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (url) DO UPDATE SET
          data_hash = EXCLUDED.data_hash,
          metadata = EXCLUDED.metadata,
          s3_key = EXCLUDED.s3_key,
          expires_at = EXCLUDED.expires_at,
          size_bytes = EXCLUDED.size_bytes,
          compressed = EXCLUDED.compressed,
          last_accessed = NOW()
      `, [
        url,
        dataHash,
        JSON.stringify(cacheItem.metadata),
        s3Key,
        expiresAt,
        processedData.length,
        compressed
      ]);

      // Add to deduplication map
      this.deduplicationMap.set(dataHash, data);

      logger.debug(`Cached content for URL: ${url} (${processedData.length} bytes, compressed: ${compressed})`);

    } catch (error) {
      logger.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * Link duplicate content
   */
  private async linkDuplicate(url: string, dataHash: string, data: any): Promise<void> {
    const cacheKey = `cache:${this.generateHash(url)}`;
    
    // Add to memory and Redis
    this.memoryCache.set(cacheKey, data, 300);
    
    const cacheItem: CacheItem = {
      data,
      metadata: {
        url,
        size: JSON.stringify(data).length,
        compressed: false,
        createdAt: Date.now(),
        checksum: dataHash,
        accessCount: 0,
        lastAccessed: Date.now()
      }
    };
    
    await this.redis.setex(cacheKey, 3600, JSON.stringify(cacheItem));
    
    // Link in database
    await this.postgres.query(`
      INSERT INTO cached_content (url, data_hash, metadata, size_bytes)
      SELECT $1, $2, $3, size_bytes FROM cached_content WHERE data_hash = $2 LIMIT 1
      ON CONFLICT (url) DO UPDATE SET
        data_hash = EXCLUDED.data_hash,
        last_accessed = NOW()
    `, [url, dataHash, JSON.stringify(cacheItem.metadata)]);
  }

  /**
   * Save data to S3
   */
  private async saveToS3(url: string, data: Buffer, compressed: boolean): Promise<string> {
    const s3Key = this.generateS3Key(url);
    const bucket = process.env.AWS_S3_BUCKET || 'save-cache';

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: data,
      ContentType: 'application/octet-stream',
      ContentEncoding: compressed ? 'gzip' : undefined,
      Metadata: {
        url,
        compressed: compressed.toString(),
        cached_at: new Date().toISOString()
      }
    });

    await this.s3.send(command);
    return s3Key;
  }

  /**
   * Get data from S3
   */
  private async getFromS3(s3Key: string, compressed: boolean): Promise<any> {
    try {
      const bucket = process.env.AWS_S3_BUCKET || 'save-cache';
      
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key
      });

      const response = await this.s3.send(command);
      const data = await this.streamToBuffer(response.Body as any);
      
      const decompressed = await this.decompressData(data, compressed);
      return JSON.parse(decompressed);
    } catch (error) {
      logger.error('S3 get error:', error);
      return null;
    }
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Warm upper cache tiers
   */
  private async warmCache(url: string, data: any, cacheKey: string): Promise<void> {
    // Warm memory cache
    this.memoryCache.set(cacheKey, data, 300);

    // Warm Redis cache
    const cacheItem: CacheItem = {
      data,
      metadata: {
        url,
        size: JSON.stringify(data).length,
        compressed: false,
        createdAt: Date.now(),
        checksum: this.generateHash(JSON.stringify(data)),
        accessCount: 0,
        lastAccessed: Date.now()
      }
    };

    await this.redis.setex(cacheKey, 3600, JSON.stringify(cacheItem));
  }

  /**
   * Update access tracking
   */
  private async updateAccessTracking(url: string): Promise<void> {
    try {
      await this.postgres.query(
        'UPDATE cached_content SET access_count = access_count + 1, last_accessed = NOW() WHERE url = $1',
        [url]
      );
    } catch (error) {
      logger.error('Access tracking update failed:', error);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const totalHits = this.stats.hits.memory + this.stats.hits.redis + 
                     this.stats.hits.database + this.stats.hits.s3;
    this.stats.hitRate = totalHits / this.stats.totalRequests;
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(url: string): Promise<void> {
    const cacheKey = `cache:${this.generateHash(url)}`;

    try {
      // Remove from all cache tiers
      this.memoryCache.del(cacheKey);
      await this.redis.del(cacheKey);
      
      // Get S3 key before deleting from database
      const dbResult = await this.postgres.query(
        'SELECT s3_key FROM cached_content WHERE url = $1',
        [url]
      );
      
      if (dbResult.rows.length > 0 && dbResult.rows[0].s3_key) {
        const s3Key = dbResult.rows[0].s3_key;
        const bucket = process.env.AWS_S3_BUCKET || 'save-cache';
        
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key
        });
        
        await this.s3.send(command);
      }
      
      await this.postgres.query('DELETE FROM cached_content WHERE url = $1', [url]);
      
      logger.debug(`Cache invalidated for URL: ${url}`);
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Cache warming strategy
   */
  async warmCache(urls: string[]): Promise<void> {
    logger.info(`Starting cache warming for ${urls.length} URLs`);
    
    const batchSize = 10;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (url) => {
          try {
            const cached = await this.get(url);
            if (!cached) {
              // This would trigger content extraction in a real implementation
              logger.debug(`Cache miss during warming: ${url}`);
            }
          } catch (error) {
            logger.error(`Cache warming failed for ${url}:`, error);
          }
        })
      );
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info('Cache warming completed');
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up PostgreSQL
      const result = await this.postgres.query(
        'DELETE FROM cached_content WHERE expires_at < NOW()'
      );
      
      // Clean up old S3 objects (would need lifecycle policies in production)
      
      logger.info(`Cache cleanup completed. Removed ${result.rowCount} expired entries`);
    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }

  /**
   * Get top accessed content for optimization
   */
  async getTopAccessed(limit: number = 100): Promise<any[]> {
    const result = await this.postgres.query(`
      SELECT url, access_count, last_accessed, size_bytes
      FROM cached_content
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY access_count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
    await this.postgres.end();
    this.memoryCache.close();
  }
}

export default MultiTierCache;
export { CacheOptions, CacheStats, CacheItem };