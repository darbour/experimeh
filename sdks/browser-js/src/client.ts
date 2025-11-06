/**
 * Experimeh Browser JavaScript Client
 */

import {
  ExperimentClientConfig,
  Assignment,
  Experiment,
  MetricEvent,
  ExposureEvent,
  APIResponse,
} from './types';
import { CacheManager } from './cache';
import {
  ExperimentError,
  NetworkError,
  ValidationError,
  TimeoutError,
} from './errors';

export class ExperimentClient {
  private config: Required<ExperimentClientConfig>;
  private cache: CacheManager;

  constructor(config: ExperimentClientConfig) {
    // Validate config
    if (!config.apiUrl) {
      throw new ValidationError('apiUrl is required');
    }
    if (!config.apiKey) {
      throw new ValidationError('apiKey is required');
    }

    // Set defaults
    this.config = {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      ...config,
    };

    this.cache = new CacheManager(this.config.cacheEnabled, this.config.cacheTTL);
  }

  /**
   * Get assignment for a user in an experiment
   */
  async getAssignment(
    experimentKey: string,
    userId: string,
    forceRefresh: boolean = false
  ): Promise<Assignment> {
    if (!experimentKey) {
      throw new ValidationError('experimentKey is required');
    }
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const cacheKey = `assignment:${experimentKey}:${userId}`;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get<Assignment>(cacheKey);
      if (cached) {
        // Convert date strings back to Date objects
        return {
          ...cached,
          assignedAt: new Date(cached.assignedAt),
        };
      }
    }

    // Fetch from API
    const response = await this.request<Assignment>(
      `/api/v1/assignments/${experimentKey}/${userId}`,
      {
        method: 'POST',
        body: JSON.stringify({ userId, experimentKey }),
      }
    );

    // Convert date string to Date object
    const assignment: Assignment = {
      ...response.data,
      assignedAt: new Date(response.data.assignedAt),
    };

    // Cache the result
    this.cache.set(cacheKey, assignment);

    return assignment;
  }

  /**
   * Get experiment details
   */
  async getExperiment(experimentKey: string): Promise<Experiment> {
    if (!experimentKey) {
      throw new ValidationError('experimentKey is required');
    }

    const cacheKey = `experiment:${experimentKey}`;

    // Check cache
    const cached = this.cache.get<Experiment>(cacheKey);
    if (cached) return cached;

    // Fetch from API
    const response = await this.request<Experiment>(
      `/api/v1/experiments/${experimentKey}`
    );

    // Cache the result
    this.cache.set(cacheKey, response.data, 60000); // Cache for 1 minute

    return response.data;
  }

  /**
   * Track exposure event
   */
  async trackExposure(
    experimentKey: string,
    userId: string,
    variantKey: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!experimentKey) {
      throw new ValidationError('experimentKey is required');
    }
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    if (!variantKey) {
      throw new ValidationError('variantKey is required');
    }

    const event: ExposureEvent = {
      experimentKey,
      userId,
      variantKey,
      timestamp: new Date(),
      metadata,
    };

    await this.request('/api/v1/events/exposure', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  /**
   * Track metric event
   */
  async trackMetric(
    metricKey: string,
    userId: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!metricKey) {
      throw new ValidationError('metricKey is required');
    }
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    if (typeof value !== 'number') {
      throw new ValidationError('value must be a number');
    }

    const event: MetricEvent = {
      metricKey,
      userId,
      value,
      timestamp: new Date(),
      metadata,
    };

    await this.request('/api/v1/events/metric', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.config.apiUrl}${path}`;
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new NetworkError(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors or client errors (4xx)
        if (
          error instanceof ValidationError ||
          (error instanceof NetworkError &&
           error.statusCode &&
           error.statusCode >= 400 &&
           error.statusCode < 500)
        ) {
          throw error;
        }

        // Check for abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError();
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw new ExperimentError(
      `Request failed after ${this.config.maxRetries + 1} attempts: ${lastError.message}`
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
