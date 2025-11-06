/**
 * Epsilon-Greedy Implementation
 *
 * Simple but effective bandit algorithm that balances exploration
 * and exploitation using a probability parameter ε.
 *
 * Algorithm:
 * 1. With probability ε: explore (select random arm)
 * 2. With probability 1-ε: exploit (select best arm by mean reward)
 * 3. Update mean rewards with observed outcomes
 * 4. Optionally decay ε over time
 *
 * Properties:
 * - Simple and interpretable
 * - Fast computation: O(k) per selection
 * - Sublinear regret with decaying ε: O(k*ln(T))
 * - Easy to tune with single parameter
 * - Good baseline for comparing other algorithms
 *
 * Variants:
 * - Fixed ε: constant exploration rate
 * - Decaying ε: ε(t) = ε₀ * decay^t or ε₀/t
 * - Adaptive ε: adjust based on uncertainty
 *
 * References:
 * - Sutton, R. S., & Barto, A. G. (2018). "Reinforcement Learning"
 * - Auer, P., et al. (2002). "Finite-time Analysis of the Multiarmed Bandit Problem"
 */

import {
  BanditAlgorithm,
  EpsilonGreedyState,
  EpsilonGreedyArm,
  EpsilonGreedyConfig,
  ArmSelectionResult,
  RewardEvent,
} from './bandit-types';

/**
 * Initialize Epsilon-Greedy state
 *
 * Creates initial state with zero knowledge about arms.
 * Default parameters:
 * - ε = 0.1 (10% exploration)
 * - decay = 0.99 (slow decay)
 * - min_ε = 0.01 (maintain minimal exploration)
 *
 * @param armIds - List of arm identifiers
 * @param config - Configuration with epsilon parameters
 * @returns Initial Epsilon-Greedy state
 */
export function initializeEpsilonGreedy(
  armIds: string[],
  config?: EpsilonGreedyConfig
): EpsilonGreedyState {
  if (armIds.length < 2) {
    throw new Error('Epsilon-Greedy requires at least 2 arms');
  }

  const initialEpsilon = config?.epsilon ?? 0.1;
  const decayRate = config?.decayRate ?? 0.99;
  const minEpsilon = config?.minEpsilon ?? 0.01;

  // Validate parameters
  if (initialEpsilon < 0 || initialEpsilon > 1) {
    throw new Error('Epsilon must be in [0, 1]');
  }
  if (decayRate < 0 || decayRate > 1) {
    throw new Error('Decay rate must be in [0, 1]');
  }
  if (minEpsilon < 0 || minEpsilon > initialEpsilon) {
    throw new Error('Min epsilon must be in [0, epsilon]');
  }

  const arms: EpsilonGreedyArm[] = armIds.map((armId) => ({
    armId,
    count: 0,
    totalReward: 0,
    meanReward: 0,
  }));

  return {
    algorithm: BanditAlgorithm.EPSILON_GREEDY,
    arms,
    totalTrials: 0,
    epsilon: initialEpsilon,
    initialEpsilon,
    decayRate,
    minEpsilon,
    lastUpdated: new Date(),
  };
}

/**
 * Select arm using Epsilon-Greedy policy
 *
 * Algorithm:
 * 1. Generate random number u ~ Uniform(0,1)
 * 2. If u < ε: select random arm (explore)
 * 3. Else: select arm with highest mean reward (exploit)
 * 4. Handle ties by random selection
 *
 * Time Complexity: O(k) where k = number of arms
 *
 * @param state - Current Epsilon-Greedy state
 * @returns Selected arm and metadata
 */
export function selectArmEpsilonGreedy(
  state: EpsilonGreedyState
): ArmSelectionResult {
  if (state.arms.length === 0) {
    throw new Error('No arms available for selection');
  }

  const random = Math.random();
  const shouldExplore = random < state.epsilon;

  let selectedArm: EpsilonGreedyArm;
  let isExploration: boolean;
  let reason: string;

  if (shouldExplore) {
    // Explore: random selection
    const randomIndex = Math.floor(Math.random() * state.arms.length);
    selectedArm = state.arms[randomIndex];
    isExploration = true;
    reason = 'epsilon_greedy_explore';
  } else {
    // Exploit: select best arm
    selectedArm = selectBestArm(state.arms);
    isExploration = false;
    reason = 'epsilon_greedy_exploit';
  }

  // Calculate selection probability
  // P(select arm i) = ε/k + (1-ε)*I(i is best)
  const k = state.arms.length;
  const bestArm = selectBestArm(state.arms);
  const probability =
    selectedArm.armId === bestArm.armId
      ? state.epsilon / k + (1 - state.epsilon)
      : state.epsilon / k;

  return {
    armId: selectedArm.armId,
    probability,
    isExploration,
    reason,
    metadata: {
      epsilon: state.epsilon,
      randomValue: random,
      bestArmId: bestArm.armId,
      bestArmMean: bestArm.meanReward,
      armMeans: Object.fromEntries(
        state.arms.map((arm) => [arm.armId, arm.meanReward])
      ),
    },
  };
}

/**
 * Select best arm by mean reward
 * Handles ties by random selection
 *
 * @param arms - List of arms
 * @returns Arm with highest mean reward
 */
function selectBestArm(arms: EpsilonGreedyArm[]): EpsilonGreedyArm {
  if (arms.length === 0) {
    throw new Error('Cannot select from empty arms list');
  }

  // Handle untried arms (give them priority)
  const untriedArms = arms.filter((arm) => arm.count === 0);
  if (untriedArms.length > 0) {
    const randomIndex = Math.floor(Math.random() * untriedArms.length);
    return untriedArms[randomIndex];
  }

  // Find maximum mean reward
  const maxMean = Math.max(...arms.map((arm) => arm.meanReward));

  // Find all arms with maximum mean (handle ties)
  const bestArms = arms.filter((arm) => arm.meanReward === maxMean);

  // Random selection among ties
  const randomIndex = Math.floor(Math.random() * bestArms.length);
  return bestArms[randomIndex];
}

/**
 * Update Epsilon-Greedy state with reward
 *
 * Updates:
 * 1. Arm statistics (count, total, mean)
 * 2. Epsilon decay: ε(t+1) = max(min_ε, ε(t) * decay)
 *
 * Uses incremental mean update for numerical stability:
 * mean_new = mean_old + (reward - mean_old) / count
 *
 * Time Complexity: O(k) where k = number of arms
 *
 * @param state - Current state
 * @param reward - Reward event
 * @returns Updated state
 */
export function updateEpsilonGreedy(
  state: EpsilonGreedyState,
  reward: RewardEvent
): EpsilonGreedyState {
  // Find arm to update
  const armIndex = state.arms.findIndex((arm) => arm.armId === reward.armId);

  if (armIndex === -1) {
    throw new Error(`Arm ${reward.armId} not found in state`);
  }

  // Clone state for immutability
  const newArms = [...state.arms];
  const arm = { ...newArms[armIndex] };

  // Incremental mean update (more numerically stable)
  arm.count += 1;
  const delta = reward.reward - arm.meanReward;
  arm.meanReward = arm.meanReward + delta / arm.count;
  arm.totalReward += reward.reward;

  newArms[armIndex] = arm;

  // Decay epsilon
  const newEpsilon = Math.max(
    state.minEpsilon,
    state.epsilon * state.decayRate
  );

  return {
    ...state,
    arms: newArms,
    totalTrials: state.totalTrials + 1,
    epsilon: newEpsilon,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate exploration rate
 *
 * @param state - Current state
 * @returns Current epsilon value
 */
export function getExplorationRate(state: EpsilonGreedyState): number {
  return state.epsilon;
}

/**
 * Calculate probability of selecting each arm
 *
 * P(select arm i) = ε/k + (1-ε)*I(i is best)
 * where k = number of arms
 *
 * @param state - Current state
 * @returns Selection probability for each arm
 */
export function calculateSelectionProbabilities(
  state: EpsilonGreedyState
): Record<string, number> {
  const k = state.arms.length;
  const baseProb = state.epsilon / k;
  const bestArm = selectBestArm(state.arms);
  const exploitProb = 1 - state.epsilon;

  const probabilities: Record<string, number> = {};

  for (const arm of state.arms) {
    probabilities[arm.armId] =
      arm.armId === bestArm.armId
        ? baseProb + exploitProb
        : baseProb;
  }

  return probabilities;
}

/**
 * Get statistics for each arm
 *
 * @param state - Current state
 * @returns Arm statistics including confidence intervals
 */
export function getArmStatistics(
  state: EpsilonGreedyState
): Array<{
  armId: string;
  count: number;
  meanReward: number;
  standardError: number;
  confidenceInterval: { lower: number; upper: number };
}> {
  return state.arms.map((arm) => {
    // Calculate standard error: SE = σ/√n
    // For bounded rewards [0,1], use Hoeffding bound
    // For unbounded, use sample variance
    const standardError =
      arm.count > 0 ? Math.sqrt(arm.meanReward * (1 - arm.meanReward) / arm.count) : 1;

    // 95% confidence interval: mean ± 1.96*SE
    const margin = 1.96 * standardError;

    return {
      armId: arm.armId,
      count: arm.count,
      meanReward: arm.meanReward,
      standardError,
      confidenceInterval: {
        lower: Math.max(0, arm.meanReward - margin),
        upper: Math.min(1, arm.meanReward + margin),
      },
    };
  });
}

/**
 * Reset epsilon to initial value
 *
 * Useful for restarting exploration phase
 *
 * @param state - Current state
 * @returns State with reset epsilon
 */
export function resetEpsilon(state: EpsilonGreedyState): EpsilonGreedyState {
  return {
    ...state,
    epsilon: state.initialEpsilon,
    lastUpdated: new Date(),
  };
}

/**
 * Set custom epsilon value
 *
 * @param state - Current state
 * @param epsilon - New epsilon value
 * @returns State with updated epsilon
 */
export function setEpsilon(
  state: EpsilonGreedyState,
  epsilon: number
): EpsilonGreedyState {
  if (epsilon < 0 || epsilon > 1) {
    throw new Error('Epsilon must be in [0, 1]');
  }

  return {
    ...state,
    epsilon: Math.max(state.minEpsilon, epsilon),
    lastUpdated: new Date(),
  };
}

/**
 * Export all Epsilon-Greedy functions
 */
export const EpsilonGreedy = {
  initialize: initializeEpsilonGreedy,
  selectArm: selectArmEpsilonGreedy,
  update: updateEpsilonGreedy,
  getExplorationRate,
  calculateSelectionProbabilities,
  getArmStatistics,
  resetEpsilon,
  setEpsilon,
};
