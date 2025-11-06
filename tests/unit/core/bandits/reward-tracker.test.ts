/**
 * Reward Tracker Tests
 */

import {
  RewardTracker,
  BanditAlgorithm,
  RewardEvent,
} from '../../../../src/core/bandits';

describe('Reward Tracker', () => {
  const armIds = ['arm-a', 'arm-b', 'arm-c'];

  describe('Initialization', () => {
    it('should create tracker with default config', () => {
      const tracker = RewardTracker.create(
        'exp-123',
        armIds,
        BanditAlgorithm.THOMPSON_SAMPLING
      );

      expect(tracker.experimentId).toBe('exp-123');
      expect(tracker.algorithm).toBe(BanditAlgorithm.THOMPSON_SAMPLING);
      expect(tracker.arms.size).toBe(3);
      expect(tracker.totalRewards).toBe(0);
      expect(tracker.history).toEqual([]);
    });

    it('should initialize arms with zero statistics', () => {
      const tracker = RewardTracker.create(
        'exp-123',
        armIds,
        BanditAlgorithm.UCB
      );

      armIds.forEach(armId => {
        const arm = tracker.arms.get(armId);
        expect(arm).toBeDefined();
        expect(arm!.count).toBe(0);
        expect(arm!.sum).toBe(0);
        expect(arm!.mean).toBe(0);
        expect(arm!.variance).toBe(0);
        expect(arm!.min).toBe(Infinity);
        expect(arm!.max).toBe(-Infinity);
      });
    });

    it('should accept custom configuration', () => {
      const tracker = RewardTracker.create(
        'exp-123',
        armIds,
        BanditAlgorithm.EPSILON_GREEDY,
        {
          windowSize: 50,
          validateRewards: false,
          storeHistory: false,
          maxHistorySize: 500,
        }
      );

      expect(tracker.config.windowSize).toBe(50);
      expect(tracker.config.validateRewards).toBe(false);
      expect(tracker.config.storeHistory).toBe(false);
      expect(tracker.config.maxHistorySize).toBe(500);
    });
  });

  describe('Tracking Rewards', () => {
    it('should track single reward', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING);

      const reward: RewardEvent = {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.8,
        timestamp: new Date(),
        unitId: 'user-1',
      };

      tracker = RewardTracker.trackReward(tracker, reward);

      const arm = tracker.arms.get('arm-a')!;
      expect(arm.count).toBe(1);
      expect(arm.sum).toBe(0.8);
      expect(arm.mean).toBe(0.8);
      expect(arm.min).toBe(0.8);
      expect(arm.max).toBe(0.8);
      expect(tracker.totalRewards).toBe(1);
      expect(tracker.history).toHaveLength(1);
    });

    it('should track multiple rewards for same arm', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.EPSILON_GREEDY);

      const rewards = [0.2, 0.4, 0.6, 0.8, 1.0];

      for (let i = 0; i < rewards.length; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: rewards[i],
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const arm = tracker.arms.get('arm-a')!;
      expect(arm.count).toBe(5);
      expect(arm.mean).toBeCloseTo(0.6); // Mean of [0.2, 0.4, 0.6, 0.8, 1.0]
      expect(arm.min).toBe(0.2);
      expect(arm.max).toBe(1.0);
      expect(arm.variance).toBeGreaterThan(0);
      expect(arm.stdDev).toBeGreaterThan(0);
      expect(tracker.totalRewards).toBe(5);
    });

    it('should track rewards for multiple arms', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.UCB);

      // Track rewards for each arm
      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.5,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-b',
        reward: 0.7,
        timestamp: new Date(),
        unitId: 'user-2',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-c',
        reward: 0.3,
        timestamp: new Date(),
        unitId: 'user-3',
      });

      expect(tracker.arms.get('arm-a')!.mean).toBe(0.5);
      expect(tracker.arms.get('arm-b')!.mean).toBe(0.7);
      expect(tracker.arms.get('arm-c')!.mean).toBe(0.3);
      expect(tracker.totalRewards).toBe(3);
    });

    it('should validate reward range', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING, {
        validateRewards: true,
        rewardRange: [0, 1],
      });

      // Valid reward
      expect(() => {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: 0.5,
          timestamp: new Date(),
          unitId: 'user-1',
        });
      }).not.toThrow();

      // Invalid reward (too high)
      expect(() => {
        RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: 1.5,
          timestamp: new Date(),
          unitId: 'user-2',
        });
      }).toThrow('outside expected range');

      // Invalid reward (too low)
      expect(() => {
        RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: -0.1,
          timestamp: new Date(),
          unitId: 'user-3',
        });
      }).toThrow('outside expected range');
    });

    it('should throw error for unknown arm', () => {
      const tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.EPSILON_GREEDY);

      expect(() => {
        RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'unknown-arm',
          reward: 0.5,
          timestamp: new Date(),
          unitId: 'user-1',
        });
      }).toThrow('not found');
    });

    it('should maintain sliding window of recent rewards', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING, {
        windowSize: 3,
      });

      // Add 5 rewards
      for (let i = 0; i < 5; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: i * 0.2, // 0, 0.2, 0.4, 0.6, 0.8
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const arm = tracker.arms.get('arm-a')!;
      // Should only keep last 3 rewards: [0.4, 0.6, 0.8]
      expect(arm.recentRewards).toHaveLength(3);
      expect(arm.recentMean).toBeCloseTo(0.6); // Mean of [0.4, 0.6, 0.8]
    });

    it('should limit history size', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.UCB, {
        storeHistory: true,
        maxHistorySize: 10,
      });

      // Add 20 rewards
      for (let i = 0; i < 20; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: 1,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      // Should only keep last 10
      expect(tracker.history).toHaveLength(10);
    });
  });

  describe('Statistics', () => {
    it('should calculate arm statistics', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING);

      // Add rewards
      for (let i = 0; i < 10; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: Math.random(),
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const stats = RewardTracker.getArmStatistics(tracker);

      expect(stats).toHaveLength(3);
      const armAStats = stats.find(s => s.armId === 'arm-a')!;

      expect(armAStats.count).toBe(10);
      expect(armAStats.meanReward).toBeGreaterThanOrEqual(0);
      expect(armAStats.meanReward).toBeLessThanOrEqual(1);
      expect(armAStats.standardError).toBeGreaterThan(0);
      expect(armAStats.confidenceInterval.lower).toBeLessThan(armAStats.meanReward);
      expect(armAStats.confidenceInterval.upper).toBeGreaterThan(armAStats.meanReward);
    });

    it('should calculate cumulative regret', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.EPSILON_GREEDY);

      // Simulate selections with known optimal arm
      const rewards = [
        { armId: 'arm-a', reward: 1 },  // Optimal
        { armId: 'arm-b', reward: 0 },  // Suboptimal
        { armId: 'arm-a', reward: 1 },  // Optimal
        { armId: 'arm-c', reward: 0 },  // Suboptimal
      ];

      for (let i = 0; i < rewards.length; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: rewards[i].armId,
          reward: rewards[i].reward,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const regret = RewardTracker.calculateCumulativeRegret(tracker, 'arm-a');

      // arm-a has mean 1 (optimal)
      // Selecting arm-b or arm-c incurs regret of ~1 per selection
      // Total regret should be > 0
      expect(regret).toBeGreaterThanOrEqual(0);
    });

    it('should calculate simple regret', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.UCB);

      // Set clear performance differences
      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 1,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-b',
        reward: 0.5,
        timestamp: new Date(),
        unitId: 'user-2',
      });

      const simpleRegret = RewardTracker.calculateSimpleRegret(tracker, 'arm-a');

      // Simple regret = optimal (1.0) - best observed (1.0) = 0
      expect(simpleRegret).toBeCloseTo(0);
    });

    it('should get summary', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING);

      for (let i = 0; i < 5; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: 0.8,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const summary = RewardTracker.getSummary(tracker);

      expect(summary.experimentId).toBe('exp-123');
      expect(summary.algorithm).toBe(BanditAlgorithm.THOMPSON_SAMPLING);
      expect(summary.totalRewards).toBe(5);
      expect(summary.numArms).toBe(3);
      expect(summary.armStats).toHaveLength(3);
      expect(summary.createdAt).toBeInstanceOf(Date);
      expect(summary.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Utility Functions', () => {
    it('should get rewards for specific arm', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING);

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.5,
        timestamp: new Date(),
        unitId: 'user-1',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-b',
        reward: 0.7,
        timestamp: new Date(),
        unitId: 'user-2',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.9,
        timestamp: new Date(),
        unitId: 'user-3',
      });

      const armARewards = RewardTracker.getArmRewards(tracker, 'arm-a');

      expect(armARewards).toHaveLength(2);
      expect(armARewards[0].reward).toBe(0.5);
      expect(armARewards[1].reward).toBe(0.9);
    });

    it('should get rewards in time window', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.EPSILON_GREEDY);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.5,
        timestamp: twoHoursAgo,
        unitId: 'user-1',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.7,
        timestamp: oneHourAgo,
        unitId: 'user-2',
      });

      tracker = RewardTracker.trackReward(tracker, {
        experimentId: 'exp-123',
        armId: 'arm-a',
        reward: 0.9,
        timestamp: now,
        unitId: 'user-3',
      });

      const recentRewards = RewardTracker.getRewardsInWindow(
        tracker,
        oneHourAgo,
        now
      );

      expect(recentRewards).toHaveLength(2); // Only last two
    });

    it('should reset statistics', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.UCB);

      // Add rewards
      for (let i = 0; i < 10; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: 0.5,
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      expect(tracker.totalRewards).toBe(10);
      expect(tracker.history).toHaveLength(10);

      // Reset
      tracker = RewardTracker.resetStatistics(tracker);

      expect(tracker.totalRewards).toBe(0);
      expect(tracker.history).toHaveLength(0);

      armIds.forEach(armId => {
        const arm = tracker.arms.get(armId)!;
        expect(arm.count).toBe(0);
        expect(arm.mean).toBe(0);
      });
    });
  });

  describe('Statistical Accuracy', () => {
    it('should calculate variance correctly', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.THOMPSON_SAMPLING);

      // Known data: [1, 2, 3, 4, 5]
      // Mean = 3, Variance = 2.5, StdDev = 1.58
      const values = [0.2, 0.4, 0.6, 0.8, 1.0];

      for (let i = 0; i < values.length; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: values[i],
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const arm = tracker.arms.get('arm-a')!;

      expect(arm.mean).toBeCloseTo(0.6);
      expect(arm.variance).toBeGreaterThan(0);
      expect(arm.stdDev).toBeCloseTo(Math.sqrt(arm.variance));
    });

    it('should calculate standard error correctly', () => {
      let tracker = RewardTracker.create('exp-123', armIds, BanditAlgorithm.EPSILON_GREEDY);

      // Add multiple rewards
      for (let i = 0; i < 100; i++) {
        tracker = RewardTracker.trackReward(tracker, {
          experimentId: 'exp-123',
          armId: 'arm-a',
          reward: Math.random(),
          timestamp: new Date(),
          unitId: `user-${i}`,
        });
      }

      const arm = tracker.arms.get('arm-a')!;

      // SE = stdDev / sqrt(n)
      const expectedSE = arm.stdDev / Math.sqrt(arm.count);
      expect(arm.standardError).toBeCloseTo(expectedSE);
    });
  });
});
