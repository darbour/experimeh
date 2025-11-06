/**
 * Common validators for experiment configuration and event payloads
 */

import Joi from 'joi';
import { ValidationError } from './errors';

/**
 * Experiment status enum
 */
export enum ExperimentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

/**
 * Experiment type enum
 */
export enum ExperimentType {
  AB_TEST = 'ab_test',
  MULTIVARIATE = 'multivariate',
  FACTORIAL = 'factorial',
  SWITCHBACK = 'switchback',
}

/**
 * Variant configuration schema
 */
const variantSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  weight: Joi.number().min(0).max(1).required(),
  config: Joi.object().optional(),
});

/**
 * Traffic allocation schema
 */
const trafficAllocationSchema = Joi.object({
  percentage: Joi.number().min(0).max(100).required(),
  seed: Joi.string().optional(),
});

/**
 * Constraint schema
 */
const constraintSchema = Joi.object({
  type: Joi.string().valid('user_attribute', 'time_window', 'device_type', 'location').required(),
  operator: Joi.string().valid('equals', 'not_equals', 'in', 'not_in', 'greater_than', 'less_than', 'between').required(),
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.array(),
    Joi.object()
  ).required(),
});

/**
 * Experiment configuration schema
 */
export const experimentConfigSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string()
    .valid(...Object.values(ExperimentType))
    .required(),
  status: Joi.string()
    .valid(...Object.values(ExperimentStatus))
    .default(ExperimentStatus.DRAFT),
  variants: Joi.array().items(variantSchema).min(2).required(),
  trafficAllocation: trafficAllocationSchema.optional(),
  constraints: Joi.array().items(constraintSchema).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
  metrics: Joi.object({
    primary: Joi.array().items(Joi.string()).min(1).required(),
    secondary: Joi.array().items(Joi.string()).optional(),
    guardrail: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  metadata: Joi.object().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});

/**
 * Assignment request schema
 */
export const assignmentRequestSchema = Joi.object({
  experimentId: Joi.string().required(),
  userId: Joi.string().required(),
  context: Joi.object({
    userAttributes: Joi.object().optional(),
    deviceInfo: Joi.object().optional(),
    location: Joi.object().optional(),
    timestamp: Joi.date().optional(),
  }).optional(),
});

/**
 * Exposure event schema
 */
export const exposureEventSchema = Joi.object({
  experimentId: Joi.string().required(),
  userId: Joi.string().required(),
  variantId: Joi.string().required(),
  timestamp: Joi.date().default(() => new Date()),
  context: Joi.object().optional(),
});

/**
 * Metric event schema
 */
export const metricEventSchema = Joi.object({
  experimentId: Joi.string().required(),
  userId: Joi.string().required(),
  metricName: Joi.string().required(),
  value: Joi.number().required(),
  timestamp: Joi.date().default(() => new Date()),
  context: Joi.object().optional(),
});

/**
 * Batch events schema
 */
export const batchEventsSchema = Joi.object({
  events: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid('exposure', 'metric').required(),
        data: Joi.alternatives()
          .conditional('type', {
            is: 'exposure',
            then: exposureEventSchema,
            otherwise: metricEventSchema,
          })
          .required(),
      })
    )
    .min(1)
    .max(1000) // Limit batch size
    .required(),
});

/**
 * Validate experiment configuration
 */
export function validateExperimentConfig(config: any): void {
  const { error, value } = experimentConfigSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ValidationError('Invalid experiment configuration', {
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }

  // Additional validation: variant weights must sum to 1
  const totalWeight = value.variants.reduce(
    (sum: number, variant: any) => sum + variant.weight,
    0
  );

  if (Math.abs(totalWeight - 1) > 0.001) {
    throw new ValidationError('Variant weights must sum to 1', {
      totalWeight,
      variants: value.variants.map((v: any) => ({ id: v.id, weight: v.weight })),
    });
  }
}

/**
 * Validate assignment request
 */
export function validateAssignmentRequest(request: any): void {
  const { error } = assignmentRequestSchema.validate(request, {
    abortEarly: false,
  });

  if (error) {
    throw new ValidationError('Invalid assignment request', {
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }
}

/**
 * Validate exposure event
 */
export function validateExposureEvent(event: any): void {
  const { error } = exposureEventSchema.validate(event, {
    abortEarly: false,
  });

  if (error) {
    throw new ValidationError('Invalid exposure event', {
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }
}

/**
 * Validate metric event
 */
export function validateMetricEvent(event: any): void {
  const { error } = metricEventSchema.validate(event, {
    abortEarly: false,
  });

  if (error) {
    throw new ValidationError('Invalid metric event', {
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }
}

/**
 * Validate batch events
 */
export function validateBatchEvents(batch: any): void {
  const { error } = batchEventsSchema.validate(batch, {
    abortEarly: false,
  });

  if (error) {
    throw new ValidationError('Invalid batch events', {
      details: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }
}

/**
 * Validate user ID format
 */
export function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ValidationError('Invalid user ID', { userId });
  }

  // Check for reasonable length
  if (userId.length > 255) {
    throw new ValidationError('User ID too long (max 255 characters)', { userId });
  }
}

/**
 * Validate experiment ID format
 */
export function validateExperimentId(experimentId: string): void {
  if (!experimentId || typeof experimentId !== 'string' || experimentId.trim().length === 0) {
    throw new ValidationError('Invalid experiment ID', { experimentId });
  }

  // Check for reasonable length
  if (experimentId.length > 255) {
    throw new ValidationError('Experiment ID too long (max 255 characters)', { experimentId });
  }
}

/**
 * Validate metric name format
 */
export function validateMetricName(metricName: string): void {
  if (!metricName || typeof metricName !== 'string' || metricName.trim().length === 0) {
    throw new ValidationError('Invalid metric name', { metricName });
  }

  // Check for valid characters (alphanumeric, underscore, hyphen, dot)
  const validPattern = /^[a-zA-Z0-9_.-]+$/;
  if (!validPattern.test(metricName)) {
    throw new ValidationError(
      'Metric name can only contain alphanumeric characters, underscores, hyphens, and dots',
      { metricName }
    );
  }

  // Check for reasonable length
  if (metricName.length > 255) {
    throw new ValidationError('Metric name too long (max 255 characters)', { metricName });
  }
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: Date, endDate: Date): void {
  if (startDate >= endDate) {
    throw new ValidationError('End date must be after start date', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  }
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Validate and sanitize context object
 */
export function validateContext(context: any): Record<string, any> {
  if (!context || typeof context !== 'object') {
    return {};
  }

  // Ensure context is not too large
  const jsonString = JSON.stringify(context);
  if (jsonString.length > 10000) {
    throw new ValidationError('Context object too large (max 10KB)', {
      size: jsonString.length,
    });
  }

  return context;
}
