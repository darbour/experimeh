/**
 * Event Service
 * Handles tracking of exposure events and metric events
 * Validates, batches, and queues events for processing
 */

import Joi from 'joi';
import { ExposureEvent, MetricEvent, EventBatch } from '../types';
import { ILogger, IEventQueue } from '../types/interfaces';
import { ValidationError, QueueError } from '../types/errors';

/**
 * Validation schemas
 */
const exposureEventSchema = Joi.object({
  experimentId: Joi.string().required(),
  unitId: Joi.string().required(),
  variantKey: Joi.string().required(),
  timestamp: Joi.date().default(() => new Date()),
  exposurePoint: Joi.string().required(),
  context: Joi.object().optional(),
});

const metricEventSchema = Joi.object({
  eventName: Joi.string().required(),
  unitId: Joi.string().required(),
  timestamp: Joi.date().default(() => new Date()),
  value: Joi.number().optional(),
  properties: Joi.object().optional(),
  experimentIds: Joi.array().items(Joi.string()).optional(),
});

export interface EventServiceOptions {
  queue: IEventQueue;
  logger: ILogger;
  batchSize?: number;
  batchTimeoutMs?: number;
  enableValidation?: boolean;
}

export class EventService {
  private queue: IEventQueue;
  private logger: ILogger;
  private batchSize: number;
  private batchTimeoutMs: number;
  private enableValidation: boolean;

  // Batch buffers
  private exposureBatch: ExposureEvent[] = [];
  private metricBatch: MetricEvent[] = [];
  private exposureTimer: NodeJS.Timeout | null = null;
  private metricTimer: NodeJS.Timeout | null = null;

  // Topics for different event types
  private readonly EXPOSURE_TOPIC = 'experimentation.exposures';
  private readonly METRIC_TOPIC = 'experimentation.metrics';

  constructor(options: EventServiceOptions) {
    this.queue = options.queue;
    this.logger = options.logger.child({ service: 'EventService' });
    this.batchSize = options.batchSize || 100;
    this.batchTimeoutMs = options.batchTimeoutMs || 5000; // 5 seconds
    this.enableValidation = options.enableValidation ?? true;
  }

  /**
   * Track an exposure event (when a user sees an experiment variant)
   */
  async trackExposure(event: Omit<ExposureEvent, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    this.logger.debug('Tracking exposure event', {
      experimentId: event.experimentId,
      unitId: event.unitId,
      variantKey: event.variantKey,
    });

    try {
      // Validate event
      if (this.enableValidation) {
        const { error, value } = exposureEventSchema.validate(event);
        if (error) {
          throw new ValidationError('Invalid exposure event', error.details);
        }
        event = value;
      }

      // Ensure timestamp
      const exposureEvent: ExposureEvent = {
        ...event,
        timestamp: event.timestamp || new Date(),
      };

      // Add to batch
      this.exposureBatch.push(exposureEvent);

      // Flush if batch is full
      if (this.exposureBatch.length >= this.batchSize) {
        await this.flushExposureBatch();
      } else if (!this.exposureTimer) {
        // Set timer to flush after timeout
        this.exposureTimer = setTimeout(() => {
          this.flushExposureBatch().catch(error => {
            this.logger.error('Failed to flush exposure batch on timeout', { error });
          });
        }, this.batchTimeoutMs);
      }

      this.logger.debug('Exposure event added to batch', {
        experimentId: event.experimentId,
        batchSize: this.exposureBatch.length,
      });
    } catch (error) {
      this.logger.error('Failed to track exposure event', { error, event });
      throw error;
    }
  }

  /**
   * Track a metric event (conversion, revenue, etc.)
   */
  async trackMetric(event: Omit<MetricEvent, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    this.logger.debug('Tracking metric event', {
      eventName: event.eventName,
      unitId: event.unitId,
      value: event.value,
    });

    try {
      // Validate event
      if (this.enableValidation) {
        const { error, value } = metricEventSchema.validate(event);
        if (error) {
          throw new ValidationError('Invalid metric event', error.details);
        }
        event = value;
      }

      // Ensure timestamp
      const metricEvent: MetricEvent = {
        ...event,
        timestamp: event.timestamp || new Date(),
      };

      // Add to batch
      this.metricBatch.push(metricEvent);

      // Flush if batch is full
      if (this.metricBatch.length >= this.batchSize) {
        await this.flushMetricBatch();
      } else if (!this.metricTimer) {
        // Set timer to flush after timeout
        this.metricTimer = setTimeout(() => {
          this.flushMetricBatch().catch(error => {
            this.logger.error('Failed to flush metric batch on timeout', { error });
          });
        }, this.batchTimeoutMs);
      }

      this.logger.debug('Metric event added to batch', {
        eventName: event.eventName,
        batchSize: this.metricBatch.length,
      });
    } catch (error) {
      this.logger.error('Failed to track metric event', { error, event });
      throw error;
    }
  }

  /**
   * Track multiple exposure events at once
   */
  async trackExposureBatch(events: ExposureEvent[]): Promise<void> {
    this.logger.info('Tracking exposure event batch', { count: events.length });

    try {
      // Validate all events if enabled
      if (this.enableValidation) {
        for (const event of events) {
          const { error } = exposureEventSchema.validate(event);
          if (error) {
            throw new ValidationError('Invalid exposure event in batch', error.details);
          }
        }
      }

      // Publish directly (bypass batching for explicit batches)
      await this.queue.publish(this.EXPOSURE_TOPIC, events);

      this.logger.info('Exposure batch tracked successfully', { count: events.length });
    } catch (error) {
      this.logger.error('Failed to track exposure batch', { error, count: events.length });
      throw new QueueError('Failed to publish exposure batch', { error });
    }
  }

  /**
   * Track multiple metric events at once
   */
  async trackMetricBatch(events: MetricEvent[]): Promise<void> {
    this.logger.info('Tracking metric event batch', { count: events.length });

    try {
      // Validate all events if enabled
      if (this.enableValidation) {
        for (const event of events) {
          const { error } = metricEventSchema.validate(event);
          if (error) {
            throw new ValidationError('Invalid metric event in batch', error.details);
          }
        }
      }

      // Publish directly
      await this.queue.publish(this.METRIC_TOPIC, events);

      this.logger.info('Metric batch tracked successfully', { count: events.length });
    } catch (error) {
      this.logger.error('Failed to track metric batch', { error, count: events.length });
      throw new QueueError('Failed to publish metric batch', { error });
    }
  }

  /**
   * Track exposure and metric together (common pattern)
   */
  async trackExposureAndMetric(
    exposure: Omit<ExposureEvent, 'timestamp'> & { timestamp?: Date },
    metric: Omit<MetricEvent, 'timestamp'> & { timestamp?: Date }
  ): Promise<void> {
    this.logger.debug('Tracking exposure and metric together', {
      experimentId: exposure.experimentId,
      eventName: metric.eventName,
    });

    try {
      // Track both in parallel
      await Promise.all([
        this.trackExposure(exposure),
        this.trackMetric(metric),
      ]);
    } catch (error) {
      this.logger.error('Failed to track exposure and metric', { error });
      throw error;
    }
  }

  /**
   * Flush all pending batches immediately
   */
  async flush(): Promise<void> {
    this.logger.info('Flushing all pending event batches');

    try {
      await Promise.all([
        this.flushExposureBatch(),
        this.flushMetricBatch(),
      ]);
    } catch (error) {
      this.logger.error('Failed to flush all batches', { error });
      throw error;
    }
  }

  /**
   * Get current batch sizes (for monitoring)
   */
  getBatchSizes(): { exposures: number; metrics: number } {
    return {
      exposures: this.exposureBatch.length,
      metrics: this.metricBatch.length,
    };
  }

  /**
   * Validate an event without tracking it
   */
  validateExposureEvent(event: any): { valid: boolean; errors?: any[] } {
    const { error } = exposureEventSchema.validate(event);
    return {
      valid: !error,
      errors: error?.details,
    };
  }

  /**
   * Validate a metric event without tracking it
   */
  validateMetricEvent(event: any): { valid: boolean; errors?: any[] } {
    const { error } = metricEventSchema.validate(event);
    return {
      valid: !error,
      errors: error?.details,
    };
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down event service');

    try {
      // Clear timers
      if (this.exposureTimer) {
        clearTimeout(this.exposureTimer);
        this.exposureTimer = null;
      }
      if (this.metricTimer) {
        clearTimeout(this.metricTimer);
        this.metricTimer = null;
      }

      // Flush remaining events
      await this.flush();

      // Disconnect from queue
      await this.queue.disconnect();

      this.logger.info('Event service shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }

  /**
   * ============================================
   * PRIVATE HELPER METHODS
   * ============================================
   */

  /**
   * Flush exposure event batch to queue
   */
  private async flushExposureBatch(): Promise<void> {
    // Clear timer
    if (this.exposureTimer) {
      clearTimeout(this.exposureTimer);
      this.exposureTimer = null;
    }

    // Nothing to flush
    if (this.exposureBatch.length === 0) {
      return;
    }

    const batch = [...this.exposureBatch];
    this.exposureBatch = [];

    this.logger.info('Flushing exposure batch', { count: batch.length });

    try {
      await this.queue.publish(this.EXPOSURE_TOPIC, batch);
      this.logger.info('Exposure batch flushed successfully', { count: batch.length });
    } catch (error) {
      this.logger.error('Failed to flush exposure batch', { error, count: batch.length });

      // Put events back in batch to retry
      this.exposureBatch.unshift(...batch);

      throw new QueueError('Failed to publish exposure batch', { error, count: batch.length });
    }
  }

  /**
   * Flush metric event batch to queue
   */
  private async flushMetricBatch(): Promise<void> {
    // Clear timer
    if (this.metricTimer) {
      clearTimeout(this.metricTimer);
      this.metricTimer = null;
    }

    // Nothing to flush
    if (this.metricBatch.length === 0) {
      return;
    }

    const batch = [...this.metricBatch];
    this.metricBatch = [];

    this.logger.info('Flushing metric batch', { count: batch.length });

    try {
      await this.queue.publish(this.METRIC_TOPIC, batch);
      this.logger.info('Metric batch flushed successfully', { count: batch.length });
    } catch (error) {
      this.logger.error('Failed to flush metric batch', { error, count: batch.length });

      // Put events back in batch to retry
      this.metricBatch.unshift(...batch);

      throw new QueueError('Failed to publish metric batch', { error, count: batch.length });
    }
  }
}
