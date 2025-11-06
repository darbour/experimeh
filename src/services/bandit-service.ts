/**
 * Bandit Service
 *
 * High-level service for managing multi-armed bandit experiments.
 * Integrates bandit algorithms with experiment infrastructure.
 *
 * Responsibilities:
 * - Initialize bandit state for experiments
 * - Select variants using bandit algorithms
 * - Process reward events
 * - Calculate performance metrics
 * - Manage warmup periods
 * - Persist and retrieve bandit state
 *
 * Usage:
 * ```typescript
 * const banditService = new BanditService({ storage, logger });
 *
 * // Initialize bandit experiment
 * await banditService.initializeBandit('exp-123', {
 *   algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
 *   armIds: ['control', 'variant-a', 'variant-b']
 * });
 *
 * // Select variant
 * const selection = await banditService.selectVariant('exp-123');
 *
 * // Record reward
 * await banditService.recordReward('exp-123', 'variant-a', 1.0);
 *
 * // Get metrics
 * const metrics = await banditService.getMetrics('exp-123');
 * ```
 */

import {
  BanditAlgorithm,
  BanditConfig,
  BanditState,
  BanditMetrics,
  ArmSelectionResult,
  RewardEvent,
  ArmStatistics,
  WarmupConfig,
  isThompsonSamplingConfig,
  isEpsilonGreedyConfig,
  isUCBConfig,
  isThompsonSamplingState,
  isEpsilonGreedyState,
  isUCBState,
} from '../core/bandits';

import { ThompsonSampling } from '../core/bandits/thompson-sampling';
import { EpsilonGreedy } from '../core/bandits/epsilon-greedy';
import { UCB } from '../core/bandits/ucb';
import {
  RewardTracker,
  RewardTrackerState,
  createRewardTracker,
  trackReward,
  getArmStatistics as getTrackerArmStats,
  calculateCumulativeRegret,
  calculateSimpleRegret,
} from '../core/bandits/reward-tracker';

/**
 * Storage interface for persisting bandit state
 */
export interface IBanditStorage {
  getBanditState(experimentId: string): Promise<BanditState | null>;
  saveBanditState(experimentId: string, state: BanditState): Promise<void>;
  getRewardTracker(experimentId: string): Promise<RewardTrackerState | null>;
  saveRewardTracker(experimentId: string, tracker: RewardTrackerState): Promise<void>;
  getWarmupConfig(experimentId: string): Promise<WarmupConfig | null>;
  saveWarmupConfig(experimentId: string, config: WarmupConfig): Promise<void>;
}

/**
 * Logger interface
 */
export interface IBanditLogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Service configuration
 */
export interface BanditServiceConfig {
  storage: IBanditStorage;
  logger: IBanditLogger;
  /** Default warmup trials per arm (0 = no warmup) */
  defaultWarmupTrials?: number;
  /** Cache TTL in seconds */
  cacheTTL?: number;
}

/**
 * Initialization options
 */
export interface InitializeBanditOptions {
  /** Bandit algorithm configuration */
  config: BanditConfig;
  /** Arm identifiers (variant keys) */
  armIds: string[];
  /** Warmup configuration */
  warmup?: {
    trialsPerArm: number;
  };
}

/**
 * Bandit Service Implementation
 */
export class BanditService {
  private storage: IBanditStorage;
  private logger: IBanditLogger;
  private defaultWarmupTrials: number;
  private stateCache: Map<string, { state: BanditState; timestamp: number }>;
  private trackerCache: Map<string, { tracker: RewardTrackerState; timestamp: number }>;
  private cacheTTL: number;

  constructor(config: BanditServiceConfig) {
    this.storage = config.storage;
    this.logger = config.logger;
    this.defaultWarmupTrials = config.defaultWarmupTrials ?? 10;
    this.cacheTTL = (config.cacheTTL ?? 300) * 1000; // Convert to ms
    this.stateCache = new Map();
    this.trackerCache = new Map();
  }

  /**
   * Initialize bandit for experiment
   *
   * Creates initial bandit state and reward tracker
   */
  async initializeBandit(
    experimentId: string,
    options: InitializeBanditOptions
  ): Promise<void> {
    this.logger.info('Initializing bandit', { experimentId, config: options.config });

    try {
      // Initialize bandit state based on algorithm
      let state: BanditState;

      if (isThompsonSamplingConfig(options.config)) {
        state = ThompsonSampling.initialize(options.armIds, options.config);
      } else if (isEpsilonGreedyConfig(options.config)) {
        state = EpsilonGreedy.initialize(options.armIds, options.config);
      } else if (isUCBConfig(options.config)) {
        state = UCB.initialize(options.armIds, options.config);
      } else {
        throw new Error(`Unsupported algorithm: ${options.config.algorithm}`);
      }

      // Initialize reward tracker
      const tracker = createRewardTracker(
        experimentId,
        options.armIds,
        options.config.algorithm
      );

      // Initialize warmup config
      const warmupTrials = options.warmup?.trialsPerArm ?? this.defaultWarmupTrials;
      const warmup: WarmupConfig = {
        trialsPerArm: warmupTrials,
        complete: warmupTrials === 0,
        trialsRemaining: warmupTrials * options.armIds.length,
      };

      // Save to storage
      await this.storage.saveBanditState(experimentId, state);
      await this.storage.saveRewardTracker(experimentId, tracker);
      await this.storage.saveWarmupConfig(experimentId, warmup);

      // Update cache
      this.stateCache.set(experimentId, { state, timestamp: Date.now() });
      this.trackerCache.set(experimentId, { tracker, timestamp: Date.now() });

      this.logger.info('Bandit initialized successfully', { experimentId });
    } catch (error) {
      this.logger.error('Failed to initialize bandit', { experimentId, error });
      throw error;
    }
  }

  /**
   * Select variant using bandit algorithm
   *
   * Handles warmup period with uniform random selection
   */
  async selectVariant(experimentId: string): Promise<ArmSelectionResult> {
    this.logger.debug('Selecting variant', { experimentId });

    try {
      const state = await this.getBanditState(experimentId);
      const warmup = await this.storage.getWarmupConfig(experimentId);

      // Warmup period: random selection
      if (warmup && !warmup.complete) {
        return this.selectWarmupArm(state, warmup);
      }

      // Use bandit algorithm
      return this.selectArmByAlgorithm(state);
    } catch (error) {
      this.logger.error('Failed to select variant', { experimentId, error });
      throw error;
    }
  }

  /**
   * Record reward for selected arm
   *
   * Updates bandit state and reward tracker
   */
  async recordReward(
    experimentId: string,
    armId: string,
    reward: number,
    unitId?: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    this.logger.debug('Recording reward', { experimentId, armId, reward });

    try {
      const state = await this.getBanditState(experimentId);
      const tracker = await this.getRewardTracker(experimentId);

      // Create reward event
      const rewardEvent: RewardEvent = {
        experimentId,
        armId,
        reward,
        timestamp: new Date(),
        unitId: unitId ?? 'unknown',
        context,
      };

      // Update bandit state
      const newState = this.updateStateWithReward(state, rewardEvent);

      // Update reward tracker
      const newTracker = trackReward(tracker, rewardEvent);

      // Update warmup status
      const warmup = await this.storage.getWarmupConfig(experimentId);
      if (warmup && !warmup.complete) {
        const newWarmup = {
          ...warmup,
          trialsRemaining: warmup.trialsRemaining - 1,
          complete: warmup.trialsRemaining <= 1,
        };
        await this.storage.saveWarmupConfig(experimentId, newWarmup);
      }

      // Save to storage
      await this.storage.saveBanditState(experimentId, newState);
      await this.storage.saveRewardTracker(experimentId, newTracker);

      // Update cache
      this.stateCache.set(experimentId, { state: newState, timestamp: Date.now() });
      this.trackerCache.set(experimentId, { tracker: newTracker, timestamp: Date.now() });

      this.logger.debug('Reward recorded successfully', { experimentId, armId });
    } catch (error) {
      this.logger.error('Failed to record reward', { experimentId, armId, error });
      throw error;
    }
  }

  /**
   * Get bandit state
   */
  async getBanditState(experimentId: string): Promise<BanditState> {
    // Check cache
    const cached = this.stateCache.get(experimentId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.state;
    }

    // Load from storage
    const state = await this.storage.getBanditState(experimentId);
    if (!state) {
      throw new Error(`Bandit not initialized for experiment ${experimentId}`);
    }

    // Update cache
    this.stateCache.set(experimentId, { state, timestamp: Date.now() });

    return state;
  }

  /**
   * Get reward tracker
   */
  async getRewardTracker(experimentId: string): Promise<RewardTrackerState> {
    // Check cache
    const cached = this.trackerCache.get(experimentId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.tracker;
    }

    // Load from storage
    const tracker = await this.storage.getRewardTracker(experimentId);
    if (!tracker) {
      throw new Error(`Reward tracker not found for experiment ${experimentId}`);
    }

    // Update cache
    this.trackerCache.set(experimentId, { tracker, timestamp: Date.now() });

    return tracker;
  }

  /**
   * Get arm statistics
   */
  async getArmStatistics(experimentId: string): Promise<ArmStatistics[]> {
    const tracker = await this.getRewardTracker(experimentId);
    return getTrackerArmStats(tracker);
  }

  /**
   * Get performance metrics
   */
  async getMetrics(
    experimentId: string,
    optimalArmId?: string
  ): Promise<BanditMetrics> {
    const state = await this.getBanditState(experimentId);
    const tracker = await this.getRewardTracker(experimentId);

    // Calculate metrics based on algorithm
    const armStats = getTrackerArmStats(tracker);

    // Find best arm
    const bestArm = armStats.reduce((best, arm) =>
      arm.meanReward > best.meanReward ? arm : best
    );

    // Calculate regret if optimal arm is known
    let cumulativeRegret = 0;
    let simpleRegret = 0;

    if (optimalArmId) {
      cumulativeRegret = calculateCumulativeRegret(tracker, optimalArmId);
      simpleRegret = calculateSimpleRegret(tracker, optimalArmId);
    }

    // Calculate best arm probabilities
    let bestArmProbability: Record<string, number> = {};

    if (isThompsonSamplingState(state)) {
      bestArmProbability = ThompsonSampling.calculateBestArmProbabilities(state);
    } else {
      // For other algorithms, estimate based on current performance
      const totalMean = armStats.reduce((sum, arm) => sum + arm.meanReward, 0);
      armStats.forEach((arm) => {
        bestArmProbability[arm.armId] = totalMean > 0 ? arm.meanReward / totalMean : 1 / armStats.length;
      });
    }

    // Calculate exploration rate
    let explorationRate = 0;
    if (isEpsilonGreedyState(state)) {
      explorationRate = state.epsilon;
    } else if (isUCBState(state)) {
      // UCB exploration decreases over time
      explorationRate = state.arms.some(arm => arm.count === 0) ? 1.0 : 0.1;
    } else {
      // Thompson Sampling inherently explores
      explorationRate = 0.5;
    }

    // Check convergence
    const convergence = this.checkConvergence(state, tracker);

    return {
      totalTrials: state.totalTrials,
      numArms: state.arms.length,
      cumulativeRegret,
      simpleRegret,
      bestArmProbability,
      explorationRate,
      convergence,
      armMetrics: armStats,
    };
  }

  /**
   * Check if bandit has converged
   */
  private checkConvergence(
    state: BanditState,
    tracker: RewardTrackerState
  ): { converged: boolean; trialsToConverge?: number; confidence: number } {
    // Simple convergence check: best arm has high probability
    let confidence = 0;

    if (isThompsonSamplingState(state)) {
      const probabilities = ThompsonSampling.calculateBestArmProbabilities(state, 1000);
      confidence = Math.max(...Object.values(probabilities));
    } else {
      // For other algorithms, use confidence intervals
      const armStats = getTrackerArmStats(tracker);
      if (armStats.length > 0) {
        const bestArm = armStats.reduce((best, arm) =>
          arm.meanReward > best.meanReward ? arm : best
        );
        const secondBest = armStats
          .filter(arm => arm.armId !== bestArm.armId)
          .reduce((best, arm) => arm.meanReward > best.meanReward ? arm : best, armStats[0]);

        // Confidence based on separation between best and second best
        const separation = bestArm.meanReward - secondBest.meanReward;
        const combinedError = bestArm.standardError + secondBest.standardError;
        confidence = combinedError > 0 ? Math.min(1, separation / (2 * combinedError)) : 0;
      }
    }

    const converged = confidence > 0.95 && state.totalTrials >= 100;

    return {
      converged,
      trialsToConverge: converged ? state.totalTrials : undefined,
      confidence,
    };
  }

  /**
   * Select arm during warmup period
   */
  private selectWarmupArm(
    state: BanditState,
    warmup: WarmupConfig
  ): ArmSelectionResult {
    // Find arm with fewest trials (ensure balanced warmup)
    const armCounts = state.arms.map(arm => ({ armId: arm.armId, count: arm.count }));
    const minCount = Math.min(...armCounts.map(a => a.count));
    const candidateArms = armCounts.filter(a => a.count === minCount);

    // Random selection among candidates
    const selectedArm = candidateArms[Math.floor(Math.random() * candidateArms.length)];

    return {
      armId: selectedArm.armId,
      probability: 1 / candidateArms.length,
      isExploration: true,
      reason: 'warmup',
      metadata: {
        trialsRemaining: warmup.trialsRemaining,
        warmupComplete: warmup.complete,
      },
    };
  }

  /**
   * Select arm using bandit algorithm
   */
  private selectArmByAlgorithm(state: BanditState): ArmSelectionResult {
    if (isThompsonSamplingState(state)) {
      return ThompsonSampling.selectArm(state);
    } else if (isEpsilonGreedyState(state)) {
      return EpsilonGreedy.selectArm(state);
    } else if (isUCBState(state)) {
      return UCB.selectArm(state);
    } else {
      throw new Error(`Unknown bandit algorithm`);
    }
  }

  /**
   * Update state with reward
   */
  private updateStateWithReward(
    state: BanditState,
    reward: RewardEvent
  ): BanditState {
    if (isThompsonSamplingState(state)) {
      return ThompsonSampling.update(state, reward);
    } else if (isEpsilonGreedyState(state)) {
      return EpsilonGreedy.update(state, reward);
    } else if (isUCBState(state)) {
      return UCB.update(state, reward);
    } else {
      throw new Error(`Unknown bandit algorithm`);
    }
  }

  /**
   * Clear cache for experiment
   */
  clearCache(experimentId: string): void {
    this.stateCache.delete(experimentId);
    this.trackerCache.delete(experimentId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.stateCache.clear();
    this.trackerCache.clear();
  }
}
