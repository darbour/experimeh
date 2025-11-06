/**
 * Thompson Sampling Tests
 *
 * Tests for Thompson Sampling bandit algorithm including:
 * - Initialization
 * - Arm selection
 * - State updates
 * - Statistical properties
 * - Convergence
 */

import {
  ThompsonSampling,
  BanditAlgorithm,
  RewardEvent,
  ThompsonSamplingState,
} from '../../../../src/core/bandits';

describe('Thompson Sampling', () => {
  const armIds = ['control', 'variant-a', 'variant-b'];

  describe('Initialization', () => {
    it('should initialize with correct structure', () => {
      const state = ThompsonSampling.initialize(armIds);

      expect(state.algorithm).toBe(BanditAlgorithm.THOMPSON_SAMPLING);
      expect(state.arms).toHaveLength(3);
      expect(state.totalTrials).toBe(0);
      expect(state.lastUpdated).toBeInstanceOf(Date);
    });

    it('should initialize arms with priors', () => {
      const state = ThompsonSampling.initialize(armIds);

      state.arms.forEach(arm => {
        expect(arm.alpha).toBe(1); // Default prior
        expect(arm.beta).toBe(1);
        expect(arm.count).toBe(0);
        expect(arm.totalReward).toBe(0);
        expect(arm.meanReward).toBe(0);
      });
    });

    it('should accept custom priors', () => {
      const state = ThompsonSampling.initialize(armIds, {
        algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
        priorAlpha: 2,
        priorBeta: 3,
      });

      state.arms.forEach(arm => {
        expect(arm.alpha).toBe(2);
        expect(arm.beta).toBe(3);
      });
    });

    it('should throw error for less than 2 arms', () => {
      expect(() => {
        ThompsonSampling.initialize(['single-arm']);
      }).toThrow('at least 2 arms');
    });

    it('should throw error for invalid priors', () => {
      expect(() => {
        ThompsonSampling.initialize(armIds, {
          algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
          priorAlpha: 0,
          priorBeta: 1,
        });
      }).toThrow('positive');
    });
  });

  describe('Arm Selection', () => {
    it('should select an arm', () => {
      const state = ThompsonSampling.initialize(armIds);
      const selection = ThompsonSampling.selectArm(state);

      expect(armIds).toContain(selection.armId);
      expect(selection.probability).toBeGreaterThan(0);
      expect(typeof selection.isExploration).toBe('boolean');
      expect(selection.reason).toBe('thompson_sampling');
    });

    it('should select each arm roughly equally with uniform priors', () => {
      const state = ThompsonSampling.initialize(armIds);
      const selections: Record<string, number> = {
        'control': 0,
        'variant-a': 0,
        'variant-b': 0,
      };

      // Run many selections
      for (let i = 0; i < 3000; i++) {
        const selection = ThompsonSampling.selectArm(state);
        selections[selection.armId]++;
      }

      // With uniform priors, each arm should be selected ~33% of time
      // Allow 5% tolerance
      Object.values(selections).forEach(count => {
        expect(count).toBeGreaterThan(900); // > 30%
        expect(count).toBeLessThan(1100); // < 37%
      });
    });

    it('should favor arms with higher alpha', () => {
      const state = ThompsonSampling.initialize(armIds);

      // Manually set one arm to have much higher alpha (more successes)
      state.arms[1].alpha = 100;
      state.arms[1].beta = 10;

      const selections: Record<string, number> = {
        'control': 0,
        'variant-a': 0,
        'variant-b': 0,
      };

      for (let i = 0; i < 1000; i++) {
        const selection = ThompsonSampling.selectArm(state);
        selections[selection.armId]++;
      }

      // variant-a should be selected most often
      expect(selections['variant-a']).toBeGreaterThan(selections['control']);
      expect(selections['variant-a']).toBeGreaterThan(selections['variant-b']);
    });

    it('should throw error when no arms available', () => {
      const state: ThompsonSamplingState = {
        algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
        arms: [],
        totalTrials: 0,
        lastUpdated: new Date(),
      };

      expect(() => {
        ThompsonSampling.selectArm(state);
      }).toThrow('No arms available');
    });
  });

  describe('State Updates', () => {
    it('should update arm with success (reward = 1)', () => {
      let state = ThompsonSampling.initialize(armIds);
      const initialAlpha = state.arms[0].alpha;
      const initialBeta = state.arms[0].beta;

      const reward: RewardEvent = {
        experimentId: 'test',
        armId: 'control',
        reward: 1,
        timestamp: new Date(),
        unitId: 'user-1',
      };

      state = ThompsonSampling.update(state, reward);

      expect(state.arms[0].alpha).toBe(initialAlpha + 1);
      expect(state.arms[0].beta).toBe(initialBeta); // Beta unchanged for success
      expect(state.arms[0].count).toBe(1);
      expect(state.arms[0].totalReward).toBe(1);
      expect(state.arms[0].meanReward).toBe(1);
      expect(state.totalTrials).toBe(1);
    });

    it('should update arm with failure (reward = 0)', () => {
      let state = ThompsonSampling.initialize(armIds);
      const initialAlpha = state.arms[0].alpha;
      const initialBeta = state.arms[0].beta;

      const reward: RewardEvent = {
        experimentId: 'test',
        armId: 'control',
        reward: 0,
        timestamp: new Date(),
        unitId: 'user-1',
      };

      state = ThompsonSampling.update(state, reward);

      expect(state.arms[0].alpha).toBe(initialAlpha); // Alpha unchanged for failure
      expect(state.arms[0].beta).toBe(initialBeta + 1);
      expect(state.arms[0].count).toBe(1);
      expect(state.arms[0].totalReward).toBe(0);
      expect(state.arms[0].meanReward).toBe(0);
    });

    it('should handle partial rewards (0 < reward < 1)', () => {
      let state = ThompsonSampling.initialize(armIds);

      const reward: RewardEvent = {
        experimentId: 'test',
        armId: 'control',
        reward: 0.7,
        timestamp: new Date(),
        unitId: 'user-1',
      };

      state = ThompsonSampling.update(state, reward);

      expect(state.arms[0].alpha).toBeCloseTo(1.7);
      expect(state.arms[0].beta).toBeCloseTo(1.3);
    });

    it('should throw error for reward outside [0,1]', () => {
      const state = ThompsonSampling.initialize(armIds);

      expect(() => {
        ThompsonSampling.update(state, {
          experimentId: 'test',
          armId: 'control',
          reward: 1.5,
          timestamp: new Date(),
          unitId: 'user-1',
        });
      }).toThrow('Reward must be in [0, 1]');

      expect(() => {
        ThompsonSampling.update(state, {
          experimentId: 'test',
          armId: 'control',
          reward: -0.1,
          timestamp: new Date(),
          unitId: 'user-1',
        });
      }).toThrow('Reward must be in [0, 1]');
    });

    it('should throw error for unknown arm', () => {
      const state = ThompsonSampling.initialize(armIds);

      expect(() => {
        ThompsonSampling.update(state, {
          experimentId: 'test',
          armId: 'unknown-arm',
          reward: 1,
          timestamp: new Date(),
          unitId: 'user-1',
        });
      }).toThrow('not found');
    });

    it('should update mean reward correctly over multiple trials', () => {
      let state = ThompsonSampling.initialize(armIds);

      // Simulate 10 trials with 7 successes
      for (let i = 0; i < 10; i++) {
        const reward = i < 7 ? 1 : 0;
        state = ThompsonSampling.update(state, {
          experimentId: 'test',
          armId: 'control',
          reward,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      expect(state.arms[0].count).toBe(10);
      expect(state.arms[0].totalReward).toBe(7);
      expect(state.arms[0].meanReward).toBeCloseTo(0.7);
    });
  });

  describe('Statistical Functions', () => {
    it('should calculate best arm probabilities', () => {
      const state = ThompsonSampling.initialize(armIds);

      // Set different performance levels
      state.arms[0].alpha = 10;
      state.arms[0].beta = 90;  // ~10% success rate

      state.arms[1].alpha = 30;
      state.arms[1].beta = 70;  // ~30% success rate

      state.arms[2].alpha = 50;
      state.arms[2].beta = 50;  // ~50% success rate (best)

      const probabilities = ThompsonSampling.calculateBestArmProbabilities(state, 10000);

      // variant-b should have highest probability of being best
      expect(probabilities['variant-b']).toBeGreaterThan(probabilities['variant-a']);
      expect(probabilities['variant-b']).toBeGreaterThan(probabilities['control']);

      // Probabilities should sum to ~1
      const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);
    });

    it('should calculate expected rewards', () => {
      const state = ThompsonSampling.initialize(armIds);

      state.arms[0].alpha = 10;
      state.arms[0].beta = 40;  // Expected: 10/50 = 0.2

      state.arms[1].alpha = 30;
      state.arms[1].beta = 20;  // Expected: 30/50 = 0.6

      const expected = ThompsonSampling.calculateExpectedRewards(state);

      expect(expected['control']).toBeCloseTo(0.2);
      expect(expected['variant-a']).toBeCloseTo(0.6);
    });

    it('should calculate credible intervals', () => {
      const state = ThompsonSampling.initialize(armIds);

      state.arms[0].alpha = 50;
      state.arms[0].beta = 50;

      const intervals = ThompsonSampling.calculateCredibleIntervals(state);

      expect(intervals['control'].lower).toBeLessThan(0.5);
      expect(intervals['control'].upper).toBeGreaterThan(0.5);
      expect(intervals['control'].lower).toBeGreaterThan(0);
      expect(intervals['control'].upper).toBeLessThan(1);
    });
  });

  describe('Convergence', () => {
    it('should converge to best arm over time', () => {
      let state = ThompsonSampling.initialize(armIds);

      // True conversion rates
      const trueRates = {
        'control': 0.10,
        'variant-a': 0.30,  // Best arm
        'variant-b': 0.15,
      };

      const selections: Record<string, number> = {
        'control': 0,
        'variant-a': 0,
        'variant-b': 0,
      };

      // Run 500 trials
      for (let i = 0; i < 500; i++) {
        const selection = ThompsonSampling.selectArm(state);
        selections[selection.armId]++;

        const converted = Math.random() < trueRates[selection.armId as keyof typeof trueRates];
        state = ThompsonSampling.update(state, {
          experimentId: 'test',
          armId: selection.armId,
          reward: converted ? 1 : 0,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      // variant-a should be selected most often
      expect(selections['variant-a']).toBeGreaterThan(selections['control']);
      expect(selections['variant-a']).toBeGreaterThan(selections['variant-b']);

      // Best arm probability should be high for variant-a
      const probabilities = ThompsonSampling.calculateBestArmProbabilities(state);
      expect(probabilities['variant-a']).toBeGreaterThan(0.5);
    });

    it('should maintain exploration even after convergence', () => {
      let state = ThompsonSampling.initialize(armIds);

      // Give one arm strong performance
      state.arms[1].alpha = 100;
      state.arms[1].beta = 50;

      const selections: Record<string, number> = {
        'control': 0,
        'variant-a': 0,
        'variant-b': 0,
      };

      // Run selections
      for (let i = 0; i < 1000; i++) {
        const selection = ThompsonSampling.selectArm(state);
        selections[selection.armId]++;
      }

      // Best arm should dominate but others should still get some trials
      expect(selections['variant-a']).toBeGreaterThan(700);
      expect(selections['control']).toBeGreaterThan(0);
      expect(selections['variant-b']).toBeGreaterThan(0);
    });
  });

  describe('Sampling Functions', () => {
    it('should sample from Beta distribution', () => {
      const samples: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const sample = ThompsonSampling.sampleBeta(2, 5);
        samples.push(sample);
      }

      // Check samples are in [0, 1]
      samples.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      });

      // Check mean is approximately alpha/(alpha+beta)
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const expectedMean = 2 / (2 + 5);
      expect(mean).toBeCloseTo(expectedMean, 1);
    });

    it('should sample from Gamma distribution', () => {
      const samples: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const sample = ThompsonSampling.sampleGamma(2, 1);
        samples.push(sample);
      }

      // All samples should be positive
      samples.forEach(s => {
        expect(s).toBeGreaterThan(0);
      });

      // Mean should be approximately shape * scale = 2 * 1 = 2
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(mean).toBeGreaterThan(1);
      expect(mean).toBeLessThan(3);
    });

    it('should sample from Normal distribution', () => {
      const samples: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const sample = ThompsonSampling.sampleNormal(0, 1);
        samples.push(sample);
      }

      // Check mean is approximately 0
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(mean).toBeCloseTo(0, 0);

      // Check standard deviation is approximately 1
      const variance = samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev).toBeCloseTo(1, 0);
    });
  });
});
