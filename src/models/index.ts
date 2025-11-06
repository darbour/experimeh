/**
 * Experimentation System Data Models
 *
 * Comprehensive TypeScript types for the feature flag based experimentation system.
 * This module exports all data models for experiments, feature flags, assignments,
 * metrics, and analysis results.
 *
 * @module models
 */

// ==============================================================================
// Experiment Models
// ==============================================================================

export {
  // Enums
  ExperimentStatus,
  ExperimentDesignType,
  RandomizationUnit,
  CounterbalancingScheme,

  // Interfaces
  Factor,
  FactorLevel,
  Variant,
  FactorialDesignConfig,
  WithinSubjectsDesignConfig,
  SwitchbackDesignConfig,
  SteppedWedgeDesignConfig,
  SteppedWedgeSchedule,
  MultivariateDesignConfig,
  DesignConfig,
  TargetingRule,
  PowerAnalysis,
  AuditMetadata,
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  ExperimentValidation,
  ValidationError,
  ValidationWarning,
  ExperimentSummary,

  // Type Guards
  isFactorialDesign,
  isWithinSubjectsDesign,
  isSwitchbackDesign,
  isSteppedWedgeDesign,
  isMultivariateDesign,
} from './experiment';

// ==============================================================================
// Feature Flag Models
// ==============================================================================

export {
  // Enums
  FeatureFlagStatus,
  FeatureFlagValueType,
  ConditionOperator,
  EvaluationReason,

  // Interfaces
  Condition,
  ConditionGroup,
  FeatureFlagVariant,
  TargetingRule as FlagTargetingRule,
  RolloutConfig,
  Schedule,
  FlagUsageMetadata,
  FlagAuditMetadata,
  FlagChangeLogEntry,
  FeatureFlag,
  CreateFeatureFlagRequest,
  UpdateFeatureFlagRequest,
  EvaluationContext,
  EvaluationResult,
  BatchEvaluationRequest,
  BatchEvaluationResponse,
  FeatureFlagSummary,
  FeatureFlagValidation,

  // Type Guards and Helpers
  isValidValueType,
  isErrorResult,
} from './feature-flag';

// ==============================================================================
// Assignment Models
// ==============================================================================

export {
  // Enums
  AssignmentReason,
  AssignmentStatus,

  // Interfaces
  AssignmentContext,
  FactorialAssignment,
  WithinSubjectsAssignment,
  SwitchbackAssignment,
  SteppedWedgeAssignment,
  DesignSpecificAssignment,
  AssignmentEvent,
  GetAssignmentRequest,
  GetAssignmentResponse,
  OverrideAssignmentRequest,
  BatchAssignmentRequest,
  BatchAssignmentResponse,
  ExposureEvent,
  ExposureContext,
  LogExposureRequest,
  BatchLogExposureRequest,
  LogExposureResponse,
  ExposureSummary,
  AssignmentConsistencyCheck,

  // Type Guards and Helpers
  isFactorialAssignment,
  isWithinSubjectsAssignment,
  isSwitchbackAssignment,
  isSteppedWedgeAssignment,
  getVariantKey,
} from './assignment';

// ==============================================================================
// Metric Models
// ==============================================================================

export {
  // Enums
  MetricType,
  MetricAggregation,
  MetricTimeWindow,

  // Interfaces
  MetricEvent,
  LogMetricRequest,
  BatchLogMetricRequest,
  LogMetricResponse,
  MetricDefinition,
  CreateMetricDefinitionRequest,
  ComputedMetricValue,
  MetricStatistics,
  MetricComparison,
  MetricTimeSeries,
  MetricTrend,
  MetricSnapshot,
  MetricAlert,
  TriggeredAlert,
  MetricValidation,

  // Type Guards and Helpers
  isGuardrailMetric,
  formatMetricValue,
  isContinuousMetric,
  isBinaryMetric,
  isCategoricalMetric,
} from './metric';

// ==============================================================================
// Analysis Models
// ==============================================================================

export {
  // Enums
  StatisticalTest,
  AnalysisStatus,
  SignificanceLevel,
  AnalysisRecommendation,

  // Interfaces
  ConfidenceInterval,
  VariantStatistics,
  VariantComparison,
  BayesianResult,
  PowerAnalysisResult,
  SequentialTestResult,
  MetricResult,
  MainEffect,
  InteractionEffect,
  FactorialAnalysisResult,
  WithinSubjectsAnalysisResult,
  SwitchbackAnalysisResult,
  EffectEstimate,
  ClusterEffect,
  SteppedWedgeAnalysisResult,
  MultipleTestingCorrection,
  SampleRatioMismatch,
  DataQualityCheck,
  ExperimentAnalysisResult,
  RunAnalysisRequest,
  ScheduledAnalysis,
  AnalysisComparison,
  SubgroupAnalysis,
  HeterogeneousTreatmentEffects,
  AnalysisSummary,

  // Type Guards and Helpers
  isFactorialAnalysis,
  isWithinSubjectsAnalysis,
  isSwitchbackAnalysis,
  isSteppedWedgeAnalysis,
  isStatisticallySignificant,
  getSignificanceLevel,
  calculateRelativeDifference,
} from './analysis';

// ==============================================================================
// Common Types
// ==============================================================================

/**
 * Generic error response
 */
export interface ErrorResponse {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Stack trace (only in development) */
  stack?: string;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  /** Items in current page */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrevious: boolean;
}

/**
 * Request parameters for pagination
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Request parameters for filtering
 */
export interface FilterParams {
  /** Filter expression */
  filter?: string;
  /** Field filters */
  fields?: Record<string, unknown>;
  /** Search query */
  search?: string;
  /** Tags to filter by */
  tags?: string[];
}

/**
 * Request parameters for date range
 */
export interface DateRangeParams {
  /** Start date */
  startDate?: Date | string;
  /** End date */
  endDate?: Date | string;
}

/**
 * Generic success response
 */
export interface SuccessResponse<T = unknown> {
  /** Success indicator */
  success: true;
  /** Response data */
  data: T;
  /** Optional message */
  message?: string;
  /** Request metadata */
  metadata?: {
    requestId?: string;
    timestamp: Date;
    duration?: number;
  };
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T = unknown> {
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** Total operations attempted */
  total: number;
  /** Individual results */
  results: Array<{
    index: number;
    success: boolean;
    data?: T;
    error?: string;
  }>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp */
  timestamp: Date;
  /** Service version */
  version: string;
  /** Component health */
  components: Record<string, {
    status: 'up' | 'down' | 'degraded';
    latency?: number;
    message?: string;
  }>;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Unique identifier */
  id: string;
  /** Entity type (experiment, flag, etc.) */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Action performed */
  action: string;
  /** Who performed the action */
  performedBy: string;
  /** When action was performed */
  performedAt: Date;
  /** Changes made */
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  /** Additional context */
  context?: Record<string, unknown>;
}

// ==============================================================================
// Type Utilities
// ==============================================================================

/**
 * Make all properties in T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specified properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract keys from T that are of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Ensure all enum values are covered in a switch statement
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

/**
 * Type guard for checking if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Type guard for checking if value is a valid date
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

// ==============================================================================
// Constants
// ==============================================================================

/**
 * Default pagination settings
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Default confidence level for statistical tests
 */
export const DEFAULT_CONFIDENCE_LEVEL = 0.95;

/**
 * Default alpha level for significance testing
 */
export const DEFAULT_ALPHA = 0.05;

/**
 * Default statistical power for sample size calculations
 */
export const DEFAULT_POWER = 0.8;

/**
 * Maximum number of variants recommended for a single experiment
 */
export const MAX_RECOMMENDED_VARIANTS = 10;

/**
 * Minimum sample size per variant for reliable analysis
 */
export const MIN_SAMPLE_SIZE_PER_VARIANT = 100;

/**
 * Minimum experiment duration in days
 */
export const MIN_EXPERIMENT_DURATION_DAYS = 7;
