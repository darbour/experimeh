/**
 * Assignment routes
 * Handles experiment assignment requests
 */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validation';
import { optionalAuth } from '../middleware/auth';
import { readRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getAssignmentQuerySchema,
  bulkAssignmentSchema,
} from '../validators/assignment';

const router = Router();

/**
 * GET /api/v1/assignments
 * Get assignment for a unit across experiments
 */
router.get(
  '/',
  optionalAuth,
  readRateLimit,
  validate({ query: getAssignmentQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { unitId, experimentId, experimentKey } = req.query;

    // Parse context from query params
    const context: Record<string, any> = {};
    Object.keys(req.query).forEach((key) => {
      if (key.startsWith('context[') && key.endsWith(']')) {
        const contextKey = key.slice(8, -1);
        context[contextKey] = req.query[key];
      }
    });

    // In production, this would:
    // 1. Fetch active experiments
    // 2. Check targeting rules
    // 3. Compute deterministic assignments
    // 4. Return variant assignments

    // Mock response for demonstration
    const assignments: Record<string, any> = {};

    if (experimentKey === 'checkout_optimization') {
      assignments[experimentKey as string] = {
        experimentId: 'exp-123',
        variantKey: 'green_buy_now',
        factors: {
          button_color: 'green',
          button_text: 'buy_now',
        },
        assigned: true,
        reason: 'hash_assignment',
      };
    } else {
      // Mock assignment using hash
      const hash = simpleHash(String(unitId) + String(experimentId || experimentKey));
      const variantIndex = hash % 2;
      const variants = ['control', 'treatment'];

      assignments['default_experiment'] = {
        experimentId: experimentId || 'exp-default',
        variantKey: variants[variantIndex],
        assigned: true,
        reason: 'hash_assignment',
      };
    }

    res.json({
      success: true,
      data: {
        unitId,
        context,
        assignments,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * POST /api/v1/assignments/bulk
 * Get assignments for multiple units
 */
router.post(
  '/bulk',
  optionalAuth,
  readRateLimit,
  validate({ body: bulkAssignmentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { units, experimentIds } = req.body;

    // Process bulk assignments
    const results = units.map((unit: any) => {
      const assignments: Record<string, any> = {};

      // Mock assignment
      const hash = simpleHash(unit.unitId);
      const variantIndex = hash % 2;
      const variants = ['control', 'treatment'];

      assignments['default_experiment'] = {
        experimentId: experimentIds?.[0] || 'exp-default',
        variantKey: variants[variantIndex],
        assigned: true,
        reason: 'hash_assignment',
      };

      return {
        unitId: unit.unitId,
        context: unit.context || {},
        assignments,
      };
    });

    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Simple hash function for assignment
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default router;
