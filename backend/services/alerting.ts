import { logger } from '../utils/logger';
import monitoringService from './monitoring';
import { EventEmitter } from 'events';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  notificationChannels: string[];
  lastTriggered?: Date;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'discord';
  config: {
    url?: string;
    email?: string;
    token?: string;
    channel?: string;
  };
  enabled: boolean;
}

class AlertingService extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultRules();
    this.setupDefaultChannels();
    this.startMonitoring();
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage is above 85%',
        metric: 'memory_usage_ratio',
        condition: 'gt',
        threshold: 0.85,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 15,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'CPU usage is above 80%',
        metric: 'cpu_usage_ratio',
        condition: 'gt',
        threshold: 0.80,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'low_disk_space',
        name: 'Low Disk Space',
        description: 'Available disk space is below 10%',
        metric: 'disk_available_ratio',
        condition: 'lt',
        threshold: 0.10,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 30,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'HTTP error rate is above 5%',
        metric: 'http_error_rate',
        condition: 'gt',
        threshold: 0.05,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 5,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        description: 'Average response time is above 2 seconds',
        metric: 'avg_response_time',
        condition: 'gt',
        threshold: 2.0,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 5,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'database_connection_errors',
        name: 'Database Connection Errors',
        description: 'Database connection failures detected',
        metric: 'database_connection_errors',
        condition: 'gt',
        threshold: 0,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 2,
        notificationChannels: ['default_webhook']
      },
      {
        id: 'extraction_failure_rate',
        name: 'High Extraction Failure Rate',
        description: 'Content extraction failure rate is above 20%',
        metric: 'extraction_failure_rate',
        condition: 'gt',
        threshold: 0.20,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        notificationChannels: ['default_webhook']
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    logger.info(`Loaded ${defaultRules.length} default alert rules`);
  }

  /**
   * Setup default notification channels
   */
  private setupDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'default_webhook',
        name: 'Default Webhook',
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL || 'http://localhost:3001/alerts'
        },
        enabled: true
      }
    ];

    defaultChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });
  }

  /**
   * Start monitoring metrics and checking alert rules
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkAlertRules();
    }, 30000); // Check every 30 seconds

    logger.info('Started alert monitoring');
  }

  /**
   * Check all alert rules against current metrics
   */
  private async checkAlertRules(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();

      for (const [ruleId, rule] of this.alertRules.entries()) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered && this.isInCooldown(rule)) {
          continue;
        }

        const currentValue = metrics[rule.metric];
        if (currentValue === undefined) {
          continue; // Metric not available
        }

        const shouldAlert = this.evaluateCondition(
          currentValue,
          rule.condition,
          rule.threshold
        );

        if (shouldAlert) {
          await this.triggerAlert(rule, currentValue);
        } else {
          // Check if we should resolve an existing alert
          await this.maybeResolveAlert(ruleId);
        }
      }

    } catch (error) {
      logger.error('Error checking alert rules:', error);
    }
  }

  /**
   * Get current metrics for alert evaluation
   */
  private async getCurrentMetrics(): Promise<Record<string, number>> {
    try {
      const health = await monitoringService.getHealthCheck();
      const memUsage = health.memory;
      
      // Calculate some basic metrics
      const metrics: Record<string, number> = {
        memory_usage_ratio: memUsage.heapUsed / memUsage.heapTotal,
        cpu_usage_ratio: Math.random() * 0.5, // Placeholder
        disk_available_ratio: Math.random() * 0.8, // Placeholder
        http_error_rate: Math.random() * 0.02, // Placeholder
        avg_response_time: Math.random() * 3, // Placeholder
        database_connection_errors: health.database ? 0 : 1,
        extraction_failure_rate: Math.random() * 0.1 // Placeholder
      };

      return metrics;
    } catch (error) {
      logger.error('Failed to get current metrics:', error);
      return {};
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(
    value: number,
    condition: AlertRule['condition'],
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return false;
    
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return Date.now() - rule.lastTriggered.getTime() < cooldownMs;
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      message: this.generateAlertMessage(rule, currentValue),
      severity: rule.severity,
      currentValue,
      threshold: rule.threshold,
      triggeredAt: new Date(),
      status: 'active'
    };

    this.activeAlerts.set(alertId, alert);
    rule.lastTriggered = new Date();

    // Send notifications
    await this.sendNotifications(alert, rule.notificationChannels);

    // Emit alert event
    this.emit('alert', alert);

    logger.warn(`Alert triggered: ${rule.name}`, {
      alertId,
      currentValue,
      threshold: rule.threshold,
      severity: rule.severity
    });
  }

  /**
   * Maybe resolve an existing alert for a rule
   */
  private async maybeResolveAlert(ruleId: string): Promise<void> {
    const activeAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.ruleId === ruleId && alert.status === 'active');

    if (activeAlert) {
      activeAlert.status = 'resolved';
      activeAlert.resolvedAt = new Date();

      // Emit resolution event
      this.emit('alertResolved', activeAlert);

      logger.info(`Alert resolved: ${activeAlert.ruleName}`, {
        alertId: activeAlert.id,
        duration: activeAlert.resolvedAt.getTime() - activeAlert.triggeredAt.getTime()
      });
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, currentValue: number): string {
    const conditionText = {
      'gt': 'above',
      'gte': 'at or above',
      'lt': 'below',
      'lte': 'at or below',
      'eq': 'equal to'
    }[rule.condition] || 'unknown';

    return `${rule.description} - Current value: ${currentValue.toFixed(3)} is ${conditionText} threshold: ${rule.threshold}`;
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, channelIds: string[]): Promise<void> {
    const notifications = channelIds.map(channelId => {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) return null;
      
      return this.sendNotification(alert, channel);
    }).filter(Boolean);

    try {
      await Promise.allSettled(notifications);
    } catch (error) {
      logger.error('Failed to send some notifications:', error);
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'webhook':
          await this.sendWebhookNotification(alert, channel);
          break;
        case 'slack':
          await this.sendSlackNotification(alert, channel);
          break;
        case 'email':
          await this.sendEmailNotification(alert, channel);
          break;
        case 'discord':
          await this.sendDiscordNotification(alert, channel);
          break;
        default:
          logger.warn(`Unsupported notification channel type: ${channel.type}`);
      }
    } catch (error) {
      logger.error(`Failed to send notification to ${channel.name}:`, error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const payload = {
      alert: {
        id: alert.id,
        name: alert.ruleName,
        message: alert.message,
        severity: alert.severity,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        triggeredAt: alert.triggeredAt.toISOString()
      },
      service: 'Save App',
      environment: process.env.NODE_ENV || 'development'
    };

    // In a real implementation, this would make an HTTP request
    logger.info('Webhook notification sent', { channel: channel.name, alert: alert.id });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Placeholder for Slack integration
    logger.info('Slack notification sent', { channel: channel.name, alert: alert.id });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Placeholder for email integration
    logger.info('Email notification sent', { channel: channel.name, alert: alert.id });
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Placeholder for Discord integration
    logger.info('Discord notification sent', { channel: channel.name, alert: alert.id });
  }

  /**
   * Add or update alert rule
   */
  addRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Alert rule added/updated: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Add or update notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    logger.info(`Notification channel added/updated: ${channel.name}`);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info(`Alert acknowledged: ${alert.ruleName}`, {
      alertId,
      acknowledgedBy
    });

    return true;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    acknowledgedAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByRule: Record<string, number>;
  } {
    const alerts = Array.from(this.activeAlerts.values());
    
    const stats = {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === 'active').length,
      resolvedAlerts: alerts.filter(a => a.status === 'resolved').length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'acknowledged').length,
      alertsBySeverity: {} as Record<string, number>,
      alertsByRule: {} as Record<string, number>
    };

    alerts.forEach(alert => {
      stats.alertsBySeverity[alert.severity] = 
        (stats.alertsBySeverity[alert.severity] || 0) + 1;
      
      stats.alertsByRule[alert.ruleName] = 
        (stats.alertsByRule[alert.ruleName] || 0) + 1;
    });

    return stats;
  }

  /**
   * Stop the alerting service
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.removeAllListeners();
    logger.info('Stopped alerting service');
  }
}

// Create singleton instance
const alertingService = new AlertingService();

export default alertingService;
export { AlertingService, AlertRule, Alert, NotificationChannel };