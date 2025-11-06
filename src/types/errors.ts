/**
 * Custom error types for the experimentation system
 */

export class ExperimentationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends ExperimentationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class AssignmentError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'ASSIGNMENT_ERROR', 500, details);
  }
}

export class EvaluationError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'EVALUATION_ERROR', 500, details);
  }
}

export class AnalysisError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'ANALYSIS_ERROR', 500, details);
  }
}

export class StorageError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', 500, details);
  }
}

export class CacheError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'CACHE_ERROR', 500, details);
  }
}

export class QueueError extends ExperimentationError {
  constructor(message: string, details?: any) {
    super(message, 'QUEUE_ERROR', 500, details);
  }
}
