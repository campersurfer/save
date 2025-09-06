import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        deviceId?: string;
      };
    }
  }
}

interface UserPayload {
  id: string;
  email: string;
  deviceId?: string;
}

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): UserPayload => {
  return jwt.verify(token, JWT_SECRET) as UserPayload;
};

/**
 * Authentication middleware - requires valid JWT
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware - adds user if token is valid but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    
    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch (error) {
      // Invalid token, but we continue without user
      logger.debug('Optional auth: Invalid token provided');
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

/**
 * API Key authentication for services
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // In production, validate against database or environment variable
  const validApiKeys = (process.env.API_KEYS || '').split(',');
  
  if (!validApiKeys.includes(apiKey as string)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

/**
 * Device authentication for mobile apps
 */
export const deviceAuth = async (req: Request, res: Response, next: NextFunction) => {
  const deviceId = req.headers['x-device-id'] as string;
  const deviceToken = req.headers['x-device-token'] as string;
  
  if (!deviceId || !deviceToken) {
    return res.status(401).json({ error: 'Device authentication required' });
  }
  
  try {
    // In production, validate device token against database
    // For now, we'll create a simple user object
    req.user = {
      id: `device_${deviceId}`,
      email: `${deviceId}@device.local`,
      deviceId
    };
    
    next();
  } catch (error) {
    logger.error('Device authentication error:', error);
    res.status(401).json({ error: 'Invalid device credentials' });
  }
};

/**
 * Rate limiting per user
 */
export const userRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRequests.get(userId);
    
    if (!userLimit || userLimit.resetTime < now) {
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter
      });
    }
    
    userLimit.count++;
    next();
  };
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d'
  });
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = (refreshToken: string): { accessToken: string; refreshToken: string } => {
  const payload = verifyToken(refreshToken);
  
  // Generate new tokens
  const accessToken = generateToken({
    id: payload.id,
    email: payload.email,
    deviceId: payload.deviceId
  });
  
  const newRefreshToken = generateRefreshToken({
    id: payload.id,
    email: payload.email,
    deviceId: payload.deviceId
  });
  
  return {
    accessToken,
    refreshToken: newRefreshToken
  };
};

/**
 * Session management
 */
export class SessionManager {
  private sessions = new Map<string, { userId: string; expiresAt: number }>();
  
  createSession(userId: string, duration: number = 3600000): string {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      userId,
      expiresAt: Date.now() + duration
    });
    return sessionId;
  }
  
  validateSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Extend session
    session.expiresAt = Date.now() + 3600000;
    
    return session.userId;
  }
  
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
  
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const sessionManager = new SessionManager();