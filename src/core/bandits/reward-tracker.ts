/**
 * Reward Tracker
 *
 * Manages reward collection and aggregation for bandit algorithms.
 * Tracks rewards over time, computes statistics, and provides
 * data for bandit state updates.
 *
 * Features:
 * - In-memory and persistent reward storage
 * - Real-time statistics computation
 * - Reward validation and normalization
 * - Time-windowed metrics
 * - Regret calculation
 */

import {
  RewardEvent,
  ArmStatistics,
  BanditAlgorithm,
} from './bandit-types';

/**
 * Configuration for reward tracking
 */
export interface RewardTrackerConfig {
  /** Window size for computing recent statistics (in trials) */
  windowSize?: number;
  /** Whether to validate reward ranges */
  validateRewards?: boolean;
  /** Expected reward range [min, max] */
  rewardRange?: [number, number];
  /** Whether to store full reward history */
  storeHistory?: boolean;
  /** Maximum history size (0 = unlimited) */
  maxHistorySize?: number;
}

/**
 * Aggregated reward data for an arm
 */
export interface ArmRewardData {
  /** Arm identifier */
  armId: string;
  /** Total number of rewards */
  count: number;
  /** Sum of all rewards */
  sum: number;
  /** Sum of squared rewards (for variance) */
  sumSquared: number;
  /** Mean reward */
  mean: number;
  /** Variance of rewards */
  variance: number;
  /** Standard deviation */
  stdDev: number;
  /** Standard error of mean */
  standardError: number;
  /** Minimum observed reward */
  min: number;
  /** Maximum observed reward */
  max: number;
  /** Recent rewards (windowed) */
  recentRewards: number[];
  /** Recent mean (within window) */
  recentMean: number;
  /** Timestamp of first reward */
  firstRewardAt?: Date;
  /** Timestamp of last reward */
  lastRewardAt?: Date;
}

/**
 * Tracker state
 */
export interface RewardTrackerState {
  /** Experiment ID */
  experimentId: string;
  /** Bandit algorithm being used */
  algorithm: BanditAlgorithm;
  /** Reward data by arm */
  arms: Map<string, ArmRewardData>;
  /** Full reward history (if enabled) */
  history: RewardEvent[];
  /** Configuration */
  config: RewardTrackerConfig;
  /** Total rewards across all arms */
  totalRewards: number;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Create new reward tracker
 *
 * @param experimentId - Experiment identifier
 * @param armIds - List of arm identifiers
 * @param algorithm - Bandit algorithm
 * @param config - Configuration options
 * @returns Initial tracker state
 */
export function createRewardTracker(
  experimentId: string,
  armIds: string[],
  algorithm: BanditAlgorithm,
  config?: RewardTrackerConfig
): RewardTrackerState {
  const arms = new Map<string, ArmRewardData>();

  for (const armId of armIds) {
    arms.set(armId, {
      armId,
      count: 0,
      sum: 0,
      sumSquared: 0,
      mean: 0,
      variance: 0,
      stdDev: 0,
      standardError: 0,
      min: Infinity,
      max: -Infinity,
      recentRewards: [],
      recentMean: 0,
    });
  }

  return {
    experimentId,
    algorithm,
    arms,
    history: [],
    config: {
      windowSize: config?.windowSize ?? 100,
      validateRewards: config?.validateRewards ?? true,
      rewardRange: config?.rewardRange ?? [0, 1],
      storeHistory: config?.storeHistory ?? true,
      maxHistorySize: config?.maxHistorySize ?? 10000,
    },
    totalRewards: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Track a new reward
 *
 * Updates arm statistics and optionally stores in history
 *
 * @param state - Current tracker state
 * @param reward - Reward event
 * @returns Updated state
 */
export function trackReward(
  state: RewardTrackerState,
  reward: RewardEvent
): RewardTrackerState {
  // Validate reward
  if (state.config.validateRewards) {
    validateReward(reward, state.config.rewardRange!);
  }

  // Get arm data
  const armData = state.arms.get(reward.armId);
  if (!armData) {
    throw new Error(`Arm ${reward.armId} not found in tracker`);
  }

  // Update statistics incrementally
  const newArmData = updateArmStatistics(armData, reward.reward, state.config.windowSize!);

  // Clone state for immutability
  const newArms = new Map(state.arms);
  newArms.set(reward.armId, newArmData);

  // Update history
  const newHistory = state.config.storeHistory
    ? [...state.history, reward].slice(-state.config.maxHistorySize!)
    : state.history;

  return {
    ...state,
    arms: newArms,
    history: newHistory,
    totalRewards: state.totalRewards + 1,
    updatedAt: new Date(),
  };
}

/**
 * Update arm statistics with new reward
 *
 * Uses Welford's online algorithm for numerical stability
 *
 * @param armData - Current arm data
 * @param reward - New reward value
 * @param windowSize - Window size for recent rewards
 * @returns Updated arm data
 */
function updateArmStatistics(
  armData: ArmRewardData,
  reward: number,
  windowSize: number
): ArmRewardData {
  const newCount = armData.count + 1;
  const newSum = armData.sum + reward;
  const newSumSquared = armData.sumSquared + reward * reward;

  // Incremental mean update
  const delta = reward - armData.mean;
  const newMean = armData.mean + delta / newCount;

  // Welford's method for variance
  const delta2 = reward - newMean;
  const m2 = armData.variance * armData.count + delta * delta2;
  const newVariance = newCount > 1 ? m2 / (newCount - 1) : 0;
  const newStdDev = Math.sqrt(newVariance);
  const newStandardError = newCount > 0 ? newStdDev / Math.sqrt(newCount) : 0;

  // Update min/max
  const newMin = Math.min(armData.min, reward);
  const newMax = Math.max(armData.max, reward);

  // Update recent rewards (sliding window)
  const newRecentRewards = [...armData.recentRewards, reward].slice(-windowSize);
  const newRecentMean =
    newRecentRewards.length > 0
      ? newRecentRewards.reduce((sum, r) => sum + r, 0) / newRecentRewards.length
      : 0;

  return {
    ...armData,
    count: newCount,
    sum: newSum,
    sumSquared: newSumSquared,
    mean: newMean,
    variance: newVariance,
    stdDev: newStdDev,
    standardError: newStandardError,
    min: newMin,
    max: newMax,
    recentRewards: newRecentRewards,
    recentMean: newRecentMean,
    lastRewardAt: new Date(),
    firstRewardAt: armData.firstRewardAt ?? new Date(),
  };
}

/**
 * Validate reward value
 *
 * @param reward - Reward event
 * @param range - Expected range [min, max]
 */
function validateReward(reward: RewardEvent, range: [number, number]): void {
  if (typeof reward.reward !== 'number' || isNaN(reward.reward)) {
    throw new Error('Reward must be a valid number');
  }

  if (reward.reward < range[0] || reward.reward > range[1]) {
    throw new Error(
      `Reward ${reward.reward} outside expected range [${range[0]}, ${range[1]}]`
    );
  }
}

/**
 * Get arm statistics
 *
 * @param state - Tracker state
 * @returns Array of arm statistics
 */
export function getArmStatistics(state: RewardTrackerState): ArmStatistics[] {
  return Array.from(state.arms.values()).map((armData) => ({
    armId: armData.armId,
    count: armData.count,
    totalReward: armData.sum,
    meanReward: armData.mean,
    standardError: armData.standardError,
    confidenceInterval: {
      lower: Math.max(0, armData.mean - 1.96 * armData.standardError),
      upper: Math.min(1, armData.mean + 1.96 * armData.standardError),
    },
  }));
}

/**
 * Calculate cumulative regret
 *
 * Regret = Σ(optimal_reward - actual_reward)
 *
 * @param state - Tracker state
 * @param optimalArmId - Known optimal arm (for evaluation)
 * @returns Cumulative regret
 */
export function calculateCumulativeRegret(
  state: RewardTrackerState,
  optimalArmId: string
): number {
  const optimalArm = state.arms.get(optimalArmId);
  if (!optimalArm) {
    throw new Error(`Optimal arm ${optimalArmId} not found`);
  }

  // Estimate optimal mean (use observed mean of optimal arm)
  const optimalMean = optimalArm.mean;

  // Calculate regret from history
  let cumulativeRegret = 0;

  for (const reward of state.history) {
    const expectedOptimal = optimalMean;
    const actualReward = reward.reward;
    cumulativeRegret += expectedOptimal - actualReward;
  }

  return Math.max(0, cumulativeRegret); // Regret is non-negative
}

/**
 * Calculate simple regret
 *
 * Simple regret = optimal_mean - best_observed_mean
 *
 * @param state - Tracker state
 * @param optimalArmId - Known optimal arm
 * @returns Simple regret
 */
export function calculateSimpleRegret(
  state: RewardTrackerState,
  optimalArmId: string
): number {
  const optimalArm = state.arms.get(optimalArmId);
  if (!optimalArm) {
    throw new Error(`Optimal arm ${optimalArmId} not found`);
  }

  // Find best observed arm
  let bestMean = -Infinity;
  for (const armData of state.arms.values()) {
    if (armData.mean > bestMean) {
      bestMean = armData.mean;
    }
  }

  return Math.max(0, optimalArm.mean - bestMean);
}

/**
 * Get rewards for specific arm
 *
 * @param state - Tracker state
 * @param armId - Arm identifier
 * @returns Reward events for arm
 */
export function getArmRewards(
  state: RewardTrackerState,
  armId: string
): RewardEvent[] {
  return state.history.filter((reward) => reward.armId === armId);
}

/**
 * Get rewards in time window
 *
 * @param state - Tracker state
 * @param startTime - Window start
 * @param endTime - Window end
 * @returns Reward events in window
 */
export function getRewardsInWindow(
  state: RewardTrackerState,
  startTime: Date,
  endTime: Date
): RewardEvent[] {
  return state.history.filter(
    (reward) =>
      reward.timestamp >= startTime && reward.timestamp <= endTime
  );
}

/**
 * Reset statistics for all arms
 *
 * Useful for restarting experiment or clearing cache
 *
 * @param state - Current state
 * @returns Reset state
 */
export function resetStatistics(state: RewardTrackerState): RewardTrackerState {
  const newArms = new Map<string, ArmRewardData>();

  for (const [armId, armData] of state.arms.entries()) {
    newArms.set(armId, {
      ...armData,
      count: 0,
      sum: 0,
      sumSquared: 0,
      mean: 0,
      variance: 0,
      stdDev: 0,
      standardError: 0,
      min: Infinity,
      max: -Infinity,
      recentRewards: [],
      recentMean: 0,
      firstRewardAt: undefined,
      lastRewardAt: undefined,
    });
  }

  return {
    ...state,
    arms: newArms,
    history: [],
    totalRewards: 0,
    updatedAt: new Date(),
  };
}

/**
 * Get summary statistics
 *
 * @param state - Tracker state
 * @returns Summary of tracker state
 */
export function getSummary(state: RewardTrackerState): {
  experimentId: string;
  algorithm: BanditAlgorithm;
  totalRewards: number;
  numArms: number;
  armStats: Array<{
    armId: string;
    count: number;
    mean: number;
    recentMean: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    experimentId: state.experimentId,
    algorithm: state.algorithm,
    totalRewards: state.totalRewards,
    numArms: state.arms.size,
    armStats: Array.from(state.arms.values()).map((arm) => ({
      armId: arm.armId,
      count: arm.count,
      mean: arm.mean,
      recentMean: arm.recentMean,
    })),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

/**
 * Export reward tracker functions
 */
export const RewardTracker = {
  create: createRewardTracker,
  trackReward,
  getArmStatistics,
  calculateCumulativeRegret,
  calculateSimpleRegret,
  getArmRewards,
  getRewardsInWindow,
  resetStatistics,
  getSummary,
};
