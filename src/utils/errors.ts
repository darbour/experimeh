/**
 * Custom error types for the experimentation system
 */

export enum ErrorCode {
  // Experiment errors
  EXPERIMENT_NOT_FOUND = 'EXPERIMENT_NOT_FOUND',
  EXPERIMENT_INACTIVE = 'EXPERIMENT_INACTIVE',
  EXPERIMENT_INVALID = 'EXPERIMENT_INVALID',

  // Assignment errors
  ASSIGNMENT_ERROR = 'ASSIGNMENT_ERROR',
  ASSIGNMENT_CONSTRAINT_VIOLATION = 'ASSIGNMENT_CONSTRAINT_VIOLATION',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',

  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MISSING_REQUIRED_CONFIG = 'MISSING_REQUIRED_CONFIG',

  // Network/API errors
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base error class for all experimentation system errors
 */
export class ExperimentError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }
}

/**
 * Error thrown when an experiment is not found
 */
export class ExperimentNotFoundError extends ExperimentError {
  constructor(experimentId: string, details?: Record<string, any>) {
    super(
      `Experiment not found: ${experimentId}`,
      ErrorCode.EXPERIMENT_NOT_FOUND,
      404,
      { experimentId, ...details }
    );
  }
}

/**
 * Error thrown when an experiment is inactive
 */
export class ExperimentInactiveError extends ExperimentError {
  constructor(experimentId: string, details?: Record<string, any>) {
    super(
      `Experiment is not active: ${experimentId}`,
      ErrorCode.EXPERIMENT_INACTIVE,
      400,
      { experimentId, ...details }
    );
  }
}

/**
 * Error thrown when assignment fails
 */
export class AssignmentError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.ASSIGNMENT_ERROR,
      400,
      details
    );
  }
}

/**
 * Error thrown when assignment constraints are violated
 */
export class AssignmentConstraintError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.ASSIGNMENT_CONSTRAINT_VIOLATION,
      400,
      details
    );
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      details
    );
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.CONFIGURATION_ERROR,
      500,
      details
    );
  }
}

/**
 * Error thrown when API request fails
 */
export class APIError extends ExperimentError {
  constructor(message: string, statusCode: number = 500, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.API_ERROR,
      statusCode,
      details
    );
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.NETWORK_ERROR,
      503,
      details
    );
  }
}

/**
 * Error thrown when cache operation fails
 */
export class CacheError extends ExperimentError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      ErrorCode.CACHE_ERROR,
      500,
      details
    );
  }
}

/**
 * Check if error is an ExperimentError
 */
export function isExperimentError(error: any): error is ExperimentError {
  return error instanceof ExperimentError;
}

/**
 * Convert any error to ExperimentError
 */
export function toExperimentError(error: any): ExperimentError {
  if (isExperimentError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ExperimentError(
      error.message,
      ErrorCode.INTERNAL_ERROR,
      500,
      { originalError: error.name }
    );
  }

  return new ExperimentError(
    String(error),
    ErrorCode.UNKNOWN_ERROR,
    500
  );
}
