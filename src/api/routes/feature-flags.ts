/**
 * Feature flag routes
 * Handles CRUD operations for feature flags
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validation';
import { apiKeyAuth, optionalAuth } from '../middleware/auth';
import { writeRateLimit, readRateLimit } from '../middleware/rateLimit';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  featureFlagIdSchema,
  featureFlagKeySchema,
  listFeatureFlagsQuerySchema,
  evaluateFlagQuerySchema,
} from '../validators/featureFlag';
import { FeatureFlag } from '../../types';

const router = Router();

// In-memory storage (replace with database in production)
const featureFlags = new Map<string, FeatureFlag>();

/**
 * POST /api/v1/flags
 * Create a new feature flag
 */
router.post(
  '/',
  apiKeyAuth,
  writeRateLimit,
  validate({ body: createFeatureFlagSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const flagData = req.body;

    // Check if flag key already exists
    const existingFlag = Array.from(featureFlags.values()).find(
      (flag) => flag.key === flagData.key
    );

    if (existingFlag) {
      throw new ApiError('Feature flag with this key already exists', 409);
    }

    // Create new flag
    const flag: FeatureFlag = {
      id: uuidv4(),
      ...flagData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    featureFlags.set(flag.id, flag);

    res.status(201).json({
      success: true,
      data: flag,
    });
  })
);

/**
 * GET /api/v1/flags
 * List all feature flags with filtering and pagination
 */
router.get(
  '/',
  apiKeyAuth,
  readRateLimit,
  validate({ query: listFeatureFlagsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled, page, limit, sortBy, sortOrder } = req.query;

    // Filter flags
    let filteredFlags = Array.from(featureFlags.values());

    if (enabled !== undefined) {
      filteredFlags = filteredFlags.filter((flag) => flag.enabled === (enabled === 'true'));
    }

    // Sort flags
    filteredFlags.sort((a, b) => {
      const sortField = sortBy as keyof FeatureFlag;
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedFlags = filteredFlags.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedFlags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredFlags.length,
        totalPages: Math.ceil(filteredFlags.length / limitNum),
      },
    });
  })
);

/**
 * GET /api/v1/flags/:id
 * Get a specific feature flag by ID
 */
router.get(
  '/:id',
  apiKeyAuth,
  readRateLimit,
  validate({ params: featureFlagIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const flag = featureFlags.get(id);

    if (!flag) {
      throw new ApiError('Feature flag not found', 404);
    }

    res.json({
      success: true,
      data: flag,
    });
  })
);

/**
 * PUT /api/v1/flags/:id
 * Update a feature flag
 */
router.put(
  '/:id',
  apiKeyAuth,
  writeRateLimit,
  validate({
    params: featureFlagIdSchema,
    body: updateFeatureFlagSchema,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const flag = featureFlags.get(id);

    if (!flag) {
      throw new ApiError('Feature flag not found', 404);
    }

    // Update flag
    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date(),
    };

    featureFlags.set(id, updatedFlag);

    res.json({
      success: true,
      data: updatedFlag,
    });
  })
);

/**
 * DELETE /api/v1/flags/:id
 * Delete a feature flag
 */
router.delete(
  '/:id',
  apiKeyAuth,
  writeRateLimit,
  validate({ params: featureFlagIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const flag = featureFlags.get(id);

    if (!flag) {
      throw new ApiError('Feature flag not found', 404);
    }

    featureFlags.delete(id);

    res.json({
      success: true,
      message: 'Feature flag deleted successfully',
    });
  })
);

/**
 * GET /api/v1/flags/:key/evaluate
 * Evaluate a feature flag for a specific unit
 */
router.get(
  '/:key/evaluate',
  optionalAuth,
  readRateLimit,
  validate({
    params: featureFlagKeySchema,
    query: evaluateFlagQuerySchema,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const { unitId } = req.query;

    // Find flag by key
    const flag = Array.from(featureFlags.values()).find((f) => f.key === key);

    if (!flag) {
      throw new ApiError('Feature flag not found', 404);
    }

    // If flag is disabled, return default value
    if (!flag.enabled) {
      res.json({
        success: true,
        data: {
          key: flag.key,
          value: flag.defaultValue,
          enabled: false,
          reason: 'flag_disabled',
        },
      });
      return;
    }

    // Evaluate targeting rules
    // In production, this would use a rule engine
    let selectedVariant = null;

    if (flag.variants && flag.variants.length > 0) {
      // Simple hash-based variant selection
      const hash = simpleHash(String(unitId) + flag.key);
      const targetWeight = hash % 100;

      let cumulativeWeight = 0;
      for (const variant of flag.variants) {
        cumulativeWeight += variant.weight;
        if (targetWeight < cumulativeWeight) {
          selectedVariant = variant;
          break;
        }
      }
    }

    const value = selectedVariant ? selectedVariant.value : flag.defaultValue;

    res.json({
      success: true,
      data: {
        key: flag.key,
        value,
        enabled: true,
        variant: selectedVariant?.key,
        reason: selectedVariant ? 'variant_assigned' : 'default_value',
      },
    });
  })
);

/**
 * Simple hash function for variant assignment
 * In production, use a proper consistent hashing algorithm
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export default router;
