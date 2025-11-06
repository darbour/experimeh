/**
 * Winston-based logging utility with structured logging support
 */

import winston from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogMetadata {
  [key: string]: any;
}

export interface LoggerConfig {
  level?: LogLevel;
  serviceName?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  enableJson?: boolean;
}

/**
 * Custom log format for structured logging
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]`;

    if (service) {
      msg += ` [${service}]`;
    }

    msg += `: ${message}`;

    // Add metadata if present
    const metadataKeys = Object.keys(metadata);
    if (metadataKeys.length > 0) {
      // Filter out internal winston keys
      const filteredMetadata = Object.keys(metadata)
        .filter(key => !['timestamp', 'level', 'message', 'service'].includes(key))
        .reduce((obj, key) => {
          obj[key] = metadata[key];
          return obj;
        }, {} as Record<string, any>);

      if (Object.keys(filteredMetadata).length > 0) {
        msg += ` ${JSON.stringify(filteredMetadata)}`;
      }
    }

    return msg;
  })
);

/**
 * JSON format for structured logging
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create a logger instance with the given configuration
 */
export function createLogger(config: LoggerConfig = {}): winston.Logger {
  const {
    level = process.env.LOG_LEVEL || LogLevel.INFO,
    serviceName = 'experimeh',
    enableConsole = true,
    enableFile = false,
    filePath = 'logs/app.log',
    enableJson = false,
  } = config;

  const transports: winston.transport[] = [];

  // Console transport
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: enableJson ? jsonFormat : customFormat,
      })
    );
  }

  // File transport
  if (enableFile) {
    transports.push(
      new winston.transports.File({
        filename: filePath,
        format: jsonFormat, // Always use JSON for file logs
      })
    );
  }

  const logger = winston.createLogger({
    level,
    defaultMeta: { service: serviceName },
    transports,
    // Don't exit on error
    exitOnError: false,
  });

  return logger;
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Logger wrapper class for easier usage
 */
export class Logger {
  private logger: winston.Logger;
  private context?: string;

  constructor(logger: winston.Logger = createLogger(), context?: string) {
    this.logger = logger;
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string, metadata?: LogMetadata): Logger {
    const childLogger = this.logger.child({ context, ...metadata });
    return new Logger(childLogger, context);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    const meta: LogMetadata = { ...metadata };

    if (this.context) {
      meta.context = this.context;
    }

    this.logger.log(level, message, meta);
  }

  /**
   * Log error with error object
   */
  logError(message: string, error: Error, metadata?: LogMetadata): void {
    this.error(message, {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Log HTTP request
   */
  logRequest(method: string, url: string, statusCode: number, duration: number, metadata?: LogMetadata): void {
    this.info(`${method} ${url} - ${statusCode} (${duration}ms)`, {
      ...metadata,
      method,
      url,
      statusCode,
      duration,
      type: 'http_request',
    });
  }

  /**
   * Log experiment assignment
   */
  logAssignment(
    experimentId: string,
    userId: string,
    variant: string,
    metadata?: LogMetadata
  ): void {
    this.info(`Assignment: user=${userId} experiment=${experimentId} variant=${variant}`, {
      ...metadata,
      experimentId,
      userId,
      variant,
      type: 'assignment',
    });
  }

  /**
   * Log metric tracking
   */
  logMetric(
    metricName: string,
    value: number,
    metadata?: LogMetadata
  ): void {
    this.debug(`Metric: ${metricName}=${value}`, {
      ...metadata,
      metricName,
      value,
      type: 'metric',
    });
  }

  /**
   * Log experiment exposure
   */
  logExposure(
    experimentId: string,
    userId: string,
    variant: string,
    metadata?: LogMetadata
  ): void {
    this.info(`Exposure: user=${userId} experiment=${experimentId} variant=${variant}`, {
      ...metadata,
      experimentId,
      userId,
      variant,
      type: 'exposure',
    });
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger(logger);

/**
 * Create a logger with custom configuration
 */
export function getLogger(config?: LoggerConfig, context?: string): Logger {
  const winstonLogger = createLogger(config);
  return new Logger(winstonLogger, context);
}
