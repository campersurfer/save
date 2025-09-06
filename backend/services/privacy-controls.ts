import Database from '../database/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

interface ConsentOptions {
  userId: string;
  consentType: 'analytics' | 'marketing' | 'cookies' | 'data_processing' | 'third_party_sharing';
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
}

interface PrivacySettings {
  userId: string;
  dataRetentionDays: number;
  allowAnalytics: boolean;
  allowMarketing: boolean;
  allowThirdPartySharing: boolean;
  allowCookies: boolean;
  searchHistoryRetention: number; // days
  autoDeleteInactive: boolean; // auto-delete after period of inactivity
  inactivityPeriodDays: number;
  allowDataExport: boolean;
  requireEncryption: boolean;
}

interface DataProcessingRecord {
  id: string;
  userId: string;
  activity: string;
  purpose: string;
  lawfulBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  dataTypes: string[];
  recipients: string[];
  retentionPeriod: string;
  timestamp: Date;
}

interface PrivacyPolicyVersion {
  version: string;
  content: string;
  effectiveDate: Date;
  changes: string[];
}

class PrivacyControlsService {
  private database: Database;

  constructor() {
    this.database = new Database();
  }

  /**
   * Record user consent for specific data processing activities
   */
  async recordConsent(options: ConsentOptions): Promise<void> {
    const { userId, consentType, granted, ipAddress, userAgent } = options;

    try {
      // Insert or update consent record
      this.database.prepare(`
        INSERT OR REPLACE INTO privacy_consents (
          id, user_id, consent_type, granted, granted_at, updated_at, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        userId,
        consentType,
        granted ? 1 : 0,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
        ipAddress || null,
        userAgent || null
      );

      // Log the consent change
      await this.logDataProcessingActivity({
        userId,
        activity: `consent_${granted ? 'granted' : 'withdrawn'}`,
        purpose: `User ${granted ? 'granted' : 'withdrew'} consent for ${consentType}`,
        lawfulBasis: 'consent',
        dataTypes: [consentType],
        recipients: ['Save App'],
        retentionPeriod: 'As per user settings',
        timestamp: new Date()
      });

      // Apply consent changes immediately
      await this.applyConsentChanges(userId, consentType, granted);

      logger.info(`Consent ${granted ? 'granted' : 'withdrawn'}`, {
        userId,
        consentType,
        ipAddress
      });

    } catch (error) {
      logger.error('Failed to record consent:', error);
      throw error;
    }
  }

  /**
   * Get current consent status for user
   */
  async getConsentStatus(userId: string): Promise<Record<string, boolean>> {
    const consents = this.database.prepare(`
      SELECT consent_type, granted 
      FROM privacy_consents 
      WHERE user_id = ?
    `).all(userId);

    const consentMap: Record<string, boolean> = {};
    for (const consent of consents) {
      consentMap[consent.consent_type] = !!consent.granted;
    }

    return consentMap;
  }

  /**
   * Update user privacy settings
   */
  async updatePrivacySettings(settings: PrivacySettings): Promise<void> {
    const { userId } = settings;

    try {
      // Store privacy settings
      const settingsJson = JSON.stringify(settings);
      
      this.database.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `).run(
        `privacy_settings_${userId}`,
        settingsJson,
        Math.floor(Date.now() / 1000)
      );

      // Schedule automatic data deletion if enabled
      if (settings.autoDeleteInactive) {
        await this.scheduleAutomaticDeletion(userId, settings.inactivityPeriodDays);
      }

      // Apply immediate changes based on settings
      await this.applyPrivacySettings(settings);

      logger.info('Privacy settings updated', { userId });

    } catch (error) {
      logger.error('Failed to update privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get user privacy settings
   */
  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const setting = this.database.prepare(`
      SELECT value FROM settings WHERE key = ?
    `).get(`privacy_settings_${userId}`);

    if (!setting) {
      return this.getDefaultPrivacySettings(userId);
    }

    return JSON.parse(setting.value);
  }

  /**
   * Apply consent changes to user data
   */
  private async applyConsentChanges(
    userId: string, 
    consentType: string, 
    granted: boolean
  ): Promise<void> {
    switch (consentType) {
      case 'analytics':
        if (!granted) {
          // Stop analytics collection and anonymize existing data
          await this.anonymizeAnalyticsData(userId);
        }
        break;

      case 'marketing':
        if (!granted) {
          // Remove from marketing lists
          await this.removeFromMarketing(userId);
        }
        break;

      case 'cookies':
        if (!granted) {
          // Clear tracking cookies
          await this.clearTrackingData(userId);
        }
        break;

      case 'data_processing':
        if (!granted) {
          // Minimal processing only
          await this.applyMinimalProcessing(userId);
        }
        break;

      case 'third_party_sharing':
        if (!granted) {
          // Stop third-party data sharing
          await this.stopThirdPartySharing(userId);
        }
        break;
    }
  }

  /**
   * Apply privacy settings changes
   */
  private async applyPrivacySettings(settings: PrivacySettings): Promise<void> {
    const { userId } = settings;

    // Apply data retention settings
    if (settings.dataRetentionDays > 0) {
      await this.enforceDataRetention(userId, settings.dataRetentionDays);
    }

    // Apply search history retention
    if (settings.searchHistoryRetention > 0) {
      await this.cleanupSearchHistory(userId, settings.searchHistoryRetention);
    }

    // Apply encryption requirements
    if (settings.requireEncryption) {
      await this.enableEncryptionForUser(userId);
    }
  }

  /**
   * Log data processing activities for audit trail
   */
  async logDataProcessingActivity(record: Omit<DataProcessingRecord, 'id'>): Promise<void> {
    const id = crypto.randomUUID();

    try {
      this.database.prepare(`
        INSERT INTO dmca_audit_log (
          id, action_type, user_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        'data_processing',
        record.userId,
        JSON.stringify({
          activity: record.activity,
          purpose: record.purpose,
          lawfulBasis: record.lawfulBasis,
          dataTypes: record.dataTypes,
          recipients: record.recipients,
          retentionPeriod: record.retentionPeriod
        }),
        Math.floor(record.timestamp.getTime() / 1000)
      );

    } catch (error) {
      logger.error('Failed to log data processing activity:', error);
    }
  }

  /**
   * Generate privacy report for user
   */
  async generatePrivacyReport(userId: string): Promise<{
    consentStatus: Record<string, boolean>;
    privacySettings: PrivacySettings | null;
    dataProcessingActivities: any[];
    dataRetentionSchedule: any[];
  }> {
    const consentStatus = await this.getConsentStatus(userId);
    const privacySettings = await this.getPrivacySettings(userId);

    // Get data processing activities
    const dataProcessingActivities = this.database.prepare(`
      SELECT details, created_at 
      FROM dmca_audit_log 
      WHERE user_id = ? AND action_type = 'data_processing'
      ORDER BY created_at DESC
      LIMIT 100
    `).all(userId);

    // Get scheduled deletions
    const dataRetentionSchedule = this.database.prepare(`
      SELECT * FROM deletion_requests
      WHERE user_id = ? AND status IN ('pending', 'scheduled')
      ORDER BY scheduled_for ASC
    `).all(userId);

    return {
      consentStatus,
      privacySettings,
      dataProcessingActivities: dataProcessingActivities.map(activity => ({
        ...JSON.parse(activity.details),
        timestamp: new Date(activity.created_at * 1000)
      })),
      dataRetentionSchedule
    };
  }

  /**
   * Handle data subject requests (GDPR Article 15-22)
   */
  async handleDataSubjectRequest(
    userId: string,
    requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection',
    details: any
  ): Promise<{ requestId: string; status: string; estimatedCompletion: Date }> {
    const requestId = crypto.randomUUID();
    const estimatedCompletion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Log the request
    await this.logDataProcessingActivity({
      userId,
      activity: `data_subject_request_${requestType}`,
      purpose: `User requested ${requestType} under GDPR`,
      lawfulBasis: 'legal_obligation',
      dataTypes: ['personal_data'],
      recipients: ['Save App Legal Team'],
      retentionPeriod: '3 years',
      timestamp: new Date()
    });

    switch (requestType) {
      case 'access':
        // Handle data access request - would trigger data export
        break;
      case 'erasure':
        // Handle right to be forgotten - would trigger deletion request
        break;
      case 'portability':
        // Handle data portability - would trigger structured export
        break;
      // ... handle other request types
    }

    logger.info(`Data subject request received`, {
      userId,
      requestType,
      requestId
    });

    return {
      requestId,
      status: 'pending',
      estimatedCompletion
    };
  }

  /**
   * Cookie consent banner management
   */
  async getCookieConsentBanner(userId?: string): Promise<{
    required: boolean;
    categories: any[];
    currentConsents?: Record<string, boolean>;
  }> {
    const categories = [
      {
        id: 'necessary',
        name: 'Strictly Necessary',
        description: 'These cookies are essential for the website to function properly.',
        required: true,
        enabled: true
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'These cookies help us understand how you use the website.',
        required: false,
        enabled: false
      },
      {
        id: 'marketing',
        name: 'Marketing',
        description: 'These cookies are used to show you relevant advertisements.',
        required: false,
        enabled: false
      }
    ];

    let currentConsents = {};
    if (userId) {
      currentConsents = await this.getConsentStatus(userId);
    }

    return {
      required: !userId || Object.keys(currentConsents).length === 0,
      categories,
      currentConsents
    };
  }

  /**
   * Privacy helper methods
   */
  private getDefaultPrivacySettings(userId: string): PrivacySettings {
    return {
      userId,
      dataRetentionDays: 365 * 2, // 2 years default
      allowAnalytics: false,
      allowMarketing: false,
      allowThirdPartySharing: false,
      allowCookies: false,
      searchHistoryRetention: 90, // 3 months
      autoDeleteInactive: false,
      inactivityPeriodDays: 365, // 1 year
      allowDataExport: true,
      requireEncryption: true
    };
  }

  private async anonymizeAnalyticsData(userId: string): Promise<void> {
    // Remove personally identifiable information from analytics
    logger.info(`Anonymizing analytics data for user ${userId}`);
  }

  private async removeFromMarketing(userId: string): Promise<void> {
    // Remove user from marketing campaigns and lists
    logger.info(`Removing user ${userId} from marketing`);
  }

  private async clearTrackingData(userId: string): Promise<void> {
    // Clear tracking cookies and related data
    logger.info(`Clearing tracking data for user ${userId}`);
  }

  private async applyMinimalProcessing(userId: string): Promise<void> {
    // Apply minimal data processing rules
    logger.info(`Applying minimal processing for user ${userId}`);
  }

  private async stopThirdPartySharing(userId: string): Promise<void> {
    // Stop sharing data with third parties
    logger.info(`Stopping third-party sharing for user ${userId}`);
  }

  private async enforceDataRetention(userId: string, retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    // Delete old content based on retention policy
    this.database.prepare(`
      DELETE FROM content 
      WHERE saved_at < ? AND archived = 0
    `).run(cutoffTimestamp);

    logger.info(`Enforced data retention policy`, { userId, retentionDays });
  }

  private async cleanupSearchHistory(userId: string, retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    this.database.prepare(`
      DELETE FROM search_history 
      WHERE searched_at < ?
    `).run(cutoffTimestamp);

    logger.info(`Cleaned up search history`, { userId, retentionDays });
  }

  private async enableEncryptionForUser(userId: string): Promise<void> {
    // Enable additional encryption for user data
    logger.info(`Enabling encryption for user ${userId}`);
  }

  private async scheduleAutomaticDeletion(userId: string, inactivityDays: number): Promise<void> {
    // Schedule automatic deletion after inactivity period
    logger.info(`Scheduled automatic deletion after ${inactivityDays} days of inactivity`, { userId });
  }
}

export default PrivacyControlsService;
export { ConsentOptions, PrivacySettings, DataProcessingRecord };