/**
 * Input validation schemas and helpers for experiment creation
 *
 * Provides Zod schemas and validation functions to ensure data integrity
 * before submitting to backend.
 */

import { z } from 'zod';
import type { ExperimentDesignType } from '../pages/CreateExperiment';
import type { VariantAllocation } from '../types';

/**
 * Experiment key validation
 * - Must be alphanumeric with hyphens
 * - 3-50 characters
 * - Cannot start or end with hyphen
 */
export const experimentKeySchema = z
  .string()
  .min(3, 'Experiment key must be at least 3 characters')
  .max(50, 'Experiment key must be at most 50 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Experiment key must be lowercase alphanumeric with hyphens (e.g., "my-experiment-1")'
  );

/**
 * Experiment name validation
 * - Non-empty string
 * - 3-100 characters
 */
export const experimentNameSchema = z
  .string()
  .min(3, 'Experiment name must be at least 3 characters')
  .max(100, 'Experiment name must be at most 100 characters')
  .trim();

/**
 * Description validation
 * - Optional or non-empty
 * - Max 500 characters
 */
export const descriptionSchema = z
  .string()
  .max(500, 'Description must be at most 500 characters')
  .trim()
  .optional();

/**
 * Metric name validation
 * - Non-empty string
 * - 1-100 characters
 */
export const metricNameSchema = z
  .string()
  .min(1, 'Metric name cannot be empty')
  .max(100, 'Metric name must be at most 100 characters')
  .trim();

/**
 * Validate variant allocations sum to 100%
 */
export const variantAllocationsSchema = z
  .array(
    z.object({
      flagVariantId: z.string(),
      flagVariantKey: z.string(),
      experimentRole: z.enum(['control', 'treatment', 'treatment_1', 'treatment_2', 'treatment_3']),
      allocationPercentage: z.number().min(0).max(100),
      description: z.string().optional(),
    })
  )
  .min(2, 'At least 2 variant allocations required')
  .refine(
    (allocations) => {
      const sum = allocations.reduce((acc, a) => acc + a.allocationPercentage, 0);
      // Allow for small floating point errors
      return Math.abs(sum - 100) < 0.01;
    },
    { message: 'Variant allocation percentages must sum to 100%' }
  );

/**
 * Power analysis validation
 */
export const powerAnalysisSchema = z.object({
  baselineValue: z.number().positive('Baseline value must be positive'),
  minimumDetectableEffect: z.number().positive('Minimum detectable effect must be positive'),
  alpha: z.number().min(0.001).max(0.5, 'Alpha must be between 0.001 and 0.5'),
  power: z.number().min(0.5).max(0.99, 'Power must be between 0.5 and 0.99'),
  requiredSampleSize: z.number().int().positive('Sample size must be a positive integer'),
  estimatedRuntimeDays: z.number().positive().optional(),
});

/**
 * Factorial config validation
 */
export const factorialConfigSchema = z.object({
  factors: z
    .array(
      z.object({
        name: z.string().min(1, 'Factor name cannot be empty'),
        levels: z.array(z.string()).min(2, 'Each factor must have at least 2 levels'),
      })
    )
    .min(2, 'Factorial design requires at least 2 factors'),
});

/**
 * Switchback config validation
 */
export const switchbackConfigSchema = z.object({
  periodLengthMinutes: z.number().int().min(1, 'Period length must be at least 1 minute'),
  washoutPeriodMinutes: z.number().int().min(0, 'Washout period cannot be negative'),
  numPeriods: z.number().int().min(2, 'At least 2 periods required for switchback design'),
});

/**
 * Stepped wedge config validation
 */
export const steppedWedgeConfigSchema = z.object({
  clusters: z.array(z.string()).min(2, 'At least 2 clusters required'),
  stepsPerCluster: z.number().int().min(1, 'At least 1 step per cluster required'),
  stepLengthDays: z.number().int().min(1, 'Step length must be at least 1 day'),
});

/**
 * Validation result type
 */
export interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
}

/**
 * Validate experiment key format
 */
export function validateExperimentKey(key: string): ValidationResult {
  const result = experimentKeySchema.safeParse(key);
  if (result.success) {
    return { success: true, errors: {} };
  }
  return {
    success: false,
    errors: { experimentKey: result.error.issues[0].message },
  };
}

/**
 * Validate experiment name
 */
export function validateExperimentName(name: string): ValidationResult {
  const result = experimentNameSchema.safeParse(name);
  if (result.success) {
    return { success: true, errors: {} };
  }
  return {
    success: false,
    errors: { experimentName: result.error.issues[0].message },
  };
}

/**
 * Validate primary metric
 */
export function validatePrimaryMetric(metric: string): ValidationResult {
  const result = metricNameSchema.safeParse(metric);
  if (result.success) {
    return { success: true, errors: {} };
  }
  return {
    success: false,
    errors: { primaryMetric: result.error.issues[0].message },
  };
}

/**
 * Validate variant allocations
 */
export function validateVariantAllocations(
  allocations: Omit<VariantAllocation, 'id'>[]
): ValidationResult {
  const result = variantAllocationsSchema.safeParse(allocations);
  if (result.success) {
    return { success: true, errors: {} };
  }
  return {
    success: false,
    errors: { variantAllocations: result.error.issues[0].message },
  };
}

/**
 * Validate minimum variant count for design type
 */
export function validateVariantCount(
  designType: ExperimentDesignType,
  variantCount: number
): ValidationResult {
  const errors: Record<string, string> = {};

  switch (designType) {
    case 'ab':
      if (variantCount !== 2) {
        errors.variantCount = 'A/B test requires exactly 2 variants';
      }
      break;
    case 'factorial':
      if (variantCount < 4) {
        errors.variantCount = 'Factorial design requires at least 4 variants (2x2)';
      }
      break;
    case 'switchback':
      if (variantCount < 2) {
        errors.variantCount = 'Switchback design requires at least 2 variants';
      }
      break;
    case 'stepped_wedge':
      if (variantCount !== 2) {
        errors.variantCount = 'Stepped wedge design requires exactly 2 variants (control and treatment)';
      }
      break;
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate power analysis inputs
 */
export function validatePowerAnalysis(powerAnalysis: {
  baselineValue: number;
  minimumDetectableEffect: number;
  alpha: number;
  power: number;
  requiredSampleSize: number;
  estimatedRuntimeDays?: number;
}): ValidationResult {
  const result = powerAnalysisSchema.safeParse(powerAnalysis);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    errors[err.path.join('.')] = err.message;
  });

  return { success: false, errors };
}

/**
 * Validate factorial configuration
 */
export function validateFactorialConfig(config: {
  factors: Array<{ name: string; levels: string[] }>;
}): ValidationResult {
  const result = factorialConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    errors[err.path.join('.')] = err.message;
  });

  return { success: false, errors };
}

/**
 * Validate switchback configuration
 */
export function validateSwitchbackConfig(config: {
  periodLengthMinutes: number;
  washoutPeriodMinutes: number;
  numPeriods: number;
}): ValidationResult {
  const result = switchbackConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    errors[err.path.join('.')] = err.message;
  });

  return { success: false, errors };
}

/**
 * Validate stepped wedge configuration
 */
export function validateSteppedWedgeConfig(config: {
  clusters: string[];
  stepsPerCluster: number;
  stepLengthDays: number;
}): ValidationResult {
  const result = steppedWedgeConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    errors[err.path.join('.')] = err.message;
  });

  return { success: false, errors };
}

/**
 * Comprehensive validation for Step 3 (Configure)
 */
export function validateStep3(data: {
  experimentName: string;
  experimentKey: string;
  description?: string;
  primaryMetric: string;
  secondaryMetrics: string[];
}): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate name
  const nameResult = validateExperimentName(data.experimentName);
  if (!nameResult.success) {
    Object.assign(errors, nameResult.errors);
  }

  // Validate key
  const keyResult = validateExperimentKey(data.experimentKey);
  if (!keyResult.success) {
    Object.assign(errors, keyResult.errors);
  }

  // Validate description if provided
  if (data.description) {
    const descResult = descriptionSchema.safeParse(data.description);
    if (!descResult.success) {
      errors.description = descResult.error.issues[0].message;
    }
  }

  // Validate primary metric
  const metricResult = validatePrimaryMetric(data.primaryMetric);
  if (!metricResult.success) {
    Object.assign(errors, metricResult.errors);
  }

  // Validate secondary metrics
  data.secondaryMetrics.forEach((metric, index) => {
    const result = metricNameSchema.safeParse(metric);
    if (!result.success) {
      errors[`secondaryMetrics.${index}`] = result.error.issues[0].message;
    }
  });

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}
