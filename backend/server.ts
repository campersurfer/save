import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import DatabaseService from './database/database';
import ExtractorOrchestrator from './services/extractor-orchestrator';
import monitoringService from './services/monitoring';
import analyticsService from './services/analytics';
import alertingService from './services/alerting';
import { logger } from './utils/logger';
import path from 'path';

// Initialize Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3
});

// Initialize database
const db = new DatabaseService(path.join(__dirname, '..', 'save.db'));

// Initialize extractor
const extractor = new ExtractorOrchestrator();

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const extractionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit extraction requests
  message: 'Too many extraction requests, please try again later.'
});

app.use('/api/', limiter);
app.use('/api/extract', extractionLimiter);

// ==================== JOB QUEUE SETUP ====================

const extractionQueue = new Queue('extraction', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 100
    },
    removeOnFail: {
      age: 24 * 3600 // 24 hours
    }
  }
});

const queueEvents = new QueueEvents('extraction', {
  connection: redis
});

// Queue event listeners
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info(`Job ${jobId} completed successfully`);
  io.to(`job:${jobId}`).emit('extraction:completed', returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed: ${failedReason}`);
  io.to(`job:${jobId}`).emit('extraction:failed', { error: failedReason });
});

queueEvents.on('progress', ({ jobId, data }) => {
  io.to(`job:${jobId}`).emit('extraction:progress', data);
});

// Worker to process extraction jobs
const extractionWorker = new Worker('extraction', async (job) => {
  const { url, type, userId } = job.data;
  
  try {
    // Update job progress
    await job.updateProgress({ status: 'extracting', percentage: 10 });
    
    // Extract content
    const result = await extractor.extract(url);
    
    await job.updateProgress({ status: 'processing', percentage: 50 });
    
    // Save to database
    const contentId = await db.saveContent({
      url,
      type: result.type,
      title: result.title,
      author: result.author,
      content: result.content,
      extractedAt: Date.now(),
      dominantColor: result.colors?.dominant,
      mood: result.mood,
      temperature: result.temperature,
      contrast: result.contrast,
      saturation: result.saturation,
      durationSeconds: result.duration,
      wordCount: result.wordCount,
      extractionMethod: result.method,
      extractionSuccess: result.success,
      extractionErrors: result.errors
    });
    
    // Save media if present
    if (result.media && result.media.length > 0) {
      for (const media of result.media) {
        await db.saveMedia({
          contentId,
          type: media.type,
          url: media.url,
          localPath: media.localPath,
          thumbnailPath: media.thumbnailPath,
          width: media.width,
          height: media.height,
          durationSeconds: media.duration,
          mimeType: media.mimeType,
          position: media.position
        });
      }
    }
    
    await job.updateProgress({ status: 'completed', percentage: 100 });
    
    return {
      contentId,
      url,
      success: true,
      ...result
    };
  } catch (error: any) {
    logger.error('Extraction failed:', error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: 5
});

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.getHealthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).send('Failed to get metrics');
  }
});

// JSON metrics endpoint for dashboards
app.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getMetricsJSON();
    res.json({ metrics });
  } catch (error) {
    logger.error('Failed to get JSON metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Analytics dashboard endpoint
app.get('/api/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    const timeRange = {
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };
    
    const [metrics, insights] = await Promise.all([
      analyticsService.getDashboardMetrics(timeRange),
      analyticsService.generateInsights()
    ]);
    
    res.json({ ...metrics, ...insights });
  } catch (error) {
    logger.error('Failed to get analytics dashboard:', error);
    res.status(500).json({ error: 'Failed to get analytics dashboard' });
  }
});

// User analytics endpoint
app.get('/api/analytics/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;
    const timeRange = {
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };
    
    const analytics = await analyticsService.getUserAnalytics(userId, timeRange);
    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get user analytics:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

// Alerting endpoints
app.get('/api/alerts', (req: Request, res: Response) => {
  try {
    const activeAlerts = alertingService.getActiveAlerts();
    const alertStats = alertingService.getAlertStats();
    
    res.json({
      alerts: activeAlerts,
      stats: alertStats
    });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

app.post('/api/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy = 'admin' } = req.body;
    
    const success = alertingService.acknowledgeAlert(alertId, acknowledgedBy);
    
    if (success) {
      res.json({ success: true, message: 'Alert acknowledged' });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

app.get('/api/alerts/rules', (req: Request, res: Response) => {
  try {
    const rules = alertingService.getAlertRules();
    res.json({ rules });
  } catch (error) {
    logger.error('Failed to get alert rules:', error);
    res.status(500).json({ error: 'Failed to get alert rules' });
  }
});

// Dashboard endpoint
app.get('/dashboard', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Static files for dashboard
app.use('/static', express.static(path.join(__dirname, 'public')));

// Extract content endpoint
app.post('/api/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, type, priority } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check if already extracted
    const existing = await db.getContentByUrl(url);
    if (existing && !req.body.force) {
      return res.json({
        contentId: existing.id,
        cached: true,
        data: existing
      });
    }
    
    // Add to extraction queue
    const job = await extractionQueue.add('extract', {
      url,
      type: type || 'auto',
      userId: (req as any).user?.id || 'anonymous'
    }, {
      priority: priority || 0
    });
    
    res.json({
      jobId: job.id,
      status: 'queued',
      position: await job.getState()
    });
  } catch (error) {
    next(error);
  }
});

// Get extraction job status
app.get('/api/extract/job/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await extractionQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    res.json({
      jobId: job.id,
      state,
      progress,
      data: job.data,
      returnValue: job.returnvalue,
      failedReason: job.failedReason
    });
  } catch (error) {
    next(error);
  }
});

// Search content
app.get('/api/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      type,
      mood,
      archived,
      favorite,
      folderId,
      limit = '50',
      offset = '0'
    } = req.query;
    
    const results = await db.search({
      query: q as string || '',
      type: type as string,
      mood: mood as any,
      archived: archived === 'true',
      favorite: favorite === 'true',
      folderId: folderId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get recent content
app.get('/api/content/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '50', type } = req.query;
    const results = await db.getRecent(parseInt(limit as string), type as string);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get content by ID
app.get('/api/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const content = await db.getContent(id);
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    const media = await db.getMediaForContent(id);
    
    res.json({
      ...content,
      media
    });
  } catch (error) {
    next(error);
  }
});

// Update content
app.patch('/api/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { favorite, archived, notes, tags, folderId } = req.body;
    
    const content = await db.getContent(id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Update fields
    if (favorite !== undefined) {
      await db.toggleFavorite(id);
    }
    
    if (archived !== undefined) {
      await db.toggleArchive(id);
    }
    
    // Update content with new data
    await db.saveContent({
      ...content,
      notes: notes !== undefined ? notes : content.notes,
      tags: tags !== undefined ? tags : content.tags,
      folderId: folderId !== undefined ? folderId : content.folderId
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete content
app.delete('/api/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await db.deleteContent(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get queue
app.get('/api/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queue = await db.getQueue();
    res.json(queue);
  } catch (error) {
    next(error);
  }
});

// Add to queue
app.post('/api/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId, position } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }
    
    await db.addToQueue(contentId, position);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Remove from queue
app.delete('/api/queue/:contentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;
    await db.removeFromQueue(contentId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Clear queue
app.delete('/api/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.clearQueue();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get statistics
app.get('/api/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.getStatistics();
    const queueStats = await extractionQueue.getJobCounts();
    
    res.json({
      content: stats,
      queue: queueStats
    });
  } catch (error) {
    next(error);
  }
});

// ==================== WEBSOCKET HANDLING ====================

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Subscribe to job updates
  socket.on('subscribe:job', (jobId: string) => {
    socket.join(`job:${jobId}`);
  });
  
  socket.on('unsubscribe:job', (jobId: string) => {
    socket.leave(`job:${jobId}`);
  });
  
  // Real-time search
  socket.on('search', async (query: string) => {
    try {
      const results = await db.search({ query, limit: 10 });
      socket.emit('search:results', results);
    } catch (error: any) {
      socket.emit('search:error', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// ==================== ERROR HANDLING ====================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('API Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`WebSocket server ready`);
  logger.info(`Redis connected: ${redis.status}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  await extractionWorker.close();
  await extractionQueue.close();
  await queueEvents.close();
  redis.disconnect();
  db.close();
  
  process.exit(0);
});

export default app;