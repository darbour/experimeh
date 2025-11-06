/**
 * Joi validation schemas for assignment-related requests
 */

import Joi from 'joi';

/**
 * Get assignment query parameters validation
 */
export const getAssignmentQuerySchema = Joi.object({
  unitId: Joi.string().required().messages({
    'any.required': 'unitId is required',
    'string.empty': 'unitId cannot be empty',
  }),
  experimentId: Joi.string().optional(),
  experimentKey: Joi.string().optional(),
  context: Joi.object().optional(),
  // Support context as query params like context[platform]=mobile
}).unknown(true); // Allow context[key] pattern

/**
 * Bulk assignment request validation
 */
export const bulkAssignmentSchema = Joi.object({
  units: Joi.array()
    .items(
      Joi.object({
        unitId: Joi.string().required(),
        context: Joi.object().optional(),
      })
    )
    .min(1)
    .max(100)
    .required(),
  experimentIds: Joi.array().items(Joi.string().uuid()).optional(),
  experimentKeys: Joi.array().items(Joi.string()).optional(),
});
