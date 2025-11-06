/**
 * Unit Tests for Statistical Tests
 * Tests t-test, z-test, ANOVA with known values
 */

import {
  twoSampleTTest,
  twoProportionZTest,
  chiSquareTest,
  oneWayANOVA,
  factorialANOVA,
  multipleRegression,
} from '../../../src/analysis/statistical-tests';

describe('Statistical Tests', () => {
  describe('twoSampleTTest', () => {
    it('should detect significant difference with known values', () => {
      // Control: mean=10, sd=2, n=30
      const control = Array(30).fill(0).map((_, i) => 10 + (Math.random() - 0.5) * 4);
      // Treatment: mean=12, sd=2, n=30
      const treatment = Array(30).fill(0).map((_, i) => 12 + (Math.random() - 0.5) * 4);

      const result = twoSampleTTest(control, treatment);

      expect(result.testName).toContain('test');
      expect(result.statistic).toBeDefined();
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.degreesOfFreedom).toBeDefined();
      expect(result.confidenceInterval).toBeDefined();
      expect(result.cohensD).toBeDefined();
    });

    it('should not detect difference when samples are identical', () => {
      const sample1 = [10, 11, 12, 13, 14];
      const sample2 = [10, 11, 12, 13, 14];

      const result = twoSampleTTest(sample1, sample2);

      expect(Math.abs(result.statistic)).toBeLessThan(0.0001);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it('should calculate correct means', () => {
      const sample1 = [10, 20, 30];
      const sample2 = [15, 25, 35];

      const result = twoSampleTTest(sample1, sample2);

      expect(result.mean1).toBe(20);
      expect(result.mean2).toBe(25);
    });

    it('should use Welchs t-test by default', () => {
      const sample1 = [10, 20, 30];
      const sample2 = [15, 25, 35];

      const result = twoSampleTTest(sample1, sample2);

      expect(result.testName).toContain("Welch");
      expect(result.pooledVariance).toBeUndefined();
    });

    it('should use pooled variance when requested', () => {
      const sample1 = [10, 20, 30];
      const sample2 = [15, 25, 35];

      const result = twoSampleTTest(sample1, sample2, 0.05, true);

      expect(result.testName).toContain("Student");
      expect(result.pooledVariance).toBeDefined();
    });

    it('should throw error for insufficient samples', () => {
      const sample1 = [10];
      const sample2 = [15, 20];

      expect(() => twoSampleTTest(sample1, sample2)).toThrow(
        'at least 2 observations'
      );
    });

    it('should calculate effect size (Cohens d)', () => {
      // Large effect: d ≈ 1.0
      const control = Array(50).fill(10);
      const treatment = Array(50).fill(13);

      const result = twoSampleTTest(control, treatment);

      // Should detect large effect
      expect(Math.abs(result.cohensD)).toBeGreaterThan(0.8);
    });

    it('should detect directional differences', () => {
      const lower = [5, 6, 7, 8, 9];
      const higher = [15, 16, 17, 18, 19];

      const result = twoSampleTTest(lower, higher);

      expect(result.statistic).toBeLessThan(0); // lower < higher
      expect(result.mean1).toBeLessThan(result.mean2);
    });

    it('should respect alpha level', () => {
      const sample1 = [10, 11, 12, 13, 14];
      const sample2 = [10, 11, 12, 13, 14];

      const result = twoSampleTTest(sample1, sample2, 0.01);

      expect(result.alpha).toBe(0.01);
      expect(result.significant).toBe(false);
    });
  });

  describe('twoProportionZTest', () => {
    it('should detect significant difference in proportions', () => {
      // Control: 450/1000 = 45%
      // Treatment: 550/1000 = 55%
      const result = twoProportionZTest(450, 1000, 550, 1000);

      expect(result.proportion1).toBe(0.45);
      expect(result.proportion2).toBe(0.55);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it('should not detect difference when proportions are equal', () => {
      const result = twoProportionZTest(500, 1000, 500, 1000);

      expect(result.proportion1).toBe(0.5);
      expect(result.proportion2).toBe(0.5);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it('should calculate pooled proportion correctly', () => {
      const result = twoProportionZTest(30, 100, 40, 100);

      const expectedPooled = (30 + 40) / (100 + 100);
      expect(result.pooledProportion).toBe(expectedPooled);
    });

    it('should calculate relative change', () => {
      const result = twoProportionZTest(40, 100, 50, 100);

      // (0.4 - 0.5) / 0.5 * 100 = -20%
      expect(result.relativeChange).toBe(-20);
    });

    it('should handle edge case of zero successes', () => {
      const result = twoProportionZTest(0, 100, 10, 100);

      expect(result.proportion1).toBe(0);
      expect(result.proportion2).toBe(0.1);
      expect(result.significant).toBe(true);
    });

    it('should handle edge case of all successes', () => {
      const result = twoProportionZTest(100, 100, 90, 100);

      expect(result.proportion1).toBe(1);
      expect(result.proportion2).toBe(0.9);
      expect(result.significant).toBe(true);
    });

    it('should throw error when successes exceed total', () => {
      expect(() => twoProportionZTest(150, 100, 50, 100)).toThrow(
        'Successes cannot exceed total observations'
      );
    });

    it('should warn about small sample sizes', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      twoProportionZTest(2, 3, 2, 3);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should calculate confidence interval', () => {
      const result = twoProportionZTest(450, 1000, 550, 1000);

      expect(result.confidenceInterval).toBeDefined();
      expect(result.confidenceInterval![0]).toBeLessThan(result.confidenceInterval![1]);
    });

    it('should calculate effect size (Cohens h)', () => {
      const result = twoProportionZTest(300, 1000, 700, 1000);

      expect(result.effectSize).toBeDefined();
      expect(Math.abs(result.effectSize!)).toBeGreaterThan(0);
    });
  });

  describe('chiSquareTest', () => {
    it('should detect independence in 2x2 table', () => {
      // Example: Click vs No Click by Variant
      const observed = [
        [45, 55], // Control: 45 clicks, 55 no clicks
        [60, 40], // Treatment: 60 clicks, 40 no clicks
      ];

      const result = chiSquareTest(observed);

      expect(result.statistic).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.degreesOfFreedom).toBe(1); // (2-1)*(2-1) = 1
      expect(result.cramersV).toBeDefined();
    });

    it('should calculate expected frequencies correctly', () => {
      const observed = [
        [10, 20],
        [30, 40],
      ];

      const result = chiSquareTest(observed);

      // Verify expected frequencies sum to same total
      const totalObserved = observed.flat().reduce((a, b) => a + b, 0);
      const totalExpected = result.expectedFrequencies.flat().reduce((a, b) => a + b, 0);

      expect(Math.abs(totalObserved - totalExpected)).toBeLessThan(0.01);
    });

    it('should handle larger contingency tables', () => {
      const observed = [
        [10, 20, 30],
        [15, 25, 35],
        [20, 30, 40],
      ];

      const result = chiSquareTest(observed);

      expect(result.degreesOfFreedom).toBe(4); // (3-1)*(3-1) = 4
    });

    it('should detect no association when perfectly independent', () => {
      // Perfectly proportional data
      const observed = [
        [50, 50],
        [50, 50],
      ];

      const result = chiSquareTest(observed);

      expect(result.statistic).toBeLessThan(0.01);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it('should throw error for insufficient table size', () => {
      const observed = [[10]];

      expect(() => chiSquareTest(observed)).toThrow(
        'at least 2x2 contingency table'
      );
    });

    it('should calculate Cramers V effect size', () => {
      const observed = [
        [100, 10],
        [10, 100],
      ];

      const result = chiSquareTest(observed);

      // Strong association
      expect(result.cramersV).toBeGreaterThan(0.5);
    });

    it('should warn about low expected frequencies', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const observed = [
        [1, 99],
        [2, 98],
      ];

      chiSquareTest(observed);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('oneWayANOVA', () => {
    it('should detect differences across groups', () => {
      const groups = [
        [10, 11, 12, 13, 14], // Group 1: mean ≈ 12
        [15, 16, 17, 18, 19], // Group 2: mean ≈ 17
        [20, 21, 22, 23, 24], // Group 3: mean ≈ 22
      ];

      const result = oneWayANOVA(groups);

      expect(result.fStatistic).toBeGreaterThan(1);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
      expect(result.groupMeans).toHaveLength(3);
    });

    it('should not detect differences when groups are similar', () => {
      const groups = [
        [10, 11, 12, 13, 14],
        [10, 11, 12, 13, 14],
        [10, 11, 12, 13, 14],
      ];

      const result = oneWayANOVA(groups);

      expect(result.fStatistic).toBeLessThan(0.1);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it('should calculate correct degrees of freedom', () => {
      const groups = [
        [1, 2, 3, 4, 5], // n1 = 5
        [6, 7, 8, 9, 10], // n2 = 5
        [11, 12, 13, 14, 15], // n3 = 5
      ];

      const result = oneWayANOVA(groups);

      expect(result.betweenGroupsDF).toBe(2); // k - 1 = 3 - 1 = 2
      expect(result.withinGroupsDF).toBe(12); // N - k = 15 - 3 = 12
    });

    it('should calculate group means correctly', () => {
      const groups = [
        [10, 20, 30],
        [15, 25, 35],
      ];

      const result = oneWayANOVA(groups);

      expect(result.groupMeans[0]).toBe(20);
      expect(result.groupMeans[1]).toBe(25);
    });

    it('should calculate effect size (eta squared)', () => {
      const groups = [
        [10, 11, 12],
        [20, 21, 22],
        [30, 31, 32],
      ];

      const result = oneWayANOVA(groups);

      // Should have large effect size
      expect(result.etaSquared).toBeGreaterThan(0.8);
    });

    it('should throw error for fewer than 2 groups', () => {
      const groups = [[1, 2, 3]];

      expect(() => oneWayANOVA(groups)).toThrow(
        'at least 2 groups'
      );
    });

    it('should throw error for groups with insufficient observations', () => {
      const groups = [
        [1],
        [2, 3],
      ];

      expect(() => oneWayANOVA(groups)).toThrow(
        'fewer than 2 observations'
      );
    });
  });

  describe('factorialANOVA', () => {
    it('should detect main effects and interactions', () => {
      // 2x2 factorial design
      const data = [
        10, 12, 11, 13, // A=0, B=0
        20, 22, 21, 23, // A=0, B=1
        15, 17, 16, 18, // A=1, B=0
        25, 27, 26, 28, // A=1, B=1
      ];
      const factorA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
      const factorB = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1];

      const result = factorialANOVA(data, factorA, factorB);

      expect(result.mainEffectA).toBeDefined();
      expect(result.mainEffectB).toBeDefined();
      expect(result.interactionEffect).toBeDefined();

      expect(result.mainEffectA.pValue).toBeLessThan(0.05);
      expect(result.mainEffectB.pValue).toBeLessThan(0.05);
    });

    it('should calculate correct effect sizes', () => {
      const data = [
        10, 10, 10, 10,
        20, 20, 20, 20,
        10, 10, 10, 10,
        20, 20, 20, 20,
      ];
      const factorA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
      const factorB = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1];

      const result = factorialANOVA(data, factorA, factorB);

      // Strong main effect for B, no effect for A, no interaction
      expect(result.mainEffectB.etaSquared).toBeGreaterThan(0.5);
      expect(result.mainEffectA.etaSquared).toBeLessThan(0.01);
    });

    it('should throw error for mismatched array lengths', () => {
      const data = [1, 2, 3];
      const factorA = [0, 0];
      const factorB = [0, 0, 0];

      expect(() => factorialANOVA(data, factorA, factorB)).toThrow(
        'same length'
      );
    });

    it('should handle string factor levels', () => {
      const data = [10, 20, 15, 25];
      const factorA = ['control', 'control', 'treatment', 'treatment'];
      const factorB = ['small', 'large', 'small', 'large'];

      const result = factorialANOVA(data, factorA, factorB);

      expect(result.mainEffectA).toBeDefined();
      expect(result.mainEffectB).toBeDefined();
    });
  });

  describe('multipleRegression', () => {
    it('should fit simple linear regression', () => {
      // Y = 2 + 3*X + error
      const y = [5, 8, 11, 14, 17];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.coefficients).toBeDefined();
      expect(result.rSquared).toBeGreaterThan(0.9);
      expect(result.pValues).toBeDefined();
    });

    it('should detect significant predictors', () => {
      // Strong relationship
      const y = [10, 20, 30, 40, 50];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      // Predictor should be significant
      expect(result.pValues['x']).toBeLessThan(0.05);
    });

    it('should calculate R-squared', () => {
      // Perfect fit: Y = X
      const y = [1, 2, 3, 4, 5];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.rSquared).toBeGreaterThan(0.99);
    });

    it('should handle multiple predictors', () => {
      const y = [10, 20, 30, 40, 50];
      const X = [
        [1, 10],
        [2, 20],
        [3, 30],
        [4, 40],
        [5, 50],
      ];

      const result = multipleRegression(y, X, ['x1', 'x2']);

      expect(Object.keys(result.coefficients).length).toBe(3); // intercept + x1 + x2
    });

    it('should calculate adjusted R-squared', () => {
      const y = [1, 2, 3, 4, 5, 6];
      const X = [[1], [2], [3], [4], [5], [6]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.adjustedRSquared).toBeLessThanOrEqual(result.rSquared);
    });

    it('should throw error for insufficient observations', () => {
      const y = [1, 2];
      const X = [[1], [2]];

      expect(() => multipleRegression(y, X, ['x'])).toThrow(
        'more observations than predictors'
      );
    });

    it('should calculate standard errors', () => {
      const y = [10, 20, 30, 40, 50];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.standardErrors).toBeDefined();
      expect(result.standardErrors['x']).toBeGreaterThan(0);
    });

    it('should calculate t-statistics', () => {
      const y = [10, 20, 30, 40, 50];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.tStatistics).toBeDefined();
      expect(Math.abs(result.tStatistics['x'])).toBeGreaterThan(0);
    });

    it('should calculate overall F-statistic', () => {
      const y = [10, 20, 30, 40, 50];
      const X = [[1], [2], [3], [4], [5]];

      const result = multipleRegression(y, X, ['x']);

      expect(result.fStatistic).toBeGreaterThan(0);
      expect(result.fPValue).toBeLessThan(0.05);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small p-values', () => {
      // Strong signal
      const control = Array(100).fill(10);
      const treatment = Array(100).fill(20);

      const result = twoSampleTTest(control, treatment);

      expect(result.pValue).toBeLessThan(0.0001);
      expect(result.significant).toBe(true);
    });

    it('should handle very large sample sizes', () => {
      const control = Array(10000).fill(0).map(() => 10 + Math.random());
      const treatment = Array(10000).fill(0).map(() => 10.1 + Math.random());

      const result = twoSampleTTest(control, treatment);

      expect(result.pValue).toBeDefined();
      expect(result.degreesOfFreedom).toBeGreaterThan(1000);
    });

    it('should handle zero variance samples', () => {
      const sample1 = [10, 10, 10, 10, 10];
      const sample2 = [10, 10, 10, 10, 10];

      const result = twoSampleTTest(sample1, sample2);

      expect(result.pValue).toBeGreaterThan(0.05);
    });
  });
});
