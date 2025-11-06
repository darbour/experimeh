/**
 * Custom error classes for the Experimeh Browser SDK
 */

export class ExperimentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExperimentError';
    Object.setPrototypeOf(this, ExperimentError.prototype);
  }
}

export class NetworkError extends ExperimentError {
  public readonly statusCode?: number;
  public readonly response?: any;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ValidationError extends ExperimentError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class CacheError extends ExperimentError {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

export class TimeoutError extends ExperimentError {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
