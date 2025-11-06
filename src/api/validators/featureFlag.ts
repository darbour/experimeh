/**
 * Joi validation schemas for feature flag-related requests
 */

import Joi from 'joi';

const flagVariantSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
  weight: Joi.number().min(0).max(100).required(),
});

const targetingRuleSchema = Joi.object({
  condition: Joi.string().required(),
  variant: Joi.string().required(),
});

/**
 * Create feature flag request validation
 */
export const createFeatureFlagSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Key must contain only lowercase letters, numbers, and underscores',
    }),
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  enabled: Joi.boolean().default(true),
  defaultValue: Joi.any().required(),
  variants: Joi.array()
    .items(flagVariantSchema)
    .optional()
    .custom((variants, helpers) => {
      if (variants && variants.length > 0) {
        const totalWeight = variants.reduce((sum: number, v: any) => sum + v.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          return helpers.error('any.custom', {
            message: 'Variant weights must sum to 100'
          });
        }
      }
      return variants;
    }),
  targetingRules: Joi.array().items(targetingRuleSchema).optional(),
});

/**
 * Update feature flag request validation
 */
export const updateFeatureFlagSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  enabled: Joi.boolean().optional(),
  defaultValue: Joi.any().optional(),
  variants: Joi.array()
    .items(flagVariantSchema)
    .optional()
    .custom((variants, helpers) => {
      if (variants && variants.length > 0) {
        const totalWeight = variants.reduce((sum: number, v: any) => sum + v.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          return helpers.error('any.custom', {
            message: 'Variant weights must sum to 100'
          });
        }
      }
      return variants;
    }),
  targetingRules: Joi.array().items(targetingRuleSchema).optional(),
}).min(1); // At least one field must be provided

/**
 * Feature flag ID parameter validation
 */
export const featureFlagIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

/**
 * Feature flag key parameter validation
 */
export const featureFlagKeySchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .required(),
});

/**
 * List feature flags query parameters validation
 */
export const listFeatureFlagsQuerySchema = Joi.object({
  enabled: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'key').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Evaluate flag query parameters validation
 */
export const evaluateFlagQuerySchema = Joi.object({
  unitId: Joi.string().required(),
  context: Joi.object().optional(),
});
