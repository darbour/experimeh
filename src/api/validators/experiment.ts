/**
 * Joi validation schemas for experiment-related requests
 */

import Joi from 'joi';

// Common schemas
const variantSchema = Joi.object({
  key: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  allocation: Joi.number().min(0).max(100).required(),
});

const factorSchema = Joi.object({
  name: Joi.string().required(),
  levels: Joi.array().items(Joi.string()).min(2).required(),
});

const designConfigSchema = Joi.object({
  type: Joi.string().valid('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback').required(),
  factors: Joi.array().items(factorSchema).optional(),
  switchbackPeriodMinutes: Joi.number().positive().optional(),
  counterbalancingScheme: Joi.string().optional(),
});

/**
 * Create experiment request validation
 */
export const createExperimentSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Key must contain only lowercase letters, numbers, and underscores',
    }),
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).required(),
  designType: Joi.string()
    .valid('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback')
    .required(),

  hypotheses: Joi.string().max(1000).optional(),
  primaryMetric: Joi.string().required(),
  secondaryMetrics: Joi.array().items(Joi.string()).default([]),
  guardrailMetrics: Joi.array().items(Joi.string()).default([]),

  randomizationUnit: Joi.string()
    .valid('user', 'session', 'device', 'other')
    .required(),
  assignmentKey: Joi.string().required(),

  variants: Joi.array()
    .items(variantSchema)
    .min(2)
    .required()
    .custom((variants, helpers) => {
      const totalAllocation = variants.reduce((sum: number, v: any) => sum + v.allocation, 0);
      if (Math.abs(totalAllocation - 100) > 0.01) {
        return helpers.error('any.custom', {
          message: 'Variant allocations must sum to 100'
        });
      }
      return variants;
    }),

  designConfig: designConfigSchema.optional(),
  targetingRules: Joi.string().optional(),
  trafficAllocation: Joi.number().min(0).max(100).default(100),

  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional(),
  minSampleSize: Joi.number().positive().optional(),
  expectedEffect: Joi.number().optional(),
});

/**
 * Update experiment request validation
 */
export const updateExperimentSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  status: Joi.string().valid('draft', 'running', 'paused', 'completed').optional(),

  hypotheses: Joi.string().max(1000).optional(),
  primaryMetric: Joi.string().optional(),
  secondaryMetrics: Joi.array().items(Joi.string()).optional(),
  guardrailMetrics: Joi.array().items(Joi.string()).optional(),

  variants: Joi.array()
    .items(variantSchema)
    .min(2)
    .optional()
    .custom((variants, helpers) => {
      if (variants) {
        const totalAllocation = variants.reduce((sum: number, v: any) => sum + v.allocation, 0);
        if (Math.abs(totalAllocation - 100) > 0.01) {
          return helpers.error('any.custom', {
            message: 'Variant allocations must sum to 100'
          });
        }
      }
      return variants;
    }),

  targetingRules: Joi.string().optional(),
  trafficAllocation: Joi.number().min(0).max(100).optional(),

  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  minSampleSize: Joi.number().positive().optional(),
  expectedEffect: Joi.number().optional(),
}).min(1); // At least one field must be provided

/**
 * Experiment ID parameter validation
 */
export const experimentIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

/**
 * List experiments query parameters validation
 */
export const listExperimentsQuerySchema = Joi.object({
  status: Joi.string().valid('draft', 'running', 'paused', 'completed').optional(),
  designType: Joi.string().valid('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'startDate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
