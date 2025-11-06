/**
 * Configuration Service
 * Handles CRUD operations for experiments and feature flags
 * Includes validation, versioning, and audit trail
 */

import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { Experiment, FeatureFlag, ExperimentStatus, DesignType } from '../types';
import { IConfigurationStore, ILogger, ICacheStore } from '../types/interfaces';
import { ValidationError, NotFoundError, ConflictError, StorageError } from '../types/errors';

/**
 * Validation schemas using Joi
 */
const variantSchema = Joi.object({
  key: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('').default(''),
  allocation: Joi.number().min(0).max(100).required(),
});

const factorLevelSchema = Joi.object({
  name: Joi.string().required(),
  levels: Joi.array().items(Joi.string()).min(2).required(),
});

const designConfigSchema = Joi.object({
  type: Joi.string().valid('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback').required(),
  factors: Joi.array().items(factorLevelSchema).optional(),
  switchbackPeriodMinutes: Joi.number().positive().optional(),
  counterbalancingScheme: Joi.string().optional(),
});

const experimentSchema = Joi.object({
  key: Joi.string().pattern(/^[a-z0-9_-]+$/).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('').default(''),
  status: Joi.string().valid('draft', 'running', 'paused', 'completed').default('draft'),
  designType: Joi.string().valid('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback').required(),
  hypotheses: Joi.string().required(),
  primaryMetric: Joi.string().required(),
  secondaryMetrics: Joi.array().items(Joi.string()).default([]),
  guardrailMetrics: Joi.array().items(Joi.string()).default([]),
  randomizationUnit: Joi.string().valid('user', 'session', 'device', 'other').required(),
  assignmentKey: Joi.string().required(),
  variants: Joi.array().items(variantSchema).min(2).required(),
  designConfig: designConfigSchema.required(),
  targetingRules: Joi.string().optional(),
  trafficAllocation: Joi.number().min(0).max(100).default(100),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  minSampleSize: Joi.number().positive().optional(),
  expectedEffect: Joi.number().optional(),
  createdBy: Joi.string().required(),
});

const featureFlagVariantSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
  weight: Joi.number().min(0).max(100).required(),
});

const targetingRuleSchema = Joi.object({
  condition: Joi.string().required(),
  variant: Joi.string().required(),
  priority: Joi.number().optional(),
});

const featureFlagSchema = Joi.object({
  key: Joi.string().pattern(/^[a-z0-9_-]+$/).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('').default(''),
  enabled: Joi.boolean().default(true),
  defaultValue: Joi.any().required(),
  variants: Joi.array().items(featureFlagVariantSchema).default([]),
  targetingRules: Joi.array().items(targetingRuleSchema).default([]),
});

export interface ConfigurationServiceOptions {
  store: IConfigurationStore;
  cache: ICacheStore;
  logger: ILogger;
  cacheTtlSeconds?: number;
}

export class ConfigurationService {
  private store: IConfigurationStore;
  private cache: ICacheStore;
  private logger: ILogger;
  private cacheTtlSeconds: number;

  constructor(options: ConfigurationServiceOptions) {
    this.store = options.store;
    this.cache = options.cache;
    this.logger = options.logger.child({ service: 'ConfigurationService' });
    this.cacheTtlSeconds = options.cacheTtlSeconds || 300; // 5 minutes default
  }

  /**
   * ============================================
   * EXPERIMENT CRUD OPERATIONS
   * ============================================
   */

  /**
   * Create a new experiment
   */
  async createExperiment(
    experimentData: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Experiment> {
    this.logger.info('Creating experiment', { key: experimentData.key });

    try {
      // Validate input
      const { error, value } = experimentSchema.validate(experimentData);
      if (error) {
        throw new ValidationError('Invalid experiment data', error.details);
      }

      // Check for duplicate key
      const existing = await this.store.getExperimentByKey(value.key);
      if (existing) {
        throw new ConflictError(`Experiment with key '${value.key}' already exists`);
      }

      // Validate variant allocations sum to 100
      const totalAllocation = value.variants.reduce((sum: number, v: any) => sum + v.allocation, 0);
      if (Math.abs(totalAllocation - 100) > 0.01) {
        throw new ValidationError(`Variant allocations must sum to 100, got ${totalAllocation}`);
      }

      // Validate design-specific requirements
      this.validateDesignConfig(value);

      // Create experiment
      const experiment = await this.store.createExperiment(value);

      // Cache the experiment
      await this.cacheExperiment(experiment);

      // Log audit trail
      await this.store.logChange('experiment', experiment.id, 'create', experiment, value.createdBy);

      this.logger.info('Experiment created successfully', {
        id: experiment.id,
        key: experiment.key,
      });

      return experiment;
    } catch (error) {
      this.logger.error('Failed to create experiment', { error, data: experimentData });
      throw error;
    }
  }

  /**
   * Update an existing experiment
   */
  async updateExperiment(
    id: string,
    updates: Partial<Experiment>,
    userId: string
  ): Promise<Experiment> {
    this.logger.info('Updating experiment', { id });

    try {
      // Get existing experiment
      const existing = await this.getExperiment(id);
      if (!existing) {
        throw new NotFoundError('Experiment', id);
      }

      // Validate updates if variants are being modified
      if (updates.variants) {
        const totalAllocation = updates.variants.reduce((sum, v) => sum + v.allocation, 0);
        if (Math.abs(totalAllocation - 100) > 0.01) {
          throw new ValidationError(`Variant allocations must sum to 100, got ${totalAllocation}`);
        }
      }

      // Prevent certain changes on running experiments
      if (existing.status === 'running') {
        const immutableFields = ['designType', 'variants', 'randomizationUnit'];
        const attemptedChanges = Object.keys(updates).filter(key =>
          immutableFields.includes(key) && updates[key as keyof Experiment] !== existing[key as keyof Experiment]
        );

        if (attemptedChanges.length > 0) {
          throw new ConflictError(
            `Cannot modify ${attemptedChanges.join(', ')} on a running experiment`,
            { immutableFields: attemptedChanges }
          );
        }
      }

      // Update experiment
      const updated = await this.store.updateExperiment(id, updates);

      // Invalidate cache
      await this.invalidateExperimentCache(id, existing.key);

      // Cache updated version
      await this.cacheExperiment(updated);

      // Log audit trail
      await this.store.logChange('experiment', id, 'update', updates, userId);

      this.logger.info('Experiment updated successfully', { id, updates: Object.keys(updates) });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update experiment', { error, id });
      throw error;
    }
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(id: string): Promise<Experiment | null> {
    try {
      // Try cache first
      const cacheKey = `experiment:${id}`;
      const cached = await this.cache.get<Experiment>(cacheKey);
      if (cached) {
        this.logger.debug('Experiment found in cache', { id });
        return cached;
      }

      // Fetch from store
      const experiment = await this.store.getExperiment(id);
      if (experiment) {
        await this.cacheExperiment(experiment);
      }

      return experiment;
    } catch (error) {
      this.logger.error('Failed to get experiment', { error, id });
      throw new StorageError('Failed to retrieve experiment', { id, error });
    }
  }

  /**
   * Get experiment by key
   */
  async getExperimentByKey(key: string): Promise<Experiment | null> {
    try {
      // Try cache first
      const cacheKey = `experiment:key:${key}`;
      const cached = await this.cache.get<Experiment>(cacheKey);
      if (cached) {
        this.logger.debug('Experiment found in cache by key', { key });
        return cached;
      }

      // Fetch from store
      const experiment = await this.store.getExperimentByKey(key);
      if (experiment) {
        await this.cacheExperiment(experiment);
      }

      return experiment;
    } catch (error) {
      this.logger.error('Failed to get experiment by key', { error, key });
      throw new StorageError('Failed to retrieve experiment', { key, error });
    }
  }

  /**
   * List experiments with optional filters
   */
  async listExperiments(filters?: {
    status?: ExperimentStatus[];
    designType?: DesignType[];
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }> {
    try {
      this.logger.debug('Listing experiments', { filters });
      return await this.store.listExperiments(filters);
    } catch (error) {
      this.logger.error('Failed to list experiments', { error, filters });
      throw new StorageError('Failed to list experiments', { filters, error });
    }
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string, userId: string): Promise<boolean> {
    this.logger.info('Deleting experiment', { id });

    try {
      // Get experiment first
      const experiment = await this.getExperiment(id);
      if (!experiment) {
        throw new NotFoundError('Experiment', id);
      }

      // Prevent deletion of running experiments
      if (experiment.status === 'running') {
        throw new ConflictError('Cannot delete a running experiment. Pause it first.');
      }

      // Delete from store
      const deleted = await this.store.deleteExperiment(id);

      if (deleted) {
        // Invalidate cache
        await this.invalidateExperimentCache(id, experiment.key);

        // Log audit trail
        await this.store.logChange('experiment', id, 'delete', { id }, userId);

        this.logger.info('Experiment deleted successfully', { id });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete experiment', { error, id });
      throw error;
    }
  }

  /**
   * ============================================
   * FEATURE FLAG CRUD OPERATIONS
   * ============================================
   */

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(
    flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<FeatureFlag> {
    this.logger.info('Creating feature flag', { key: flagData.key });

    try {
      // Validate input
      const { error, value } = featureFlagSchema.validate(flagData);
      if (error) {
        throw new ValidationError('Invalid feature flag data', error.details);
      }

      // Check for duplicate key
      const existing = await this.store.getFeatureFlagByKey(value.key);
      if (existing) {
        throw new ConflictError(`Feature flag with key '${value.key}' already exists`);
      }

      // Validate variant weights sum to 100 if variants exist
      if (value.variants && value.variants.length > 0) {
        const totalWeight = value.variants.reduce((sum: number, v: any) => sum + v.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new ValidationError(`Variant weights must sum to 100, got ${totalWeight}`);
        }
      }

      // Create feature flag
      const flag = await this.store.createFeatureFlag(value);

      // Cache the flag
      await this.cacheFeatureFlag(flag);

      this.logger.info('Feature flag created successfully', {
        id: flag.id,
        key: flag.key,
      });

      return flag;
    } catch (error) {
      this.logger.error('Failed to create feature flag', { error, data: flagData });
      throw error;
    }
  }

  /**
   * Update an existing feature flag
   */
  async updateFeatureFlag(
    id: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag> {
    this.logger.info('Updating feature flag', { id });

    try {
      // Get existing flag
      const existing = await this.getFeatureFlag(id);
      if (!existing) {
        throw new NotFoundError('FeatureFlag', id);
      }

      // Validate updates if variants are being modified
      if (updates.variants && updates.variants.length > 0) {
        const totalWeight = updates.variants.reduce((sum, v) => sum + v.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new ValidationError(`Variant weights must sum to 100, got ${totalWeight}`);
        }
      }

      // Update flag
      const updated = await this.store.updateFeatureFlag(id, updates);

      // Invalidate cache
      await this.invalidateFeatureFlagCache(id, existing.key);

      // Cache updated version
      await this.cacheFeatureFlag(updated);

      this.logger.info('Feature flag updated successfully', { id, updates: Object.keys(updates) });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update feature flag', { error, id });
      throw error;
    }
  }

  /**
   * Get feature flag by ID
   */
  async getFeatureFlag(id: string): Promise<FeatureFlag | null> {
    try {
      // Try cache first
      const cacheKey = `flag:${id}`;
      const cached = await this.cache.get<FeatureFlag>(cacheKey);
      if (cached) {
        this.logger.debug('Feature flag found in cache', { id });
        return cached;
      }

      // Fetch from store
      const flag = await this.store.getFeatureFlag(id);
      if (flag) {
        await this.cacheFeatureFlag(flag);
      }

      return flag;
    } catch (error) {
      this.logger.error('Failed to get feature flag', { error, id });
      throw new StorageError('Failed to retrieve feature flag', { id, error });
    }
  }

  /**
   * Get feature flag by key
   */
  async getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
    try {
      // Try cache first
      const cacheKey = `flag:key:${key}`;
      const cached = await this.cache.get<FeatureFlag>(cacheKey);
      if (cached) {
        this.logger.debug('Feature flag found in cache by key', { key });
        return cached;
      }

      // Fetch from store
      const flag = await this.store.getFeatureFlagByKey(key);
      if (flag) {
        await this.cacheFeatureFlag(flag);
      }

      return flag;
    } catch (error) {
      this.logger.error('Failed to get feature flag by key', { error, key });
      throw new StorageError('Failed to retrieve feature flag', { key, error });
    }
  }

  /**
   * List feature flags with optional filters
   */
  async listFeatureFlags(filters?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ flags: FeatureFlag[]; total: number }> {
    try {
      this.logger.debug('Listing feature flags', { filters });
      return await this.store.listFeatureFlags(filters);
    } catch (error) {
      this.logger.error('Failed to list feature flags', { error, filters });
      throw new StorageError('Failed to list feature flags', { filters, error });
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFeatureFlag(id: string): Promise<boolean> {
    this.logger.info('Deleting feature flag', { id });

    try {
      // Get flag first
      const flag = await this.getFeatureFlag(id);
      if (!flag) {
        throw new NotFoundError('FeatureFlag', id);
      }

      // Delete from store
      const deleted = await this.store.deleteFeatureFlag(id);

      if (deleted) {
        // Invalidate cache
        await this.invalidateFeatureFlagCache(id, flag.key);

        this.logger.info('Feature flag deleted successfully', { id });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete feature flag', { error, id });
      throw error;
    }
  }

  /**
   * ============================================
   * PRIVATE HELPER METHODS
   * ============================================
   */

  /**
   * Validate design-specific configuration
   */
  private validateDesignConfig(experiment: any): void {
    const { designType, designConfig, variants } = experiment;

    switch (designType) {
      case 'factorial':
        if (!designConfig.factors || designConfig.factors.length === 0) {
          throw new ValidationError('Factorial designs must specify factors');
        }
        // Calculate expected number of variants (product of factor levels)
        const expectedVariants = designConfig.factors.reduce(
          (prod: number, factor: any) => prod * factor.levels.length,
          1
        );
        if (variants.length !== expectedVariants) {
          throw new ValidationError(
            `Factorial design expects ${expectedVariants} variants, got ${variants.length}`
          );
        }
        break;

      case 'switchback':
        if (!designConfig.switchbackPeriodMinutes) {
          throw new ValidationError('Switchback designs must specify switchbackPeriodMinutes');
        }
        break;

      case 'within_subjects':
        if (!designConfig.counterbalancingScheme) {
          throw new ValidationError('Within-subjects designs must specify counterbalancingScheme');
        }
        break;

      case 'ab':
        if (variants.length !== 2) {
          throw new ValidationError('A/B tests must have exactly 2 variants');
        }
        break;

      case 'multivariate':
        if (variants.length < 3) {
          throw new ValidationError('Multivariate tests must have at least 3 variants');
        }
        break;
    }
  }

  /**
   * Cache an experiment
   */
  private async cacheExperiment(experiment: Experiment): Promise<void> {
    try {
      await Promise.all([
        this.cache.set(`experiment:${experiment.id}`, experiment, this.cacheTtlSeconds),
        this.cache.set(`experiment:key:${experiment.key}`, experiment, this.cacheTtlSeconds),
      ]);
    } catch (error) {
      this.logger.warn('Failed to cache experiment', { error, id: experiment.id });
      // Don't throw - caching failure shouldn't break the operation
    }
  }

  /**
   * Invalidate experiment cache
   */
  private async invalidateExperimentCache(id: string, key: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.delete(`experiment:${id}`),
        this.cache.delete(`experiment:key:${key}`),
      ]);
    } catch (error) {
      this.logger.warn('Failed to invalidate experiment cache', { error, id });
    }
  }

  /**
   * Cache a feature flag
   */
  private async cacheFeatureFlag(flag: FeatureFlag): Promise<void> {
    try {
      await Promise.all([
        this.cache.set(`flag:${flag.id}`, flag, this.cacheTtlSeconds),
        this.cache.set(`flag:key:${flag.key}`, flag, this.cacheTtlSeconds),
      ]);
    } catch (error) {
      this.logger.warn('Failed to cache feature flag', { error, id: flag.id });
    }
  }

  /**
   * Invalidate feature flag cache
   */
  private async invalidateFeatureFlagCache(id: string, key: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.delete(`flag:${id}`),
        this.cache.delete(`flag:key:${key}`),
      ]);
    } catch (error) {
      this.logger.warn('Failed to invalidate feature flag cache', { error, id });
    }
  }
}
