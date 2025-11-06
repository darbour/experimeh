/**
 * Experiment Data Models
 *
 * Comprehensive TypeScript types for defining and managing experiments
 * across multiple experimental designs including A/B, multivariate, factorial,
 * within-subjects, and switchback experiments.
 */

/**
 * Status of an experiment throughout its lifecycle
 */
export enum ExperimentStatus {
  /** Experiment is being configured and not yet launched */
  DRAFT = 'draft',
  /** Experiment is actively running and collecting data */
  RUNNING = 'running',
  /** Experiment is temporarily paused but not completed */
  PAUSED = 'paused',
  /** Experiment has finished and no longer assigns users */
  COMPLETED = 'completed',
  /** Experiment was stopped early due to issues */
  STOPPED = 'stopped',
}

/**
 * Type of experimental design methodology
 */
export enum ExperimentDesignType {
  /** Simple A/B test with two variants */
  AB = 'ab',
  /** Multiple variants of a single factor (A/B/C/D test) */
  MULTIVARIATE = 'multivariate',
  /** Multiple factors tested simultaneously to detect interactions */
  FACTORIAL = 'factorial',
  /** Same units experience multiple treatments over time */
  WITHIN_SUBJECTS = 'within_subjects',
  /** Temporal switching between treatments to mitigate interference */
  SWITCHBACK = 'switchback',
}

/**
 * Unit used for randomization and assignment
 */
export enum RandomizationUnit {
  /** Individual user (most common) */
  USER = 'user',
  /** Session-based randomization */
  SESSION = 'session',
  /** Device-based randomization */
  DEVICE = 'device',
  /** Account or organization level */
  ACCOUNT = 'account',
  /** Time period (for switchback experiments) */
  TIME_PERIOD = 'time_period',
  /** Custom randomization unit */
  CUSTOM = 'custom',
}

/**
 * Counterbalancing scheme for within-subjects designs
 */
export enum CounterbalancingScheme {
  /** Latin square design for balanced ordering */
  LATIN_SQUARE = 'latin_square',
  /** Complete randomization of order */
  RANDOMIZED = 'randomized',
  /** Fixed sequence for all participants */
  FIXED = 'fixed',
  /** Balanced Latin square (each condition follows every other condition once) */
  BALANCED_LATIN_SQUARE = 'balanced_latin_square',
}

/**
 * A single factor in a factorial design
 */
export interface Factor {
  /** Unique identifier for the factor */
  id: string;
  /** Human-readable name (e.g., "button_color") */
  name: string;
  /** Description of what this factor tests */
  description: string;
  /** Different levels/values this factor can take */
  levels: FactorLevel[];
}

/**
 * A specific level within a factor
 */
export interface FactorLevel {
  /** Unique key for this level (e.g., "blue", "green") */
  key: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Configuration value for this level */
  value: unknown;
}

/**
 * A variant (treatment) in an experiment
 */
export interface Variant {
  /** Unique identifier */
  id: string;
  /** Machine-readable key (used in code) */
  key: string;
  /** Human-readable name */
  name: string;
  /** Description of this variant */
  description: string;
  /** Traffic allocation percentage (0-100) */
  allocation: number;
  /** Whether this is the control/baseline variant */
  isControl: boolean;
  /** Configuration payload for this variant */
  config?: Record<string, unknown>;
  /** For factorial designs: factor assignments */
  factorAssignments?: Record<string, string>;
}

/**
 * Configuration specific to factorial designs
 */
export interface FactorialDesignConfig {
  /** List of factors being tested */
  factors: Factor[];
  /** Whether to test all possible combinations (full factorial) */
  fullFactorial: boolean;
  /** If not full factorial, specific combinations to test */
  includedCombinations?: string[][];
}

/**
 * Configuration specific to within-subjects designs
 */
export interface WithinSubjectsDesignConfig {
  /** Counterbalancing strategy to use */
  counterbalancingScheme: CounterbalancingScheme;
  /** Number of sessions/exposures per participant */
  sessionsPerParticipant: number;
  /** Minimum time between sessions (in minutes) */
  minTimeBetweenSessions?: number;
  /** Whether to allow participants to skip sessions */
  allowSkippedSessions: boolean;
  /** Custom ordering logic (if using fixed scheme) */
  customOrdering?: string[][];
}

/**
 * Configuration specific to switchback designs
 */
export interface SwitchbackDesignConfig {
  /** Length of each period in minutes */
  periodLengthMinutes: number;
  /** Whether period assignment is randomized */
  randomizePeriods: boolean;
  /** Optional washout period between switches (minutes) */
  washoutPeriodMinutes?: number;
  /** Minimum number of periods required */
  minPeriods: number;
  /** Time zone for period calculations */
  timeZone: string;
}

/**
 * Configuration specific to multivariate designs
 */
export interface MultivariateDesignConfig {
  /** Whether to auto-balance traffic across variants */
  autoBalance: boolean;
  /** Maximum number of variants allowed */
  maxVariants: number;
}

/**
 * Union type for all design-specific configurations
 */
export type DesignConfig =
  | { type: ExperimentDesignType.AB }
  | { type: ExperimentDesignType.MULTIVARIATE; config: MultivariateDesignConfig }
  | { type: ExperimentDesignType.FACTORIAL; config: FactorialDesignConfig }
  | { type: ExperimentDesignType.WITHIN_SUBJECTS; config: WithinSubjectsDesignConfig }
  | { type: ExperimentDesignType.SWITCHBACK; config: SwitchbackDesignConfig };

/**
 * Targeting rule for experiment enrollment
 */
export interface TargetingRule {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Rule condition expression (evaluated against context) */
  condition: string;
  /** Whether this rule includes or excludes matching users */
  type: 'include' | 'exclude';
  /** Priority order (lower numbers evaluated first) */
  priority: number;
}

/**
 * Sample size and power calculation parameters
 */
export interface PowerAnalysis {
  /** Expected effect size (as percentage change) */
  expectedEffect: number;
  /** Baseline conversion rate or mean */
  baselineValue: number;
  /** Statistical significance level (typically 0.05) */
  alpha: number;
  /** Desired statistical power (typically 0.8) */
  power: number;
  /** Calculated required sample size per variant */
  requiredSampleSize: number;
  /** Expected runtime in days */
  expectedRuntimeDays: number;
  /** Calculated at timestamp */
  calculatedAt: Date;
}

/**
 * Metadata about who created/modified the experiment
 */
export interface AuditMetadata {
  /** User ID who created the experiment */
  createdBy: string;
  /** Timestamp of creation */
  createdAt: Date;
  /** User ID who last updated */
  updatedBy: string;
  /** Timestamp of last update */
  updatedAt: Date;
  /** Version number for optimistic locking */
  version: number;
}

/**
 * Complete experiment definition
 */
export interface Experiment {
  /** Unique identifier */
  id: string;
  /** Machine-readable key (used in code) */
  key: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the experiment */
  description: string;

  /** Current status */
  status: ExperimentStatus;
  /** Type of experimental design */
  designType: ExperimentDesignType;

  /** Hypothesis being tested */
  hypothesis: string;
  /** Primary metric key */
  primaryMetric: string;
  /** Secondary metric keys */
  secondaryMetrics: string[];
  /** Guardrail metric keys (should not degrade) */
  guardrailMetrics: string[];

  /** Unit used for randomization */
  randomizationUnit: RandomizationUnit;
  /** Field name to use for hashing (e.g., "userId", "deviceId") */
  assignmentKey: string;

  /** List of variants/treatments */
  variants: Variant[];
  /** Design-specific configuration */
  designConfig: DesignConfig;

  /** Targeting rules for enrollment */
  targetingRules: TargetingRule[];
  /** Overall traffic allocation (0-100) */
  trafficAllocation: number;

  /** Experiment start date */
  startDate: Date;
  /** Experiment end date (null if running indefinitely) */
  endDate: Date | null;

  /** Power analysis and sample size calculations */
  powerAnalysis?: PowerAnalysis;
  /** Minimum sample size before making decisions */
  minSampleSize: number;

  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Audit trail */
  audit: AuditMetadata;

  /** Tags for categorization */
  tags: string[];
  /** Team or organization owning this experiment */
  owner: string;
}

/**
 * Request to create a new experiment
 */
export interface CreateExperimentRequest {
  key: string;
  name: string;
  description: string;
  designType: ExperimentDesignType;
  hypothesis: string;
  primaryMetric: string;
  secondaryMetrics?: string[];
  guardrailMetrics?: string[];
  randomizationUnit: RandomizationUnit;
  assignmentKey: string;
  variants: Omit<Variant, 'id'>[];
  designConfig: DesignConfig;
  targetingRules?: Omit<TargetingRule, 'id'>[];
  trafficAllocation: number;
  startDate?: Date;
  endDate?: Date;
  minSampleSize?: number;
  powerAnalysis?: Omit<PowerAnalysis, 'calculatedAt' | 'requiredSampleSize' | 'expectedRuntimeDays'>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  owner: string;
}

/**
 * Request to update an existing experiment
 */
export interface UpdateExperimentRequest {
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  hypothesis?: string;
  secondaryMetrics?: string[];
  guardrailMetrics?: string[];
  targetingRules?: TargetingRule[];
  trafficAllocation?: number;
  endDate?: Date | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Validation result for experiment configuration
 */
export interface ExperimentValidation {
  /** Whether the configuration is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
  /** List of warnings (non-blocking issues) */
  warnings: ValidationWarning[];
}

/**
 * A validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Field path where error occurred */
  field: string;
  /** Severity level */
  severity: 'error';
}

/**
 * A validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Field path where warning occurred */
  field: string;
  /** Severity level */
  severity: 'warning';
}

/**
 * Experiment summary for list views
 */
export interface ExperimentSummary {
  id: string;
  key: string;
  name: string;
  status: ExperimentStatus;
  designType: ExperimentDesignType;
  startDate: Date;
  endDate: Date | null;
  variantCount: number;
  trafficAllocation: number;
  primaryMetric: string;
  owner: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type guard to check if a design config is factorial
 */
export function isFactorialDesign(config: DesignConfig): config is { type: ExperimentDesignType.FACTORIAL; config: FactorialDesignConfig } {
  return config.type === ExperimentDesignType.FACTORIAL;
}

/**
 * Type guard to check if a design config is within-subjects
 */
export function isWithinSubjectsDesign(config: DesignConfig): config is { type: ExperimentDesignType.WITHIN_SUBJECTS; config: WithinSubjectsDesignConfig } {
  return config.type === ExperimentDesignType.WITHIN_SUBJECTS;
}

/**
 * Type guard to check if a design config is switchback
 */
export function isSwitchbackDesign(config: DesignConfig): config is { type: ExperimentDesignType.SWITCHBACK; config: SwitchbackDesignConfig } {
  return config.type === ExperimentDesignType.SWITCHBACK;
}

/**
 * Type guard to check if a design config is multivariate
 */
export function isMultivariateDesign(config: DesignConfig): config is { type: ExperimentDesignType.MULTIVARIATE; config: MultivariateDesignConfig } {
  return config.type === ExperimentDesignType.MULTIVARIATE;
}
