import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import zlib from 'zlib';
import { promisify } from 'util';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

interface OptimizationOptions {
  imageQuality?: number;
  maxImageSize?: { width: number; height: number };
  generateThumbnails?: boolean;
  compressText?: boolean;
  compressionLevel?: number;
  generateWebP?: boolean;
}

interface OptimizedAsset {
  original: {
    url: string;
    size: number;
    mimeType: string;
  };
  optimized: {
    url: string;
    size: number;
    mimeType: string;
    compressionRatio: number;
  };
  thumbnail?: {
    url: string;
    size: number;
    dimensions: { width: number; height: number };
  };
  webp?: {
    url: string;
    size: number;
    compressionRatio: number;
  };
}

class StorageOptimizer {
  private s3: S3Client;
  private cdnBaseUrl: string;
  private localStoragePath: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.saveapp.com';
    this.localStoragePath = process.env.STORAGE_PATH || './storage';
  }

  /**
   * Compress text content with multiple algorithms
   */
  async compressContent(content: string, level: number = 6): Promise<{
    gzipped: Buffer;
    brotli: Buffer;
    best: { data: Buffer; algorithm: 'gzip' | 'brotli'; ratio: number };
  }> {
    const originalSize = Buffer.byteLength(content, 'utf8');
    
    const [gzipped, brotli] = await Promise.all([
      gzip(content, { level }),
      brotliCompress(content, { 
        params: { 
          [zlib.constants.BROTLI_PARAM_QUALITY]: level + 4 
        }
      })
    ]);

    const gzipRatio = gzipped.length / originalSize;
    const brotliRatio = brotli.length / originalSize;

    const best = brotliRatio < gzipRatio 
      ? { data: brotli, algorithm: 'brotli' as const, ratio: brotliRatio }
      : { data: gzipped, algorithm: 'gzip' as const, ratio: gzipRatio };

    return { gzipped, brotli, best };
  }

  /**
   * Optimize image with multiple formats and sizes
   */
  async optimizeImage(
    imageBuffer: Buffer, 
    originalUrl: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizedAsset> {
    const {
      imageQuality = 85,
      maxImageSize = { width: 1920, height: 1080 },
      generateThumbnails = true,
      generateWebP = true
    } = options;

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const originalSize = imageBuffer.length;
      const originalMimeType = `image/${metadata.format}`;

      // Optimize main image
      const optimizedBuffer = await image
        .resize(maxImageSize.width, maxImageSize.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: imageQuality, mozjpeg: true })
        .toBuffer();

      const optimizedUrl = await this.uploadAsset(
        optimizedBuffer,
        this.generateAssetPath(originalUrl, 'optimized', 'jpg')
      );

      // Generate WebP version
      let webpAsset;
      if (generateWebP) {
        const webpBuffer = await image
          .resize(maxImageSize.width, maxImageSize.height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: imageQuality - 10 })
          .toBuffer();

        const webpUrl = await this.uploadAsset(
          webpBuffer,
          this.generateAssetPath(originalUrl, 'webp', 'webp')
        );

        webpAsset = {
          url: webpUrl,
          size: webpBuffer.length,
          compressionRatio: webpBuffer.length / originalSize
        };
      }

      // Generate thumbnail
      let thumbnailAsset;
      if (generateThumbnails) {
        const thumbnailBuffer = await image
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();

        const thumbnailUrl = await this.uploadAsset(
          thumbnailBuffer,
          this.generateAssetPath(originalUrl, 'thumb', 'jpg')
        );

        thumbnailAsset = {
          url: thumbnailUrl,
          size: thumbnailBuffer.length,
          dimensions: { width: 300, height: 300 }
        };
      }

      return {
        original: {
          url: originalUrl,
          size: originalSize,
          mimeType: originalMimeType
        },
        optimized: {
          url: optimizedUrl,
          size: optimizedBuffer.length,
          mimeType: 'image/jpeg',
          compressionRatio: optimizedBuffer.length / originalSize
        },
        thumbnail: thumbnailAsset,
        webp: webpAsset
      };

    } catch (error) {
      logger.error('Image optimization failed:', error);
      throw error;
    }
  }

  /**
   * Generate responsive image variants
   */
  async generateResponsiveImages(
    imageBuffer: Buffer,
    originalUrl: string,
    sizes: number[] = [400, 800, 1200, 1920]
  ): Promise<{ size: number; url: string; width: number; height: number }[]> {
    const variants = [];
    const image = sharp(imageBuffer);

    for (const size of sizes) {
      try {
        const resizedBuffer = await image
          .resize(size, null, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();

        const metadata = await sharp(resizedBuffer).metadata();
        const url = await this.uploadAsset(
          resizedBuffer,
          this.generateAssetPath(originalUrl, `${size}w`, 'jpg')
        );

        variants.push({
          size: resizedBuffer.length,
          url,
          width: metadata.width!,
          height: metadata.height!
        });
      } catch (error) {
        logger.error(`Failed to generate ${size}px variant:`, error);
      }
    }

    return variants;
  }

  /**
   * Optimize video thumbnails and previews
   */
  async optimizeVideo(
    videoUrl: string,
    thumbnailBuffer?: Buffer
  ): Promise<{
    thumbnail?: OptimizedAsset;
    preview?: { url: string; size: number };
  }> {
    const result: any = {};

    if (thumbnailBuffer) {
      result.thumbnail = await this.optimizeImage(thumbnailBuffer, videoUrl);
    }

    // Video preview generation would require ffmpeg
    // This is a placeholder for video optimization
    logger.info(`Video optimization placeholder for: ${videoUrl}`);

    return result;
  }

  /**
   * Upload asset to S3 with CDN integration
   */
  private async uploadAsset(buffer: Buffer, key: string): Promise<string> {
    const bucket = process.env.AWS_S3_BUCKET || 'save-assets';
    
    // Determine content type
    const contentType = this.getContentType(key);
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      ACL: 'public-read'
    });

    await this.s3.send(command);
    
    // Return CDN URL
    return `${this.cdnBaseUrl}/${key}`;
  }

  /**
   * Generate asset path with organization
   */
  private generateAssetPath(originalUrl: string, variant: string, extension: string): string {
    const hash = crypto.createHash('md5').update(originalUrl).digest('hex');
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    return `assets/${date}/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}_${variant}.${extension}`;
  }

  /**
   * Get content type from file extension
   */
  private getContentType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Create optimized storage policy
   */
  async createStoragePolicy(contentType: string, size: number): Promise<{
    tier: 'hot' | 'warm' | 'cold' | 'archive';
    compress: boolean;
    thumbnail: boolean;
    responsive: boolean;
    ttl?: number;
  }> {
    // Hot tier: frequently accessed, small files
    if (size < 100 * 1024 && contentType.startsWith('text/')) { // < 100KB text
      return {
        tier: 'hot',
        compress: true,
        thumbnail: false,
        responsive: false
      };
    }

    // Warm tier: images, moderate access
    if (contentType.startsWith('image/')) {
      return {
        tier: 'warm',
        compress: false,
        thumbnail: true,
        responsive: size > 500 * 1024, // Generate responsive for > 500KB images
        ttl: 7776000 // 90 days
      };
    }

    // Cold tier: large files, infrequent access
    if (size > 10 * 1024 * 1024) { // > 10MB
      return {
        tier: 'cold',
        compress: true,
        thumbnail: contentType.startsWith('video/'),
        responsive: false,
        ttl: 31536000 // 1 year
      };
    }

    // Default to warm tier
    return {
      tier: 'warm',
      compress: true,
      thumbnail: false,
      responsive: false,
      ttl: 2592000 // 30 days
    };
  }

  /**
   * Cleanup old optimized assets
   */
  async cleanupAssets(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    // This would implement S3 lifecycle policies or manual cleanup
    // For now, return a placeholder count
    logger.info(`Asset cleanup for files older than ${olderThanDays} days`);
    return 0;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    assetCount: number;
    storageByType: { [key: string]: number };
  }> {
    // This would query S3 and database for actual statistics
    // Placeholder implementation
    return {
      totalSize: 0,
      optimizedSize: 0,
      compressionRatio: 0,
      assetCount: 0,
      storageByType: {}
    };
  }

  /**
   * Generate CDN purge requests
   */
  async purgeCDN(urls: string[]): Promise<void> {
    // This would integrate with CloudFlare, AWS CloudFront, etc.
    logger.info(`CDN purge requested for ${urls.length} URLs`);
  }
}

export default StorageOptimizer;
export { OptimizationOptions, OptimizedAsset };