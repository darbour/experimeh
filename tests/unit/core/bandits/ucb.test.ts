/**
 * UCB (Upper Confidence Bound) Tests
 */

import {
  UCB,
  BanditAlgorithm,
  RewardEvent,
} from '../../../../src/core/bandits';

describe('UCB', () => {
  const armIds = ['x', 'y', 'z'];

  describe('Initialization', () => {
    it('should initialize with defaults', () => {
      const state = UCB.initialize(armIds);

      expect(state.algorithm).toBe(BanditAlgorithm.UCB);
      expect(state.arms).toHaveLength(3);
      expect(state.explorationParam).toBe(2);
      expect(state.totalTrials).toBe(0);
    });

    it('should initialize untried arms with infinite UCB', () => {
      const state = UCB.initialize(armIds);

      state.arms.forEach(arm => {
        expect(arm.ucbValue).toBe(Infinity);
        expect(arm.count).toBe(0);
      });
    });

    it('should accept custom exploration parameter', () => {
      const state = UCB.initialize(armIds, {
        algorithm: BanditAlgorithm.UCB,
        explorationParam: 1.5,
      });

      expect(state.explorationParam).toBe(1.5);
    });

    it('should throw error for non-positive exploration param', () => {
      expect(() => {
        UCB.initialize(armIds, {
          algorithm: BanditAlgorithm.UCB,
          explorationParam: 0,
        });
      }).toThrow('positive');
    });
  });

  describe('UCB Calculation', () => {
    it('should return infinity for untried arms', () => {
      const state = UCB.initialize(armIds);
      const ucb = UCB.calculateUCB(state.arms[0], 10, 2);

      expect(ucb).toBe(Infinity);
    });

    it('should calculate UCB correctly', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.5;
      state.totalTrials = 100;

      const ucb = UCB.calculateUCB(state.arms[0], 100, 2);

      // UCB = 0.5 + 2 * sqrt(ln(100) / 10)
      const expected = 0.5 + 2 * Math.sqrt(Math.log(100) / 10);

      expect(ucb).toBeCloseTo(expected, 5);
    });

    it('should increase UCB with fewer trials', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].meanReward = 0.5;
      state.totalTrials = 100;

      // Same mean, different counts
      state.arms[0].count = 5;
      const ucb1 = UCB.calculateUCB(state.arms[0], 100, 2);

      state.arms[0].count = 50;
      const ucb2 = UCB.calculateUCB(state.arms[0], 100, 2);

      // Less-tried arm should have higher UCB
      expect(ucb1).toBeGreaterThan(ucb2);
    });
  });

  describe('Arm Selection', () => {
    it('should select untried arms first', () => {
      const state = UCB.initialize(armIds);

      // Mark some arms as tried
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.8;
      state.arms[0].ucbValue = 0.9;

      const selections: Record<string, number> = { 'x': 0, 'y': 0, 'z': 0 };

      // Should select untried arms (y and z) before tried arms
      for (let i = 0; i < 100; i++) {
        const selection = UCB.selectArm(state);
        selections[selection.armId]++;

        // Don't update state, keep some arms untried
        if (selection.armId !== 'x') break;
      }

      // Should select an untried arm
      expect(selections['y'] + selections['z']).toBeGreaterThan(0);
    });

    it('should select arm with highest UCB', () => {
      const state = UCB.initialize(armIds);

      // Set UCB values manually
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.5;
      state.arms[0].ucbValue = 0.7;

      state.arms[1].count = 10;
      state.arms[1].meanReward = 0.4;
      state.arms[1].ucbValue = 0.9; // Highest UCB

      state.arms[2].count = 10;
      state.arms[2].meanReward = 0.3;
      state.arms[2].ucbValue = 0.6;

      state.totalTrials = 30;

      const selections: Record<string, number> = { 'x': 0, 'y': 0, 'z': 0 };

      // Select multiple times
      for (let i = 0; i < 100; i++) {
        const selection = UCB.selectArm(state);
        selections[selection.armId]++;
      }

      // Should always select 'y' (highest UCB)
      expect(selections['y']).toBe(100);
    });

    it('should mark exploration correctly', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].count = 50;
      state.arms[0].meanReward = 0.8; // Empirically best
      state.arms[0].ucbValue = 0.85;

      state.arms[1].count = 5;
      state.arms[1].meanReward = 0.6;
      state.arms[1].ucbValue = 0.9; // Higher UCB due to fewer trials

      state.arms[2].count = 10;
      state.arms[2].meanReward = 0.5;
      state.arms[2].ucbValue = 0.7;

      state.totalTrials = 65;

      const selection = UCB.selectArm(state);

      // Should select 'y' (highest UCB)
      expect(selection.armId).toBe('y');
      // Should mark as exploration (not empirically best)
      expect(selection.isExploration).toBe(true);
    });
  });

  describe('State Updates', () => {
    it('should update arm statistics', () => {
      let state = UCB.initialize(armIds);

      state = UCB.update(state, {
        experimentId: 'test',
        armId: 'x',
        reward: 0.8,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      expect(state.arms[0].count).toBe(1);
      expect(state.arms[0].totalReward).toBe(0.8);
      expect(state.arms[0].meanReward).toBe(0.8);
      expect(state.totalTrials).toBe(1);
    });

    it('should recalculate UCB values', () => {
      let state = UCB.initialize(armIds);

      // Initial UCB is infinity for all untried arms
      expect(state.arms[0].ucbValue).toBe(Infinity);

      // Update one arm
      state = UCB.update(state, {
        experimentId: 'test',
        armId: 'x',
        reward: 0.5,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      // Updated arm should have finite UCB
      expect(state.arms[0].ucbValue).not.toBe(Infinity);
      expect(state.arms[0].ucbValue).toBeGreaterThan(0);

      // Other arms should still have infinite UCB
      expect(state.arms[1].ucbValue).toBe(Infinity);
    });

    it('should update all UCB values when total trials changes', () => {
      let state = UCB.initialize(armIds);

      // Give all arms some trials
      state = UCB.update(state, {
        experimentId: 'test',
        armId: 'x',
        reward: 0.5,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      state = UCB.update(state, {
        experimentId: 'test',
        armId: 'y',
        reward: 0.6,
        timestamp: new Date(),
        unitId: 'user-2',
      });

      const initialUCBx = state.arms[0].ucbValue;
      const initialUCBy = state.arms[1].ucbValue;

      // Update arm x again
      state = UCB.update(state, {
        experimentId: 'test',
        armId: 'x',
        reward: 0.7,
        timestamp: new Date(),
        unitId: 'user-3',
      });

      // Both UCB values should change (total trials increased)
      expect(state.arms[0].ucbValue).not.toBe(initialUCBx);
      expect(state.arms[1].ucbValue).not.toBe(initialUCBy);
    });

    it('should handle incremental mean correctly', () => {
      let state = UCB.initialize(armIds);

      // Add multiple rewards
      const rewards = [0.2, 0.4, 0.6, 0.8];
      for (let i = 0; i < rewards.length; i++) {
        state = UCB.update(state, {
          experimentId: 'test',
          armId: 'x',
          reward: rewards[i],
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      expect(state.arms[0].count).toBe(4);
      expect(state.arms[0].meanReward).toBeCloseTo(0.5);
    });
  });

  describe('Helper Functions', () => {
    it('should get confidence bounds', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].count = 50;
      state.arms[0].meanReward = 0.5;
      state.totalTrials = 100;
      state.explorationParam = 2;

      const bounds = UCB.getConfidenceBounds(state);

      expect(bounds['x'].mean).toBe(0.5);
      expect(bounds['x'].upper).toBeGreaterThan(0.5);
      expect(bounds['x'].lower).toBeLessThan(0.5);
      expect(bounds['x'].lower).toBeGreaterThanOrEqual(0);
    });

    it('should get exploration bonuses', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].count = 10;
      state.arms[1].count = 100;
      state.totalTrials = 200;
      state.explorationParam = 2;

      const bonuses = UCB.getExplorationBonuses(state);

      // Arm with fewer trials should have larger bonus
      expect(bonuses['x']).toBeGreaterThan(bonuses['y']);
      expect(bonuses['x']).toBeGreaterThan(0);
    });

    it('should get arm statistics', () => {
      const state = UCB.initialize(armIds);

      state.arms[0].count = 50;
      state.arms[0].meanReward = 0.6;
      state.arms[0].ucbValue = 0.7;
      state.totalTrials = 100;

      const stats = UCB.getArmStatistics(state);

      expect(stats[0].armId).toBe('x');
      expect(stats[0].count).toBe(50);
      expect(stats[0].meanReward).toBe(0.6);
      expect(stats[0].ucbValue).toBe(0.7);
      expect(stats[0].explorationBonus).toBeGreaterThan(0);
    });

    it('should set exploration parameter', () => {
      let state = UCB.initialize(armIds, {
        algorithm: BanditAlgorithm.UCB,
        explorationParam: 2,
      });

      state = UCB.setExplorationParam(state, 3);

      expect(state.explorationParam).toBe(3);
    });
  });

  describe('Convergence', () => {
    it('should converge to best arm', () => {
      let state = UCB.initialize(armIds);

      const trueRates = {
        'x': 0.3,
        'y': 0.6, // Best
        'z': 0.4,
      };

      const selections: Record<string, number> = { 'x': 0, 'y': 0, 'z': 0 };

      for (let i = 0; i < 400; i++) {
        const selection = UCB.selectArm(state);
        selections[selection.armId]++;

        const reward = Math.random() < trueRates[selection.armId as keyof typeof trueRates] ? 1 : 0;
        state = UCB.update(state, {
          experimentId: 'test',
          armId: selection.armId,
          reward,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      // Best arm should be selected most often
      expect(selections['y']).toBeGreaterThan(selections['x']);
      expect(selections['y']).toBeGreaterThan(selections['z']);
    });

    it('should explore systematically', () => {
      let state = UCB.initialize(armIds);

      // Give arms different performance
      state.arms[0].count = 10;
      state.arms[0].meanReward = 0.8;

      state.arms[1].count = 2; // Few trials
      state.arms[1].meanReward = 0.5;

      state.arms[2].count = 10;
      state.arms[2].meanReward = 0.3;

      state.totalTrials = 22;

      // Recalculate UCB values
      state.arms.forEach((arm, i) => {
        state.arms[i].ucbValue = UCB.calculateUCB(arm, state.totalTrials, state.explorationParam);
      });

      // Arm with fewer trials might have higher UCB despite lower mean
      // This demonstrates systematic exploration
      const selection = UCB.selectArm(state);
      expect(['x', 'y']).toContain(selection.armId);
    });
  });
});
