# Multi-stage Dockerfile for Save App
# Stage 1: Frontend build
FROM node:18-alpine AS frontend-builder

# Set working directory
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# Stage 2: Backend dependencies
FROM node:18-alpine AS backend-builder

# Set working directory
WORKDIR /app

# Copy backend package files
COPY package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Stage 3: Runtime
FROM node:18-alpine AS runtime

# Install system dependencies for Puppeteer and Sharp
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    sqlite \
    redis \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy backend dependencies from builder stage
COPY --from=backend-builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy backend source code
COPY --chown=nextjs:nodejs . .

# Copy frontend build from builder stage
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/dist ./public
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/dist ./backend/public/app

# Create necessary directories
RUN mkdir -p /app/storage /app/cache /app/logs /app/exports && \
    chown -R nextjs:nodejs /app/storage /app/cache /app/logs /app/exports

# Build TypeScript backend
RUN npm run build

# Set environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PORT=3001 \
    REDIS_HOST=redis \
    DATABASE_PATH=/app/storage/save.db \
    STORAGE_PATH=/app/storage \
    CACHE_PATH=/app/cache \
    LOG_PATH=/app/logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER nextjs

# Start the application
CMD ["npm", "start"]