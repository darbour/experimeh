/**
 * Multi-Armed Bandit Algorithms
 *
 * Exports all bandit-related functionality for adaptive experimentation.
 *
 * Available algorithms:
 * - Thompson Sampling: Bayesian approach with optimal exploration
 * - Epsilon-Greedy: Simple exploration-exploitation with decaying epsilon
 * - UCB: Confidence-based exploration without randomness
 *
 * Features:
 * - Production-ready implementations from scratch
 * - Full TypeScript type safety
 * - Reward tracking and statistics
 * - Performance metrics and regret calculation
 * - Integration with existing assignment service
 */

// Core types
export * from './bandit-types';

// Algorithm namespace objects (contain all methods)
export { ThompsonSampling } from './thompson-sampling';
export { EpsilonGreedy } from './epsilon-greedy';
export { UCB } from './ucb';

// Type guard functions
export {
  isThompsonSamplingConfig,
  isThompsonSamplingState,
  isEpsilonGreedyConfig,
  isEpsilonGreedyState,
  isUCBConfig,
  isUCBState,
} from './bandit-types';

// Reward tracking
export {
  createRewardTracker,
  trackReward,
  getArmStatistics,
  calculateCumulativeRegret,
  calculateSimpleRegret,
  type RewardTrackerState,
  type RewardTracker,
} from './reward-tracker';
