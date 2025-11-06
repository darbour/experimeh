/**
 * Experiment routes
 * Handles CRUD operations for experiments
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../middleware/validation';
import { apiKeyAuth } from '../middleware/auth';
import { writeRateLimit, readRateLimit } from '../middleware/rateLimit';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
  createExperimentSchema,
  updateExperimentSchema,
  experimentIdSchema,
  listExperimentsQuerySchema,
} from '../validators/experiment';
import { Experiment } from '../../types';

const router = Router();

// In-memory storage (replace with database in production)
const experiments = new Map<string, Experiment>();

/**
 * POST /api/v1/experiments
 * Create a new experiment
 */
router.post(
  '/',
  apiKeyAuth,
  writeRateLimit,
  validate({ body: createExperimentSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const experimentData = req.body;

    // Check if experiment key already exists
    const existingExperiment = Array.from(experiments.values()).find(
      (exp) => exp.key === experimentData.key
    );

    if (existingExperiment) {
      throw new ApiError('Experiment with this key already exists', 409);
    }

    // Create new experiment
    const experiment: Experiment = {
      id: uuidv4(),
      ...experimentData,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    experiments.set(experiment.id, experiment);

    res.status(201).json({
      success: true,
      data: experiment,
    });
  })
);

/**
 * GET /api/v1/experiments
 * List all experiments with filtering and pagination
 */
router.get(
  '/',
  apiKeyAuth,
  readRateLimit,
  validate({ query: listExperimentsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, designType, page, limit, sortBy, sortOrder } = req.query;

    // Filter experiments
    let filteredExperiments = Array.from(experiments.values());

    if (status) {
      filteredExperiments = filteredExperiments.filter((exp) => exp.status === status);
    }

    if (designType) {
      filteredExperiments = filteredExperiments.filter((exp) => exp.designType === designType);
    }

    // Sort experiments
    filteredExperiments.sort((a, b) => {
      const sortField = sortBy as keyof Experiment;
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (!aValue || !bValue) return 0;
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedExperiments = filteredExperiments.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedExperiments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredExperiments.length,
        totalPages: Math.ceil(filteredExperiments.length / limitNum),
      },
    });
  })
);

/**
 * GET /api/v1/experiments/:id
 * Get a specific experiment by ID
 */
router.get(
  '/:id',
  apiKeyAuth,
  readRateLimit,
  validate({ params: experimentIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const experiment = experiments.get(id);

    if (!experiment) {
      throw new ApiError('Experiment not found', 404);
    }

    res.json({
      success: true,
      data: experiment,
    });
  })
);

/**
 * PUT /api/v1/experiments/:id
 * Update an experiment
 */
router.put(
  '/:id',
  apiKeyAuth,
  writeRateLimit,
  validate({
    params: experimentIdSchema,
    body: updateExperimentSchema,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const experiment = experiments.get(id);

    if (!experiment) {
      throw new ApiError('Experiment not found', 404);
    }

    // Prevent updating running experiments (some fields)
    if (experiment.status === 'running') {
      const restrictedFields = ['variants', 'designType', 'randomizationUnit'];
      const hasRestrictedUpdate = restrictedFields.some((field) => field in updates);

      if (hasRestrictedUpdate) {
        throw new ApiError(
          'Cannot modify core configuration of running experiment',
          400
        );
      }
    }

    // Update experiment
    const updatedExperiment: Experiment = {
      ...experiment,
      ...updates,
      updatedAt: new Date(),
    };

    experiments.set(id, updatedExperiment);

    res.json({
      success: true,
      data: updatedExperiment,
    });
  })
);

/**
 * DELETE /api/v1/experiments/:id
 * Delete an experiment
 */
router.delete(
  '/:id',
  apiKeyAuth,
  writeRateLimit,
  validate({ params: experimentIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const experiment = experiments.get(id);

    if (!experiment) {
      throw new ApiError('Experiment not found', 404);
    }

    // Prevent deleting running experiments
    if (experiment.status === 'running') {
      throw new ApiError('Cannot delete running experiment. Pause it first.', 400);
    }

    experiments.delete(id);

    res.json({
      success: true,
      message: 'Experiment deleted successfully',
    });
  })
);

/**
 * GET /api/v1/experiments/:id/results
 * Get analysis results for an experiment
 */
router.get(
  '/:id/results',
  apiKeyAuth,
  readRateLimit,
  validate({ params: experimentIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const experiment = experiments.get(id);

    if (!experiment) {
      throw new ApiError('Experiment not found', 404);
    }

    // In production, this would fetch from analysis service
    // For now, return mock results
    const results = {
      experimentId: id,
      status: experiment.status,
      sampleSize: 10000,
      startDate: experiment.startDate || experiment.createdAt,
      mainEffects: [
        {
          factor: experiment.variants[0]?.key || 'control',
          metric: experiment.primaryMetric,
          control: experiment.variants[0]?.key || 'control',
          treatment: experiment.variants[1]?.key || 'treatment',
          controlMean: 0.45,
          treatmentMean: 0.48,
          relativeChange: 6.67,
          pValue: 0.023,
          confidenceInterval: [0.9, 12.4] as [number, number],
        },
      ],
      interactions: [],
    };

    res.json({
      success: true,
      data: results,
    });
  })
);

export default router;
