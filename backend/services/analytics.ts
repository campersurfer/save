import Database from '../database/database';
import monitoringService from './monitoring';
import PrivacyControlsService from './privacy-controls';
import { logger } from '../utils/logger';
import crypto from 'crypto';

interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  properties: Record<string, any>;
  context: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: string;
    platform?: string;
    referrer?: string;
    url?: string;
  };
}

interface UserSegment {
  id: string;
  name: string;
  description: string;
  conditions: any[];
  userCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversionFunnel {
  id: string;
  name: string;
  steps: string[];
  conversionRates: number[];
  dropoffPoints: number[];
  totalUsers: number;
  completedUsers: number;
}

interface RetentionCohort {
  cohortDate: string;
  userCount: number;
  retentionRates: { [period: string]: number };
}

class AnalyticsService {
  private database: Database;
  private privacyService: PrivacyControlsService;
  private eventBuffer: AnalyticsEvent[];
  private flushInterval: NodeJS.Timeout | null;

  constructor() {
    this.database = new Database();
    this.privacyService = new PrivacyControlsService();
    this.eventBuffer = [];
    this.flushInterval = null;
    this.startEventFlushing();
  }

  /**
   * Track an analytics event
   */
  async track(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    // Check user consent for analytics
    if (event.userId) {
      const consent = await this.privacyService.getConsentStatus(event.userId);
      if (!consent.analytics) {
        return; // User hasn't consented to analytics
      }
    }

    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to buffer for batch processing
    this.eventBuffer.push(analyticsEvent);

    // Record metrics
    monitoringService.recordUserAction(event.eventType, event.userId ? 'registered' : 'anonymous');

    // If buffer is full, flush immediately
    if (this.eventBuffer.length >= 100) {
      await this.flushEvents();
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string | undefined,
    sessionId: string,
    url: string,
    context: AnalyticsEvent['context']
  ): Promise<void> {
    await this.track({
      eventType: 'page_view',
      userId,
      sessionId,
      properties: { url },
      context
    });
  }

  /**
   * Track content interaction
   */
  async trackContentInteraction(
    userId: string | undefined,
    sessionId: string,
    contentId: string,
    action: 'view' | 'save' | 'read' | 'share' | 'archive' | 'favorite',
    context: AnalyticsEvent['context'],
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track({
      eventType: 'content_interaction',
      userId,
      sessionId,
      properties: {
        contentId,
        action,
        ...properties
      },
      context
    });

    // Record specific metrics
    if (action === 'save') {
      monitoringService.recordContentSave(
        properties.contentType || 'unknown',
        properties.sourceDomain || 'unknown'
      );
    }
  }

  /**
   * Track user journey
   */
  async trackUserJourney(
    userId: string,
    sessionId: string,
    step: string,
    funnelId?: string,
    context: AnalyticsEvent['context']
  ): Promise<void> {
    await this.track({
      eventType: 'user_journey',
      userId,
      sessionId,
      properties: {
        step,
        funnelId
      },
      context
    });
  }

  /**
   * Track error
   */
  async trackError(
    userId: string | undefined,
    sessionId: string,
    error: string,
    context: AnalyticsEvent['context'],
    properties: Record<string, any> = {}
  ): Promise<void> {
    await this.track({
      eventType: 'error',
      userId,
      sessionId,
      properties: {
        error,
        ...properties
      },
      context
    });
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string, timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    totalEvents: number;
    topEvents: { eventType: string; count: number }[];
    sessionCount: number;
    averageSessionDuration: number;
    contentInteractions: any[];
    deviceBreakdown: any[];
  }> {
    // Check user consent
    const consent = await this.privacyService.getConsentStatus(userId);
    if (!consent.analytics) {
      return {
        totalEvents: 0,
        topEvents: [],
        sessionCount: 0,
        averageSessionDuration: 0,
        contentInteractions: [],
        deviceBreakdown: []
      };
    }

    // This would query the analytics database
    // For now, return placeholder data structure
    return {
      totalEvents: 0,
      topEvents: [],
      sessionCount: 0,
      averageSessionDuration: 0,
      contentInteractions: [],
      deviceBreakdown: []
    };
  }

  /**
   * Create user segment
   */
  async createUserSegment(segment: Omit<UserSegment, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserSegment> {
    const id = crypto.randomUUID();
    const now = new Date();

    const userSegment: UserSegment = {
      id,
      ...segment,
      createdAt: now,
      updatedAt: now
    };

    // Store segment definition
    this.database.prepare(`
      INSERT INTO user_segments (id, name, description, conditions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      segment.name,
      segment.description,
      JSON.stringify(segment.conditions),
      Math.floor(now.getTime() / 1000),
      Math.floor(now.getTime() / 1000)
    );

    // Calculate initial user count
    userSegment.userCount = await this.calculateSegmentSize(id);

    return userSegment;
  }

  /**
   * Analyze conversion funnel
   */
  async analyzeConversionFunnel(
    funnelId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ConversionFunnel | null> {
    // This would analyze the conversion funnel from analytics data
    // For now, return a placeholder structure
    
    return {
      id: funnelId,
      name: 'Default Funnel',
      steps: ['landing', 'signup', 'first_save', 'active_user'],
      conversionRates: [1.0, 0.25, 0.80, 0.65],
      dropoffPoints: [0, 0.75, 0.20, 0.35],
      totalUsers: 1000,
      completedUsers: 130
    };
  }

  /**
   * Calculate retention cohorts
   */
  async calculateRetentionCohorts(
    cohortPeriod: 'daily' | 'weekly' | 'monthly' = 'monthly',
    periods: number = 12
  ): Promise<RetentionCohort[]> {
    // This would calculate actual retention cohorts from user data
    // For now, return placeholder data
    
    const cohorts: RetentionCohort[] = [];
    const now = new Date();

    for (let i = 0; i < periods; i++) {
      const cohortDate = new Date(now);
      
      if (cohortPeriod === 'monthly') {
        cohortDate.setMonth(cohortDate.getMonth() - i);
      } else if (cohortPeriod === 'weekly') {
        cohortDate.setDate(cohortDate.getDate() - i * 7);
      } else {
        cohortDate.setDate(cohortDate.getDate() - i);
      }

      const retentionRates: { [period: string]: number } = {};
      
      // Generate sample retention rates
      for (let period = 1; period <= 12; period++) {
        retentionRates[`period_${period}`] = Math.max(0.1, 1.0 - period * 0.08 + Math.random() * 0.1);
      }

      cohorts.push({
        cohortDate: cohortDate.toISOString().split('T')[0],
        userCount: Math.floor(Math.random() * 1000) + 100,
        retentionRates
      });
    }

    return cohorts.reverse(); // Most recent first
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(timeRange: { start: Date; end: Date }): Promise<{
    totalUsers: number;
    activeUsers: { daily: number; weekly: number; monthly: number };
    totalSaves: number;
    averageSessionDuration: number;
    topContentTypes: { type: string; count: number }[];
    topDomains: { domain: string; count: number }[];
    deviceBreakdown: { device: string; percentage: number }[];
    conversionRate: number;
    retentionRate: number;
    revenueGrowth: number;
  }> {
    // This would calculate real metrics from the database
    // For now, return sample data
    
    return {
      totalUsers: 12500,
      activeUsers: {
        daily: 2100,
        weekly: 5800,
        monthly: 9200
      },
      totalSaves: 45000,
      averageSessionDuration: 420, // seconds
      topContentTypes: [
        { type: 'article', count: 25000 },
        { type: 'tweet', count: 12000 },
        { type: 'video', count: 5500 },
        { type: 'image', count: 2500 }
      ],
      topDomains: [
        { domain: 'twitter.com', count: 12000 },
        { domain: 'medium.com', count: 8500 },
        { domain: 'youtube.com', count: 5500 },
        { domain: 'github.com', count: 4200 },
        { domain: 'reddit.com', count: 3800 }
      ],
      deviceBreakdown: [
        { device: 'mobile', percentage: 65 },
        { device: 'desktop', percentage: 30 },
        { device: 'tablet', percentage: 5 }
      ],
      conversionRate: 0.125, // 12.5%
      retentionRate: 0.68, // 68%
      revenueGrowth: 0.15 // 15% month-over-month
    };
  }

  /**
   * Generate insights
   */
  async generateInsights(userId?: string): Promise<{
    insights: string[];
    recommendations: string[];
    alerts: string[];
  }> {
    const insights = [];
    const recommendations = [];
    const alerts = [];

    // Example insights based on data patterns
    insights.push(
      "User engagement is highest on weekday evenings",
      "Article saves have increased 23% this month",
      "Mobile users spend 40% more time reading than desktop users"
    );

    recommendations.push(
      "Consider sending digest emails at 7 PM for better engagement",
      "Promote article discovery features to maintain growth",
      "Optimize mobile reading experience for longer sessions"
    );

    // Check for any concerning patterns
    const metrics = await this.getDashboardMetrics({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date()
    });

    if (metrics.retentionRate < 0.5) {
      alerts.push("User retention rate has dropped below 50%");
    }

    if (metrics.activeUsers.daily < metrics.activeUsers.weekly * 0.2) {
      alerts.push("Daily active users are unusually low");
    }

    return { insights, recommendations, alerts };
  }

  /**
   * Start periodic event flushing
   */
  private startEventFlushing(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushEvents();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Flush events to storage
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = this.eventBuffer.splice(0); // Empty the buffer

    try {
      // In a real implementation, this would batch insert to a time-series database
      // For now, we'll just log the events
      logger.info(`Flushing ${events.length} analytics events`);
      
      // Could store in ClickHouse, InfluxDB, or similar time-series database
      for (const event of events) {
        // Store event (simplified version using SQLite for demo)
        const eventId = crypto.randomUUID();
        // This would typically go to a dedicated analytics database
      }

    } catch (error) {
      logger.error('Failed to flush analytics events:', error);
      
      // Put events back in buffer to retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Calculate user segment size
   */
  private async calculateSegmentSize(segmentId: string): Promise<number> {
    // This would evaluate segment conditions against user data
    // For now, return a random number
    return Math.floor(Math.random() * 1000) + 50;
  }

  /**
   * Stop analytics service
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining events
    this.flushEvents();

    logger.info('Stopped analytics service');
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;
export { AnalyticsService, AnalyticsEvent, UserSegment, ConversionFunnel, RetentionCohort };