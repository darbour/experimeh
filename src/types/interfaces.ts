/**
 * Abstract interfaces for external dependencies
 * These allow for dependency injection and easy mocking/testing
 */

import { Experiment, FeatureFlag, Assignment, ExposureEvent, MetricEvent } from './index';

/**
 * Database interface for configuration storage
 */
export interface IConfigurationStore {
  // Experiments
  createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Experiment>;
  updateExperiment(id: string, updates: Partial<Experiment>): Promise<Experiment>;
  getExperiment(id: string): Promise<Experiment | null>;
  getExperimentByKey(key: string): Promise<Experiment | null>;
  listExperiments(filters?: {
    status?: string[];
    designType?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ experiments: Experiment[]; total: number }>;
  deleteExperiment(id: string): Promise<boolean>;

  // Feature Flags
  createFeatureFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<FeatureFlag>;
  updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag>;
  getFeatureFlag(id: string): Promise<FeatureFlag | null>;
  getFeatureFlagByKey(key: string): Promise<FeatureFlag | null>;
  listFeatureFlags(filters?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ flags: FeatureFlag[]; total: number }>;
  deleteFeatureFlag(id: string): Promise<boolean>;

  // Audit trail
  logChange(entityType: string, entityId: string, action: string, changes: any, userId: string): Promise<void>;
}

/**
 * Cache interface for Redis or other caching solutions
 */
export interface ICacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  // Hash operations for more complex caching
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
}

/**
 * Queue interface for Kafka or other message brokers
 */
export interface IEventQueue {
  publish(topic: string, messages: any[]): Promise<void>;
  publishSingle(topic: string, message: any): Promise<void>;
  subscribe(topic: string, handler: (message: any) => Promise<void>): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Logger interface (Winston or similar)
 */
export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;

  // Child logger with additional context
  child(context: Record<string, any>): ILogger;
}

/**
 * Statistical analysis engine interface
 */
export interface IStatisticalEngine {
  // Basic statistical tests
  tTest(control: number[], treatment: number[], alpha?: number): Promise<{
    mean1: number;
    mean2: number;
    pValue: number;
    confidenceInterval: [number, number];
    significant: boolean;
  }>;

  zTest(control: { successes: number; total: number }, treatment: { successes: number; total: number }, alpha?: number): Promise<{
    rate1: number;
    rate2: number;
    pValue: number;
    confidenceInterval: [number, number];
    significant: boolean;
  }>;

  // ANOVA for multiple groups
  anova(groups: number[][], alpha?: number): Promise<{
    fStatistic: number;
    pValue: number;
    significant: boolean;
    groupMeans: number[];
  }>;

  // Interaction effect detection (for factorial)
  interactionTest(data: {
    outcome: number[];
    factor1: string[];
    factor2: string[];
  }, alpha?: number): Promise<{
    pValue: number;
    significant: boolean;
    effectSize: number;
  }>;

  // Sample size calculation
  calculateSampleSize(params: {
    baselineRate: number;
    minimumDetectableEffect: number;
    alpha?: number;
    power?: number;
  }): Promise<number>;

  // Power analysis
  calculatePower(params: {
    sampleSize: number;
    baselineRate: number;
    effect: number;
    alpha?: number;
  }): Promise<number>;
}

/**
 * Assignment algorithm interface
 */
export interface IAssignmentAlgorithm {
  assign(unitId: string, experiment: Experiment, context?: Record<string, any>): string;
  assignFactorial(unitId: string, experiment: Experiment): Record<string, string>;
  assignSwitchback(experiment: Experiment, timestamp: Date): string;
  assignWithinSubjects(unitId: string, experiment: Experiment, sessionNumber: number): string;
  assignSteppedWedge(experiment: Experiment, clusterId: string, timestamp: Date): {
    variantKey: string;
    currentStep: number;
    stepStart: Date;
    stepEnd: Date;
    switchStep: number;
    inTreatment: boolean;
  };
}
