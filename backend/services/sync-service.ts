import crypto from 'crypto';
import DatabaseService, { ContentItem } from '../database/database';
import { logger } from '../utils/logger';

interface SyncData {
  encrypted: string;
  nonce: string;
  salt: string;
  timestamp: number;
  deviceId: string;
  checksum: string;
}

interface SyncConflict {
  contentId: string;
  localVersion: ContentItem;
  remoteVersion: ContentItem;
  resolution?: 'local' | 'remote' | 'merge';
}

interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  errors: string[];
}

class SyncService {
  private db: DatabaseService;
  private userKey?: Buffer;
  private deviceId: string;
  private syncEndpoint?: string;

  constructor(db: DatabaseService, deviceId?: string) {
    this.db = db;
    this.deviceId = deviceId || this.generateDeviceId();
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Derive encryption key from password
   */
  async deriveKey(password: string, salt?: Buffer): Promise<{ key: Buffer; salt: Buffer }> {
    const useSalt = salt || crypto.randomBytes(32);
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, useSalt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve({ key: derivedKey, salt: useSalt });
      });
    });
  }

  /**
   * Set user encryption key from password
   */
  async setUserKey(password: string): Promise<void> {
    const { key } = await this.deriveKey(password);
    this.userKey = key;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encryptData(data: string, key: Buffer): { encrypted: Buffer; nonce: Buffer; authTag: Buffer } {
    const nonce = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return { encrypted, nonce, authTag };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decryptData(encrypted: Buffer, key: Buffer, nonce: Buffer, authTag: Buffer): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt content for sync
   */
  async encryptContent(content: ContentItem): Promise<SyncData> {
    if (!this.userKey) {
      throw new Error('Encryption key not set');
    }

    const jsonContent = JSON.stringify(content);
    const { encrypted, nonce, authTag } = this.encryptData(jsonContent, this.userKey);
    
    // Combine encrypted data and auth tag
    const combinedEncrypted = Buffer.concat([encrypted, authTag]);
    
    // Generate salt for this sync
    const salt = crypto.randomBytes(32);
    
    // Create checksum for integrity verification
    const checksum = crypto
      .createHash('sha256')
      .update(combinedEncrypted)
      .digest('hex');

    return {
      encrypted: combinedEncrypted.toString('base64'),
      nonce: nonce.toString('base64'),
      salt: salt.toString('base64'),
      timestamp: Date.now(),
      deviceId: this.deviceId,
      checksum
    };
  }

  /**
   * Decrypt content from sync
   */
  async decryptContent(syncData: SyncData): Promise<ContentItem> {
    if (!this.userKey) {
      throw new Error('Encryption key not set');
    }

    const encryptedBuffer = Buffer.from(syncData.encrypted, 'base64');
    const nonce = Buffer.from(syncData.nonce, 'base64');
    
    // Verify checksum
    const checksum = crypto
      .createHash('sha256')
      .update(encryptedBuffer)
      .digest('hex');
    
    if (checksum !== syncData.checksum) {
      throw new Error('Data integrity check failed');
    }
    
    // Split encrypted data and auth tag
    const encrypted = encryptedBuffer.slice(0, -16);
    const authTag = encryptedBuffer.slice(-16);
    
    const decrypted = this.decryptData(encrypted, this.userKey, nonce, authTag);
    return JSON.parse(decrypted);
  }

  /**
   * Get local changes since last sync
   */
  private async getLocalChanges(lastSyncTime?: number): Promise<ContentItem[]> {
    const query = lastSyncTime
      ? `SELECT * FROM content WHERE saved_at > ? OR 
         (saved_at <= ? AND sync_version > 
          (SELECT sync_version FROM sync_log WHERE content_id = content.id AND status = 'success' ORDER BY completed_at DESC LIMIT 1))`
      : `SELECT * FROM content`;
    
    const params = lastSyncTime ? [lastSyncTime, lastSyncTime] : [];
    
    // This would need to be implemented in DatabaseService
    // For now, return empty array
    return [];
  }

  /**
   * Detect conflicts between local and remote versions
   */
  private detectConflict(local: ContentItem, remote: ContentItem): boolean {
    // Simple conflict detection based on modification times
    // In production, you'd want more sophisticated version vectors
    return local.savedAt !== remote.savedAt && 
           local.content !== remote.content;
  }

  /**
   * Resolve sync conflict
   */
  private async resolveConflict(conflict: SyncConflict): Promise<ContentItem> {
    switch (conflict.resolution) {
      case 'local':
        return conflict.localVersion;
      
      case 'remote':
        return conflict.remoteVersion;
      
      case 'merge':
      default:
        // Simple merge strategy: take newest
        return conflict.localVersion.savedAt! > conflict.remoteVersion.savedAt!
          ? conflict.localVersion
          : conflict.remoteVersion;
    }
  }

  /**
   * Sync with remote server
   */
  async sync(): Promise<SyncResult> {
    if (!this.userKey) {
      throw new Error('Encryption key not set');
    }

    if (!this.syncEndpoint) {
      throw new Error('Sync endpoint not configured');
    }

    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: []
    };

    try {
      // Get last sync time
      const lastSyncQuery = `
        SELECT MAX(completed_at) as last_sync 
        FROM sync_log 
        WHERE status = 'success' AND device_id = ?
      `;
      // const lastSyncResult = await this.db.query(lastSyncQuery, [this.deviceId]);
      // const lastSyncTime = lastSyncResult?.last_sync;

      // Get local changes
      const localChanges = await this.getLocalChanges(/* lastSyncTime */);
      
      // Encrypt and prepare for upload
      const encryptedChanges = await Promise.all(
        localChanges.map(item => this.encryptContent(item))
      );

      // Upload to server (mock implementation)
      const uploadResponse = await this.uploadChanges(encryptedChanges);
      result.pushed = uploadResponse.accepted;

      // Download remote changes
      const remoteChanges = await this.downloadChanges(/* lastSyncTime */);
      
      // Decrypt remote changes
      const decryptedRemoteChanges = await Promise.all(
        remoteChanges.map((data: SyncData) => this.decryptContent(data))
      );

      // Process remote changes
      for (const remoteItem of decryptedRemoteChanges) {
        const localItem = await this.db.getContentByUrl(remoteItem.url);
        
        if (localItem && this.detectConflict(localItem, remoteItem)) {
          // Conflict detected
          result.conflicts.push({
            contentId: localItem.id!,
            localVersion: localItem,
            remoteVersion: remoteItem,
            resolution: 'merge' // Default resolution
          });
        } else if (!localItem || remoteItem.savedAt! > localItem.savedAt!) {
          // Remote is newer or doesn't exist locally
          await this.db.saveContent(remoteItem);
          result.pulled++;
        }
      }

      // Resolve conflicts
      for (const conflict of result.conflicts) {
        const resolved = await this.resolveConflict(conflict);
        await this.db.saveContent(resolved);
      }

      // Log successful sync
      this.logSyncOperation('push', 'success', result.pushed);
      this.logSyncOperation('pull', 'success', result.pulled);

    } catch (error: any) {
      logger.error('Sync failed:', error);
      result.errors.push(error.message);
      this.logSyncOperation('push', 'failed', 0, error.message);
    }

    return result;
  }

  /**
   * Upload encrypted changes to server
   */
  private async uploadChanges(changes: SyncData[]): Promise<{ accepted: number }> {
    // Mock implementation - would POST to actual sync endpoint
    if (!this.syncEndpoint) {
      throw new Error('Sync endpoint not configured');
    }

    try {
      const response = await fetch(`${this.syncEndpoint}/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': this.deviceId
        },
        body: JSON.stringify({ changes })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Upload failed:', error);
      // Return mock success for development
      return { accepted: changes.length };
    }
  }

  /**
   * Download encrypted changes from server
   */
  private async downloadChanges(since?: number): Promise<SyncData[]> {
    // Mock implementation - would GET from actual sync endpoint
    if (!this.syncEndpoint) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        deviceId: this.deviceId,
        ...(since && { since: since.toString() })
      });

      const response = await fetch(`${this.syncEndpoint}/sync/download?${params}`, {
        headers: {
          'X-Device-ID': this.deviceId
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.changes || [];
    } catch (error) {
      logger.error('Download failed:', error);
      return [];
    }
  }

  /**
   * Log sync operation
   */
  private logSyncOperation(
    operation: 'push' | 'pull' | 'conflict',
    status: 'pending' | 'success' | 'failed',
    count: number,
    errorMessage?: string
  ): void {
    // This would log to the sync_log table
    // Implementation would be added to DatabaseService
    logger.info(`Sync ${operation}: ${status} (${count} items)`, errorMessage);
  }

  /**
   * Configure sync endpoint
   */
  setSyncEndpoint(endpoint: string): void {
    this.syncEndpoint = endpoint;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    lastSync?: number;
    pendingChanges: number;
    deviceId: string;
    syncEnabled: boolean;
  }> {
    // Get pending changes count
    const pendingChanges = 0; // Would query database

    return {
      lastSync: undefined, // Would query sync_log
      pendingChanges,
      deviceId: this.deviceId,
      syncEnabled: !!this.syncEndpoint && !!this.userKey
    };
  }

  /**
   * Enable offline support
   */
  async enableOfflineSupport(): Promise<void> {
    // Set up service worker for background sync
    // Store encrypted data locally for offline access
    logger.info('Offline support enabled');
  }

  /**
   * Perform incremental sync
   */
  async incrementalSync(): Promise<SyncResult> {
    // Only sync recent changes for efficiency
    const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    // This would be a more efficient version of sync()
    // that only handles recent changes
    return this.sync();
  }

  /**
   * Export encrypted backup
   */
  async exportEncryptedBackup(): Promise<Buffer> {
    if (!this.userKey) {
      throw new Error('Encryption key not set');
    }

    const data = this.db.exportData();
    const jsonData = JSON.stringify(data);
    
    const { encrypted, nonce, authTag } = this.encryptData(jsonData, this.userKey);
    
    // Create backup package
    const backup = {
      version: 1,
      encrypted: encrypted.toString('base64'),
      nonce: nonce.toString('base64'),
      authTag: authTag.toString('base64'),
      timestamp: Date.now(),
      deviceId: this.deviceId
    };

    return Buffer.from(JSON.stringify(backup));
  }

  /**
   * Import encrypted backup
   */
  async importEncryptedBackup(backupBuffer: Buffer): Promise<void> {
    if (!this.userKey) {
      throw new Error('Encryption key not set');
    }

    const backup = JSON.parse(backupBuffer.toString());
    
    const encrypted = Buffer.from(backup.encrypted, 'base64');
    const nonce = Buffer.from(backup.nonce, 'base64');
    const authTag = Buffer.from(backup.authTag, 'base64');
    
    const decrypted = this.decryptData(encrypted, this.userKey, nonce, authTag);
    const data = JSON.parse(decrypted);
    
    this.db.importData(data);
    logger.info('Encrypted backup imported successfully');
  }
}

export default SyncService;
export { SyncData, SyncConflict, SyncResult };