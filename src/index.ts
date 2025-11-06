/**
 * Main entry point for the experimentation system
 * Exports all public APIs, types, and utilities
 */

import { getLogger as getLoggerUtil } from './utils/logger';
import { createClient as createClientUtil } from './sdk/client';

// SDK Client exports
export {
  ExperimentClient,
  createClient,
  ExperimentClientConfig,
  Assignment,
  ExposureEvent,
  MetricEvent,
} from './sdk/client';

// Logger exports
export {
  Logger,
  LogLevel,
  LogMetadata,
  LoggerConfig,
  createLogger,
  getLogger,
  defaultLogger,
} from './utils/logger';

// Cache exports
export {
  CacheAdapter,
  CacheOptions,
  InMemoryCache,
  RedisCache,
  RedisCacheConfig,
  CacheFactory,
} from './utils/cache';

// Error exports
export {
  ExperimentError,
  ErrorCode,
  ExperimentNotFoundError,
  ExperimentInactiveError,
  AssignmentError,
  AssignmentConstraintError,
  ValidationError,
  ConfigurationError,
  APIError,
  NetworkError,
  CacheError,
  isExperimentError,
  toExperimentError,
} from './utils/errors';

// Validator exports
export {
  ExperimentStatus,
  ExperimentType,
  validateExperimentConfig,
  validateAssignmentRequest,
  validateExposureEvent,
  validateMetricEvent,
  validateBatchEvents,
  validateUserId,
  validateExperimentId,
  validateMetricName,
  validateDateRange,
  validateContext,
  sanitizeString,
  experimentConfigSchema,
  assignmentRequestSchema,
  exposureEventSchema,
  metricEventSchema,
  batchEventsSchema,
} from './utils/validators';

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Quick start example for SDK usage
 *
 * @example
 * ```typescript
 * import { createClient } from 'experimeh';
 *
 * const client = createClient({
 *   apiUrl: 'https://experiments.example.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * await client.initialize();
 *
 * // Get assignment for a user
 * const assignment = await client.getAssignment('exp-123', 'user-456');
 * console.log('Assigned variant:', assignment.variantId);
 *
 * // Track exposure
 * await client.trackExposure('exp-123', 'user-456', assignment.variantId);
 *
 * // Track metric
 * await client.trackMetric('exp-123', 'user-456', 'conversion', 1);
 *
 * // Shutdown gracefully
 * await client.shutdown();
 * ```
 */

/**
 * Server configuration interface
 */
export interface ServerConfig {
  port?: number;
  host?: string;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  apiPrefix?: string;
  maxRequestSize?: string;
  rateLimitEnabled?: boolean;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

/**
 * Default server configuration
 */
const defaultServerConfig: Required<ServerConfig> = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  corsEnabled: process.env.CORS_ENABLED !== 'false',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  apiPrefix: process.env.API_PREFIX || '/api',
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
};

/**
 * Start the experimentation server
 *
 * @param config - Server configuration
 * @returns Promise that resolves when server is started
 *
 * @example
 * ```typescript
 * import { startServer } from 'experimeh';
 *
 * await startServer({
 *   port: 3000,
 *   corsEnabled: true,
 * });
 * ```
 */
export async function startServer(config: ServerConfig = {}): Promise<void> {
  const finalConfig = { ...defaultServerConfig, ...config };

  const logger = getLoggerUtil(undefined, 'Server');

  logger.info('Starting experimentation server', {
    port: finalConfig.port,
    host: finalConfig.host,
    apiPrefix: finalConfig.apiPrefix,
  });

  // Import express and other server dependencies lazily
  const express = await import('express');
  const cors = await import('cors');
  const helmet = await import('helmet');
  const compression = await import('compression');

  const app = express.default();

  // Middleware
  app.use(helmet.default());
  app.use(compression.default());
  app.use(express.json({ limit: finalConfig.maxRequestSize }));
  app.use(express.urlencoded({ extended: true, limit: finalConfig.maxRequestSize }));

  if (finalConfig.corsEnabled) {
    app.use(cors.default({
      origin: finalConfig.corsOrigins,
      credentials: true,
    }));
  }

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: VERSION,
    });
  });

  // Status endpoint
  app.get('/status', (_req, res) => {
    res.json({
      status: 'running',
      version: VERSION,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  });

  // API routes will be mounted here by application code
  // This is just the base server setup

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        message: 'Not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        path: req.path,
      },
    });
  });

  // Error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        statusCode,
      },
    });
  });

  // Start server
  return new Promise((resolve, reject) => {
    const server = app.listen(finalConfig.port, finalConfig.host, () => {
      logger.info('Server started successfully', {
        port: finalConfig.port,
        host: finalConfig.host,
        url: `http://${finalConfig.host}:${finalConfig.port}`,
      });
      resolve();
    });

    server.on('error', (error: Error) => {
      logger.error('Server failed to start', { error: error.message });
      reject(error);
    });
  });
}

/**
 * Default export for CommonJS compatibility
 */
export default {
  createClient: createClientUtil,
  startServer,
  VERSION,
};
