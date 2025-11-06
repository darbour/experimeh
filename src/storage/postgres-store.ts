/**
 * PostgreSQL implementation of IConfigurationStore
 * Provides persistent storage for experiments and feature flags
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { IConfigurationStore } from '../types/interfaces';
import {
  Experiment,
  FeatureFlag,
  ExperimentVariant,
  FeatureFlagVariant,
  TargetingRule,
  DesignConfig,
} from '../types';
import { Logger } from '../utils/logger';
import { ExperimentNotFoundError, ConfigurationError } from '../utils/errors';

export interface PostgresStoreConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * PostgreSQL store implementation
 */
export class PostgresStore implements IConfigurationStore {
  private pool: Pool;
  private logger: Logger;
  private initialized: boolean = false;

  constructor(config?: PostgresStoreConfig, logger?: Logger) {
    const poolConfig: PoolConfig = {
      host: config?.host || process.env.POSTGRES_HOST || 'localhost',
      port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: config?.database || process.env.POSTGRES_DB || 'experimeh',
      user: config?.user || process.env.POSTGRES_USER || 'postgres',
      password: config?.password || process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: config?.ssl || process.env.POSTGRES_SSL === 'true',
      max: config?.max || parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 10000,
    };

    this.pool = new Pool(poolConfig);
    this.logger = logger || new Logger(undefined, 'PostgresStore');

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      this.logger.error('Unexpected error on idle database client', { error: err.message });
    });
  }

  /**
   * Initialize the database connection and verify schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        this.logger.info('PostgreSQL connection established successfully');
        this.initialized = true;
      } finally {
        client.release();
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to initialize PostgreSQL connection', { error: err.message });
      throw new ConfigurationError('Failed to initialize database connection', { error: err.message });
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('PostgreSQL connections closed');
      this.initialized = false;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error closing PostgreSQL connections', { error: err.message });
      throw error;
    }
  }

  // ==================== EXPERIMENTS ====================

  /**
   * Create a new experiment
   */
  async createExperiment(
    experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Experiment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const id = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO experiments (
          id, key, name, description, status, design_type, hypotheses,
          primary_metric, secondary_metrics, guardrail_metrics,
          randomization_unit, assignment_key, variants, design_config,
          targeting_rules, traffic_allocation, start_date, end_date,
          min_sample_size, expected_effect, created_by, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *`,
        [
          id,
          experiment.key,
          experiment.name,
          experiment.description,
          experiment.status,
          experiment.designType,
          experiment.hypotheses,
          experiment.primaryMetric,
          JSON.stringify(experiment.secondaryMetrics),
          JSON.stringify(experiment.guardrailMetrics),
          experiment.randomizationUnit,
          experiment.assignmentKey,
          JSON.stringify(experiment.variants),
          JSON.stringify(experiment.designConfig),
          experiment.targetingRules || null,
          experiment.trafficAllocation,
          experiment.startDate || null,
          experiment.endDate || null,
          experiment.minSampleSize || null,
          experiment.expectedEffect || null,
          experiment.createdBy,
          now,
          now,
          1,
        ]
      );

      await client.query('COMMIT');

      this.logger.info('Experiment created', { experimentId: id, key: experiment.key });
      return this.rowToExperiment(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to create experiment', { error: err.message, key: experiment.key });
      throw new ConfigurationError('Failed to create experiment', { error: err.message });
    } finally {
      client.release();
    }
  }

  /**
   * Update an experiment
   */
  async updateExperiment(id: string, updates: Partial<Experiment>): Promise<Experiment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current version for optimistic locking
      const currentResult = await client.query('SELECT version FROM experiments WHERE id = $1', [id]);

      if (currentResult.rows.length === 0) {
        throw new ExperimentNotFoundError(id);
      }

      const currentVersion = currentResult.rows[0].version;
      const newVersion = currentVersion + 1;

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.hypotheses !== undefined) {
        updateFields.push(`hypotheses = $${paramIndex++}`);
        values.push(updates.hypotheses);
      }
      if (updates.primaryMetric !== undefined) {
        updateFields.push(`primary_metric = $${paramIndex++}`);
        values.push(updates.primaryMetric);
      }
      if (updates.secondaryMetrics !== undefined) {
        updateFields.push(`secondary_metrics = $${paramIndex++}`);
        values.push(JSON.stringify(updates.secondaryMetrics));
      }
      if (updates.guardrailMetrics !== undefined) {
        updateFields.push(`guardrail_metrics = $${paramIndex++}`);
        values.push(JSON.stringify(updates.guardrailMetrics));
      }
      if (updates.variants !== undefined) {
        updateFields.push(`variants = $${paramIndex++}`);
        values.push(JSON.stringify(updates.variants));
      }
      if (updates.designConfig !== undefined) {
        updateFields.push(`design_config = $${paramIndex++}`);
        values.push(JSON.stringify(updates.designConfig));
      }
      if (updates.targetingRules !== undefined) {
        updateFields.push(`targeting_rules = $${paramIndex++}`);
        values.push(updates.targetingRules);
      }
      if (updates.trafficAllocation !== undefined) {
        updateFields.push(`traffic_allocation = $${paramIndex++}`);
        values.push(updates.trafficAllocation);
      }
      if (updates.startDate !== undefined) {
        updateFields.push(`start_date = $${paramIndex++}`);
        values.push(updates.startDate);
      }
      if (updates.endDate !== undefined) {
        updateFields.push(`end_date = $${paramIndex++}`);
        values.push(updates.endDate);
      }
      if (updates.minSampleSize !== undefined) {
        updateFields.push(`min_sample_size = $${paramIndex++}`);
        values.push(updates.minSampleSize);
      }
      if (updates.expectedEffect !== undefined) {
        updateFields.push(`expected_effect = $${paramIndex++}`);
        values.push(updates.expectedEffect);
      }

      // Always update these fields
      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      updateFields.push(`version = $${paramIndex++}`);
      values.push(newVersion);

      // Add ID and version for WHERE clause
      values.push(id);
      values.push(currentVersion);

      const query = `
        UPDATE experiments
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND version = $${paramIndex++}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new ConfigurationError('Experiment update failed due to version conflict', { experimentId: id });
      }

      await client.query('COMMIT');

      this.logger.info('Experiment updated', { experimentId: id, version: newVersion });
      return this.rowToExperiment(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to update experiment', { error: err.message, experimentId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(id: string): Promise<Experiment | null> {
    try {
      const result = await this.pool.query('SELECT * FROM experiments WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToExperiment(result.rows[0]);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get experiment', { error: err.message, experimentId: id });
      throw new ConfigurationError('Failed to get experiment', { error: err.message });
    }
  }

  /**
   * Get experiment by key
   */
  async getExperimentByKey(key: string): Promise<Experiment | null> {
    try {
      const result = await this.pool.query('SELECT * FROM experiments WHERE key = $1', [key]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToExperiment(result.rows[0]);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get experiment by key', { error: err.message, key });
      throw new ConfigurationError('Failed to get experiment by key', { error: err.message });
    }
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
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.status && filters.status.length > 0) {
        conditions.push(`status = ANY($${paramIndex++})`);
        values.push(filters.status);
      }

      if (filters?.designType && filters.designType.length > 0) {
        conditions.push(`design_type = ANY($${paramIndex++})`);
        values.push(filters.designType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM experiments ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        SELECT * FROM experiments
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      const experiments = result.rows.map((row) => this.rowToExperiment(row));

      return { experiments, total };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to list experiments', { error: err.message });
      throw new ConfigurationError('Failed to list experiments', { error: err.message });
    }
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query('DELETE FROM experiments WHERE id = $1', [id]);

      await client.query('COMMIT');

      const deleted = result.rowCount !== null && result.rowCount > 0;

      if (deleted) {
        this.logger.info('Experiment deleted', { experimentId: id });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to delete experiment', { error: err.message, experimentId: id });
      throw new ConfigurationError('Failed to delete experiment', { error: err.message });
    } finally {
      client.release();
    }
  }

  // ==================== FEATURE FLAGS ====================

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(
    flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<FeatureFlag> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const id = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO feature_flags (
          id, key, name, description, enabled, default_value,
          variants, targeting_rules, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          id,
          flag.key,
          flag.name,
          flag.description,
          flag.enabled,
          JSON.stringify(flag.defaultValue),
          JSON.stringify(flag.variants),
          JSON.stringify(flag.targetingRules),
          now,
          now,
          1,
        ]
      );

      await client.query('COMMIT');

      this.logger.info('Feature flag created', { flagId: id, key: flag.key });
      return this.rowToFeatureFlag(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to create feature flag', { error: err.message, key: flag.key });
      throw new ConfigurationError('Failed to create feature flag', { error: err.message });
    } finally {
      client.release();
    }
  }

  /**
   * Update a feature flag
   */
  async updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current version for optimistic locking
      const currentResult = await client.query('SELECT version FROM feature_flags WHERE id = $1', [id]);

      if (currentResult.rows.length === 0) {
        throw new ConfigurationError('Feature flag not found', { flagId: id });
      }

      const currentVersion = currentResult.rows[0].version;
      const newVersion = currentVersion + 1;

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.enabled !== undefined) {
        updateFields.push(`enabled = $${paramIndex++}`);
        values.push(updates.enabled);
      }
      if (updates.defaultValue !== undefined) {
        updateFields.push(`default_value = $${paramIndex++}`);
        values.push(JSON.stringify(updates.defaultValue));
      }
      if (updates.variants !== undefined) {
        updateFields.push(`variants = $${paramIndex++}`);
        values.push(JSON.stringify(updates.variants));
      }
      if (updates.targetingRules !== undefined) {
        updateFields.push(`targeting_rules = $${paramIndex++}`);
        values.push(JSON.stringify(updates.targetingRules));
      }

      // Always update these fields
      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      updateFields.push(`version = $${paramIndex++}`);
      values.push(newVersion);

      // Add ID and version for WHERE clause
      values.push(id);
      values.push(currentVersion);

      const query = `
        UPDATE feature_flags
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND version = $${paramIndex++}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new ConfigurationError('Feature flag update failed due to version conflict', { flagId: id });
      }

      await client.query('COMMIT');

      this.logger.info('Feature flag updated', { flagId: id, version: newVersion });
      return this.rowToFeatureFlag(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to update feature flag', { error: err.message, flagId: id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get feature flag by ID
   */
  async getFeatureFlag(id: string): Promise<FeatureFlag | null> {
    try {
      const result = await this.pool.query('SELECT * FROM feature_flags WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToFeatureFlag(result.rows[0]);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get feature flag', { error: err.message, flagId: id });
      throw new ConfigurationError('Failed to get feature flag', { error: err.message });
    }
  }

  /**
   * Get feature flag by key
   */
  async getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
    try {
      const result = await this.pool.query('SELECT * FROM feature_flags WHERE key = $1', [key]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToFeatureFlag(result.rows[0]);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get feature flag by key', { error: err.message, key });
      throw new ConfigurationError('Failed to get feature flag by key', { error: err.message });
    }
  }

  /**
   * List feature flags with filters
   */
  async listFeatureFlags(filters?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ flags: FeatureFlag[]; total: number }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.enabled !== undefined) {
        conditions.push(`enabled = $${paramIndex++}`);
        values.push(filters.enabled);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM feature_flags ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated results
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        SELECT * FROM feature_flags
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      const flags = result.rows.map((row) => this.rowToFeatureFlag(row));

      return { flags, total };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to list feature flags', { error: err.message });
      throw new ConfigurationError('Failed to list feature flags', { error: err.message });
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFeatureFlag(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query('DELETE FROM feature_flags WHERE id = $1', [id]);

      await client.query('COMMIT');

      const deleted = result.rowCount !== null && result.rowCount > 0;

      if (deleted) {
        this.logger.info('Feature flag deleted', { flagId: id });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to delete feature flag', { error: err.message, flagId: id });
      throw new ConfigurationError('Failed to delete feature flag', { error: err.message });
    } finally {
      client.release();
    }
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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO audit_log (
          id, entity_type, entity_id, action, changes, user_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), entityType, entityId, action, JSON.stringify(changes), userId, new Date()]
      );

      await client.query('COMMIT');

      this.logger.debug('Audit log entry created', { entityType, entityId, action, userId });
    } catch (error) {
      await client.query('ROLLBACK');
      const err = error as Error;
      this.logger.error('Failed to create audit log entry', {
        error: err.message,
        entityType,
        entityId,
        action,
      });
      // Don't throw error for audit logging failures
    } finally {
      client.release();
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Convert database row to Experiment object
   */
  private rowToExperiment(row: any): Experiment {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      status: row.status,
      designType: row.design_type,
      hypotheses: row.hypotheses,
      primaryMetric: row.primary_metric,
      secondaryMetrics: JSON.parse(row.secondary_metrics),
      guardrailMetrics: JSON.parse(row.guardrail_metrics),
      randomizationUnit: row.randomization_unit,
      assignmentKey: row.assignment_key,
      variants: JSON.parse(row.variants),
      designConfig: JSON.parse(row.design_config),
      targetingRules: row.targeting_rules,
      trafficAllocation: row.traffic_allocation,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      minSampleSize: row.min_sample_size,
      expectedEffect: row.expected_effect,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    };
  }

  /**
   * Convert database row to FeatureFlag object
   */
  private rowToFeatureFlag(row: any): FeatureFlag {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      defaultValue: JSON.parse(row.default_value),
      variants: JSON.parse(row.variants),
      targetingRules: JSON.parse(row.targeting_rules),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      return false;
    }
  }
}
