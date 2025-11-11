/**
 * Assignment and Exposure Data Models
 *
 * TypeScript types for tracking experiment assignments and exposure events.
 * Assignments occur when a unit is allocated to a variant, while exposures
 * occur when the unit actually encounters the experiment treatment.
 */

/**
 * Reason why a particular assignment was made
 */
export enum AssignmentReason {
  /** Standard random assignment */
  RANDOM = 'random',
  /** Forced assignment via override */
  OVERRIDE = 'override',
  /** Targeting rule matched */
  TARGETING = 'targeting',
  /** Previous assignment maintained (consistency) */
  STICKY = 'sticky',
  /** Temporal assignment (switchback experiment) */
  SWITCHBACK = 'switchback',
  /** Sequential assignment (within-subjects) */
  WITHIN_SUBJECTS = 'within_subjects',
  /** User ineligible for experiment */
  INELIGIBLE = 'ineligible',
  /** Experiment not running */
  NOT_RUNNING = 'not_running',
  /** Assigned via active experiment allocation */
  EXPERIMENT_ALLOCATION = 'experiment_allocation',
  /** Assigned via feature flag default rollout */
  FLAG_ROLLOUT = 'flag_rollout',
  /** Flag disabled, using default value */
  FLAG_DISABLED = 'flag_disabled',
  /** Default value (no rules matched) */
  DEFAULT = 'default',
  /** Flag not found */
  NOT_FOUND = 'not_found',
  /** Error during evaluation */
  ERROR = 'error',
}

/**
 * Status of an assignment
 */
export enum AssignmentStatus {
  /** Assignment is active */
  ACTIVE = 'active',
  /** Assignment has been overridden */
  OVERRIDDEN = 'overridden',
  /** Assignment expired (for time-limited assignments) */
  EXPIRED = 'expired',
  /** Assignment was revoked */
  REVOKED = 'revoked',
}

/**
 * Context provided during assignment
 */
export interface AssignmentContext {
  /** Session identifier */
  sessionId?: string;
  /** Device identifier */
  deviceId?: string;
  /** Platform (web, mobile, api, etc.) */
  platform?: string;
  /** Application version */
  appVersion?: string;
  /** Geographic location */
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  /** User agent string */
  userAgent?: string;
  /** IP address (hashed for privacy) */
  ipAddressHash?: string;
  /** Additional custom attributes */
  customAttributes: Record<string, unknown>;
}

/**
 * Assignment for factorial designs
 */
export interface FactorialAssignment {
  /** Map of factor name to level key */
  factorLevels: Record<string, string>;
  /** Combined variant key (e.g., "blue_buy_now") */
  combinedVariantKey: string;
}

/**
 * Assignment for within-subjects designs
 */
export interface WithinSubjectsAssignment {
  /** Current session number */
  sessionNumber: number;
  /** Variant for this session */
  variantKey: string;
  /** Ordered sequence of all variants */
  sequence: string[];
  /** Next scheduled session time */
  nextSessionAt?: Date;
}

/**
 * Assignment for switchback designs
 */
export interface SwitchbackAssignment {
  /** Current time period number */
  periodNumber: number;
  /** Variant for this period */
  variantKey: string;
  /** When current period started */
  periodStartTime: Date;
  /** When current period ends */
  periodEndTime: Date;
  /** Whether we're in a washout period */
  isWashout: boolean;
}

/**
 * Assignment for stepped wedge designs
 *
 * Tracks which cluster a unit belongs to and whether that cluster
 * is currently in control or treatment based on the current time step.
 */
export interface SteppedWedgeAssignment {
  /** Type identifier for stepped wedge assignment */
  type: 'stepped_wedge';
  /** Current step number in the design */
  currentStep: number;
  /** When the current step started */
  stepStart: Date;
  /** When the current step ends */
  stepEnd: Date;
  /** Cluster ID this unit belongs to */
  clusterId: string;
  /** Step number when this cluster switches from control to treatment */
  switchStep: number;
  /** Whether this cluster is currently receiving treatment (true if currentStep >= switchStep) */
  inTreatment: boolean;
}

/**
 * Union type for design-specific assignment data
 */
export type DesignSpecificAssignment =
  | { type: 'standard'; variantKey: string }
  | { type: 'factorial'; data: FactorialAssignment }
  | { type: 'within_subjects'; data: WithinSubjectsAssignment }
  | { type: 'switchback'; data: SwitchbackAssignment }
  | { type: 'stepped_wedge'; data: SteppedWedgeAssignment };

/**
 * Assignment event - when a unit is assigned to a variant
 */
export interface AssignmentEvent {
  /** Unique identifier for this assignment */
  id: string;
  /** Experiment identifier */
  experimentId: string;
  /** Experiment key */
  experimentKey: string;
  /** Unit identifier (user, session, device, etc.) */
  unitId: string;
  /** Type of unit */
  unitType: string;

  /** Assigned variant information */
  assignment: DesignSpecificAssignment;

  /** Why this assignment was made */
  reason: AssignmentReason;
  /** Current status */
  status: AssignmentStatus;

  /** When assignment was made */
  timestamp: Date;
  /** When assignment expires (null if permanent) */
  expiresAt: Date | null;

  /** Context at time of assignment */
  context: AssignmentContext;

  /** Hash used for assignment (for debugging) */
  assignmentHash?: string;
  /** Salt/seed used in hashing */
  hashSalt?: string;

  /** Whether this overwrote a previous assignment */
  overridePrevious: boolean;
  /** Previous assignment ID if overridden */
  previousAssignmentId?: string;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Request to get or create assignment
 */
export interface GetAssignmentRequest {
  /** Experiment key or ID */
  experimentKey: string;
  /** Unit identifier */
  unitId: string;
  /** Unit type */
  unitType?: string;
  /** Context for assignment */
  context?: Partial<AssignmentContext>;
  /** Whether to create if not exists */
  createIfNotExists?: boolean;
}

/**
 * Response from assignment request
 */
export interface GetAssignmentResponse {
  /** The assignment */
  assignment: AssignmentEvent | null;
  /** Whether this is a new assignment */
  isNew: boolean;
  /** Whether user is eligible for experiment */
  isEligible: boolean;
  /** Reason if not eligible */
  ineligibilityReason?: string;
}

/**
 * Request to override an assignment
 */
export interface OverrideAssignmentRequest {
  /** Experiment key */
  experimentKey: string;
  /** Unit identifier */
  unitId: string;
  /** Variant to assign */
  variantKey: string;
  /** Reason for override */
  reason: string;
  /** Who is making the override */
  overriddenBy: string;
  /** How long override lasts (null for permanent) */
  expiresAt?: Date | null;
}

/**
 * Batch assignment request
 */
export interface BatchAssignmentRequest {
  /** Experiment key */
  experimentKey: string;
  /** List of unit IDs */
  unitIds: string[];
  /** Shared context */
  context?: Partial<AssignmentContext>;
}

/**
 * Batch assignment response
 */
export interface BatchAssignmentResponse {
  /** Assignments keyed by unit ID */
  assignments: Record<string, AssignmentEvent>;
  /** Any errors that occurred */
  errors: Array<{
    unitId: string;
    error: string;
  }>;
}

/**
 * Exposure event - when a unit actually encounters the experiment
 */
export interface ExposureEvent {
  /** Unique identifier */
  id: string;
  /** Experiment identifier */
  experimentId: string;
  /** Experiment key */
  experimentKey: string;
  /** Unit identifier */
  unitId: string;
  /** Unit type */
  unitType: string;

  /** Variant that was exposed */
  variantKey: string;
  /** Assignment ID this exposure relates to */
  assignmentId: string;

  /** When exposure occurred */
  timestamp: Date;
  /** Where in code exposure occurred */
  exposurePoint: string;
  /** Which feature/component triggered exposure */
  featureName?: string;

  /** Context at time of exposure */
  context: ExposureContext;

  /** Duration of exposure (milliseconds) */
  durationMs?: number;
  /** Whether exposure was successful */
  successful: boolean;
  /** Error if exposure failed */
  error?: string;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Context for exposure events
 */
export interface ExposureContext {
  /** Session identifier */
  sessionId?: string;
  /** Page/screen where exposure occurred */
  page?: string;
  /** Section of page/screen */
  section?: string;
  /** Platform */
  platform?: string;
  /** Application version */
  appVersion?: string;
  /** Device type */
  deviceType?: string;
  /** Additional custom attributes */
  customAttributes: Record<string, unknown>;
}

/**
 * Request to log an exposure
 */
export interface LogExposureRequest {
  /** Experiment key */
  experimentKey: string;
  /** Unit identifier */
  unitId: string;
  /** Variant that was shown */
  variantKey: string;
  /** Where exposure occurred */
  exposurePoint: string;
  /** Context */
  context?: Partial<ExposureContext>;
  /** Feature name */
  featureName?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch exposure logging
 */
export interface BatchLogExposureRequest {
  /** List of exposures to log */
  exposures: LogExposureRequest[];
}

/**
 * Response from logging exposure
 */
export interface LogExposureResponse {
  /** Created exposure event */
  exposure: ExposureEvent;
  /** Whether this is the first exposure for this unit/variant */
  isFirstExposure: boolean;
}

/**
 * Exposure summary for an experiment
 */
export interface ExposureSummary {
  /** Experiment identifier */
  experimentId: string;
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
  /** Total exposures */
  totalExposures: number;
  /** Unique units exposed */
  uniqueUnitsExposed: number;
  /** Exposures per variant */
  byVariant: Record<string, {
    exposures: number;
    uniqueUnits: number;
  }>;
  /** Exposures by exposure point */
  byExposurePoint: Record<string, number>;
}

/**
 * Assignment consistency check result
 */
export interface AssignmentConsistencyCheck {
  /** Unit ID being checked */
  unitId: string;
  /** Experiment ID */
  experimentId: string;
  /** Whether assignment is consistent */
  isConsistent: boolean;
  /** Current assignment */
  currentAssignment: string;
  /** Historical assignments */
  assignmentHistory: Array<{
    timestamp: Date;
    variantKey: string;
    reason: AssignmentReason;
  }>;
  /** Any inconsistencies found */
  inconsistencies: Array<{
    timestamp: Date;
    expected: string;
    actual: string;
    reason: string;
  }>;
}

/**
 * Type guard to check if assignment is factorial
 */
export function isFactorialAssignment(
  assignment: DesignSpecificAssignment
): assignment is { type: 'factorial'; data: FactorialAssignment } {
  return assignment.type === 'factorial';
}

/**
 * Type guard to check if assignment is within-subjects
 */
export function isWithinSubjectsAssignment(
  assignment: DesignSpecificAssignment
): assignment is { type: 'within_subjects'; data: WithinSubjectsAssignment } {
  return assignment.type === 'within_subjects';
}

/**
 * Type guard to check if assignment is switchback
 */
export function isSwitchbackAssignment(
  assignment: DesignSpecificAssignment
): assignment is { type: 'switchback'; data: SwitchbackAssignment } {
  return assignment.type === 'switchback';
}

/**
 * Type guard to check if assignment is stepped wedge
 */
export function isSteppedWedgeAssignment(
  assignment: DesignSpecificAssignment
): assignment is { type: 'stepped_wedge'; data: SteppedWedgeAssignment } {
  return assignment.type === 'stepped_wedge';
}

/**
 * Helper to extract variant key from any assignment type
 */
export function getVariantKey(assignment: DesignSpecificAssignment): string {
  switch (assignment.type) {
    case 'standard':
      return assignment.variantKey;
    case 'factorial':
      return assignment.data.combinedVariantKey;
    case 'within_subjects':
      return assignment.data.variantKey;
    case 'switchback':
      return assignment.data.variantKey;
    case 'stepped_wedge':
      return assignment.data.inTreatment ? 'treatment' : 'control';
  }
}

/**
 * UNIFIED ASSIGNMENT RESULT
 *
 * This is the core type that bridges feature flags and experiments.
 * When a feature flag is evaluated, it may have an active experiment,
 * in which case the result includes full experiment context.
 */
export interface UnifiedAssignmentResult {
  /** Flag key that was evaluated */
  flagKey: string;
  /** Flag ID */
  flagId: string;
  /** Variant key assigned */
  variantKey: string;
  /** Variant ID */
  variantId: string;
  /** Actual value to return to the application */
  value: unknown;
  /** Reason for this assignment */
  reason: AssignmentReason;

  /** Experiment context (if assigned via experiment) */
  experiment?: {
    /** Experiment ID */
    id: string;
    /** Experiment key */
    key: string;
    /** Experiment name */
    name: string;
    /** Design type */
    designType: string;
    /** Role in experiment (control/treatment) */
    variantRole: string;
    /** Allocation percentage for this variant */
    allocationPercentage: number;
    /** Design-specific assignment data */
    designSpecific?: DesignSpecificAssignment;
  };

  /** Unique exposure ID for tracking */
  exposureId: string;
  /** Timestamp of assignment */
  timestamp: Date;

  /** Whether result came from cache */
  fromCache: boolean;
  /** ID of matched targeting rule (if any) */
  matchedRuleId?: string;

  /** Performance and debugging metadata */
  metadata: {
    /** Evaluation duration in milliseconds */
    evaluationTimeMs: number;
    /** Hash value used for bucketing */
    bucketHash?: number;
    /** Bucket value (0-99) used for allocation */
    bucketValue?: number;
    /** Cache key used (if cached) */
    cacheKey?: string;
  };
}

/**
 * Request for unified feature flag evaluation
 */
export interface UnifiedAssignmentRequest {
  /** Feature flag key to evaluate */
  flagKey: string;
  /** Unit ID (user, device, etc.) */
  unitId: string;
  /** Unit type */
  unitType?: string;
  /** Evaluation context */
  context?: AssignmentContext;
  /** Optional: Force a specific variant (for testing) */
  forceVariant?: string;
  /** Optional: Skip experiment assignment (use flag only) */
  skipExperiment?: boolean;
}

/**
 * Batch unified assignment request
 */
export interface BatchUnifiedAssignmentRequest {
  /** List of flag keys to evaluate */
  flagKeys: string[];
  /** Unit ID (shared across all flags) */
  unitId: string;
  /** Unit type */
  unitType?: string;
  /** Shared context */
  context?: AssignmentContext;
}

/**
 * Batch unified assignment response
 */
export interface BatchUnifiedAssignmentResponse {
  /** Results keyed by flag key */
  assignments: Record<string, UnifiedAssignmentResult>;
  /** Any errors that occurred */
  errors: Array<{
    flagKey: string;
    error: string;
    code: string;
  }>;
  /** Total evaluation time */
  totalTimeMs: number;
}
