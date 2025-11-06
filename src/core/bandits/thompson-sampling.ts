/**
 * Thompson Sampling Implementation
 *
 * Bayesian bandit algorithm that samples from posterior distributions
 * to balance exploration and exploitation optimally.
 *
 * Algorithm:
 * 1. For each arm, maintain Beta(α, β) distribution
 *    - α = number of successes + prior
 *    - β = number of failures + prior
 * 2. Sample from each arm's posterior distribution
 * 3. Select arm with highest sample
 * 4. Update parameters based on observed reward
 *
 * Properties:
 * - Optimal regret bounds: O(√(K*T*ln(T)))
 * - Probability matching: P(select arm i) ≈ P(arm i is best)
 * - Naturally balances exploration and exploitation
 * - No hyperparameters to tune (uses priors)
 *
 * References:
 * - Chapelle, O., & Li, L. (2011). "An empirical evaluation of thompson sampling"
 * - Agrawal, S., & Goyal, N. (2012). "Analysis of Thompson Sampling"
 */

import {
  BanditAlgorithm,
  ThompsonSamplingState,
  ThompsonSamplingArm,
  ThompsonSamplingConfig,
  ArmSelectionResult,
  RewardEvent,
} from './bandit-types';

/**
 * Initialize Thompson Sampling state
 *
 * Creates initial state with Beta(1,1) priors (uniform distribution)
 * representing no prior knowledge about arm performance.
 *
 * @param armIds - List of arm identifiers (variant keys)
 * @param config - Optional configuration with priors
 * @returns Initial Thompson Sampling state
 */
export function initializeThompsonSampling(
  armIds: string[],
  config?: ThompsonSamplingConfig
): ThompsonSamplingState {
  if (armIds.length < 2) {
    throw new Error('Thompson Sampling requires at least 2 arms');
  }

  const priorAlpha = config?.priorAlpha ?? 1;
  const priorBeta = config?.priorBeta ?? 1;

  if (priorAlpha <= 0 || priorBeta <= 0) {
    throw new Error('Prior parameters must be positive');
  }

  const arms: ThompsonSamplingArm[] = armIds.map((armId) => ({
    armId,
    count: 0,
    totalReward: 0,
    meanReward: 0,
    alpha: priorAlpha, // Prior successes
    beta: priorBeta,   // Prior failures
  }));

  return {
    algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
    arms,
    totalTrials: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Sample from Beta distribution using Gamma distribution
 *
 * Beta(α, β) can be generated as:
 * X ~ Gamma(α, 1)
 * Y ~ Gamma(β, 1)
 * Beta = X / (X + Y)
 *
 * Time Complexity: O(1)
 *
 * @param alpha - Alpha parameter (successes + 1)
 * @param beta - Beta parameter (failures + 1)
 * @returns Random sample from Beta(α, β)
 */
export function sampleBeta(alpha: number, beta: number): number {
  // Generate two gamma samples
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);

  // Beta sample is ratio
  return x / (x + y);
}

/**
 * Sample from Gamma distribution
 *
 * Uses Marsaglia & Tsang method for shape >= 1
 * Uses Ahrens-Dieter acceptance-rejection for shape < 1
 *
 * Time Complexity: O(1) expected
 *
 * @param shape - Shape parameter (k or α)
 * @param scale - Scale parameter (θ)
 * @returns Random sample from Gamma(shape, scale)
 */
export function sampleGamma(shape: number, scale: number): number {
  if (shape < 1) {
    // Use Ahrens-Dieter method for shape < 1
    // Gamma(α) = Gamma(α + 1) * U^(1/α)
    const sample = sampleGamma(shape + 1, scale);
    return sample * Math.pow(Math.random(), 1 / shape);
  }

  // Marsaglia & Tsang method for shape >= 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    // Sample from standard normal
    let x = sampleNormal(0, 1);
    const v = Math.pow(1 + c * x, 3);

    if (v <= 0) continue;

    x = x * x;
    const u = Math.random();

    // Accept/reject
    if (u < 1 - 0.0331 * x * x) {
      return d * v * scale;
    }

    if (Math.log(u) < 0.5 * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Sample from standard normal distribution
 * Uses Box-Muller transform
 *
 * @param mean - Mean of distribution
 * @param stdDev - Standard deviation
 * @returns Random sample from N(mean, stdDev²)
 */
export function sampleNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return mean + stdDev * z0;
}

/**
 * Select arm using Thompson Sampling
 *
 * Algorithm:
 * 1. For each arm i, sample θᵢ ~ Beta(αᵢ, βᵢ)
 * 2. Select arm with highest sample: argmax θᵢ
 *
 * This naturally implements probability matching:
 * P(select arm i) = P(arm i has highest θ) ≈ P(arm i is best)
 *
 * Time Complexity: O(k) where k = number of arms
 *
 * @param state - Current Thompson Sampling state
 * @returns Selected arm and metadata
 */
export function selectArmThompsonSampling(
  state: ThompsonSamplingState
): ArmSelectionResult {
  if (state.arms.length === 0) {
    throw new Error('No arms available for selection');
  }

  let bestArm: ThompsonSamplingArm | null = null;
  let bestSample = -Infinity;
  const samples: Record<string, number> = {};

  // Sample from each arm's posterior
  for (const arm of state.arms) {
    const sample = sampleBeta(arm.alpha, arm.beta);
    samples[arm.armId] = sample;

    if (sample > bestSample) {
      bestSample = sample;
      bestArm = arm;
    }
  }

  if (!bestArm) {
    throw new Error('Failed to select arm');
  }

  // Thompson Sampling is inherently exploratory
  // We consider it exploration if not selecting empirically best arm
  const empiricalBest = state.arms.reduce((best, arm) =>
    arm.meanReward > best.meanReward ? arm : best
  );
  const isExploration = bestArm.armId !== empiricalBest.armId;

  return {
    armId: bestArm.armId,
    probability: bestSample,
    isExploration,
    reason: 'thompson_sampling',
    metadata: {
      samples,
      empiricalBestArm: empiricalBest.armId,
      empiricalBestMean: empiricalBest.meanReward,
      selectedSample: bestSample,
    },
  };
}

/**
 * Update Thompson Sampling state with reward
 *
 * Updates Beta distribution parameters:
 * - Success (reward = 1): α = α + 1
 * - Failure (reward = 0): β = β + 1
 * - Partial reward (0 < reward < 1): weighted update
 *
 * For continuous rewards, we normalize to [0,1] range.
 *
 * Time Complexity: O(k) where k = number of arms
 *
 * @param state - Current state
 * @param reward - Reward event
 * @returns Updated state
 */
export function updateThompsonSampling(
  state: ThompsonSamplingState,
  reward: RewardEvent
): ThompsonSamplingState {
  // Find arm to update
  const armIndex = state.arms.findIndex((arm) => arm.armId === reward.armId);

  if (armIndex === -1) {
    throw new Error(`Arm ${reward.armId} not found in state`);
  }

  // Validate reward
  if (reward.reward < 0 || reward.reward > 1) {
    throw new Error('Reward must be in [0, 1] for Thompson Sampling');
  }

  // Clone state for immutability
  const newArms = [...state.arms];
  const arm = { ...newArms[armIndex] };

  // Update statistics
  arm.count += 1;
  arm.totalReward += reward.reward;
  arm.meanReward = arm.totalReward / arm.count;

  // Update Beta parameters
  // For binary: success adds to alpha, failure adds to beta
  // For continuous: weighted update
  arm.alpha += reward.reward;
  arm.beta += (1 - reward.reward);

  newArms[armIndex] = arm;

  return {
    ...state,
    arms: newArms,
    totalTrials: state.totalTrials + 1,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate probability that each arm is best
 *
 * Uses Monte Carlo sampling to estimate:
 * P(arm i is best) ≈ frequency that θᵢ is maximum in samples
 *
 * Time Complexity: O(k * n) where k = arms, n = samples
 *
 * @param state - Current state
 * @param numSamples - Number of Monte Carlo samples (default: 10000)
 * @returns Probability that each arm is best
 */
export function calculateBestArmProbabilities(
  state: ThompsonSamplingState,
  numSamples: number = 10000
): Record<string, number> {
  const counts: Record<string, number> = {};

  // Initialize counts
  for (const arm of state.arms) {
    counts[arm.armId] = 0;
  }

  // Monte Carlo sampling
  for (let i = 0; i < numSamples; i++) {
    let bestArm: ThompsonSamplingArm | null = null;
    let bestSample = -Infinity;

    // Sample from each posterior
    for (const arm of state.arms) {
      const sample = sampleBeta(arm.alpha, arm.beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }

    if (bestArm) {
      counts[bestArm.armId]++;
    }
  }

  // Convert counts to probabilities
  const probabilities: Record<string, number> = {};
  for (const armId in counts) {
    probabilities[armId] = counts[armId] / numSamples;
  }

  return probabilities;
}

/**
 * Calculate expected reward for each arm
 *
 * For Beta(α, β), expected value is α / (α + β)
 *
 * @param state - Current state
 * @returns Expected reward for each arm
 */
export function calculateExpectedRewards(
  state: ThompsonSamplingState
): Record<string, number> {
  const expected: Record<string, number> = {};

  for (const arm of state.arms) {
    expected[arm.armId] = arm.alpha / (arm.alpha + arm.beta);
  }

  return expected;
}

/**
 * Calculate credible intervals for each arm
 *
 * Returns 95% credible interval using Beta distribution quantiles
 *
 * @param state - Current state
 * @param confidence - Confidence level (default: 0.95)
 * @returns Credible intervals for each arm
 */
export function calculateCredibleIntervals(
  state: ThompsonSamplingState,
  confidence: number = 0.95
): Record<string, { lower: number; upper: number }> {
  const intervals: Record<string, { lower: number; upper: number }> = {};
  const alpha = (1 - confidence) / 2;

  for (const arm of state.arms) {
    // For Beta distribution, use quantile function
    // Approximate using inverse CDF sampling
    const samples = [];
    for (let i = 0; i < 10000; i++) {
      samples.push(sampleBeta(arm.alpha, arm.beta));
    }
    samples.sort((a, b) => a - b);

    const lowerIndex = Math.floor(alpha * samples.length);
    const upperIndex = Math.floor((1 - alpha) * samples.length);

    intervals[arm.armId] = {
      lower: samples[lowerIndex],
      upper: samples[upperIndex],
    };
  }

  return intervals;
}

/**
 * Export all Thompson Sampling functions
 */
export const ThompsonSampling = {
  initialize: initializeThompsonSampling,
  selectArm: selectArmThompsonSampling,
  update: updateThompsonSampling,
  calculateBestArmProbabilities,
  calculateExpectedRewards,
  calculateCredibleIntervals,
  sampleBeta,
  sampleGamma,
  sampleNormal,
};
