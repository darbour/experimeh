/**
 * Epsilon-Greedy Tests
 */

import {
  EpsilonGreedy,
  BanditAlgorithm,
  RewardEvent,
} from '../../../../src/core/bandits';

describe('Epsilon-Greedy', () => {
  const armIds = ['arm-1', 'arm-2', 'arm-3'];

  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const state = EpsilonGreedy.initialize(armIds);

      expect(state.algorithm).toBe(BanditAlgorithm.EPSILON_GREEDY);
      expect(state.arms).toHaveLength(3);
      expect(state.epsilon).toBe(0.1);
      expect(state.initialEpsilon).toBe(0.1);
      expect(state.decayRate).toBe(0.99);
      expect(state.minEpsilon).toBe(0.01);
      expect(state.totalTrials).toBe(0);
    });

    it('should initialize with custom parameters', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.3,
        decayRate: 0.95,
        minEpsilon: 0.05,
      });

      expect(state.epsilon).toBe(0.3);
      expect(state.decayRate).toBe(0.95);
      expect(state.minEpsilon).toBe(0.05);
    });

    it('should throw error for invalid epsilon', () => {
      expect(() => {
        EpsilonGreedy.initialize(armIds, {
          algorithm: BanditAlgorithm.EPSILON_GREEDY,
          epsilon: 1.5,
        });
      }).toThrow('Epsilon must be in [0, 1]');
    });
  });

  describe('Arm Selection', () => {
    it('should select best arm when not exploring', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0, // Never explore
      });

      // Set clear best arm
      state.arms[1].count = 10;
      state.arms[1].meanReward = 0.8;
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.2;
      state.arms[2].count = 10;
      state.arms[2].meanReward = 0.3;

      const selections: Record<string, number> = {
        'arm-1': 0,
        'arm-2': 0,
        'arm-3': 0,
      };

      for (let i = 0; i < 100; i++) {
        const selection = EpsilonGreedy.selectArm(state);
        selections[selection.armId]++;
      }

      // Should always select arm-2 (best)
      expect(selections['arm-2']).toBe(100);
    });

    it('should explore uniformly when epsilon = 1', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 1, // Always explore
      });

      const selections: Record<string, number> = {
        'arm-1': 0,
        'arm-2': 0,
        'arm-3': 0,
      };

      for (let i = 0; i < 3000; i++) {
        const selection = EpsilonGreedy.selectArm(state);
        selections[selection.armId]++;
      }

      // Should be roughly uniform (±5%)
      Object.values(selections).forEach(count => {
        expect(count).toBeGreaterThan(900);
        expect(count).toBeLessThan(1100);
      });
    });

    it('should prioritize untried arms', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0,
      });

      // Mark two arms as tried
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.5;
      state.arms[1].count = 10;
      state.arms[1].meanReward = 0.6;

      // arm-3 is untried
      const selections: Record<string, number> = {
        'arm-1': 0,
        'arm-2': 0,
        'arm-3': 0,
      };

      for (let i = 0; i < 100; i++) {
        const selection = EpsilonGreedy.selectArm(state);
        selections[selection.armId]++;
      }

      // Should always select untried arm
      expect(selections['arm-3']).toBe(100);
    });
  });

  describe('State Updates', () => {
    it('should update arm statistics', () => {
      let state = EpsilonGreedy.initialize(armIds);

      const reward: RewardEvent = {
        experimentId: 'test',
        armId: 'arm-1',
        reward: 0.7,
        timestamp: new Date(),
        unitId: 'user-1',
      };

      state = EpsilonGreedy.update(state, reward);

      expect(state.arms[0].count).toBe(1);
      expect(state.arms[0].totalReward).toBe(0.7);
      expect(state.arms[0].meanReward).toBe(0.7);
      expect(state.totalTrials).toBe(1);
    });

    it('should decay epsilon', () => {
      let state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.5,
        decayRate: 0.9,
        minEpsilon: 0.01,
      });

      const initialEpsilon = state.epsilon;

      state = EpsilonGreedy.update(state, {
        experimentId: 'test',
        armId: 'arm-1',
        reward: 1,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      expect(state.epsilon).toBe(initialEpsilon * 0.9);
    });

    it('should not decay below min epsilon', () => {
      let state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.02,
        decayRate: 0.5,
        minEpsilon: 0.01,
      });

      state = EpsilonGreedy.update(state, {
        experimentId: 'test',
        armId: 'arm-1',
        reward: 1,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      expect(state.epsilon).toBe(0.01);
    });

    it('should update mean incrementally', () => {
      let state = EpsilonGreedy.initialize(armIds);

      // Add multiple rewards
      for (let i = 0; i < 5; i++) {
        state = EpsilonGreedy.update(state, {
          experimentId: 'test',
          armId: 'arm-1',
          reward: i * 0.2, // 0, 0.2, 0.4, 0.6, 0.8
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      expect(state.arms[0].count).toBe(5);
      expect(state.arms[0].meanReward).toBeCloseTo(0.4); // Mean of [0, 0.2, 0.4, 0.6, 0.8]
    });
  });

  describe('Helper Functions', () => {
    it('should get exploration rate', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.15,
      });

      expect(EpsilonGreedy.getExplorationRate(state)).toBe(0.15);
    });

    it('should calculate selection probabilities', () => {
      const state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.3,
      });

      // Set best arm
      state.arms[1].count = 10;
      state.arms[1].meanReward = 0.8;
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.2;
      state.arms[2].count = 10;
      state.arms[2].meanReward = 0.3;

      const probs = EpsilonGreedy.calculateSelectionProbabilities(state);

      // P(best) = 0.3/3 + 0.7 = 0.8
      // P(other) = 0.3/3 = 0.1
      expect(probs['arm-2']).toBeCloseTo(0.8);
      expect(probs['arm-1']).toBeCloseTo(0.1);
      expect(probs['arm-3']).toBeCloseTo(0.1);
    });

    it('should get arm statistics', () => {
      const state = EpsilonGreedy.initialize(armIds);

      state.arms[0].count = 100;
      state.arms[0].meanReward = 0.5;

      const stats = EpsilonGreedy.getArmStatistics(state);

      expect(stats[0].armId).toBe('arm-1');
      expect(stats[0].count).toBe(100);
      expect(stats[0].meanReward).toBe(0.5);
      expect(stats[0].standardError).toBeGreaterThan(0);
      expect(stats[0].confidenceInterval.lower).toBeLessThan(0.5);
      expect(stats[0].confidenceInterval.upper).toBeGreaterThan(0.5);
    });

    it('should reset epsilon', () => {
      let state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.3,
      });

      // Decay epsilon
      state.epsilon = 0.1;

      state = EpsilonGreedy.resetEpsilon(state);

      expect(state.epsilon).toBe(0.3); // Back to initial
    });

    it('should set epsilon', () => {
      let state = EpsilonGreedy.initialize(armIds);

      state = EpsilonGreedy.setEpsilon(state, 0.25);

      expect(state.epsilon).toBe(0.25);
    });
  });

  describe('Convergence', () => {
    it('should converge to best arm', () => {
      let state = EpsilonGreedy.initialize(armIds, {
        algorithm: BanditAlgorithm.EPSILON_GREEDY,
        epsilon: 0.1,
        decayRate: 0.995,
      });

      const trueRates = {
        'arm-1': 0.2,
        'arm-2': 0.5, // Best
        'arm-3': 0.3,
      };

      const selections: Record<string, number> = {
        'arm-1': 0,
        'arm-2': 0,
        'arm-3': 0,
      };

      for (let i = 0; i < 500; i++) {
        const selection = EpsilonGreedy.selectArm(state);
        selections[selection.armId]++;

        const reward = Math.random() < trueRates[selection.armId as keyof typeof trueRates] ? 1 : 0;
        state = EpsilonGreedy.update(state, {
          experimentId: 'test',
          armId: selection.armId,
          reward,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      // Best arm should be selected most
      expect(selections['arm-2']).toBeGreaterThan(selections['arm-1']);
      expect(selections['arm-2']).toBeGreaterThan(selections['arm-3']);

      // Epsilon should have decayed
      expect(state.epsilon).toBeLessThan(0.1);
    });
  });
});
