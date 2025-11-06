/**
 * Statistical Validation Tests for Assignment Distribution
 * Verifies assignments are uniform using chi-square test with 10,000+ samples
 */

import {
  assignSimpleAB,
  ExperimentConfig,
} from '../../src/core/assignment';
import { verifyHashUniformity, murmurHash3 } from '../../src/core/hash';

describe('Assignment Distribution Statistical Validation', () => {
  const createABExperiment = (): ExperimentConfig => ({
    id: 'stat-test-ab',
    key: 'stat_ab',
    variants: [
      { key: 'control', name: 'Control', allocation: 50 },
      { key: 'treatment', name: 'Treatment', allocation: 50 },
    ],
    trafficAllocation: 100,
    designType: 'ab',
    randomizationUnit: 'user',
    startDate: new Date('2025-01-01'),
  });

  describe('Uniformity Tests', () => {
    it('should distribute 10,000 users uniformly across variants', () => {
      const experiment = createABExperiment();
      const numUsers = 10000;

      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const controlCount = assignments.filter(a => a.variantKey === 'control').length;
      const treatmentCount = assignments.filter(a => a.variantKey === 'treatment').length;

      // Should be 5000 ± 300 (3 standard deviations)
      expect(controlCount).toBeGreaterThan(4700);
      expect(controlCount).toBeLessThan(5300);
      expect(treatmentCount).toBeGreaterThan(4700);
      expect(treatmentCount).toBeLessThan(5300);
    });

    it('should pass chi-square test for uniformity', () => {
      const numSamples = 10000;
      const samples = Array.from({ length: numSamples }, (_, i) =>
        murmurHash3(`user-${i}`)
      );

      const result = verifyHashUniformity(samples, 100);

      expect(result.isUniform).toBe(true);
      // For 100 buckets, df = 99, chi-square should be around 99 ± 42
      expect(result.chiSquare).toBeGreaterThan(50);
      expect(result.chiSquare).toBeLessThan(150);
    });

    it('should maintain uniformity across multiple experiments', () => {
      const experiments = Array.from({ length: 10 }, (_, i) => ({
        ...createABExperiment(),
        id: `exp-${i}`,
        key: `exp_${i}`,
      }));

      const numUsers = 1000;

      experiments.forEach(experiment => {
        const assignments = Array.from({ length: numUsers }, (_, i) =>
          assignSimpleAB(experiment, `user-${i}`)
        );

        const controlCount = assignments.filter(a => a.variantKey === 'control').length;

        // Each experiment should have roughly 50% control
        expect(controlCount).toBeGreaterThan(450);
        expect(controlCount).toBeLessThan(550);
      });
    });

    it('should handle weighted allocations correctly', () => {
      const weightedExperiment: ExperimentConfig = {
        id: 'weighted',
        key: 'weighted',
        variants: [
          { key: 'control', name: 'Control', allocation: 20 },
          { key: 'treatment', name: 'Treatment', allocation: 80 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const numUsers = 10000;
      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignSimpleAB(weightedExperiment, `user-${i}`)
      );

      const controlCount = assignments.filter(a => a.variantKey === 'control').length;
      const treatmentCount = assignments.filter(a => a.variantKey === 'treatment').length;

      // Control: 20% ± 3% = 2000 ± 300
      expect(controlCount).toBeGreaterThan(1700);
      expect(controlCount).toBeLessThan(2300);

      // Treatment: 80% ± 3% = 8000 ± 300
      expect(treatmentCount).toBeGreaterThan(7700);
      expect(treatmentCount).toBeLessThan(8300);
    });

    it('should verify traffic allocation works correctly', () => {
      const experiment: ExperimentConfig = {
        ...createABExperiment(),
        trafficAllocation: 50, // Only 50% of users
      };

      const numUsers = 10000;
      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const includedCount = assignments.filter(a => a.inExperiment).length;

      // Should be around 5000 ± 300
      expect(includedCount).toBeGreaterThan(4700);
      expect(includedCount).toBeLessThan(5300);
    });
  });

  describe('Multivariate Distribution', () => {
    it('should distribute users evenly across 4 variants', () => {
      const multivariateExperiment: ExperimentConfig = {
        id: 'multivariate',
        key: 'multivariate',
        variants: [
          { key: 'v1', name: 'V1', allocation: 25 },
          { key: 'v2', name: 'V2', allocation: 25 },
          { key: 'v3', name: 'V3', allocation: 25 },
          { key: 'v4', name: 'V4', allocation: 25 },
        ],
        trafficAllocation: 100,
        designType: 'multivariate',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const numUsers = 10000;
      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignSimpleAB(multivariateExperiment, `user-${i}`)
      );

      const counts = {
        v1: assignments.filter(a => a.variantKey === 'v1').length,
        v2: assignments.filter(a => a.variantKey === 'v2').length,
        v3: assignments.filter(a => a.variantKey === 'v3').length,
        v4: assignments.filter(a => a.variantKey === 'v4').length,
      };

      // Each should be 2500 ± 200
      Object.values(counts).forEach(count => {
        expect(count).toBeGreaterThan(2300);
        expect(count).toBeLessThan(2700);
      });
    });
  });

  describe('Consistency Tests', () => {
    it('should maintain consistent assignment over time', () => {
      const experiment = createABExperiment();
      const userId = 'consistency-test-user';

      // Assign same user 100 times
      const assignments = Array.from({ length: 100 }, () =>
        assignSimpleAB(experiment, userId)
      );

      // All assignments should be identical
      const firstVariant = assignments[0].variantKey;
      expect(assignments.every(a => a.variantKey === firstVariant)).toBe(true);
    });

    it('should be independent across experiments', () => {
      const exp1 = createABExperiment();
      const exp2 = { ...createABExperiment(), id: 'exp-2', key: 'exp_2' };

      const numUsers = 1000;

      // Track users who get treatment in both experiments
      let bothTreatment = 0;
      let exp1Treatment = 0;
      let exp2Treatment = 0;

      for (let i = 0; i < numUsers; i++) {
        const userId = `user-${i}`;
        const assign1 = assignSimpleAB(exp1, userId);
        const assign2 = assignSimpleAB(exp2, userId);

        if (assign1.variantKey === 'treatment') exp1Treatment++;
        if (assign2.variantKey === 'treatment') exp2Treatment++;
        if (assign1.variantKey === 'treatment' && assign2.variantKey === 'treatment') {
          bothTreatment++;
        }
      }

      // If independent, ~25% should be in treatment for both
      // (0.5 * 0.5 = 0.25)
      expect(bothTreatment).toBeGreaterThan(200);
      expect(bothTreatment).toBeLessThan(300);
    });
  });

  describe('Large Scale Tests', () => {
    it('should handle 100,000 users efficiently', () => {
      const experiment = createABExperiment();
      const startTime = performance.now();

      const assignments = Array.from({ length: 100000 }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const duration = performance.now() - startTime;

      // Should complete in reasonable time (<1000ms)
      expect(duration).toBeLessThan(1000);

      // Verify distribution still uniform at scale
      const controlCount = assignments.filter(a => a.variantKey === 'control').length;
      expect(controlCount).toBeGreaterThan(49000);
      expect(controlCount).toBeLessThan(51000);
    });
  });
});
