/**
 * In-memory implementation of IConfigurationStore
 * Fast, simple storage for development and testing
 * WARNING: Not persistent - data is lost on restart
 */

import { v4 as uuidv4 } from 'uuid';
import { IConfigurationStore } from '../types/interfaces';
import { Experiment, FeatureFlag } from '../types';
import { ExperimentNotFoundError, ConfigurationError } from '../utils/errors';
import { Logger } from '../utils/logger';

/**
 * In-memory store implementation
 */
export class InMemoryStore implements IConfigurationStore {
  private experiments: Map<string, Experiment> = new Map();
  private experimentsByKey: Map<string, string> = new Map(); // key -> id mapping
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private featureFlagsByKey: Map<string, string> = new Map(); // key -> id mapping
  private auditLog: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    changes: any;
    userId: string;
    timestamp: Date;
  }> = [];
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger(undefined, 'InMemoryStore');
    this.logger.info('InMemoryStore initialized - data is not persistent');
  }

  // ==================== EXPERIMENTS ====================

  /**
   * Create a new experiment
   */
  async createExperiment(
    experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Experiment> {
    // Check for duplicate key
    if (this.experimentsByKey.has(experiment.key)) {
      throw new ConfigurationError('Experiment with this key already exists', { key: experiment.key });
    }

    const id = uuidv4();
    const now = new Date();

    const newExperiment: Experiment = {
      ...experiment,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.experiments.set(id, newExperiment);
    this.experimentsByKey.set(experiment.key, id);

    this.logger.info('Experiment created', { experimentId: id, key: experiment.key });
    return this.cloneExperiment(newExperiment);
  }

  /**
   * Update an experiment
   */
  async updateExperiment(id: string, updates: Partial<Experiment>): Promise<Experiment> {
    const experiment = this.experiments.get(id);

    if (!experiment) {
      throw new ExperimentNotFoundError(id);
    }

    // Handle key change
    if (updates.key && updates.key !== experiment.key) {
      if (this.experimentsByKey.has(updates.key)) {
        throw new ConfigurationError('Experiment with this key already exists', { key: updates.key });
      }
      this.experimentsByKey.delete(experiment.key);
      this.experimentsByKey.set(updates.key, id);
    }

    const updatedExperiment: Experiment = {
      ...experiment,
      ...updates,
      id, // Preserve ID
      createdAt: experiment.createdAt, // Preserve creation date
      updatedAt: new Date(),
      version: experiment.version + 1,
    };

    this.experiments.set(id, updatedExperiment);

    this.logger.info('Experiment updated', { experimentId: id, version: updatedExperiment.version });
    return this.cloneExperiment(updatedExperiment);
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(id: string): Promise<Experiment | null> {
    const experiment = this.experiments.get(id);
    return experiment ? this.cloneExperiment(experiment) : null;
  }

  /**
   * Get experiment by key
   */
  async getExperimentByKey(key: string): Promise<Experiment | null> {
    const id = this.experimentsByKey.get(key);
    if (!id) {
      return null;
    }
    return this.getExperiment(id);
  }

  /**
   * List experiments with filters
   */
  async listExperiments(filters?: {
    status?: string[];
    designType?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }> {
    let experiments = Array.from(this.experiments.values());

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      experiments = experiments.filter((exp) => filters.status!.includes(exp.status));
    }

    if (filters?.designType && filters.designType.length > 0) {
      experiments = experiments.filter((exp) => filters.designType!.includes(exp.designType));
    }

    // Sort by creation date (newest first)
    experiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = experiments.length;

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    experiments = experiments.slice(offset, offset + limit);

    return {
      experiments: experiments.map((exp) => this.cloneExperiment(exp)),
      total,
    };
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string): Promise<boolean> {
    const experiment = this.experiments.get(id);

    if (!experiment) {
      return false;
    }

    this.experiments.delete(id);
    this.experimentsByKey.delete(experiment.key);

    this.logger.info('Experiment deleted', { experimentId: id });
    return true;
  }

  // ==================== FEATURE FLAGS ====================

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(
    flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<FeatureFlag> {
    // Check for duplicate key
    if (this.featureFlagsByKey.has(flag.key)) {
      throw new ConfigurationError('Feature flag with this key already exists', { key: flag.key });
    }

    const id = uuidv4();
    const now = new Date();

    const newFlag: FeatureFlag = {
      ...flag,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.featureFlags.set(id, newFlag);
    this.featureFlagsByKey.set(flag.key, id);

    this.logger.info('Feature flag created', { flagId: id, key: flag.key });
    return this.cloneFeatureFlag(newFlag);
  }

  /**
   * Update a feature flag
   */
  async updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const flag = this.featureFlags.get(id);

    if (!flag) {
      throw new ConfigurationError('Feature flag not found', { flagId: id });
    }

    // Handle key change
    if (updates.key && updates.key !== flag.key) {
      if (this.featureFlagsByKey.has(updates.key)) {
        throw new ConfigurationError('Feature flag with this key already exists', { key: updates.key });
      }
      this.featureFlagsByKey.delete(flag.key);
      this.featureFlagsByKey.set(updates.key, id);
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      id, // Preserve ID
      createdAt: flag.createdAt, // Preserve creation date
      updatedAt: new Date(),
      version: flag.version + 1,
    };

    this.featureFlags.set(id, updatedFlag);

    this.logger.info('Feature flag updated', { flagId: id, version: updatedFlag.version });
    return this.cloneFeatureFlag(updatedFlag);
  }

  /**
   * Get feature flag by ID
   */
  async getFeatureFlag(id: string): Promise<FeatureFlag | null> {
    const flag = this.featureFlags.get(id);
    return flag ? this.cloneFeatureFlag(flag) : null;
  }

  /**
   * Get feature flag by key
   */
  async getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
    const id = this.featureFlagsByKey.get(key);
    if (!id) {
      return null;
    }
    return this.getFeatureFlag(id);
  }

  /**
   * List feature flags with filters
   */
  async listFeatureFlags(filters?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ flags: FeatureFlag[]; total: number }> {
    let flags = Array.from(this.featureFlags.values());

    // Apply filters
    if (filters?.enabled !== undefined) {
      flags = flags.filter((flag) => flag.enabled === filters.enabled);
    }

    // Sort by creation date (newest first)
    flags.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = flags.length;

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    flags = flags.slice(offset, offset + limit);

    return {
      flags: flags.map((flag) => this.cloneFeatureFlag(flag)),
      total,
    };
  }

  /**
   * Delete a feature flag
   */
  async deleteFeatureFlag(id: string): Promise<boolean> {
    const flag = this.featureFlags.get(id);

    if (!flag) {
      return false;
    }

    this.featureFlags.delete(id);
    this.featureFlagsByKey.delete(flag.key);

    this.logger.info('Feature flag deleted', { flagId: id });
    return true;
  }

  // ==================== AUDIT TRAIL ====================

  /**
   * Log a change for audit purposes
   */
  async logChange(
    entityType: string,
    entityId: string,
    action: string,
    changes: any,
    userId: string
  ): Promise<void> {
    const entry = {
      id: uuidv4(),
      entityType,
      entityId,
      action,
      changes,
      userId,
      timestamp: new Date(),
    };

    this.auditLog.push(entry);

    this.logger.debug('Audit log entry created', { entityType, entityId, action, userId });
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(filters?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: any[]; total: number }> {
    let entries = [...this.auditLog];

    // Apply filters
    if (filters?.entityType) {
      entries = entries.filter((entry) => entry.entityType === filters.entityType);
    }

    if (filters?.entityId) {
      entries = entries.filter((entry) => entry.entityId === filters.entityId);
    }

    if (filters?.userId) {
      entries = entries.filter((entry) => entry.userId === filters.userId);
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = entries.length;

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    entries = entries.slice(offset, offset + limit);

    return { entries, total };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clear all data (useful for testing)
   */
  async clear(): Promise<void> {
    this.experiments.clear();
    this.experimentsByKey.clear();
    this.featureFlags.clear();
    this.featureFlagsByKey.clear();
    this.auditLog = [];
    this.logger.info('All data cleared from in-memory store');
  }

  /**
   * Get statistics about stored data
   */
  getStats(): {
    experiments: number;
    featureFlags: number;
    auditLogEntries: number;
  } {
    return {
      experiments: this.experiments.size,
      featureFlags: this.featureFlags.size,
      auditLogEntries: this.auditLog.length,
    };
  }

  /**
   * Export all data (useful for debugging/testing)
   */
  exportData(): {
    experiments: Experiment[];
    featureFlags: FeatureFlag[];
    auditLog: any[];
  } {
    return {
      experiments: Array.from(this.experiments.values()).map((exp) => this.cloneExperiment(exp)),
      featureFlags: Array.from(this.featureFlags.values()).map((flag) => this.cloneFeatureFlag(flag)),
      auditLog: [...this.auditLog],
    };
  }

  /**
   * Import data (useful for testing/seeding)
   */
  async importData(data: {
    experiments?: Experiment[];
    featureFlags?: FeatureFlag[];
  }): Promise<void> {
    if (data.experiments) {
      for (const experiment of data.experiments) {
        this.experiments.set(experiment.id, this.cloneExperiment(experiment));
        this.experimentsByKey.set(experiment.key, experiment.id);
      }
      this.logger.info('Experiments imported', { count: data.experiments.length });
    }

    if (data.featureFlags) {
      for (const flag of data.featureFlags) {
        this.featureFlags.set(flag.id, this.cloneFeatureFlag(flag));
        this.featureFlagsByKey.set(flag.key, flag.id);
      }
      this.logger.info('Feature flags imported', { count: data.featureFlags.length });
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Deep clone an experiment to prevent external mutations
   */
  private cloneExperiment(experiment: Experiment): Experiment {
    return JSON.parse(JSON.stringify(experiment));
  }

  /**
   * Deep clone a feature flag to prevent external mutations
   */
  private cloneFeatureFlag(flag: FeatureFlag): FeatureFlag {
    return JSON.parse(JSON.stringify(flag));
  }

  /**
   * Health check (always healthy for in-memory)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
