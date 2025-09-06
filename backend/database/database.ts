import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface ContentItem {
  id?: string;
  url: string;
  type: 'article' | 'tweet' | 'image' | 'video' | 'instagram' | 'tiktok';
  title?: string;
  author?: string;
  content?: string;
  extractedAt: number;
  savedAt?: number;
  readAt?: number;
  archived?: boolean;
  favorite?: boolean;
  dominantColor?: string;
  mood?: 'light' | 'dark' | 'warm' | 'cool' | 'neutral';
  temperature?: number;
  contrast?: number;
  saturation?: number;
  durationSeconds?: number;
  wordCount?: number;
  language?: string;
  sourceDomain?: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  extractionMethod?: string;
  extractionSuccess?: boolean;
  extractionErrors?: any[];
}

interface MediaItem {
  id?: string;
  contentId: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  localPath?: string;
  thumbnailPath?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  mimeType?: string;
  position?: number;
}

interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  type?: string;
  mood?: string;
  archived?: boolean;
  favorite?: boolean;
  folderId?: string;
  startDate?: number;
  endDate?: number;
}

interface BackupOptions {
  includeMeda?: boolean;
  encryptionKey?: string;
  compress?: boolean;
}

class DatabaseService {
  private db: Database.Database;
  private dbPath: string;
  private schemaPath: string;

  constructor(dbPath: string = './save.db') {
    this.dbPath = dbPath;
    this.schemaPath = path.join(__dirname, 'schema.sql');
    this.db = new Database(dbPath);
    
    // Enable foreign keys and WAL mode for better concurrency
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
  }

  /**
   * Initialize database with schema
   */
  private initialize() {
    try {
      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      this.db.exec(schema);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  // ==================== CONTENT OPERATIONS ====================

  /**
   * Save or update content
   */
  async saveContent(item: ContentItem): Promise<string> {
    const id = item.id || this.generateId();
    const sourceDomain = item.sourceDomain || this.extractDomain(item.url);
    const tags = item.tags ? JSON.stringify(item.tags) : null;
    const extractionErrors = item.extractionErrors ? JSON.stringify(item.extractionErrors) : null;

    const stmt = this.db.prepare(`
      INSERT INTO content (
        id, url, type, title, author, content, 
        extracted_at, saved_at, archived, favorite,
        dominant_color, mood, temperature, contrast, saturation,
        duration_seconds, word_count, language, source_domain,
        folder_id, tags, notes, extraction_method, 
        extraction_success, extraction_errors
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        author = excluded.author,
        content = excluded.content,
        dominant_color = excluded.dominant_color,
        mood = excluded.mood,
        temperature = excluded.temperature,
        contrast = excluded.contrast,
        saturation = excluded.saturation,
        duration_seconds = excluded.duration_seconds,
        word_count = excluded.word_count,
        tags = excluded.tags,
        notes = excluded.notes
    `);

    stmt.run(
      id, item.url, item.type, item.title, item.author, item.content,
      item.extractedAt, Date.now(), item.archived ? 1 : 0, item.favorite ? 1 : 0,
      item.dominantColor, item.mood, item.temperature, item.contrast, item.saturation,
      item.durationSeconds, item.wordCount, item.language || 'en', sourceDomain,
      item.folderId, tags, item.notes, item.extractionMethod,
      item.extractionSuccess !== false ? 1 : 0, extractionErrors
    );

    return id;
  }

  /**
   * Get content by ID
   */
  getContent(id: string): ContentItem | null {
    const row = this.db.prepare('SELECT * FROM content WHERE id = ?').get(id) as any;
    if (!row) return null;

    return this.rowToContent(row);
  }

  /**
   * Get content by URL
   */
  getContentByUrl(url: string): ContentItem | null {
    const row = this.db.prepare('SELECT * FROM content WHERE url = ?').get(url) as any;
    if (!row) return null;

    return this.rowToContent(row);
  }

  /**
   * Convert database row to ContentItem
   */
  private rowToContent(row: any): ContentItem {
    return {
      id: row.id,
      url: row.url,
      type: row.type,
      title: row.title,
      author: row.author,
      content: row.content,
      extractedAt: row.extracted_at,
      savedAt: row.saved_at,
      readAt: row.read_at,
      archived: row.archived === 1,
      favorite: row.favorite === 1,
      dominantColor: row.dominant_color,
      mood: row.mood,
      temperature: row.temperature,
      contrast: row.contrast,
      saturation: row.saturation,
      durationSeconds: row.duration_seconds,
      wordCount: row.word_count,
      language: row.language,
      sourceDomain: row.source_domain,
      folderId: row.folder_id,
      tags: row.tags ? JSON.parse(row.tags) : [],
      notes: row.notes,
      extractionMethod: row.extraction_method,
      extractionSuccess: row.extraction_success === 1,
      extractionErrors: row.extraction_errors ? JSON.parse(row.extraction_errors) : []
    };
  }

  /**
   * Mark content as read
   */
  markAsRead(id: string): void {
    this.db.prepare('UPDATE content SET read_at = ? WHERE id = ?')
      .run(Date.now(), id);
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): void {
    this.db.prepare('UPDATE content SET favorite = NOT favorite WHERE id = ?').run(id);
  }

  /**
   * Archive/unarchive content
   */
  toggleArchive(id: string): void {
    this.db.prepare('UPDATE content SET archived = NOT archived WHERE id = ?').run(id);
  }

  /**
   * Delete content
   */
  deleteContent(id: string): void {
    this.db.prepare('DELETE FROM content WHERE id = ?').run(id);
  }

  // ==================== SEARCH OPERATIONS ====================

  /**
   * Full-text search with filters
   */
  async search(options: SearchOptions): Promise<ContentItem[]> {
    let query = `
      SELECT c.* FROM content c
      WHERE 1=1
    `;
    const params: any[] = [];

    // Add full-text search if query provided
    if (options.query) {
      query = `
        SELECT c.* FROM content c
        JOIN content_fts ON c.rowid = content_fts.rowid
        WHERE content_fts MATCH ?
      `;
      params.push(options.query);
    }

    // Add filters
    if (options.type) {
      query += ' AND c.type = ?';
      params.push(options.type);
    }

    if (options.mood) {
      query += ' AND c.mood = ?';
      params.push(options.mood);
    }

    if (options.archived !== undefined) {
      query += ' AND c.archived = ?';
      params.push(options.archived ? 1 : 0);
    }

    if (options.favorite !== undefined) {
      query += ' AND c.favorite = ?';
      params.push(options.favorite ? 1 : 0);
    }

    if (options.folderId) {
      query += ' AND c.folder_id = ?';
      params.push(options.folderId);
    }

    if (options.startDate) {
      query += ' AND c.saved_at >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND c.saved_at <= ?';
      params.push(options.endDate);
    }

    // Add ordering
    query += ' ORDER BY c.saved_at DESC';

    // Add pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToContent(row));
  }

  /**
   * Get recent items
   */
  getRecent(limit: number = 50, type?: string): ContentItem[] {
    let query = 'SELECT * FROM content WHERE archived = 0';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY saved_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToContent(row));
  }

  /**
   * Get unread articles
   */
  getUnreadArticles(limit: number = 50): ContentItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM v_unread_articles LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => this.rowToContent(row));
  }

  /**
   * Get favorites
   */
  getFavorites(limit: number = 50): ContentItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM v_favorites LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => this.rowToContent(row));
  }

  // ==================== MEDIA OPERATIONS ====================

  /**
   * Save media item
   */
  async saveMedia(media: MediaItem): Promise<string> {
    const id = media.id || this.generateId();

    const stmt = this.db.prepare(`
      INSERT INTO media (
        id, content_id, type, url, local_path, thumbnail_path,
        width, height, duration_seconds, size_bytes, mime_type, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, media.contentId, media.type, media.url, media.localPath,
      media.thumbnailPath, media.width, media.height, media.durationSeconds,
      media.sizeBytes, media.mimeType, media.position || 0
    );

    return id;
  }

  /**
   * Get media for content
   */
  getMediaForContent(contentId: string): MediaItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM media WHERE content_id = ? ORDER BY position
    `).all(contentId) as any[];

    return rows.map(row => ({
      id: row.id,
      contentId: row.content_id,
      type: row.type,
      url: row.url,
      localPath: row.local_path,
      thumbnailPath: row.thumbnail_path,
      width: row.width,
      height: row.height,
      durationSeconds: row.duration_seconds,
      sizeBytes: row.size_bytes,
      mimeType: row.mime_type,
      position: row.position
    }));
  }

  // ==================== QUEUE OPERATIONS ====================

  /**
   * Add to queue
   */
  addToQueue(contentId: string, position?: number): void {
    if (position === undefined) {
      // Get next position
      const result = this.db.prepare('SELECT MAX(position) as max_pos FROM queue').get() as any;
      position = (result.max_pos || 0) + 1;
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO queue (content_id, position, added_at)
      VALUES (?, ?, ?)
    `).run(contentId, position, Date.now());
  }

  /**
   * Remove from queue
   */
  removeFromQueue(contentId: string): void {
    this.db.prepare('DELETE FROM queue WHERE content_id = ?').run(contentId);
  }

  /**
   * Get queue items
   */
  getQueue(): any[] {
    return this.db.prepare('SELECT * FROM v_queue_items').all() as any[];
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.db.prepare('DELETE FROM queue').run();
  }

  // ==================== BACKUP & RESTORE ====================

  /**
   * Create backup
   */
  async createBackup(backupPath: string, options: BackupOptions = {}): Promise<void> {
    const backup = new Database(backupPath);
    
    try {
      await this.db.backup(backup);
      logger.info(`Backup created at ${backupPath}`);
    } finally {
      backup.close();
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    const backup = new Database(backupPath);
    
    try {
      // Close current database
      this.db.close();
      
      // Copy backup to current database path
      await backup.backup(new Database(this.dbPath));
      
      // Reopen database
      this.db = new Database(this.dbPath);
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      
      logger.info('Database restored from backup');
    } finally {
      backup.close();
    }
  }

  /**
   * Export data as JSON
   */
  exportData(): any {
    const content = this.db.prepare('SELECT * FROM content').all();
    const media = this.db.prepare('SELECT * FROM media').all();
    const folders = this.db.prepare('SELECT * FROM folders').all();
    const settings = this.db.prepare('SELECT * FROM settings').all();

    return {
      version: 1,
      exportedAt: Date.now(),
      content,
      media,
      folders,
      settings
    };
  }

  /**
   * Import data from JSON
   */
  importData(data: any): void {
    const transaction = this.db.transaction(() => {
      // Clear existing data
      this.db.prepare('DELETE FROM content').run();
      this.db.prepare('DELETE FROM media').run();
      this.db.prepare('DELETE FROM folders').run();
      
      // Import folders first (due to foreign key constraints)
      if (data.folders) {
        const folderStmt = this.db.prepare(`
          INSERT INTO folders (id, name, color, icon, parent_id, created_at, updated_at, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const folder of data.folders) {
          folderStmt.run(
            folder.id, folder.name, folder.color, folder.icon,
            folder.parent_id, folder.created_at, folder.updated_at, folder.position
          );
        }
      }
      
      // Import content
      if (data.content) {
        for (const item of data.content) {
          this.saveContent(item);
        }
      }
      
      // Import media
      if (data.media) {
        for (const media of data.media) {
          this.saveMedia(media);
        }
      }
      
      // Import settings
      if (data.settings) {
        const settingsStmt = this.db.prepare(`
          INSERT OR REPLACE INTO settings (key, value, updated_at)
          VALUES (?, ?, ?)
        `);
        
        for (const setting of data.settings) {
          settingsStmt.run(setting.key, setting.value, setting.updated_at);
        }
      }
    });

    transaction();
    logger.info('Data imported successfully');
  }

  // ==================== STATISTICS ====================

  /**
   * Get database statistics
   */
  getStatistics(): any {
    const totalContent = this.db.prepare('SELECT COUNT(*) as count FROM content').get() as any;
    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM content 
      GROUP BY type
    `).all();
    
    const byMood = this.db.prepare(`
      SELECT mood, COUNT(*) as count 
      FROM content 
      WHERE mood IS NOT NULL
      GROUP BY mood
    `).all();
    
    const unread = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM content 
      WHERE type = 'article' AND read_at IS NULL
    `).get() as any;
    
    const favorites = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM content 
      WHERE favorite = 1
    `).get() as any;
    
    const archived = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM content 
      WHERE archived = 1
    `).get() as any;

    return {
      total: totalContent.count,
      byType,
      byMood,
      unread: unread.count,
      favorites: favorites.count,
      archived: archived.count
    };
  }

  /**
   * Clean up old data
   */
  cleanup(daysToKeep: number = 90): void {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Delete old archived content
    const deleted = this.db.prepare(`
      DELETE FROM content 
      WHERE archived = 1 AND saved_at < ?
    `).run(cutoffDate);
    
    // Clean extraction cache
    this.db.prepare(`
      DELETE FROM extraction_cache
      WHERE expires_at < ?
    `).run(Date.now());
    
    // Vacuum to reclaim space
    this.db.prepare('VACUUM').run();
    
    logger.info(`Cleanup complete. Deleted ${deleted.changes} items`);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default DatabaseService;
export { ContentItem, MediaItem, SearchOptions, BackupOptions };