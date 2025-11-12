/**
 * Feature flag routes
 * Handles CRUD operations for feature flags
 *
 * ENHANCED: Now uses UnifiedAssignmentService for evaluation
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
import { FeatureFlag, FeatureFlagStatus } from '../../models/feature-flag';
import { UnifiedAssignmentService } from '../../services/unified-assignment-service';
import { experiments } from './experiments';

const router = Router();

// In-memory storage (replace with database in production)
export const featureFlags = new Map<string, FeatureFlag>();

// Initialize unified assignment service
const assignmentService = new UnifiedAssignmentService({
  enableCache: true,
  cacheTtlSeconds: 300, // 5 minutes
  enableExposureLogging: true,
  logToConsole: process.env.NODE_ENV === 'development',
});

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
      const isEnabled = enabled === 'true';
      filteredFlags = filteredFlags.filter((flag) =>
        (flag.status === FeatureFlagStatus.ENABLED) === isEnabled
      );
    }

    // Sort flags
    filteredFlags.sort((a, b) => {
      const sortField = sortBy as keyof FeatureFlag;
      const aValue = a[sortField] as any;
      const bValue = b[sortField] as any;

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
 *
 * ENHANCED: Now uses UnifiedAssignmentService which integrates experiments
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
    const { unitId, context } = req.query;

    // Update assignment service with latest data
    assignmentService.setFeatureFlags(Array.from(featureFlags.values()));
    assignmentService.setExperiments(Array.from(experiments.values()));

    // Evaluate using unified assignment service
    const result = await assignmentService.evaluate({
      flagKey: key,
      unitId: String(unitId),
      unitType: 'user',
      context: context ? JSON.parse(String(context)) : undefined,
    });

    res.json({
      success: true,
      data: {
        flagKey: result.flagKey,
        flagId: result.flagId,
        variantKey: result.variantKey,
        variantId: result.variantId,
        value: result.value,
        reason: result.reason,
        // Include experiment context if assigned via experiment
        experiment: result.experiment
          ? {
              id: result.experiment.id,
              key: result.experiment.key,
              name: result.experiment.name,
              designType: result.experiment.designType,
              variantRole: result.experiment.variantRole,
            }
          : undefined,
        exposureId: result.exposureId,
        timestamp: result.timestamp,
        fromCache: result.fromCache,
        metadata: result.metadata,
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
