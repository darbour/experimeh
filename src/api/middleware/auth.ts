/**
 * Authentication middleware for API key validation
 */

import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  apiKey?: string;
  clientId?: string;
}

/**
 * API Key authentication middleware
 * Expects API key in X-API-Key header
 */
export const apiKeyAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
      statusCode: 401,
    });
    return;
  }

  // In production, validate against database or secure key store
  // For now, we do a simple check
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      statusCode: 401,
    });
    return;
  }

  // Attach API key info to request
  req.apiKey = apiKey;
  // In production, also attach client/tenant ID from key lookup
  req.clientId = 'default';

  next();
};

/**
 * Optional authentication - doesn't fail if no key provided
 * Useful for public endpoints with optional enhanced features
 */
export const optionalAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const apiKey = req.header('X-API-Key');

  if (apiKey) {
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (validApiKeys.includes(apiKey)) {
      req.apiKey = apiKey;
      req.clientId = 'default';
    }
  }

  next();
};

/**
 * Admin-only authentication
 * Requires special admin API key
 */
export const adminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin API key is required',
      statusCode: 401,
    });
    return;
  }

  const adminApiKeys = process.env.ADMIN_API_KEYS?.split(',') || [];

  if (!adminApiKeys.includes(apiKey)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
      statusCode: 403,
    });
    return;
  }

  req.apiKey = apiKey;
  req.clientId = 'admin';

  next();
};
