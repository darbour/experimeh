/**
 * Joi validation schemas for event tracking requests
 */

import Joi from 'joi';

/**
 * Exposure event validation
 */
export const exposureEventSchema = Joi.object({
  experimentId: Joi.string().required(),
  unitId: Joi.string().required(),
  variantKey: Joi.string().required(),
  timestamp: Joi.date().iso().default(() => new Date()),
  exposurePoint: Joi.string().optional(),
  context: Joi.object().optional(),
});

/**
 * Metric event validation
 */
export const metricEventSchema = Joi.object({
  eventName: Joi.string().required(),
  unitId: Joi.string().required(),
  timestamp: Joi.date().iso().default(() => new Date()),
  value: Joi.number().optional(),
  properties: Joi.object().optional(),
  experimentIds: Joi.array().items(Joi.string()).optional(),
});

/**
 * Track exposure request validation
 */
export const trackExposureSchema = Joi.object({
  experimentId: Joi.string().required(),
  experimentKey: Joi.string().optional(),
  unitId: Joi.string().required(),
  variantKey: Joi.string().required(),
  exposurePoint: Joi.string().optional(),
  context: Joi.object().optional(),
});

/**
 * Track metric request validation
 */
export const trackMetricSchema = Joi.object({
  eventName: Joi.string().required(),
  unitId: Joi.string().required(),
  value: Joi.number().optional(),
  properties: Joi.object().optional(),
  experimentIds: Joi.array().items(Joi.string()).optional(),
});

/**
 * Batch event tracking validation
 */
export const batchEventSchema = Joi.object({
  events: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid('exposure', 'metric').required(),
        data: Joi.alternatives().conditional('type', {
          is: 'exposure',
          then: exposureEventSchema,
          otherwise: metricEventSchema,
        }),
      })
    )
    .min(1)
    .max(1000)
    .required(),
});
