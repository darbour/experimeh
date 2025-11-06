/**
 * Express application setup
 * Main entry point for the REST API
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger, requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalRateLimit } from './middleware/rateLimit';

// Import routes
import experimentsRouter from './routes/experiments';
import featureFlagsRouter from './routes/feature-flags';
import assignmentsRouter from './routes/assignments';
import eventsRouter from './routes/events';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy (important for rate limiting and IP detection)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  // Compression
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger);

  // Apply general rate limiting
  app.use(generalRateLimit);

  // Health check endpoint (no auth required)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // API info endpoint
  app.get('/api/v1', (_req: Request, res: Response) => {
    res.json({
      name: 'Experimentation API',
      version: 'v1',
      description: 'Feature flag based experimentation system with support for complex experimental designs',
      endpoints: {
        experiments: '/api/v1/experiments',
        flags: '/api/v1/flags',
        assignments: '/api/v1/assignments',
        events: '/api/v1/events',
      },
      documentation: '/api/v1/docs',
    });
  });

  // Mount API routes
  app.use('/api/v1/experiments', experimentsRouter);
  app.use('/api/v1/flags', featureFlagsRouter);
  app.use('/api/v1/assignments', assignmentsRouter);
  app.use('/api/v1/events', eventsRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
export function startServer(app: Application, port: number = 3000): void {
  const server = app.listen(port, () => {
    logger.info(`Server started on port ${port}`, {
      environment: process.env.NODE_ENV || 'development',
      port,
    });
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(() => {
      logger.info('HTTP server closed');

      // Close database connections, Redis, Kafka, etc.
      // In production, add cleanup for all connections:
      // - Database pool.end()
      // - Redis client.quit()
      // - Kafka producer.disconnect()

      logger.info('All connections closed. Exiting process.');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

/**
 * Main entry point
 */
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();

  const port = parseInt(process.env.PORT || '3000', 10);
  const app = createApp();
  startServer(app, port);
}

export default createApp;
