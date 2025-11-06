/**
 * Main SDK client for the experimentation system
 */

import { Logger, defaultLogger } from '../utils/logger';
import { CacheAdapter, InMemoryCache } from '../utils/cache';
import {
  ExperimentError,
  NetworkError,
  APIError,
  toExperimentError,
} from '../utils/errors';
import {
  validateUserId,
  validateExperimentId,
  validateMetricName,
  validateContext,
} from '../utils/validators';

/**
 * SDK Configuration
 */
export interface ExperimentClientConfig {
  apiUrl: string;
  apiKey?: string;
  cache?: CacheAdapter;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in seconds
  retryAttempts?: number;
  retryDelay?: number; // in milliseconds
  timeout?: number; // in milliseconds
  batchSize?: number;
  flushInterval?: number; // in milliseconds
  logger?: Logger;
}

/**
 * Assignment result
 */
export interface Assignment {
  experimentId: string;
  userId: string;
  variantId: string;
  variantName: string;
  config?: Record<string, any>;
  assigned: boolean;
  cached?: boolean;
}

/**
 * Exposure event
 */
export interface ExposureEvent {
  experimentId: string;
  userId: string;
  variantId: string;
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * Metric event
 */
export interface MetricEvent {
  experimentId: string;
  userId: string;
  metricName: string;
  value: number;
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * Event queue item
 */
interface QueuedEvent {
  type: 'exposure' | 'metric';
  data: ExposureEvent | MetricEvent;
}

/**
 * HTTP client options
 */
interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  retryAttempts?: number;
}

/**
 * Main SDK client class
 */
export class ExperimentClient {
  private config: Required<ExperimentClientConfig>;
  private cache: CacheAdapter;
  private logger: Logger;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(config: ExperimentClientConfig) {
    // Set defaults
    this.config = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey || '',
      cache: config.cache || new InMemoryCache(),
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 300, // 5 minutes default
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 5000,
      batchSize: config.batchSize || 100,
      flushInterval: config.flushInterval || 10000, // 10 seconds default
      logger: config.logger || defaultLogger.child('ExperimentClient'),
    };

    this.cache = this.config.cache;
    this.logger = this.config.logger;

    // Validate API URL
    try {
      new URL(this.config.apiUrl);
    } catch (error) {
      throw new ExperimentError('Invalid API URL', undefined, 400, {
        apiUrl: this.config.apiUrl,
      });
    }
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing ExperimentClient', {
      apiUrl: this.config.apiUrl,
      cacheEnabled: this.config.cacheEnabled,
      batchSize: this.config.batchSize,
    });

    // Start flush timer for batch events
    this.startFlushTimer();

    this.isInitialized = true;
    this.logger.info('ExperimentClient initialized successfully');
  }

  /**
   * Get experiment assignment for a user
   */
  async getAssignment(
    experimentId: string,
    userId: string,
    context?: Record<string, any>
  ): Promise<Assignment> {
    // Validate inputs
    validateExperimentId(experimentId);
    validateUserId(userId);
    const validatedContext = context ? validateContext(context) : undefined;

    // Check cache first
    if (this.config.cacheEnabled) {
      const cacheKey = this.getAssignmentCacheKey(experimentId, userId);
      const cachedAssignment = await this.cache.get<Assignment>(cacheKey);

      if (cachedAssignment) {
        this.logger.debug('Assignment retrieved from cache', {
          experimentId,
          userId,
          variantId: cachedAssignment.variantId,
        });

        return { ...cachedAssignment, cached: true };
      }
    }

    // Fetch assignment from API
    try {
      const response = await this.request<Assignment>({
        method: 'POST',
        path: '/api/assignments',
        body: {
          experimentId,
          userId,
          context: validatedContext,
        },
      });

      // Cache the assignment
      if (this.config.cacheEnabled && response.assigned) {
        const cacheKey = this.getAssignmentCacheKey(experimentId, userId);
        await this.cache.set(cacheKey, response, { ttl: this.config.cacheTTL });
      }

      this.logger.logAssignment(experimentId, userId, response.variantId, {
        cached: false,
      });

      return { ...response, cached: false };
    } catch (error) {
      this.logger.error('Failed to get assignment', {
        experimentId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw toExperimentError(error);
    }
  }

  /**
   * Track exposure event
   */
  async trackExposure(
    experimentId: string,
    userId: string,
    variantId: string,
    context?: Record<string, any>
  ): Promise<void> {
    // Validate inputs
    validateExperimentId(experimentId);
    validateUserId(userId);
    const validatedContext = context ? validateContext(context) : undefined;

    const event: ExposureEvent = {
      experimentId,
      userId,
      variantId,
      timestamp: new Date(),
      context: validatedContext,
    };

    this.logger.logExposure(experimentId, userId, variantId);

    // Add to queue
    this.queueEvent({
      type: 'exposure',
      data: event,
    });
  }

  /**
   * Track metric event
   */
  async trackMetric(
    experimentId: string,
    userId: string,
    metricName: string,
    value: number,
    context?: Record<string, any>
  ): Promise<void> {
    // Validate inputs
    validateExperimentId(experimentId);
    validateUserId(userId);
    validateMetricName(metricName);

    if (typeof value !== 'number' || !isFinite(value)) {
      throw new ExperimentError('Invalid metric value', undefined, 400, {
        value,
      });
    }

    const validatedContext = context ? validateContext(context) : undefined;

    const event: MetricEvent = {
      experimentId,
      userId,
      metricName,
      value,
      timestamp: new Date(),
      context: validatedContext,
    };

    this.logger.logMetric(metricName, value, { experimentId, userId });

    // Add to queue
    this.queueEvent({
      type: 'metric',
      data: event,
    });
  }

  /**
   * Get assignment and track exposure in one call
   */
  async getAssignmentAndTrackExposure(
    experimentId: string,
    userId: string,
    context?: Record<string, any>
  ): Promise<Assignment> {
    const assignment = await this.getAssignment(experimentId, userId, context);

    if (assignment.assigned) {
      // Track exposure asynchronously (don't await)
      this.trackExposure(
        experimentId,
        userId,
        assignment.variantId,
        context
      ).catch((error) => {
        this.logger.error('Failed to track exposure', {
          experimentId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return assignment;
  }

  /**
   * Flush queued events immediately
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = this.eventQueue.splice(0, this.config.batchSize);

    try {
      await this.request({
        method: 'POST',
        path: '/api/events/batch',
        body: {
          events: eventsToFlush,
        },
      });

      this.logger.debug('Flushed events', {
        count: eventsToFlush.length,
      });
    } catch (error) {
      this.logger.error('Failed to flush events', {
        count: eventsToFlush.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-queue failed events (at the front)
      this.eventQueue.unshift(...eventsToFlush);

      throw toExperimentError(error);
    }
  }

  /**
   * Shutdown the client gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ExperimentClient');

    // Stop flush timer
    this.stopFlushTimer();

    // Flush remaining events
    try {
      while (this.eventQueue.length > 0) {
        await this.flush();
      }
    } catch (error) {
      this.logger.error('Failed to flush events during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.isInitialized = false;
    this.logger.info('ExperimentClient shutdown complete');
  }

  /**
   * Queue an event for batch processing
   */
  private queueEvent(event: QueuedEvent): void {
    this.eventQueue.push(event);

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush().catch((error) => {
        this.logger.error('Auto-flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush().catch((error) => {
          this.logger.error('Scheduled flush failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get cache key for assignment
   */
  private getAssignmentCacheKey(experimentId: string, userId: string): string {
    return `assignment:${experimentId}:${userId}`;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, retryAttempts = this.config.retryAttempts } = options;
    const url = `${this.config.apiUrl}${path}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const response = await this.makeRequest<T>(method, url, body);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (error instanceof APIError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Log retry attempt
        if (attempt < retryAttempts - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          this.logger.warn(`Request failed, retrying (${attempt + 1}/${retryAttempts})`, {
            method,
            url,
            delay,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    throw new NetworkError(`Request failed after ${retryAttempts} attempts: ${lastError?.message}`, {
      url,
      attempts: retryAttempts,
    });
  }

  /**
   * Make actual HTTP request
   */
  private async makeRequest<T>(method: string, url: string, body?: any): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData as Record<string, any>
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout', {
          url,
          timeout: this.config.timeout,
        });
      }

      throw new NetworkError(
        error instanceof Error ? error.message : String(error),
        { url }
      );
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new ExperimentClient instance
 */
export function createClient(config: ExperimentClientConfig): ExperimentClient {
  return new ExperimentClient(config);
}
