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

// Algorithm implementations
export * from './thompson-sampling';
export * from './epsilon-greedy';
export * from './ucb';

// Reward tracking
export * from './reward-tracker';
