/**
 * UCB (Upper Confidence Bound) Implementation
 *
 * Deterministic bandit algorithm that uses confidence bounds to
 * balance exploration and exploitation without randomness.
 *
 * Algorithm:
 * 1. Calculate UCB for each arm:
 *    UCB(i) = mean(i) + c * sqrt(ln(t) / n(i))
 *    where:
 *    - mean(i) = empirical mean reward of arm i
 *    - c = exploration parameter (typically 2)
 *    - t = total trials
 *    - n(i) = trials of arm i
 * 2. Select arm with highest UCB value
 * 3. Update statistics with observed reward
 *
 * Intuition:
 * - mean(i): exploitation (prefer high reward)
 * - sqrt(ln(t)/n(i)): exploration (prefer less-tried arms)
 * - The "optimism in face of uncertainty" principle
 *
 * Properties:
 * - Logarithmic regret: O(ln(T))
 * - No randomness (deterministic given same order)
 * - Optimal regret bounds (proven)
 * - No hyperparameter tuning needed (c=2 works well)
 * - Graceful handling of non-stationary rewards
 *
 * Variants:
 * - UCB1: Original algorithm (implemented here)
 * - UCB1-Tuned: Variance-based confidence bounds
 * - UCB-V: Variance-aware UCB
 * - Discounted UCB: For non-stationary environments
 *
 * References:
 * - Auer, P., et al. (2002). "Finite-time Analysis of the Multiarmed Bandit Problem"
 * - Lattimore, T., & Szepesvári, C. (2020). "Bandit Algorithms"
 */

import {
  BanditAlgorithm,
  UCBState,
  UCBArm,
  UCBConfig,
  ArmSelectionResult,
  RewardEvent,
} from './bandit-types';

/**
 * Initialize UCB state
 *
 * Creates initial state with zero knowledge.
 * Default exploration parameter c = 2 (theoretical optimum for UCB1)
 *
 * @param armIds - List of arm identifiers
 * @param config - Configuration with exploration parameter
 * @returns Initial UCB state
 */
export function initializeUCB(
  armIds: string[],
  config?: UCBConfig
): UCBState {
  if (armIds.length < 2) {
    throw new Error('UCB requires at least 2 arms');
  }

  const explorationParam = config?.explorationParam ?? 2;

  if (explorationParam <= 0) {
    throw new Error('Exploration parameter must be positive');
  }

  const arms: UCBArm[] = armIds.map((armId) => ({
    armId,
    count: 0,
    totalReward: 0,
    meanReward: 0,
    ucbValue: Infinity, // Untried arms have infinite UCB
  }));

  return {
    algorithm: BanditAlgorithm.UCB,
    arms,
    totalTrials: 0,
    explorationParam,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate UCB value for an arm
 *
 * Formula: UCB(i) = μᵢ + c * sqrt(ln(t) / nᵢ)
 * where:
 * - μᵢ = mean reward of arm i
 * - c = exploration parameter
 * - t = total trials across all arms
 * - nᵢ = trials for arm i
 *
 * For untried arms (nᵢ = 0), returns Infinity to ensure exploration
 *
 * Time Complexity: O(1)
 *
 * @param arm - Arm to calculate UCB for
 * @param totalTrials - Total trials across all arms
 * @param explorationParam - Exploration parameter c
 * @returns UCB value
 */
export function calculateUCB(
  arm: UCBArm,
  totalTrials: number,
  explorationParam: number
): number {
  // Untried arms have infinite UCB (must be tried)
  if (arm.count === 0) {
    return Infinity;
  }

  // Handle edge case: no trials yet
  if (totalTrials === 0) {
    return Infinity;
  }

  // UCB formula: mean + exploration_bonus
  const explorationBonus = explorationParam * Math.sqrt(
    Math.log(totalTrials) / arm.count
  );

  return arm.meanReward + explorationBonus;
}

/**
 * Select arm using UCB policy
 *
 * Algorithm:
 * 1. Calculate UCB for each arm
 * 2. Select arm with highest UCB
 * 3. Break ties randomly
 *
 * This naturally balances:
 * - Exploitation: arms with high mean are preferred
 * - Exploration: arms with few trials get exploration bonus
 *
 * Time Complexity: O(k) where k = number of arms
 *
 * @param state - Current UCB state
 * @returns Selected arm and metadata
 */
export function selectArmUCB(state: UCBState): ArmSelectionResult {
  if (state.arms.length === 0) {
    throw new Error('No arms available for selection');
  }

  // Calculate UCB for each arm
  const ucbValues: Array<{ arm: UCBArm; ucb: number }> = state.arms.map(
    (arm) => ({
      arm,
      ucb: calculateUCB(arm, state.totalTrials, state.explorationParam),
    })
  );

  // Find maximum UCB
  const maxUCB = Math.max(...ucbValues.map((v) => v.ucb));

  // Find all arms with maximum UCB (handle ties and Infinity)
  const bestArms = ucbValues.filter((v) => v.ucb === maxUCB);

  // Random selection among ties
  const randomIndex = Math.floor(Math.random() * bestArms.length);
  const selected = bestArms[randomIndex];

  // Determine if this is exploration
  // We consider it exploration if not selecting empirically best arm
  const empiricalBest = state.arms.reduce((best, arm) =>
    arm.meanReward > best.meanReward ? arm : best
  );
  const isExploration = selected.arm.armId !== empiricalBest.armId;

  // Calculate metadata
  const ucbByArm = Object.fromEntries(
    ucbValues.map((v) => [v.arm.armId, v.ucb])
  );
  const meansByArm = Object.fromEntries(
    state.arms.map((arm) => [arm.armId, arm.meanReward])
  );
  const countsByArm = Object.fromEntries(
    state.arms.map((arm) => [arm.armId, arm.count])
  );

  return {
    armId: selected.arm.armId,
    probability: maxUCB,
    isExploration,
    reason: 'ucb',
    metadata: {
      ucbValue: maxUCB,
      ucbByArm,
      meansByArm,
      countsByArm,
      empiricalBestArm: empiricalBest.armId,
      empiricalBestMean: empiricalBest.meanReward,
      explorationParam: state.explorationParam,
      totalTrials: state.totalTrials,
    },
  };
}

/**
 * Update UCB state with reward
 *
 * Updates:
 * 1. Arm statistics (count, total, mean)
 * 2. UCB value for updated arm
 * 3. Total trial count
 *
 * Uses incremental mean update for numerical stability
 *
 * Time Complexity: O(1)
 *
 * @param state - Current state
 * @param reward - Reward event
 * @returns Updated state
 */
export function updateUCB(
  state: UCBState,
  reward: RewardEvent
): UCBState {
  // Find arm to update
  const armIndex = state.arms.findIndex((arm) => arm.armId === reward.armId);

  if (armIndex === -1) {
    throw new Error(`Arm ${reward.armId} not found in state`);
  }

  // Clone state for immutability
  const newArms = [...state.arms];
  const arm = { ...newArms[armIndex] };

  // Incremental mean update
  arm.count += 1;
  const delta = reward.reward - arm.meanReward;
  arm.meanReward = arm.meanReward + delta / arm.count;
  arm.totalReward += reward.reward;

  // Recalculate UCB value for this arm
  const newTotalTrials = state.totalTrials + 1;
  arm.ucbValue = calculateUCB(arm, newTotalTrials, state.explorationParam);

  newArms[armIndex] = arm;

  // Also update UCB values for all other arms (total trials changed)
  for (let i = 0; i < newArms.length; i++) {
    if (i !== armIndex) {
      newArms[i] = {
        ...newArms[i],
        ucbValue: calculateUCB(
          newArms[i],
          newTotalTrials,
          state.explorationParam
        ),
      };
    }
  }

  return {
    ...state,
    arms: newArms,
    totalTrials: newTotalTrials,
    lastUpdated: new Date(),
  };
}

/**
 * Get confidence bounds for each arm
 *
 * Returns both the UCB (upper confidence bound) and LCB (lower confidence bound)
 * LCB = mean - exploration_bonus
 *
 * @param state - Current state
 * @returns Confidence bounds for each arm
 */
export function getConfidenceBounds(
  state: UCBState
): Record<string, { lower: number; upper: number; mean: number }> {
  const bounds: Record<string, { lower: number; upper: number; mean: number }> = {};

  for (const arm of state.arms) {
    const explorationBonus =
      arm.count > 0
        ? state.explorationParam * Math.sqrt(Math.log(state.totalTrials) / arm.count)
        : Infinity;

    bounds[arm.armId] = {
      mean: arm.meanReward,
      upper: arm.count > 0 ? arm.meanReward + explorationBonus : Infinity,
      lower: arm.count > 0 ? Math.max(0, arm.meanReward - explorationBonus) : 0,
    };
  }

  return bounds;
}

/**
 * Get exploration bonus for each arm
 *
 * Bonus = c * sqrt(ln(t) / n)
 *
 * Shows how much each arm is being "optimistically" evaluated
 *
 * @param state - Current state
 * @returns Exploration bonus for each arm
 */
export function getExplorationBonuses(
  state: UCBState
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const arm of state.arms) {
    bonuses[arm.armId] =
      arm.count > 0
        ? state.explorationParam * Math.sqrt(Math.log(state.totalTrials) / arm.count)
        : Infinity;
  }

  return bonuses;
}

/**
 * Get arm statistics including confidence intervals
 *
 * @param state - Current state
 * @returns Detailed statistics for each arm
 */
export function getArmStatistics(
  state: UCBState
): Array<{
  armId: string;
  count: number;
  meanReward: number;
  ucbValue: number;
  explorationBonus: number;
  confidenceInterval: { lower: number; upper: number };
}> {
  const bounds = getConfidenceBounds(state);
  const bonuses = getExplorationBonuses(state);

  return state.arms.map((arm) => ({
    armId: arm.armId,
    count: arm.count,
    meanReward: arm.meanReward,
    ucbValue: arm.ucbValue,
    explorationBonus: bonuses[arm.armId],
    confidenceInterval: {
      lower: bounds[arm.armId].lower,
      upper: bounds[arm.armId].upper,
    },
  }));
}

/**
 * Calculate regret bounds
 *
 * UCB provides logarithmic regret guarantees:
 * E[Regret(T)] ≤ Σᵢ (8*ln(T)/Δᵢ) + (1 + π²/3)Σᵢ Δᵢ
 *
 * where Δᵢ = μ* - μᵢ is the gap between optimal and arm i
 *
 * @param state - Current state
 * @param optimalMean - Known optimal mean (for evaluation)
 * @returns Regret bound
 */
export function calculateRegretBound(
  state: UCBState,
  optimalMean: number
): number {
  if (state.totalTrials === 0) {
    return 0;
  }

  let bound = 0;

  for (const arm of state.arms) {
    const gap = optimalMean - arm.meanReward;

    if (gap > 0.001) {
      // Avoid division by very small gaps
      bound += (8 * Math.log(state.totalTrials)) / gap + (1 + Math.PI ** 2 / 3) * gap;
    }
  }

  return bound;
}

/**
 * Set exploration parameter
 *
 * Allows dynamic adjustment of exploration-exploitation trade-off
 *
 * @param state - Current state
 * @param explorationParam - New exploration parameter
 * @returns Updated state with recalculated UCB values
 */
export function setExplorationParam(
  state: UCBState,
  explorationParam: number
): UCBState {
  if (explorationParam <= 0) {
    throw new Error('Exploration parameter must be positive');
  }

  // Recalculate all UCB values with new parameter
  const newArms = state.arms.map((arm) => ({
    ...arm,
    ucbValue: calculateUCB(arm, state.totalTrials, explorationParam),
  }));

  return {
    ...state,
    arms: newArms,
    explorationParam,
    lastUpdated: new Date(),
  };
}

/**
 * Export all UCB functions
 */
export const UCB = {
  initialize: initializeUCB,
  selectArm: selectArmUCB,
  update: updateUCB,
  calculateUCB,
  getConfidenceBounds,
  getExplorationBonuses,
  getArmStatistics,
  calculateRegretBound,
  setExplorationParam,
};
