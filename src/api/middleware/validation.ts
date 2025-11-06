/**
 * Request validation middleware using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'joi';

interface ValidationSource {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Generic validation middleware factory
 * Validates request body, query params, or URL params against Joi schema
 */
export const validate = (schema: ValidationSource) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { [key: string]: string } = {};

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.body = formatValidationError(error);
      }
    }

    // Validate query params
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.query = formatValidationError(error);
      }
    }

    // Validate URL params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.params = formatValidationError(error);
      }
    }

    // If validation errors exist, return 400
    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors,
        statusCode: 400,
      });
      return;
    }

    next();
  };
};

/**
 * Format Joi validation error for better readability
 */
function formatValidationError(error: ValidationError): string {
  return error.details.map((detail) => detail.message).join('; ');
}

/**
 * Validate request body against schema
 */
export const validateBody = (schema: Schema) => {
  return validate({ body: schema });
};

/**
 * Validate query parameters against schema
 */
export const validateQuery = (schema: Schema) => {
  return validate({ query: schema });
};

/**
 * Validate URL parameters against schema
 */
export const validateParams = (schema: Schema) => {
  return validate({ params: schema });
};
