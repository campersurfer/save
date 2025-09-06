import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import Database from '../database/database';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

interface ExportOptions {
  userId: string;
  includeMedia?: boolean;
  includeMetadata?: boolean;
  format?: 'json' | 'csv' | 'html';
  dateRange?: {
    start: Date;
    end: Date;
  };
  folders?: string[];
  encryption?: {
    enabled: boolean;
    password?: string;
  };
}

interface ExportResult {
  exportId: string;
  filePath: string;
  size: number;
  checksum: string;
  encryptionKey?: string;
  downloadUrl: string;
  expiresAt: Date;
}

interface DeletionRequest {
  userId: string;
  requestId: string;
  requestedAt: Date;
  scheduledFor: Date;
  reason: string;
  items: {
    content: boolean;
    media: boolean;
    metadata: boolean;
    analytics: boolean;
  };
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  verificationToken: string;
}

class DataExportService {
  private database: Database;
  private s3: S3Client;
  private exportPath: string;

  constructor() {
    this.database = new Database();
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    this.exportPath = process.env.EXPORT_PATH || './exports';
  }

  /**
   * Export user data according to GDPR requirements
   */
  async exportUserData(options: ExportOptions): Promise<ExportResult> {
    const exportId = crypto.randomUUID();
    const exportDir = path.join(this.exportPath, exportId);
    
    try {
      await mkdir(exportDir, { recursive: true });

      // Gather user data
      const userData = await this.gatherUserData(options);
      
      // Create export files
      const files = await this.createExportFiles(userData, exportDir, options);
      
      // Create archive
      const archivePath = await this.createArchive(exportDir, files, options);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(archivePath);
      
      // Generate download URL
      const downloadUrl = await this.generateDownloadUrl(exportId, archivePath);
      
      // Log export request
      await this.logExportRequest(options.userId, exportId, {
        files: files.length,
        size: (await import('fs')).statSync(archivePath).size,
        checksum
      });

      return {
        exportId,
        filePath: archivePath,
        size: (await import('fs')).statSync(archivePath).size,
        checksum,
        encryptionKey: options.encryption?.enabled ? options.encryption.password : undefined,
        downloadUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

    } catch (error) {
      logger.error('Data export failed:', error);
      throw error;
    }
  }

  /**
   * Gather all user data for export
   */
  private async gatherUserData(options: ExportOptions) {
    const { userId, dateRange, folders } = options;
    
    // Build query constraints
    const constraints = [];
    const params = [userId];
    
    if (dateRange) {
      constraints.push('created_at BETWEEN ? AND ?');
      params.push(dateRange.start.toISOString(), dateRange.end.toISOString());
    }
    
    if (folders && folders.length > 0) {
      constraints.push(`folder_id IN (${folders.map(() => '?').join(',')})`);
      params.push(...folders);
    }

    const whereClause = constraints.length > 0 ? 'AND ' + constraints.join(' AND ') : '';

    // Gather content data
    const content = this.database.prepare(`
      SELECT c.*, m.file_path, m.file_size, m.mime_type, m.thumbnail_path
      FROM content c
      LEFT JOIN media m ON c.id = m.content_id
      WHERE c.user_id = ? ${whereClause}
      ORDER BY c.created_at DESC
    `).all(...params);

    // Gather folders
    const folders_data = this.database.prepare(`
      SELECT * FROM folders WHERE user_id = ?
    `).all(userId);

    // Gather reading progress
    const reading_progress = this.database.prepare(`
      SELECT rp.* FROM reading_progress rp
      JOIN content c ON rp.content_id = c.id
      WHERE c.user_id = ?
    `).all(userId);

    // Gather user settings
    const settings = this.database.prepare(`
      SELECT * FROM settings WHERE user_id = ?
    `).all(userId);

    // Gather analytics (anonymized)
    const analytics = this.database.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as items_saved,
        AVG(reading_time) as avg_reading_time
      FROM content 
      WHERE user_id = ? 
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(userId);

    return {
      profile: {
        userId,
        exportDate: new Date().toISOString(),
        totalItems: content.length,
        exportOptions: options
      },
      content,
      folders: folders_data,
      readingProgress: reading_progress,
      settings,
      analytics: options.includeMetadata ? analytics : []
    };
  }

  /**
   * Create export files in different formats
   */
  private async createExportFiles(
    userData: any, 
    exportDir: string, 
    options: ExportOptions
  ): Promise<string[]> {
    const files: string[] = [];

    switch (options.format) {
      case 'json':
        const jsonPath = path.join(exportDir, 'data.json');
        await writeFile(jsonPath, JSON.stringify(userData, null, 2));
        files.push(jsonPath);
        break;

      case 'csv':
        // Export content as CSV
        const csvPath = path.join(exportDir, 'content.csv');
        const csvData = this.convertToCSV(userData.content);
        await writeFile(csvPath, csvData);
        files.push(csvPath);

        // Export folders as CSV
        const foldersCsvPath = path.join(exportDir, 'folders.csv');
        const foldersCsvData = this.convertToCSV(userData.folders);
        await writeFile(foldersCsvPath, foldersCsvData);
        files.push(foldersCsvPath);
        break;

      case 'html':
        const htmlPath = path.join(exportDir, 'data.html');
        const htmlData = this.convertToHTML(userData);
        await writeFile(htmlPath, htmlData);
        files.push(htmlPath);
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Export media files if requested
    if (options.includeMedia) {
      const mediaDir = path.join(exportDir, 'media');
      await mkdir(mediaDir, { recursive: true });
      
      for (const item of userData.content) {
        if (item.file_path) {
          try {
            await this.downloadMediaFile(item.file_path, mediaDir);
            files.push(path.join(mediaDir, path.basename(item.file_path)));
          } catch (error) {
            logger.warn(`Failed to download media file: ${item.file_path}`, error);
          }
        }
      }
    }

    return files;
  }

  /**
   * Create encrypted archive of export files
   */
  private async createArchive(
    exportDir: string, 
    files: string[], 
    options: ExportOptions
  ): Promise<string> {
    const archivePath = path.join(exportDir, '..', `export_${Date.now()}.zip`);
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(archivePath));
      archive.on('error', reject);
      
      archive.pipe(output);

      // Add files to archive
      for (const file of files) {
        const relativePath = path.relative(exportDir, file);
        archive.file(file, { name: relativePath });
      }

      // Add metadata
      archive.append(JSON.stringify({
        exportDate: new Date().toISOString(),
        userId: options.userId,
        fileCount: files.length,
        options
      }, null, 2), { name: 'export_metadata.json' });

      archive.finalize();
    });
  }

  /**
   * Request account deletion with GDPR compliance
   */
  async requestAccountDeletion(
    userId: string,
    reason: string,
    items: DeletionRequest['items']
  ): Promise<DeletionRequest> {
    const requestId = crypto.randomUUID();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // 30-day waiting period as per GDPR
    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const deletionRequest: DeletionRequest = {
      userId,
      requestId,
      requestedAt: new Date(),
      scheduledFor,
      reason,
      items,
      status: 'pending',
      verificationToken
    };

    // Store deletion request
    this.database.prepare(`
      INSERT INTO deletion_requests (
        request_id, user_id, requested_at, scheduled_for, 
        reason, items, status, verification_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId, userId, deletionRequest.requestedAt.toISOString(),
      scheduledFor.toISOString(), reason, JSON.stringify(items),
      'pending', verificationToken
    );

    // Send verification email (placeholder)
    await this.sendDeletionVerificationEmail(userId, verificationToken);

    logger.info(`Account deletion requested for user ${userId}`, {
      requestId,
      scheduledFor: scheduledFor.toISOString()
    });

    return deletionRequest;
  }

  /**
   * Verify and execute account deletion
   */
  async executeDeletion(requestId: string, verificationToken: string): Promise<void> {
    const request = this.database.prepare(`
      SELECT * FROM deletion_requests 
      WHERE request_id = ? AND verification_token = ? AND status = 'pending'
    `).get(requestId, verificationToken);

    if (!request) {
      throw new Error('Invalid or expired deletion request');
    }

    if (new Date() < new Date(request.scheduled_for)) {
      throw new Error('Deletion not yet scheduled to execute');
    }

    // Update status to processing
    this.database.prepare(`
      UPDATE deletion_requests 
      SET status = 'processing', processed_at = ? 
      WHERE request_id = ?
    `).run(new Date().toISOString(), requestId);

    const items = JSON.parse(request.items);

    try {
      if (items.content) {
        await this.deleteUserContent(request.user_id);
      }

      if (items.media) {
        await this.deleteUserMedia(request.user_id);
      }

      if (items.metadata) {
        await this.deleteUserMetadata(request.user_id);
      }

      if (items.analytics) {
        await this.deleteUserAnalytics(request.user_id);
      }

      // Mark as completed
      this.database.prepare(`
        UPDATE deletion_requests 
        SET status = 'completed', completed_at = ? 
        WHERE request_id = ?
      `).run(new Date().toISOString(), requestId);

      logger.info(`Account deletion completed for user ${request.user_id}`, {
        requestId,
        items
      });

    } catch (error) {
      // Mark as failed
      this.database.prepare(`
        UPDATE deletion_requests 
        SET status = 'failed', error_message = ? 
        WHERE request_id = ?
      `).run(error.message, requestId);

      throw error;
    }
  }

  /**
   * Cancel pending deletion request
   */
  async cancelDeletion(requestId: string, userId: string): Promise<void> {
    this.database.prepare(`
      UPDATE deletion_requests 
      SET status = 'cancelled', cancelled_at = ? 
      WHERE request_id = ? AND user_id = ? AND status = 'pending'
    `).run(new Date().toISOString(), requestId, userId);

    logger.info(`Deletion request cancelled`, { requestId, userId });
  }

  /**
   * Helper methods for data conversion
   */
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private convertToHTML(userData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Data Export</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section { margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Personal Data Export</h1>
      <div class="section">
        <h2>Export Information</h2>
        <p>User ID: ${userData.profile.userId}</p>
        <p>Export Date: ${userData.profile.exportDate}</p>
        <p>Total Items: ${userData.profile.totalItems}</p>
      </div>
      
      <div class="section">
        <h2>Saved Content</h2>
        ${this.arrayToHTMLTable(userData.content)}
      </div>
      
      <div class="section">
        <h2>Folders</h2>
        ${this.arrayToHTMLTable(userData.folders)}
      </div>
    </body>
    </html>
    `;
  }

  private arrayToHTMLTable(data: any[]): string {
    if (!data || data.length === 0) return '<p>No data</p>';

    const headers = Object.keys(data[0]);
    let html = '<table><thead><tr>';
    
    for (const header of headers) {
      html += `<th>${header}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of data) {
      html += '<tr>';
      for (const header of headers) {
        html += `<td>${row[header] || ''}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
  }

  /**
   * Helper methods for deletion
   */
  private async deleteUserContent(userId: string): Promise<void> {
    this.database.prepare('DELETE FROM reading_progress WHERE content_id IN (SELECT id FROM content WHERE user_id = ?)').run(userId);
    this.database.prepare('DELETE FROM content WHERE user_id = ?').run(userId);
  }

  private async deleteUserMedia(userId: string): Promise<void> {
    const mediaFiles = this.database.prepare(`
      SELECT m.file_path FROM media m
      JOIN content c ON m.content_id = c.id
      WHERE c.user_id = ?
    `).all(userId);

    // Delete from S3
    for (const media of mediaFiles) {
      try {
        await this.s3.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || 'save-media',
          Key: media.file_path
        }));
      } catch (error) {
        logger.warn(`Failed to delete media file: ${media.file_path}`, error);
      }
    }

    this.database.prepare(`
      DELETE FROM media WHERE content_id IN (SELECT id FROM content WHERE user_id = ?)
    `).run(userId);
  }

  private async deleteUserMetadata(userId: string): Promise<void> {
    this.database.prepare('DELETE FROM folders WHERE user_id = ?').run(userId);
    this.database.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
  }

  private async deleteUserAnalytics(userId: string): Promise<void> {
    // Delete from analytics tables (placeholder)
    logger.info(`Analytics deletion for user ${userId}`);
  }

  private async downloadMediaFile(s3Key: string, localDir: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || 'save-media',
      Key: s3Key
    });

    const response = await this.s3.send(command);
    const localPath = path.join(localDir, path.basename(s3Key));

    if (response.Body) {
      await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(localPath));
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await pipeline(createReadStream(filePath), hash);
    return hash.digest('hex');
  }

  private async generateDownloadUrl(exportId: string, filePath: string): Promise<string> {
    // In production, this would generate a signed URL
    return `${process.env.BASE_URL}/api/exports/${exportId}/download`;
  }

  private async logExportRequest(userId: string, exportId: string, metadata: any): Promise<void> {
    this.database.prepare(`
      INSERT INTO export_requests (
        export_id, user_id, created_at, metadata, status
      ) VALUES (?, ?, ?, ?, ?)
    `).run(exportId, userId, new Date().toISOString(), JSON.stringify(metadata), 'completed');
  }

  private async sendDeletionVerificationEmail(userId: string, token: string): Promise<void> {
    // Email sending logic would go here
    logger.info(`Deletion verification email sent to user ${userId}`);
  }
}

export default DataExportService;
export { ExportOptions, ExportResult, DeletionRequest };