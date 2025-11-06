/**
 * Rate limiting middleware
 * Simple in-memory rate limiter
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiting middleware
 * In production, use Redis-backed rate limiter for distributed systems
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req: Request) => req.ip || 'unknown',
  } = options;

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    store[key].count++;

    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);

      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(store[key].resetTime));

      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        statusCode: 429,
        retryAfter,
      });
    }

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(maxRequests - store[key].count));
    res.set('X-RateLimit-Reset', String(store[key].resetTime));

    next();
  };
};

/**
 * Default rate limiters for different endpoint types
 */

// General API rate limit: 100 requests per minute
export const generalRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

// Stricter rate limit for write operations: 30 requests per minute
export const writeRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many write requests, please slow down',
});

// Very strict rate limit for expensive operations: 10 requests per minute
export const expensiveRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'This operation is rate limited to 10 requests per minute',
});

// Lenient rate limit for read-heavy endpoints: 1000 requests per minute
export const readRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000,
});
