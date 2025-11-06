/**
 * Core type definitions for the experimentation system
 */

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type DesignType = 'ab' | 'multivariate' | 'factorial' | 'within_subjects' | 'switchback';
export type RandomizationUnit = 'user' | 'session' | 'device' | 'other';

/**
 * Feature Flag Types
 */
export interface FeatureFlagVariant {
  key: string;
  value: any;
  weight: number; // 0-100
}

export interface TargetingRule {
  condition: string; // Expression to evaluate
  variant: string;
  priority?: number;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  defaultValue: any;
  variants: FeatureFlagVariant[];
  targetingRules: TargetingRule[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Experiment Types
 */
export interface ExperimentVariant {
  key: string;
  name: string;
  description: string;
  allocation: number; // 0-100
}

export interface FactorLevel {
  name: string;
  levels: string[];
}

export interface DesignConfig {
  type: DesignType;
  factors?: FactorLevel[];
  switchbackPeriodMinutes?: number;
  counterbalancingScheme?: string;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  designType: DesignType;
  hypotheses: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  guardrailMetrics: string[];
  randomizationUnit: RandomizationUnit;
  assignmentKey: string;
  variants: ExperimentVariant[];
  designConfig: DesignConfig;
  targetingRules?: string;
  trafficAllocation: number; // 0-100
  startDate?: Date;
  endDate?: Date;
  minSampleSize?: number;
  expectedEffect?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Assignment Types
 */
export interface Assignment {
  experimentId: string;
  unitId: string;
  variantKey: string;
  timestamp: Date;
  context?: Record<string, any>;
  factors?: Record<string, string>; // For factorial designs
}

export interface AssignmentResult {
  variantKey: string;
  factors?: Record<string, string>;
  assigned: boolean;
  reason?: string;
}

/**
 * Event Types
 */
export interface ExposureEvent {
  experimentId: string;
  unitId: string;
  variantKey: string;
  timestamp: Date;
  exposurePoint: string;
  context?: Record<string, any>;
}

export interface MetricEvent {
  eventName: string;
  unitId: string;
  timestamp: Date;
  value?: number;
  properties?: Record<string, any>;
  experimentIds?: string[];
}

export interface EventBatch {
  events: (ExposureEvent | MetricEvent)[];
}

/**
 * Analysis Types
 */
export interface StatisticalResult {
  metric: string;
  controlMean: number;
  treatmentMean: number;
  relativeChange: number;
  absoluteChange: number;
  pValue: number;
  confidenceInterval: [number, number];
  significant: boolean;
  sampleSizeControl: number;
  sampleSizeTreatment: number;
}

export interface MainEffect {
  factor: string;
  metric: string;
  control: string;
  treatment: string;
  controlMean: number;
  treatmentMean: number;
  relativeChange: number;
  pValue: number;
  confidenceInterval: [number, number];
  significant: boolean;
}

export interface InteractionEffect {
  factors: string[];
  pValue: number;
  significant: boolean;
  effectSize?: number;
}

export interface AnalysisResult {
  experimentId: string;
  status: ExperimentStatus;
  sampleSize: number;
  startDate: Date;
  endDate?: Date;
  results?: StatisticalResult[];
  mainEffects?: MainEffect[];
  interactions?: InteractionEffect[];
  guardrailResults?: StatisticalResult[];
  recommendation?: string;
  warnings?: string[];
}

/**
 * Context for feature flag and experiment evaluation
 */
export interface EvaluationContext {
  unitId: string;
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  platform?: string;
  version?: string;
  attributes?: Record<string, any>;
  timestamp?: Date;
}
