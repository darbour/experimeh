/**
 * Assignment Algorithms for Experiment Types
 *
 * This module implements deterministic assignment algorithms for various
 * experimental designs:
 * - Simple A/B Tests: Between-subjects randomization
 * - Factorial Designs: Independent multi-factor assignment
 * - Switchback Experiments: Time-based temporal switching
 * - Within-Subjects: Counterbalanced repeated measures
 *
 * All algorithms use deterministic hashing for:
 * - Consistency: Same input always yields same assignment
 * - Performance: O(1) assignment complexity
 * - Uniformity: Even distribution across variants
 *
 * References:
 * - "Trustworthy Online Controlled Experiments" - Kohavi et al.
 * - "Design and Analysis of Switchback Experiments" - Bojinov & Simchi-Levi
 * - "Counterbalancing in Repeated Measures Designs" - Bradley
 */

import {
  hashExperiment,
  hashExperimentFloat,
  hashFactorialFactor,
  hashSwitchbackPeriod,
  hashWithinSubjects,
  hashToRange,
} from './hash';

/**
 * Type definitions for assignment
 */

export interface Variant {
  key: string;
  name: string;
  allocation: number; // Percentage 0-100
  description?: string;
}

export interface Factor {
  name: string;
  levels: string[]; // Different values/variants for this factor
  description?: string;
}

export interface ExperimentConfig {
  id: string;
  key: string;
  variants: Variant[];
  trafficAllocation: number; // Percentage 0-100 of total traffic
  designType: 'ab' | 'multivariate' | 'factorial' | 'within_subjects' | 'switchback';
  designConfig?: FactorialConfig | WithinSubjectsConfig | SwitchbackConfig;
  randomizationUnit: 'user' | 'session' | 'device' | 'other';
  startDate: Date;
  endDate?: Date;
}

export interface FactorialConfig {
  factors: Factor[];
}

export interface WithinSubjectsConfig {
  counterbalancingScheme: 'latin_square' | 'random' | 'sequential';
  sessionKey?: string; // Key to determine which session/period user is in
}

export interface SwitchbackConfig {
  periodMinutes: number; // Length of each period
  washoutMinutes?: number; // Optional cooldown between switches
}

export interface AssignmentResult {
  variantKey: string;
  inExperiment: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

export interface FactorialAssignmentResult extends AssignmentResult {
  factorAssignments: Record<string, string>; // Factor name -> level
}

export interface WithinSubjectsAssignmentResult extends AssignmentResult {
  sessionNumber: number;
  orderSequence: string[]; // Complete order for debugging
}

export interface SwitchbackAssignmentResult extends AssignmentResult {
  periodNumber: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Traffic Allocation Check
 * Determines if a unit should be included in the experiment based on traffic allocation
 *
 * Time Complexity: O(1)
 * Statistical Property: Uniform random sampling
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier
 * @param trafficAllocation - Percentage of traffic to include (0-100)
 * @returns true if unit is in experiment traffic
 */
export function isInExperimentTraffic(
  experimentId: string,
  unitId: string,
  trafficAllocation: number
): boolean {
  if (trafficAllocation >= 100) return true;
  if (trafficAllocation <= 0) return false;

  const hashValue = hashExperimentFloat(experimentId, unitId, 'traffic');
  return hashValue < trafficAllocation / 100;
}

/**
 * Simple A/B or Multivariate Assignment
 * Deterministically assigns users to variants based on weighted allocation
 *
 * Algorithm:
 * 1. Hash the experimentId + unitId to get consistent value
 * 2. Normalize hash to [0, 1) range
 * 3. Map to variant based on cumulative allocation percentages
 *
 * Time Complexity: O(n) where n = number of variants (typically small)
 * Space Complexity: O(1)
 *
 * Statistical Properties:
 * - Uniform distribution if allocations are equal
 * - Weighted sampling if allocations differ
 * - Independence between experiments (different hashes)
 *
 * @param experiment - Experiment configuration
 * @param unitId - Unit identifier for assignment
 * @returns Assignment result with variant key
 *
 * @example
 * ```typescript
 * const experiment = {
 *   id: 'exp-123',
 *   variants: [
 *     { key: 'control', allocation: 50 },
 *     { key: 'treatment', allocation: 50 }
 *   ],
 *   trafficAllocation: 100
 * };
 * const result = assignSimpleAB(experiment, 'user-456');
 * // result.variantKey will be 'control' or 'treatment'
 * ```
 */
export function assignSimpleAB(
  experiment: ExperimentConfig,
  unitId: string
): AssignmentResult {
  // Check traffic allocation
  if (!isInExperimentTraffic(experiment.id, unitId, experiment.trafficAllocation)) {
    return {
      variantKey: 'excluded',
      inExperiment: false,
      reason: 'excluded_by_traffic_allocation',
    };
  }

  // Validate variants have allocations
  const totalAllocation = experiment.variants.reduce((sum, v) => sum + v.allocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.01) {
    throw new Error(`Variant allocations must sum to 100, got ${totalAllocation}`);
  }

  // Get hash value in [0, 1) range
  const hashValue = hashExperimentFloat(experiment.id, unitId);
  const percentage = hashValue * 100;

  // Find variant based on cumulative allocation
  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.allocation;
    if (percentage < cumulative) {
      return {
        variantKey: variant.key,
        inExperiment: true,
        reason: 'assigned_by_hash',
        metadata: {
          hashValue,
          percentage,
          allocation: variant.allocation,
        },
      };
    }
  }

  // Fallback to last variant (handles floating point edge cases)
  const lastVariant = experiment.variants[experiment.variants.length - 1];
  return {
    variantKey: lastVariant.key,
    inExperiment: true,
    reason: 'assigned_by_hash_fallback',
  };
}

/**
 * Factorial Design Assignment
 * Independently assigns each factor using separate hash functions
 *
 * Algorithm:
 * 1. For each factor, generate independent hash
 * 2. Use hash to select level from factor's levels
 * 3. Combine all factor assignments
 *
 * Time Complexity: O(f) where f = number of factors
 * Space Complexity: O(f)
 *
 * Statistical Properties:
 * - Independent randomization per factor
 * - Orthogonal factor assignments (no correlation)
 * - Enables interaction effect detection
 *
 * Example: 2x2 Factorial
 * - Factor A: Button Color [blue, green]
 * - Factor B: Button Text [buy_now, purchase]
 * - Results in 4 combinations: blue_buy_now, blue_purchase, green_buy_now, green_purchase
 *
 * @param experiment - Experiment with factorial design config
 * @param unitId - Unit identifier
 * @returns Assignment with factor-level mapping
 *
 * @example
 * ```typescript
 * const experiment = {
 *   id: 'factorial-exp',
 *   designConfig: {
 *     factors: [
 *       { name: 'button_color', levels: ['blue', 'green'] },
 *       { name: 'button_text', levels: ['buy_now', 'purchase'] }
 *     ]
 *   }
 * };
 * const result = assignFactorial(experiment, 'user-456');
 * // result.factorAssignments = { button_color: 'blue', button_text: 'buy_now' }
 * ```
 */
export function assignFactorial(
  experiment: ExperimentConfig,
  unitId: string
): FactorialAssignmentResult {
  // Check traffic allocation
  if (!isInExperimentTraffic(experiment.id, unitId, experiment.trafficAllocation)) {
    return {
      variantKey: 'excluded',
      inExperiment: false,
      reason: 'excluded_by_traffic_allocation',
      factorAssignments: {},
    };
  }

  const config = experiment.designConfig as FactorialConfig;
  if (!config || !config.factors || config.factors.length === 0) {
    throw new Error('Factorial experiment requires factors in designConfig');
  }

  const factorAssignments: Record<string, string> = {};

  // Assign each factor independently
  for (const factor of config.factors) {
    if (factor.levels.length === 0) {
      throw new Error(`Factor ${factor.name} must have at least one level`);
    }

    // Generate independent hash for this factor
    const factorHash = hashFactorialFactor(experiment.id, unitId, factor.name);
    const levelIndex = factorHash % factor.levels.length;
    factorAssignments[factor.name] = factor.levels[levelIndex];
  }

  // Create composite variant key from all factor assignments
  const variantKey = Object.entries(factorAssignments)
    .map(([name, level]) => `${name}:${level}`)
    .join('_');

  return {
    variantKey,
    inExperiment: true,
    reason: 'assigned_factorial',
    factorAssignments,
    metadata: {
      numFactors: config.factors.length,
      totalCombinations: config.factors.reduce((prod, f) => prod * f.levels.length, 1),
    },
  };
}

/**
 * Switchback Design Assignment
 * Time-based assignment where all units switch treatments together
 *
 * Algorithm:
 * 1. Calculate time elapsed since experiment start
 * 2. Determine current period number
 * 3. Hash period number to select variant
 * 4. All users in same period get same variant
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 *
 * Statistical Properties:
 * - Temporal randomization mitigates network effects
 * - All units experience same treatment at same time
 * - Requires clustered standard errors in analysis
 *
 * Use Cases:
 * - Marketplace experiments (rideshare, delivery)
 * - Network effect scenarios
 * - Supply-constrained environments
 *
 * @param experiment - Experiment with switchback config
 * @param currentTime - Current timestamp for period calculation
 * @returns Assignment with period information
 *
 * @example
 * ```typescript
 * const experiment = {
 *   id: 'switchback-exp',
 *   startDate: new Date('2025-01-01T00:00:00Z'),
 *   designConfig: {
 *     periodMinutes: 60, // 1-hour periods
 *     washoutMinutes: 5   // 5-minute cooldown
 *   }
 * };
 * const result = assignSwitchback(experiment, new Date());
 * // All users in same period get same variant
 * ```
 */
export function assignSwitchback(
  experiment: ExperimentConfig,
  currentTime: Date = new Date()
): SwitchbackAssignmentResult {
  const config = experiment.designConfig as SwitchbackConfig;
  if (!config || !config.periodMinutes) {
    throw new Error('Switchback experiment requires periodMinutes in designConfig');
  }

  if (experiment.variants.length < 2) {
    throw new Error('Switchback experiment requires at least 2 variants');
  }

  // Calculate elapsed time in minutes
  const startTime = experiment.startDate.getTime();
  const currentTimeMs = currentTime.getTime();
  const elapsedMinutes = (currentTimeMs - startTime) / (1000 * 60);

  // Handle washout periods
  const washoutMinutes = config.washoutMinutes || 0;
  const totalPeriodMinutes = config.periodMinutes + washoutMinutes;

  // Determine current period
  const periodNumber = Math.floor(elapsedMinutes / totalPeriodMinutes);

  // Check if in washout period
  const minutesIntoPeriod = elapsedMinutes % totalPeriodMinutes;
  const inWashout = minutesIntoPeriod >= config.periodMinutes;

  // Calculate period boundaries
  const periodStart = new Date(startTime + periodNumber * totalPeriodMinutes * 60 * 1000);
  const periodEnd = new Date(periodStart.getTime() + config.periodMinutes * 60 * 1000);

  // Hash period to assign variant
  const periodHash = hashSwitchbackPeriod(experiment.id, periodNumber);
  const variantIndex = periodHash % experiment.variants.length;
  const assignedVariant = experiment.variants[variantIndex];

  return {
    variantKey: assignedVariant.key,
    inExperiment: !inWashout,
    reason: inWashout ? 'in_washout_period' : 'assigned_switchback_period',
    periodNumber,
    periodStart,
    periodEnd,
    metadata: {
      elapsedMinutes,
      minutesIntoPeriod,
      inWashout,
      totalPeriodMinutes,
      variantIndex,
    },
  };
}

/**
 * Within-Subjects Design Assignment
 * Assigns treatments over multiple sessions with counterbalancing
 *
 * Algorithm:
 * 1. Hash user to determine order sequence (Latin square or other scheme)
 * 2. Use session number to index into sequence
 * 3. Return treatment for current session
 *
 * Time Complexity: O(n) where n = number of variants
 * Space Complexity: O(n)
 *
 * Statistical Properties:
 * - Same user experiences all treatments over time
 * - Counterbalancing controls for order effects
 * - Latin square ensures each treatment appears equally at each position
 *
 * Counterbalancing Schemes:
 * - Latin Square: Each treatment appears once in each position
 * - Random: Random order per user
 * - Sequential: Fixed order for all users
 *
 * @param experiment - Experiment with within-subjects config
 * @param unitId - Unit identifier
 * @param sessionNumber - Current session number (0-indexed)
 * @returns Assignment with session information
 *
 * @example
 * ```typescript
 * const experiment = {
 *   id: 'within-subjects-exp',
 *   variants: [
 *     { key: 'v1', allocation: 33.33 },
 *     { key: 'v2', allocation: 33.33 },
 *     { key: 'v3', allocation: 33.34 }
 *   ],
 *   designConfig: {
 *     counterbalancingScheme: 'latin_square'
 *   }
 * };
 * // Session 0: user gets v1
 * // Session 1: user gets v2
 * // Session 2: user gets v3
 * ```
 */
export function assignWithinSubjects(
  experiment: ExperimentConfig,
  unitId: string,
  sessionNumber: number
): WithinSubjectsAssignmentResult {
  const config = experiment.designConfig as WithinSubjectsConfig;
  const scheme = config?.counterbalancingScheme || 'latin_square';

  if (sessionNumber < 0) {
    throw new Error('sessionNumber must be non-negative');
  }

  if (experiment.variants.length < 2) {
    throw new Error('Within-subjects experiment requires at least 2 variants');
  }

  // Generate order sequence based on scheme
  let orderSequence: string[];

  switch (scheme) {
    case 'latin_square':
      orderSequence = generateLatinSquareOrder(experiment, unitId);
      break;

    case 'random':
      orderSequence = generateRandomOrder(experiment, unitId);
      break;

    case 'sequential':
      orderSequence = experiment.variants.map((v) => v.key);
      break;

    default:
      throw new Error(`Unknown counterbalancing scheme: ${scheme}`);
  }

  // Get variant for current session (cycle through order)
  const variantIndex = sessionNumber % orderSequence.length;
  const variantKey = orderSequence[variantIndex];

  return {
    variantKey,
    inExperiment: true,
    reason: 'assigned_within_subjects',
    sessionNumber,
    orderSequence,
    metadata: {
      scheme,
      totalVariants: experiment.variants.length,
      cyclePosition: variantIndex,
      completedCycles: Math.floor(sessionNumber / orderSequence.length),
    },
  };
}

/**
 * Generate Latin Square order for counterbalancing
 * Ensures each treatment appears equally often at each position
 *
 * For n variants, generates one of n possible Latin square orderings
 * based on deterministic hash of user ID
 *
 * @param experiment - Experiment configuration
 * @param unitId - Unit identifier
 * @returns Array of variant keys in counterbalanced order
 */
function generateLatinSquareOrder(
  experiment: ExperimentConfig,
  unitId: string
): string[] {
  const variants = experiment.variants.map((v) => v.key);
  const n = variants.length;

  // Hash user to select which Latin square row to use
  const hash = hashWithinSubjects(experiment.id, unitId);
  const rowIndex = hash % n;

  // Generate Latin square row using cyclic permutation
  // This is a simplified Latin square; full implementation would use
  // balanced Latin square for even n to avoid bias
  const order: string[] = [];
  for (let i = 0; i < n; i++) {
    order.push(variants[(rowIndex + i) % n]);
  }

  return order;
}

/**
 * Generate random order for each user
 * Uses Fisher-Yates shuffle with deterministic hash as seed
 *
 * @param experiment - Experiment configuration
 * @param unitId - Unit identifier
 * @returns Array of variant keys in random order
 */
function generateRandomOrder(
  experiment: ExperimentConfig,
  unitId: string
): string[] {
  const variants = experiment.variants.map((v) => v.key);
  const order = [...variants];

  // Fisher-Yates shuffle with deterministic hash
  for (let i = order.length - 1; i > 0; i--) {
    const hash = hashWithinSubjects(experiment.id, `${unitId}:${i}`);
    const j = hash % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order;
}

/**
 * Universal assignment function
 * Routes to appropriate assignment algorithm based on experiment type
 *
 * @param experiment - Experiment configuration
 * @param unitId - Unit identifier
 * @param context - Additional context (timestamp for switchback, session for within-subjects)
 * @returns Assignment result appropriate for experiment type
 */
export function assign(
  experiment: ExperimentConfig,
  unitId: string,
  context?: {
    currentTime?: Date;
    sessionNumber?: number;
  }
): AssignmentResult | FactorialAssignmentResult | SwitchbackAssignmentResult | WithinSubjectsAssignmentResult {
  switch (experiment.designType) {
    case 'ab':
    case 'multivariate':
      return assignSimpleAB(experiment, unitId);

    case 'factorial':
      return assignFactorial(experiment, unitId);

    case 'switchback':
      return assignSwitchback(experiment, context?.currentTime);

    case 'within_subjects':
      if (context?.sessionNumber === undefined) {
        throw new Error('sessionNumber required for within-subjects assignment');
      }
      return assignWithinSubjects(experiment, unitId, context.sessionNumber);

    default:
      throw new Error(`Unknown experiment design type: ${experiment.designType}`);
  }
}

/**
 * Batch assignment for multiple units
 * Optimized for bulk assignment operations
 *
 * Time Complexity: O(m) where m = number of units
 *
 * @param experiment - Experiment configuration
 * @param unitIds - Array of unit identifiers
 * @param context - Optional context for specialized assignments
 * @returns Map of unitId to assignment result
 */
export function batchAssign(
  experiment: ExperimentConfig,
  unitIds: string[],
  context?: {
    currentTime?: Date;
    sessionNumbers?: Map<string, number>;
  }
): Map<string, AssignmentResult> {
  const results = new Map<string, AssignmentResult>();

  for (const unitId of unitIds) {
    const assignmentContext = {
      currentTime: context?.currentTime,
      sessionNumber: context?.sessionNumbers?.get(unitId),
    };

    results.set(unitId, assign(experiment, unitId, assignmentContext));
  }

  return results;
}

/**
 * Validate experiment configuration
 * Checks for common configuration errors
 *
 * @param experiment - Experiment to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateExperiment(experiment: ExperimentConfig): string[] {
  const errors: string[] = [];

  // Basic validation
  if (!experiment.id) errors.push('Experiment ID is required');
  if (!experiment.key) errors.push('Experiment key is required');
  if (experiment.trafficAllocation < 0 || experiment.trafficAllocation > 100) {
    errors.push('Traffic allocation must be between 0 and 100');
  }

  // Variant validation
  if (!experiment.variants || experiment.variants.length < 2) {
    errors.push('At least 2 variants required');
  }

  if (experiment.variants) {
    const totalAllocation = experiment.variants.reduce((sum, v) => sum + v.allocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      errors.push(`Variant allocations must sum to 100, got ${totalAllocation}`);
    }

    const keys = new Set<string>();
    for (const variant of experiment.variants) {
      if (keys.has(variant.key)) {
        errors.push(`Duplicate variant key: ${variant.key}`);
      }
      keys.add(variant.key);
    }
  }

  // Design-specific validation
  switch (experiment.designType) {
    case 'factorial': {
      const config = experiment.designConfig as FactorialConfig;
      if (!config?.factors || config.factors.length === 0) {
        errors.push('Factorial design requires at least one factor');
      }
      break;
    }

    case 'switchback': {
      const config = experiment.designConfig as SwitchbackConfig;
      if (!config?.periodMinutes || config.periodMinutes <= 0) {
        errors.push('Switchback design requires positive periodMinutes');
      }
      break;
    }

    case 'within_subjects': {
      const config = experiment.designConfig as WithinSubjectsConfig;
      if (!config?.counterbalancingScheme) {
        errors.push('Within-subjects design requires counterbalancingScheme');
      }
      break;
    }
  }

  return errors;
}
