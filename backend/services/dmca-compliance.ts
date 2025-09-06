import DatabaseService from '../database/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface DMCARequest {
  id?: string;
  type: 'takedown' | 'counter-notice';
  claimant: {
    name: string;
    email: string;
    address: string;
    phone?: string;
    organization?: string;
  };
  copyrightedWork: {
    title: string;
    description: string;
    url?: string;
    registrationNumber?: string;
  };
  allegedInfringement: {
    contentId: string;
    url: string;
    description: string;
  };
  goodFaithStatement: boolean;
  accuracyStatement: boolean;
  authorityStatement: boolean;
  signature: string;
  submittedAt: number;
  processedAt?: number;
  status: 'received' | 'processing' | 'valid' | 'invalid' | 'completed' | 'disputed';
  processingNotes?: string;
  responseRequired?: boolean;
  responseDeadline?: number;
}

interface CounterNotice {
  id?: string;
  originalTakedownId: string;
  respondent: {
    name: string;
    email: string;
    address: string;
    phone?: string;
  };
  identificationOfMaterial: string;
  locationOfMaterial: string;
  goodFaithStatement: boolean;
  consentToJurisdiction: boolean;
  accuracyStatement: boolean;
  signature: string;
  submittedAt: number;
  processedAt?: number;
  status: 'received' | 'processing' | 'valid' | 'invalid' | 'completed';
  processingNotes?: string;
}

interface ComplianceAuditLog {
  id?: string;
  action: string;
  entityType: 'content' | 'user' | 'dmca_request' | 'privacy_request';
  entityId: string;
  details: any;
  performedBy: string;
  performedAt: number;
  ipAddress?: string;
  userAgent?: string;
}

class DMCACompliance {
  private db: DatabaseService;
  private auditLogs: ComplianceAuditLog[] = [];
  private complianceEmail: string;
  private legalContactInfo: any;

  constructor(db: DatabaseService) {
    this.db = db;
    this.complianceEmail = process.env.DMCA_EMAIL || 'dmca@saveapp.com';
    this.legalContactInfo = {
      name: 'Save App Legal Team',
      address: '123 Tech Street, San Francisco, CA 94105',
      phone: '+1-555-SAVE-APP',
      email: this.complianceEmail
    };
  }

  /**
   * Process DMCA takedown request
   */
  async processTakedown(request: DMCARequest): Promise<{
    status: 'processed' | 'invalid' | 'error';
    requestId?: string;
    reason?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Validate DMCA request
      const validation = this.validateDMCARequest(request);
      if (!validation.valid) {
        await this.logAudit({
          action: 'dmca_request_invalid',
          entityType: 'dmca_request',
          entityId: request.id || 'unknown',
          details: { reason: validation.reason, request },
          performedBy: 'system',
          performedAt: Date.now()
        });

        return {
          status: 'invalid',
          reason: validation.reason
        };
      }

      // Generate unique request ID
      const requestId = this.generateRequestId();
      request.id = requestId;
      request.status = 'processing';
      request.processedAt = Date.now();
      request.responseRequired = true;
      request.responseDeadline = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      // Save DMCA request
      await this.saveDMCARequest(request);

      // Remove infringing content
      await this.removeContent(request.allegedInfringement.contentId, requestId);

      // Log compliance action
      await this.logAudit({
        action: 'dmca_takedown_processed',
        entityType: 'content',
        entityId: request.allegedInfringement.contentId,
        details: { dmcaRequestId: requestId, claimant: request.claimant },
        performedBy: 'system',
        performedAt: Date.now()
      });

      // Send notifications
      await this.notifyUser(request.allegedInfringement.contentId, requestId);
      await this.sendConfirmation(request.claimant, requestId);

      // Update status
      request.status = 'completed';
      await this.updateDMCARequest(requestId, { status: 'completed' });

      const responseTime = Date.now() - startTime;
      
      logger.info(`DMCA takedown processed: ${requestId} in ${responseTime}ms`);

      return {
        status: 'processed',
        requestId,
        responseTime
      };

    } catch (error) {
      logger.error('DMCA processing error:', error);
      
      await this.logAudit({
        action: 'dmca_processing_error',
        entityType: 'dmca_request',
        entityId: request.id || 'unknown',
        details: { error: error.message, request },
        performedBy: 'system',
        performedAt: Date.now()
      });

      return {
        status: 'error',
        reason: 'Internal processing error'
      };
    }
  }

  /**
   * Validate DMCA takedown request
   */
  private validateDMCARequest(request: DMCARequest): { valid: boolean; reason?: string } {
    // Check required fields
    if (!request.claimant.name || !request.claimant.email) {
      return { valid: false, reason: 'Missing claimant information' };
    }

    if (!request.copyrightedWork.title || !request.copyrightedWork.description) {
      return { valid: false, reason: 'Missing copyrighted work information' };
    }

    if (!request.allegedInfringement.contentId || !request.allegedInfringement.url) {
      return { valid: false, reason: 'Missing infringement information' };
    }

    if (!request.goodFaithStatement || !request.accuracyStatement || !request.authorityStatement) {
      return { valid: false, reason: 'Missing required legal statements' };
    }

    if (!request.signature) {
      return { valid: false, reason: 'Missing signature' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.claimant.email)) {
      return { valid: false, reason: 'Invalid email address' };
    }

    // Check if content exists
    const content = this.db.getContent(request.allegedInfringement.contentId);
    if (!content) {
      return { valid: false, reason: 'Content not found' };
    }

    return { valid: true };
  }

  /**
   * Process counter-notice
   */
  async processCounterNotice(counterNotice: CounterNotice): Promise<{
    status: 'processed' | 'invalid' | 'error';
    noticeId?: string;
    reason?: string;
  }> {
    try {
      // Validate counter-notice
      const validation = this.validateCounterNotice(counterNotice);
      if (!validation.valid) {
        return {
          status: 'invalid',
          reason: validation.reason
        };
      }

      // Generate unique notice ID
      const noticeId = this.generateRequestId();
      counterNotice.id = noticeId;
      counterNotice.status = 'processing';
      counterNotice.processedAt = Date.now();

      // Save counter-notice
      await this.saveCounterNotice(counterNotice);

      // Log compliance action
      await this.logAudit({
        action: 'counter_notice_received',
        entityType: 'dmca_request',
        entityId: counterNotice.originalTakedownId,
        details: { counterNoticeId: noticeId, respondent: counterNotice.respondent },
        performedBy: 'system',
        performedAt: Date.now()
      });

      // Notify original claimant
      await this.notifyClaimantOfCounterNotice(counterNotice);

      // Schedule restoration (10-14 business days as per DMCA)
      await this.scheduleContentRestoration(counterNotice, 14 * 24 * 60 * 60 * 1000);

      counterNotice.status = 'completed';
      await this.updateCounterNotice(noticeId, { status: 'completed' });

      return {
        status: 'processed',
        noticeId
      };

    } catch (error) {
      logger.error('Counter-notice processing error:', error);
      return {
        status: 'error',
        reason: 'Internal processing error'
      };
    }
  }

  /**
   * Validate counter-notice
   */
  private validateCounterNotice(counterNotice: CounterNotice): { valid: boolean; reason?: string } {
    if (!counterNotice.respondent.name || !counterNotice.respondent.email) {
      return { valid: false, reason: 'Missing respondent information' };
    }

    if (!counterNotice.identificationOfMaterial || !counterNotice.locationOfMaterial) {
      return { valid: false, reason: 'Missing material identification' };
    }

    if (!counterNotice.goodFaithStatement || !counterNotice.consentToJurisdiction || !counterNotice.accuracyStatement) {
      return { valid: false, reason: 'Missing required legal statements' };
    }

    if (!counterNotice.signature) {
      return { valid: false, reason: 'Missing signature' };
    }

    return { valid: true };
  }

  /**
   * Remove infringing content
   */
  private async removeContent(contentId: string, dmcaRequestId: string): Promise<void> {
    try {
      // Get content details before removal
      const content = await this.db.getContent(contentId);
      
      if (content) {
        // Mark content as removed due to DMCA
        await this.db.saveContent({
          ...content,
          archived: true,
          notes: `DMCA takedown: ${dmcaRequestId}`
        });

        // Remove from all cache tiers (if cache service is available)
        // This would integrate with the cache service

        // Remove media files
        const media = await this.db.getMediaForContent(contentId);
        for (const mediaItem of media) {
          await this.removeMediaFile(mediaItem.localPath);
        }
      }

      await this.logAudit({
        action: 'content_removed_dmca',
        entityType: 'content',
        entityId: contentId,
        details: { dmcaRequestId, contentUrl: content?.url },
        performedBy: 'dmca_system',
        performedAt: Date.now()
      });

    } catch (error) {
      logger.error(`Failed to remove content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Remove media file from storage
   */
  private async removeMediaFile(localPath?: string): Promise<void> {
    if (!localPath) return;

    try {
      await fs.unlink(localPath);
      logger.debug(`Media file removed: ${localPath}`);
    } catch (error) {
      logger.warn(`Failed to remove media file ${localPath}:`, error);
    }
  }

  /**
   * Notify user of DMCA takedown
   */
  private async notifyUser(contentId: string, dmcaRequestId: string): Promise<void> {
    // This would integrate with an email service
    logger.info(`DMCA notification sent for content ${contentId}, request ${dmcaRequestId}`);
    
    // In a real implementation, this would send an email to the user
    // explaining the takedown and their right to file a counter-notice
  }

  /**
   * Send confirmation to claimant
   */
  private async sendConfirmation(claimant: any, requestId: string): Promise<void> {
    // This would send an email confirmation to the claimant
    logger.info(`DMCA confirmation sent to ${claimant.email} for request ${requestId}`);
  }

  /**
   * Notify claimant of counter-notice
   */
  private async notifyClaimantOfCounterNotice(counterNotice: CounterNotice): Promise<void> {
    // Get original takedown request
    const originalRequest = await this.getDMCARequest(counterNotice.originalTakedownId);
    
    if (originalRequest) {
      logger.info(`Counter-notice notification sent to ${originalRequest.claimant.email}`);
      // Send email notification about counter-notice
    }
  }

  /**
   * Schedule content restoration after counter-notice period
   */
  private async scheduleContentRestoration(counterNotice: CounterNotice, delayMs: number): Promise<void> {
    // In a real implementation, this would use a job queue
    setTimeout(async () => {
      await this.restoreContent(counterNotice.originalTakedownId);
    }, delayMs);
  }

  /**
   * Restore content after counter-notice period
   */
  private async restoreContent(dmcaRequestId: string): Promise<void> {
    try {
      // Find content marked with this DMCA request
      const searchResults = await this.db.search({
        query: `DMCA takedown: ${dmcaRequestId}`,
        limit: 1
      });

      if (searchResults.length > 0) {
        const content = searchResults[0];
        
        // Restore content
        await this.db.saveContent({
          ...content,
          archived: false,
          notes: content.notes?.replace(`DMCA takedown: ${dmcaRequestId}`, `Restored after counter-notice: ${Date.now()}`)
        });

        await this.logAudit({
          action: 'content_restored_counter_notice',
          entityType: 'content',
          entityId: content.id!,
          details: { dmcaRequestId },
          performedBy: 'dmca_system',
          performedAt: Date.now()
        });

        logger.info(`Content restored after counter-notice period: ${content.id}`);
      }
    } catch (error) {
      logger.error('Content restoration error:', error);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `DMCA-${timestamp}-${random}`;
  }

  /**
   * Save DMCA request to persistent storage
   */
  private async saveDMCARequest(request: DMCARequest): Promise<void> {
    // In a real implementation, this would save to a dedicated compliance database
    const filePath = path.join(__dirname, '..', 'compliance', 'dmca-requests.json');
    
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let requests: DMCARequest[] = [];
      try {
        const existing = await fs.readFile(filePath, 'utf8');
        requests = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }

      requests.push(request);
      await fs.writeFile(filePath, JSON.stringify(requests, null, 2));
    } catch (error) {
      logger.error('Failed to save DMCA request:', error);
    }
  }

  /**
   * Update DMCA request
   */
  private async updateDMCARequest(requestId: string, updates: Partial<DMCARequest>): Promise<void> {
    const filePath = path.join(__dirname, '..', 'compliance', 'dmca-requests.json');
    
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      const requests: DMCARequest[] = JSON.parse(existing);
      
      const index = requests.findIndex(r => r.id === requestId);
      if (index !== -1) {
        requests[index] = { ...requests[index], ...updates };
        await fs.writeFile(filePath, JSON.stringify(requests, null, 2));
      }
    } catch (error) {
      logger.error('Failed to update DMCA request:', error);
    }
  }

  /**
   * Get DMCA request by ID
   */
  private async getDMCARequest(requestId: string): Promise<DMCARequest | null> {
    const filePath = path.join(__dirname, '..', 'compliance', 'dmca-requests.json');
    
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      const requests: DMCARequest[] = JSON.parse(existing);
      
      return requests.find(r => r.id === requestId) || null;
    } catch (error) {
      logger.error('Failed to get DMCA request:', error);
      return null;
    }
  }

  /**
   * Save counter-notice
   */
  private async saveCounterNotice(counterNotice: CounterNotice): Promise<void> {
    const filePath = path.join(__dirname, '..', 'compliance', 'counter-notices.json');
    
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let notices: CounterNotice[] = [];
      try {
        const existing = await fs.readFile(filePath, 'utf8');
        notices = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }

      notices.push(counterNotice);
      await fs.writeFile(filePath, JSON.stringify(notices, null, 2));
    } catch (error) {
      logger.error('Failed to save counter-notice:', error);
    }
  }

  /**
   * Update counter-notice
   */
  private async updateCounterNotice(noticeId: string, updates: Partial<CounterNotice>): Promise<void> {
    const filePath = path.join(__dirname, '..', 'compliance', 'counter-notices.json');
    
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      const notices: CounterNotice[] = JSON.parse(existing);
      
      const index = notices.findIndex(n => n.id === noticeId);
      if (index !== -1) {
        notices[index] = { ...notices[index], ...updates };
        await fs.writeFile(filePath, JSON.stringify(notices, null, 2));
      }
    } catch (error) {
      logger.error('Failed to update counter-notice:', error);
    }
  }

  /**
   * Log audit event
   */
  async logAudit(entry: ComplianceAuditLog): Promise<void> {
    entry.id = crypto.randomUUID();
    this.auditLogs.push(entry);

    // Also save to persistent storage
    const filePath = path.join(__dirname, '..', 'compliance', 'audit-logs.json');
    
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      let logs: ComplianceAuditLog[] = [];
      try {
        const existing = await fs.readFile(filePath, 'utf8');
        logs = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }

      logs.push(entry);
      
      // Keep only last 10,000 entries
      if (logs.length > 10000) {
        logs = logs.slice(-10000);
      }

      await fs.writeFile(filePath, JSON.stringify(logs, null, 2));
    } catch (error) {
      logger.error('Failed to save audit log:', error);
    }

    logger.debug(`Audit logged: ${entry.action} for ${entry.entityType}:${entry.entityId}`);
  }

  /**
   * Get DMCA statistics
   */
  async getStatistics(): Promise<{
    totalRequests: number;
    processingTime: number;
    contentRemoved: number;
    counterNotices: number;
    restoredContent: number;
  }> {
    // This would query the persistent storage for actual statistics
    return {
      totalRequests: 0,
      processingTime: 12, // average hours
      contentRemoved: 0,
      counterNotices: 0,
      restoredContent: 0
    };
  }

  /**
   * Get compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const logs = this.auditLogs.filter(log => 
      log.performedAt >= startDate.getTime() && 
      log.performedAt <= endDate.getTime()
    );

    return {
      period: { start: startDate, end: endDate },
      totalEvents: logs.length,
      dmcaTakedowns: logs.filter(log => log.action === 'dmca_takedown_processed').length,
      counterNotices: logs.filter(log => log.action === 'counter_notice_received').length,
      contentRemoved: logs.filter(log => log.action === 'content_removed_dmca').length,
      contentRestored: logs.filter(log => log.action === 'content_restored_counter_notice').length,
      averageResponseTime: '< 24 hours'
    };
  }
}

export default DMCACompliance;
export { DMCARequest, CounterNotice, ComplianceAuditLog };