/**
 * Feature Flag Data Models
 *
 * TypeScript types for feature flag management, variants, and targeting rules.
 * Feature flags can be used independently or linked to experiments.
 */

/**
 * Status of a feature flag
 */
export enum FeatureFlagStatus {
  /** Flag is active and evaluating */
  ENABLED = 'enabled',
  /** Flag is disabled and returns default value */
  DISABLED = 'disabled',
  /** Flag is archived (not deleted but no longer in use) */
  ARCHIVED = 'archived',
}

/**
 * Type of value a feature flag can return
 */
export enum FeatureFlagValueType {
  /** Boolean true/false */
  BOOLEAN = 'boolean',
  /** String value */
  STRING = 'string',
  /** Numeric value */
  NUMBER = 'number',
  /** JSON object */
  JSON = 'json',
}

/**
 * Operator for rule conditions
 */
export enum ConditionOperator {
  /** Equals */
  EQUALS = 'equals',
  /** Not equals */
  NOT_EQUALS = 'not_equals',
  /** Greater than */
  GREATER_THAN = 'greater_than',
  /** Greater than or equal */
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  /** Less than */
  LESS_THAN = 'less_than',
  /** Less than or equal */
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  /** Contains (for arrays/strings) */
  CONTAINS = 'contains',
  /** Does not contain */
  NOT_CONTAINS = 'not_contains',
  /** In list */
  IN = 'in',
  /** Not in list */
  NOT_IN = 'not_in',
  /** Matches regex */
  MATCHES = 'matches',
  /** Semantic version comparison */
  VERSION_GREATER_THAN = 'version_greater_than',
  /** Semantic version comparison */
  VERSION_LESS_THAN = 'version_less_than',
  /** Is defined/exists */
  EXISTS = 'exists',
  /** Is not defined */
  NOT_EXISTS = 'not_exists',
}

/**
 * A single condition in a targeting rule
 */
export interface Condition {
  /** Field/attribute to evaluate (e.g., "country", "userTier") */
  attribute: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value: unknown;
}

/**
 * Group of conditions combined with AND/OR logic
 */
export interface ConditionGroup {
  /** How to combine conditions in this group */
  operator: 'AND' | 'OR';
  /** List of conditions */
  conditions: Condition[];
  /** Nested condition groups for complex logic */
  groups?: ConditionGroup[];
}

/**
 * A variant of a feature flag
 */
export interface FeatureFlagVariant {
  /** Unique identifier */
  id: string;
  /** Machine-readable key */
  key: string;
  /** Display name */
  name: string;
  /** Description of this variant */
  description: string;
  /** The actual value to return */
  value: unknown;
  /** Traffic weight (0-100) for percentage rollout */
  weight: number;
}

/**
 * A targeting rule that determines which variant to serve
 */
export interface TargetingRule {
  /** Unique identifier */
  id: string;
  /** Description of what this rule does */
  description: string;
  /** Condition(s) that must be met */
  conditions: ConditionGroup;
  /** Variant to serve if conditions match */
  variantId: string;
  /** Priority (lower numbers evaluated first) */
  priority: number;
  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * Percentage rollout configuration
 */
export interface RolloutConfig {
  /** Whether rollout is enabled */
  enabled: boolean;
  /** Percentage of traffic to receive non-default variant (0-100) */
  percentage: number;
  /** Variant to serve for rollout traffic */
  variantId: string;
  /** Field to use for consistent bucketing (e.g., "userId") */
  bucketBy: string;
}

/**
 * Schedule for automatic flag changes
 */
export interface Schedule {
  /** Unique identifier */
  id: string;
  /** When to execute this schedule */
  executeAt: Date;
  /** Action to perform */
  action: 'enable' | 'disable' | 'change_rollout' | 'change_variant';
  /** Configuration for the action */
  config: Record<string, unknown>;
  /** Whether schedule has been executed */
  executed: boolean;
  /** When it was executed (if executed) */
  executedAt?: Date;
}

/**
 * Metadata about flag usage
 */
export interface FlagUsageMetadata {
  /** Number of evaluations in last 24 hours */
  evaluationsLast24h: number;
  /** Number of unique users in last 24 hours */
  uniqueUsersLast24h: number;
  /** Last time flag was evaluated */
  lastEvaluatedAt: Date | null;
  /** Environments where flag is actively used */
  activeEnvironments: string[];
}

/**
 * Audit metadata for feature flags
 */
export interface FlagAuditMetadata {
  /** Who created the flag */
  createdBy: string;
  /** When created */
  createdAt: Date;
  /** Who last modified */
  updatedBy: string;
  /** When last modified */
  updatedAt: Date;
  /** Version for optimistic locking */
  version: number;
  /** History of changes */
  changeLog: FlagChangeLogEntry[];
}

/**
 * Entry in flag change log
 */
export interface FlagChangeLogEntry {
  /** Timestamp of change */
  timestamp: Date;
  /** Who made the change */
  userId: string;
  /** What changed */
  action: string;
  /** Old value (if applicable) */
  oldValue?: unknown;
  /** New value (if applicable) */
  newValue?: unknown;
  /** Optional reason/comment */
  reason?: string;
}

/**
 * Complete feature flag definition
 */
export interface FeatureFlag {
  /** Unique identifier */
  id: string;
  /** Machine-readable key (used in code) */
  key: string;
  /** Human-readable name */
  name: string;
  /** Description of the flag's purpose */
  description: string;

  /** Current status */
  status: FeatureFlagStatus;
  /** Type of value this flag returns */
  valueType: FeatureFlagValueType;
  /** Default value when flag is disabled or no rules match */
  defaultValue: unknown;

  /** Available variants */
  variants: FeatureFlagVariant[];
  /** Targeting rules (evaluated in priority order) */
  targetingRules: TargetingRule[];
  /** Percentage rollout configuration */
  rollout: RolloutConfig;

  /** Associated experiment ID (if flag is linked to experiment) */
  experimentId?: string;
  /** Environment (production, staging, development) */
  environment: string;

  /** Scheduled changes */
  schedules: Schedule[];
  /** Tags for organization */
  tags: string[];
  /** Team/owner */
  owner: string;

  /** Usage statistics */
  usage: FlagUsageMetadata;
  /** Audit trail */
  audit: FlagAuditMetadata;

  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Request to create a new feature flag
 */
export interface CreateFeatureFlagRequest {
  key: string;
  name: string;
  description: string;
  valueType: FeatureFlagValueType;
  defaultValue: unknown;
  variants: Omit<FeatureFlagVariant, 'id'>[];
  targetingRules?: Omit<TargetingRule, 'id'>[];
  rollout?: Omit<RolloutConfig, 'enabled'> & { enabled?: boolean };
  experimentId?: string;
  environment: string;
  tags?: string[];
  owner: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update a feature flag
 */
export interface UpdateFeatureFlagRequest {
  name?: string;
  description?: string;
  status?: FeatureFlagStatus;
  defaultValue?: unknown;
  variants?: FeatureFlagVariant[];
  targetingRules?: TargetingRule[];
  rollout?: RolloutConfig;
  schedules?: Schedule[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Optional reason for the change */
  changeReason?: string;
}

/**
 * Context for evaluating a feature flag
 */
export interface EvaluationContext {
  /** User/entity identifier */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Device identifier */
  deviceId?: string;
  /** Custom attributes for targeting */
  attributes: Record<string, unknown>;
  /** Request metadata */
  metadata?: {
    /** IP address */
    ipAddress?: string;
    /** User agent */
    userAgent?: string;
    /** Timestamp of evaluation */
    timestamp: Date;
  };
}

/**
 * Result of evaluating a feature flag
 */
export interface EvaluationResult {
  /** The flag that was evaluated */
  flagKey: string;
  /** The value to use */
  value: unknown;
  /** Which variant was selected */
  variantKey: string;
  /** Reason for this result */
  reason: EvaluationReason;
  /** Whether this came from cache */
  fromCache: boolean;
  /** Rule that matched (if any) */
  matchedRuleId?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Reason why a particular value was returned
 */
export enum EvaluationReason {
  /** Flag is disabled, returning default value */
  DISABLED = 'disabled',
  /** Matched a targeting rule */
  RULE_MATCH = 'rule_match',
  /** Matched rollout percentage */
  ROLLOUT = 'rollout',
  /** No rules matched, using default */
  DEFAULT = 'default',
  /** Flag not found, using fallback */
  NOT_FOUND = 'not_found',
  /** Error during evaluation */
  ERROR = 'error',
}

/**
 * Batch evaluation request
 */
export interface BatchEvaluationRequest {
  /** Context for evaluation */
  context: EvaluationContext;
  /** Flag keys to evaluate */
  flagKeys: string[];
}

/**
 * Batch evaluation response
 */
export interface BatchEvaluationResponse {
  /** Results keyed by flag key */
  results: Record<string, EvaluationResult>;
  /** Any errors that occurred */
  errors: Array<{
    flagKey: string;
    error: string;
  }>;
}

/**
 * Feature flag summary for list views
 */
export interface FeatureFlagSummary {
  id: string;
  key: string;
  name: string;
  status: FeatureFlagStatus;
  valueType: FeatureFlagValueType;
  environment: string;
  experimentId?: string;
  variantCount: number;
  ruleCount: number;
  rolloutPercentage: number;
  evaluationsLast24h: number;
  owner: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation result for feature flag configuration
 */
export interface FeatureFlagValidation {
  /** Whether configuration is valid */
  isValid: boolean;
  /** Validation errors */
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** Warnings */
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Type guard to check if a value is a valid feature flag value type
 */
export function isValidValueType(value: unknown, type: FeatureFlagValueType): boolean {
  switch (type) {
    case FeatureFlagValueType.BOOLEAN:
      return typeof value === 'boolean';
    case FeatureFlagValueType.STRING:
      return typeof value === 'string';
    case FeatureFlagValueType.NUMBER:
      return typeof value === 'number';
    case FeatureFlagValueType.JSON:
      return typeof value === 'object';
    default:
      return false;
  }
}

/**
 * Helper to check if evaluation result indicates an error
 */
export function isErrorResult(result: EvaluationResult): boolean {
  return result.reason === EvaluationReason.ERROR || result.reason === EvaluationReason.NOT_FOUND;
}
