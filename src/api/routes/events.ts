/**
 * Event tracking routes
 * Handles exposure and metric event tracking
 */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validation';
import { optionalAuth } from '../middleware/auth';
import { writeRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import {
  trackExposureSchema,
  trackMetricSchema,
  batchEventSchema,
} from '../validators/event';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * POST /api/v1/events/exposures
 * Track exposure event when a user sees an experiment variant
 */
router.post(
  '/exposures',
  optionalAuth,
  writeRateLimit,
  validate({ body: trackExposureSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const exposureData = req.body;

    // In production, this would:
    // 1. Validate the exposure
    // 2. Send to event stream (Kafka)
    // 3. Store in time-series database
    // 4. Update metrics in real-time

    logger.info('Exposure tracked', {
      experimentId: exposureData.experimentId,
      unitId: exposureData.unitId,
      variantKey: exposureData.variantKey,
      exposurePoint: exposureData.exposurePoint,
    });

    // Mock successful response
    res.status(202).json({
      success: true,
      message: 'Exposure event queued for processing',
      eventId: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/v1/events/metrics
 * Track metric event
 */
router.post(
  '/metrics',
  optionalAuth,
  writeRateLimit,
  validate({ body: trackMetricSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const metricData = req.body;

    // In production, this would:
    // 1. Validate the metric
    // 2. Link to active experiments for the unit
    // 3. Send to event stream
    // 4. Update aggregated metrics

    logger.info('Metric tracked', {
      eventName: metricData.eventName,
      unitId: metricData.unitId,
      value: metricData.value,
      experimentIds: metricData.experimentIds,
    });

    res.status(202).json({
      success: true,
      message: 'Metric event queued for processing',
      eventId: `met_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/v1/events/batch
 * Batch event tracking for multiple events
 */
router.post(
  '/batch',
  optionalAuth,
  writeRateLimit,
  validate({ body: batchEventSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { events } = req.body;

    // Process batch events
    const results = events.map((event: any) => {
      const eventId = `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Batch ${event.type} event tracked`, {
        eventId,
        type: event.type,
        data: event.data,
      });

      return {
        eventId,
        type: event.type,
        status: 'queued',
      };
    });

    res.status(202).json({
      success: true,
      message: `${events.length} events queued for processing`,
      results,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/v1/events/health
 * Health check for event tracking system
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    // In production, check:
    // - Kafka connectivity
    // - Database connectivity
    // - Event processing lag
    // - Error rates

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        eventStream: 'ok',
        storage: 'ok',
        processing: 'ok',
      },
    });
  })
);

export default router;
