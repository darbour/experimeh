/**
 * Multi-Armed Bandit Type Definitions
 *
 * Core types for bandit algorithms including Thompson Sampling,
 * Epsilon-Greedy, and UCB (Upper Confidence Bound).
 *
 * These algorithms enable adaptive experimentation where traffic
 * automatically shifts toward better-performing variants over time.
 */

/**
 * Supported bandit algorithms
 */
export enum BanditAlgorithm {
  /** Bayesian Thompson Sampling - optimal for binary and continuous rewards */
  THOMPSON_SAMPLING = 'thompson_sampling',
  /** Epsilon-Greedy - simple exploration-exploitation with decaying epsilon */
  EPSILON_GREEDY = 'epsilon_greedy',
  /** Upper Confidence Bound - confidence-based exploration without randomness */
  UCB = 'ucb',
}

/**
 * Base interface for all bandit arm states
 */
export interface BanditArm {
  /** Unique arm identifier (typically variant key) */
  armId: string;
  /** Total number of pulls/trials for this arm */
  count: number;
  /** Total reward accumulated */
  totalReward: number;
  /** Mean reward (totalReward / count) */
  meanReward: number;
}

/**
 * Thompson Sampling arm state
 * Uses Beta distribution for binary rewards: Beta(α, β)
 * α = successes + 1 (prior)
 * β = failures + 1 (prior)
 */
export interface ThompsonSamplingArm extends BanditArm {
  /** Alpha parameter (successes + 1) */
  alpha: number;
  /** Beta parameter (failures + 1) */
  beta: number;
}

/**
 * Complete Thompson Sampling state
 */
export interface ThompsonSamplingState {
  /** Algorithm identifier */
  algorithm: BanditAlgorithm.THOMPSON_SAMPLING;
  /** Arms in this bandit */
  arms: ThompsonSamplingArm[];
  /** Total number of trials across all arms */
  totalTrials: number;
  /** Timestamp of last update */
  lastUpdated: Date;
}

/**
 * Epsilon-Greedy arm state
 * Simple mean tracking with exploration parameter
 */
export interface EpsilonGreedyArm extends BanditArm {
  // Inherits all fields from BanditArm
}

/**
 * Complete Epsilon-Greedy state
 */
export interface EpsilonGreedyState {
  /** Algorithm identifier */
  algorithm: BanditAlgorithm.EPSILON_GREEDY;
  /** Arms in this bandit */
  arms: EpsilonGreedyArm[];
  /** Total number of trials across all arms */
  totalTrials: number;
  /** Current epsilon value (exploration probability) */
  epsilon: number;
  /** Initial epsilon value */
  initialEpsilon: number;
  /** Decay rate for epsilon (0 = no decay, 1 = full decay) */
  decayRate: number;
  /** Minimum epsilon value (floor) */
  minEpsilon: number;
  /** Timestamp of last update */
  lastUpdated: Date;
}

/**
 * UCB arm state
 * Tracks confidence bounds for exploration
 */
export interface UCBArm extends BanditArm {
  /** Current UCB value (mean + confidence interval) */
  ucbValue: number;
}

/**
 * Complete UCB state
 */
export interface UCBState {
  /** Algorithm identifier */
  algorithm: BanditAlgorithm.UCB;
  /** Arms in this bandit */
  arms: UCBArm[];
  /** Total number of trials across all arms */
  totalTrials: number;
  /** Exploration parameter (typically 2) */
  explorationParam: number;
  /** Timestamp of last update */
  lastUpdated: Date;
}

/**
 * Union type for all bandit states
 */
export type BanditState =
  | ThompsonSamplingState
  | EpsilonGreedyState
  | UCBState;

/**
 * Configuration for Thompson Sampling
 */
export interface ThompsonSamplingConfig {
  algorithm: BanditAlgorithm.THOMPSON_SAMPLING;
  /** Prior belief: alpha parameter (default: 1) */
  priorAlpha?: number;
  /** Prior belief: beta parameter (default: 1) */
  priorBeta?: number;
}

/**
 * Configuration for Epsilon-Greedy
 */
export interface EpsilonGreedyConfig {
  algorithm: BanditAlgorithm.EPSILON_GREEDY;
  /** Initial exploration rate (0-1, default: 0.1) */
  epsilon?: number;
  /** Decay rate per trial (0-1, default: 0.99) */
  decayRate?: number;
  /** Minimum epsilon value (default: 0.01) */
  minEpsilon?: number;
}

/**
 * Configuration for UCB
 */
export interface UCBConfig {
  algorithm: BanditAlgorithm.UCB;
  /** Exploration parameter (default: 2) */
  explorationParam?: number;
}

/**
 * Union type for all bandit configurations
 */
export type BanditConfig =
  | ThompsonSamplingConfig
  | EpsilonGreedyConfig
  | UCBConfig;

/**
 * Result of arm selection
 */
export interface ArmSelectionResult {
  /** Selected arm ID */
  armId: string;
  /** Selection probability or confidence */
  probability: number;
  /** Whether this was exploration (vs exploitation) */
  isExploration: boolean;
  /** Reason for selection */
  reason: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Reward event for updating bandit state
 */
export interface RewardEvent {
  /** Experiment ID */
  experimentId: string;
  /** Arm/variant that was pulled */
  armId: string;
  /** Reward value (0-1 for binary, any positive for continuous) */
  reward: number;
  /** Timestamp of reward */
  timestamp: Date;
  /** Unit ID (user, session, etc.) */
  unitId: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Statistics for a single arm
 */
export interface ArmStatistics {
  /** Arm identifier */
  armId: string;
  /** Number of pulls */
  count: number;
  /** Total reward */
  totalReward: number;
  /** Mean reward */
  meanReward: number;
  /** Standard error of mean */
  standardError: number;
  /** 95% confidence interval */
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  /** Selection probability (for Thompson Sampling) */
  selectionProbability?: number;
  /** UCB value (for UCB algorithm) */
  ucbValue?: number;
}

/**
 * Performance metrics for bandit experiment
 */
export interface BanditMetrics {
  /** Total number of trials */
  totalTrials: number;
  /** Number of arms */
  numArms: number;
  /** Cumulative regret (difference from optimal arm) */
  cumulativeRegret: number;
  /** Simple regret (current best vs optimal) */
  simpleRegret: number;
  /** Probability that each arm is best */
  bestArmProbability: Record<string, number>;
  /** Current exploration rate */
  explorationRate: number;
  /** Convergence status */
  convergence: {
    /** Whether algorithm has converged */
    converged: boolean;
    /** Number of trials to convergence (if converged) */
    trialsToConverge?: number;
    /** Confidence in convergence (0-1) */
    confidence: number;
  };
  /** Performance by arm */
  armMetrics: ArmStatistics[];
}

/**
 * Warmup configuration for initial exploration
 */
export interface WarmupConfig {
  /** Number of random trials per arm before using bandit */
  trialsPerArm: number;
  /** Whether warmup is complete */
  complete: boolean;
  /** Trials remaining */
  trialsRemaining: number;
}

/**
 * Type guards for bandit states
 */
export function isThompsonSamplingState(
  state: BanditState
): state is ThompsonSamplingState {
  return state.algorithm === BanditAlgorithm.THOMPSON_SAMPLING;
}

export function isEpsilonGreedyState(
  state: BanditState
): state is EpsilonGreedyState {
  return state.algorithm === BanditAlgorithm.EPSILON_GREEDY;
}

export function isUCBState(state: BanditState): state is UCBState {
  return state.algorithm === BanditAlgorithm.UCB;
}

/**
 * Type guards for bandit configs
 */
export function isThompsonSamplingConfig(
  config: BanditConfig
): config is ThompsonSamplingConfig {
  return config.algorithm === BanditAlgorithm.THOMPSON_SAMPLING;
}

export function isEpsilonGreedyConfig(
  config: BanditConfig
): config is EpsilonGreedyConfig {
  return config.algorithm === BanditAlgorithm.EPSILON_GREEDY;
}

export function isUCBConfig(config: BanditConfig): config is UCBConfig {
  return config.algorithm === BanditAlgorithm.UCB;
}
