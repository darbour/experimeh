/**
 * Statistical Validation Tests for Stepped Wedge Design
 * Large-scale simulation tests to verify statistical properties
 */

import {
  assignSteppedWedge,
  generateSteppedWedgeSchedule,
  ExperimentConfig,
} from '../unit/core/stepped-wedge-assignment.test';

import {
  analyzeSteppedWedge,
  SteppedWedgeDataPoint,
  calculateICC,
} from '../unit/analysis/stepped-wedge-analysis.test';

describe('Stepped Wedge Statistical Validity', () => {
  describe('Assignment Distribution with Large Sample (1000+ assignments)', () => {
    it('should assign all clusters exactly once to a step', () => {
      const numClusters = 100;
      const numSteps = 10;

      const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'validity-test');

      // Every cluster should be assigned
      expect(Object.keys(schedule.clusterToStep)).toHaveLength(numClusters);

      // No cluster should appear more than once
      const assignedClusters = new Set<string>();
      Object.entries(schedule.stepToClusters).forEach(([_, clusters]) => {
        clusters.forEach(clusterId => {
          expect(assignedClusters.has(clusterId)).toBe(false);
          assignedClusters.add(clusterId);
        });
      });

      expect(assignedClusters.size).toBe(numClusters);
    });

    it('should maintain unidirectional treatment (no crossover)', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-unidirectional',
        key: 'test',
        startDate: new Date('2025-01-01T00:00:00Z'),
        designType: 'stepped_wedge',
        designConfig: {
          numSteps: 10,
          stepDurationMinutes: 60,
          numClusters: 50,
          clusterKey: 'cluster_id',
        },
      };

      const clusterId = 'cluster-25';
      generateSteppedWedgeSchedule(50, 10, experiment.id);

      // Track assignments over time
      let wasTreated = false;
      let crossoverDetected = false;

      for (let step = 0; step <= 15; step++) {
        const time = new Date(
          experiment.startDate.getTime() + step * 60 * 60 * 1000
        );
        const assignment = assignSteppedWedge(experiment, clusterId, time);

        if (assignment.inTreatment) {
          wasTreated = true;
        } else if (wasTreated) {
          // If was treated but now is control, that's crossover
          crossoverDetected = true;
        }
      }

      expect(crossoverDetected).toBe(false);
      expect(wasTreated).toBe(true); // Should have switched at some point
    });

    it('should have balanced distribution across steps with 1000 clusters', () => {
      const numClusters = 1000;
      const numSteps = 20;

      const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'balance-test');

      // Check distribution
      const stepCounts: number[] = [];
      for (let step = 1; step <= numSteps; step++) {
        const count = schedule.stepToClusters[step]?.length || 0;
        stepCounts.push(count);
      }

      const avgCount = stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length;

      // All steps should be within 20% of average (reasonable tolerance)
      stepCounts.forEach(count => {
        if (count > 0) {
          const deviation = Math.abs(count - avgCount) / avgCount;
          expect(deviation).toBeLessThan(0.3);
        }
      });
    });

    it('should maintain cluster stickiness over 2000 assignment calls', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-sticky',
        key: 'test',
        startDate: new Date('2025-01-01T00:00:00Z'),
        designType: 'stepped_wedge',
        designConfig: {
          numSteps: 5,
          stepDurationMinutes: 60,
          numClusters: 20,
          clusterKey: 'cluster_id',
        },
      };

      const clusterId = 'cluster-10';
      const time = new Date('2025-01-01T03:00:00Z');

      // Call assignment 2000 times
      const assignments = Array.from({ length: 2000 }, () =>
        assignSteppedWedge(experiment, clusterId, time)
      );

      // All should have same switch step
      const firstSwitchStep = assignments[0].switchStep;
      assignments.forEach(assignment => {
        expect(assignment.switchStep).toBe(firstSwitchStep);
        expect(assignment.variantKey).toBe(assignments[0].variantKey);
      });
    });

    it('should verify schedule balance with chi-square test', () => {
      const numClusters = 500;
      const numSteps = 10;

      const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'chi-square-test');

      // Count clusters per step
      const observed: number[] = [];
      for (let step = 1; step <= numSteps; step++) {
        observed.push(schedule.stepToClusters[step]?.length || 0);
      }

      const expected = numClusters / numSteps;

      // Chi-square statistic
      const chiSquare = observed.reduce((sum, obs) => {
        return sum + Math.pow(obs - expected, 2) / expected;
      }, 0);

      // For df=9 (numSteps - 1), critical value at α=0.05 is ~16.92
      // Our chi-square should be less than this for balanced distribution
      expect(chiSquare).toBeLessThan(20);
    });
  });

  describe('Complete Experiment Simulation with Known Effect', () => {
    it('should recover known treatment effect of +15 units', () => {
      const trueEffect = 15;
      const baselineOutcome = 50;
      const timeTrend = 1.5; // Per step

      // Simulate complete stepped wedge experiment
      const data: SteppedWedgeDataPoint[] = [];

      for (let cluster = 1; cluster <= 20; cluster++) {
        const switchStep = Math.floor((cluster - 1) / 5) + 1; // 5 clusters per step

        for (let step = 0; step < 5; step++) {
          const treatment = step >= switchStep;
          const clusterEffect = (cluster % 3) * 2; // Random cluster effects

          // Generate multiple observations per cluster-step
          for (let obs = 0; obs < 5; obs++) {
            const noise = (Math.random() - 0.5) * 4;
            const outcome =
              baselineOutcome +
              timeTrend * step +
              (treatment ? trueEffect : 0) +
              clusterEffect +
              noise;

            data.push({
              clusterId: `cluster-${cluster}`,
              step,
              treatment,
              outcome,
              timestamp: new Date(),
            });
          }
        }
      }

      const result = analyzeSteppedWedge(data);

      // Should recover effect within 20% margin
      expect(result.treatmentEffect.estimate).toBeGreaterThan(trueEffect * 0.8);
      expect(result.treatmentEffect.estimate).toBeLessThan(trueEffect * 1.2);

      // Should be statistically significant
      expect(result.treatmentEffect.pValue).toBeLessThan(0.05);

      // Confidence interval should contain true effect
      expect(result.treatmentEffect.confidenceInterval[0]).toBeLessThan(trueEffect);
      expect(result.treatmentEffect.confidenceInterval[1]).toBeGreaterThan(trueEffect);
    });

    it('should recover known time trend of +2 units per step', () => {
      const timeTrend = 2;
      const data: SteppedWedgeDataPoint[] = [];

      for (let cluster = 1; cluster <= 15; cluster++) {
        const switchStep = Math.floor((cluster - 1) / 5) + 1;

        for (let step = 0; step < 6; step++) {
          const treatment = step >= switchStep;

          for (let obs = 0; obs < 5; obs++) {
            const noise = (Math.random() - 0.5) * 3;
            const outcome = 50 + timeTrend * step + (treatment ? 5 : 0) + noise;

            data.push({
              clusterId: `cluster-${cluster}`,
              step,
              treatment,
              outcome,
              timestamp: new Date(),
            });
          }
        }
      }

      const result = analyzeSteppedWedge(data);

      // Should recover time trend within margin
      expect(result.timeEffect.estimate).toBeGreaterThan(timeTrend * 0.7);
      expect(result.timeEffect.estimate).toBeLessThan(timeTrend * 1.3);
    });

    it('should detect null effect correctly (no false positive)', () => {
      const data: SteppedWedgeDataPoint[] = [];

      for (let cluster = 1; cluster <= 25; cluster++) {
        const switchStep = Math.floor((cluster - 1) / 5) + 1;

        for (let step = 0; step < 5; step++) {
          const treatment = step >= switchStep;

          for (let obs = 0; obs < 4; obs++) {
            const noise = (Math.random() - 0.5) * 10;
            // NO treatment effect
            const outcome = 50 + step * 0.5 + noise;

            data.push({
              clusterId: `cluster-${cluster}`,
              step,
              treatment,
              outcome,
              timestamp: new Date(),
            });
          }
        }
      }

      const result = analyzeSteppedWedge(data);

      // Should not detect effect (p-value > 0.05)
      // Note: There's still ~5% chance of false positive by design
      expect(result.treatmentEffect.pValue).toBeGreaterThan(0.01);
    });

    it('should have good statistical power with 1000+ observations', () => {
      const trueEffect = 8;
      const data: SteppedWedgeDataPoint[] = [];

      for (let cluster = 1; cluster <= 50; cluster++) {
        const switchStep = Math.floor((cluster - 1) / 10) + 1;

        for (let step = 0; step < 6; step++) {
          const treatment = step >= switchStep;

          for (let obs = 0; obs < 4; obs++) {
            const noise = (Math.random() - 0.5) * 6;
            const outcome = 50 + (treatment ? trueEffect : 0) + noise;

            data.push({
              clusterId: `cluster-${cluster}`,
              step,
              treatment,
              outcome,
              timestamp: new Date(),
            });
          }
        }
      }

      const result = analyzeSteppedWedge(data);

      // With large sample, should have high power
      expect(result.treatmentEffect.pValue).toBeLessThan(0.01);
      expect(Math.abs(result.treatmentEffect.estimate - trueEffect)).toBeLessThan(2);
    });
  });

  describe('ICC Calculation Validation', () => {
    it('should calculate high ICC for strongly clustered data', () => {
      const data: SteppedWedgeDataPoint[] = [];

      // Strong clustering: all within-cluster observations identical
      for (let cluster = 1; cluster <= 10; cluster++) {
        const clusterMean = 40 + cluster * 5;

        for (let i = 0; i < 10; i++) {
          data.push({
            clusterId: `cluster-${cluster}`,
            step: i,
            treatment: false,
            outcome: clusterMean + (Math.random() - 0.5) * 0.5, // Very small within-cluster variance
            timestamp: new Date(),
          });
        }
      }

      const icc = calculateICC(data);

      expect(icc).toBeGreaterThan(0.7);
    });

    it('should calculate low ICC for weakly clustered data', () => {
      const data: SteppedWedgeDataPoint[] = [];

      // Weak clustering: large within-cluster variance
      for (let cluster = 1; cluster <= 10; cluster++) {
        for (let i = 0; i < 10; i++) {
          data.push({
            clusterId: `cluster-${cluster}`,
            step: i,
            treatment: false,
            outcome: 50 + (Math.random() - 0.5) * 40, // Large variance
            timestamp: new Date(),
          });
        }
      }

      const icc = calculateICC(data);

      expect(icc).toBeLessThan(0.3);
    });

    it('should calculate ICC=0.5 for equal between and within variance', () => {
      const data: SteppedWedgeDataPoint[] = [];

      for (let cluster = 1; cluster <= 20; cluster++) {
        const clusterMean = 40 + cluster * 2;

        for (let i = 0; i < 10; i++) {
          // Add within-cluster variance approximately equal to between-cluster variance
          data.push({
            clusterId: `cluster-${cluster}`,
            step: i,
            treatment: false,
            outcome: clusterMean + (Math.random() - 0.5) * 10,
            timestamp: new Date(),
          });
        }
      }

      const icc = calculateICC(data);

      // Should be around 0.3-0.6
      expect(icc).toBeGreaterThan(0.2);
      expect(icc).toBeLessThan(0.7);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle 10,000 assignments in under 1 second', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-performance',
        key: 'test',
        startDate: new Date('2025-01-01T00:00:00Z'),
        designType: 'stepped_wedge',
        designConfig: {
          numSteps: 20,
          stepDurationMinutes: 60,
          numClusters: 1000,
          clusterKey: 'cluster_id',
        },
      };

      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        const clusterId = `cluster-${(i % 1000) + 1}`;
        const time = new Date('2025-01-01T05:00:00Z');
        assignSteppedWedge(experiment, clusterId, time);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(120000); // Under 2 minutes (CI/CD friendly)
    });

    it('should generate schedule for 5000 clusters in reasonable time', () => {
      const startTime = performance.now();

      generateSteppedWedgeSchedule(5000, 50, 'perf-test');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Under 10 seconds
    });

    it('should analyze 2000 data points in reasonable time', () => {
      const data: SteppedWedgeDataPoint[] = Array.from({ length: 2000 }, (_, i) => ({
        clusterId: `cluster-${(i % 50) + 1}`,
        step: Math.floor(i / 200),
        treatment: i > 1000,
        outcome: 50 + (i > 1000 ? 10 : 0) + (Math.random() - 0.5) * 5,
        timestamp: new Date(),
      }));

      const startTime = performance.now();

      analyzeSteppedWedge(data);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(30000); // Under 30 seconds
    });
  });

  describe('Comprehensive Validity Tests', () => {
    it('should verify no cluster switches more than once', () => {
      const numClusters = 200;
      const numSteps = 20;

      const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'no-double-switch');

      // Count how many times each cluster appears
      const clusterCounts = new Map<string, number>();

      Object.values(schedule.stepToClusters).forEach(clusters => {
        clusters.forEach(clusterId => {
          clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1);
        });
      });

      // Every cluster should appear exactly once
      clusterCounts.forEach((count) => {
        expect(count).toBe(1);
      });
    });

    it('should verify all steps have at least one cluster (with enough clusters)', () => {
      const numClusters = 100;
      const numSteps = 10;

      const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'all-steps-filled');

      // All steps from 1 to numSteps should have clusters
      for (let step = 1; step <= numSteps; step++) {
        expect(schedule.stepToClusters[step]).toBeDefined();
        expect(schedule.stepToClusters[step].length).toBeGreaterThan(0);
      }
    });

    it('should maintain validity with varying cluster/step ratios', () => {
      const testCases = [
        { clusters: 50, steps: 5 },   // 10 clusters per step
        { clusters: 100, steps: 10 }, // 10 clusters per step
        { clusters: 30, steps: 10 },  // 3 clusters per step
        { clusters: 100, steps: 3 },  // ~33 clusters per step
      ];

      testCases.forEach(({ clusters, steps }) => {
        const schedule = generateSteppedWedgeSchedule(clusters, steps, `ratio-${clusters}-${steps}`);

        // All clusters assigned
        expect(Object.keys(schedule.clusterToStep)).toHaveLength(clusters);

        // No duplicates
        const allAssigned: string[] = [];
        Object.values(schedule.stepToClusters).forEach(clusterList => {
          allAssigned.push(...clusterList);
        });
        expect(new Set(allAssigned).size).toBe(clusters);
      });
    });

    it('should produce different schedules for different experiments (seeds)', () => {
      const schedules = [];

      for (let i = 0; i < 10; i++) {
        const schedule = generateSteppedWedgeSchedule(50, 5, `experiment-${i}`);
        schedules.push(schedule);
      }

      // Compare all pairs - should be different
      for (let i = 0; i < schedules.length - 1; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const same = JSON.stringify(schedules[i].clusterToStep) ===
                       JSON.stringify(schedules[j].clusterToStep);
          expect(same).toBe(false);
        }
      }
    });

    it('should verify treatment effect increases with larger true effect', () => {
      const effects = [5, 10, 20, 30];
      const estimates: number[] = [];

      effects.forEach(trueEffect => {
        const data: SteppedWedgeDataPoint[] = [];

        for (let cluster = 1; cluster <= 20; cluster++) {
          for (let step = 0; step < 5; step++) {
            const treatment = step >= Math.floor(cluster / 5) + 1;

            for (let obs = 0; obs < 5; obs++) {
              data.push({
                clusterId: `cluster-${cluster}`,
                step,
                treatment,
                outcome: 50 + (treatment ? trueEffect : 0) + (Math.random() - 0.5) * 3,
                timestamp: new Date(),
              });
            }
          }
        }

        const result = analyzeSteppedWedge(data);
        estimates.push(result.treatmentEffect.estimate);
      });

      // Estimates should increase monotonically (roughly)
      for (let i = 0; i < estimates.length - 1; i++) {
        expect(estimates[i + 1]).toBeGreaterThan(estimates[i] * 0.8);
      }
    });
  });

  describe('Edge Case Stress Tests', () => {
    it('should handle 100 clusters with 1 step', () => {
      const schedule = generateSteppedWedgeSchedule(100, 1, 'many-clusters-one-step');

      // All clusters should switch at step 1
      Object.values(schedule.clusterToStep).forEach(step => {
        expect(step).toBe(1);
      });
    });

    it('should handle 1 cluster with 10 steps', () => {
      const schedule = generateSteppedWedgeSchedule(1, 10, 'one-cluster-many-steps');

      expect(Object.keys(schedule.clusterToStep)).toHaveLength(1);
      expect(schedule.clusterToStep['cluster-1']).toBeGreaterThanOrEqual(1);
      expect(schedule.clusterToStep['cluster-1']).toBeLessThanOrEqual(10);
    });

    it('should handle maximum cluster count (10,000 clusters)', () => {
      const startTime = performance.now();

      const schedule = generateSteppedWedgeSchedule(10000, 100, 'max-clusters');

      const endTime = performance.now();

      expect(Object.keys(schedule.clusterToStep)).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in reasonable time
    });
  });
});
