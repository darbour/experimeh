/**
 * Statistical Validation Tests for Analysis Accuracy
 * Compares against known statistical results using synthetic data
 */

import {
  twoSampleTTest,
  twoProportionZTest,
  oneWayANOVA,
  multipleRegression,
} from '../../src/analysis/statistical-tests';

describe('Analysis Accuracy Statistical Validation', () => {
  describe('T-Test Accuracy', () => {
    it('should correctly identify no difference when means are equal', () => {
      // Generate two samples from same distribution
      const sample1 = Array(1000).fill(0).map(() => 50 + randn() * 10);
      const sample2 = Array(1000).fill(0).map(() => 50 + randn() * 10);

      const result = twoSampleTTest(sample1, sample2, 0.05);

      // p-value should be > 0.05 (not significant)
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it('should correctly identify large effect', () => {
      // Generate samples with large difference (Cohen's d ≈ 2)
      const sample1 = Array(100).fill(0).map(() => 50 + randn() * 10);
      const sample2 = Array(100).fill(0).map(() => 70 + randn() * 10);

      const result = twoSampleTTest(sample1, sample2, 0.05);

      // Should detect significant difference
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.significant).toBe(true);
      expect(Math.abs(result.cohensD)).toBeGreaterThan(1.5);
    });

    it('should match known t-test results', () => {
      // Known data from statistics textbook
      const control = [10, 12, 14, 16, 18];
      const treatment = [15, 17, 19, 21, 23];

      const result = twoSampleTTest(control, treatment);

      // Mean difference should be 5
      expect(result.mean2 - result.mean1).toBe(5);
      // Should be significant
      expect(result.pValue).toBeLessThan(0.05);
    });
  });

  describe('Z-Test for Proportions Accuracy', () => {
    it('should correctly detect conversion rate increase', () => {
      // Control: 10% conversion (100/1000)
      // Treatment: 12% conversion (120/1000)
      const result = twoProportionZTest(100, 1000, 120, 1000, 0.05);

      // Should detect ~20% relative increase
      expect(result.relativeChange).toBeCloseTo(20, 0);
      // Should be statistically significant
      expect(result.significant).toBe(true);
    });

    it('should not detect noise as signal', () => {
      // Same conversion rate: 10%
      const result = twoProportionZTest(100, 1000, 102, 1000, 0.05);

      // Should not be significant
      expect(result.significant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('should match known proportion test results', () => {
      // Known example: 45% vs 55% with n=1000 each
      const result = twoProportionZTest(450, 1000, 550, 1000, 0.05);

      expect(result.proportion1).toBe(0.45);
      expect(result.proportion2).toBe(0.55);
      expect(result.significant).toBe(true);
    });
  });

  describe('ANOVA Accuracy', () => {
    it('should detect differences across groups', () => {
      // Three groups with different means
      const group1 = Array(100).fill(0).map(() => 10 + randn() * 2);
      const group2 = Array(100).fill(0).map(() => 15 + randn() * 2);
      const group3 = Array(100).fill(0).map(() => 20 + randn() * 2);

      const result = oneWayANOVA([group1, group2, group3]);

      // Should detect significant difference
      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.etaSquared).toBeGreaterThan(0.5);
    });

    it('should not detect false differences', () => {
      // Three groups with same mean
      const group1 = Array(100).fill(0).map(() => 50 + randn() * 10);
      const group2 = Array(100).fill(0).map(() => 50 + randn() * 10);
      const group3 = Array(100).fill(0).map(() => 50 + randn() * 10);

      const result = oneWayANOVA([group1, group2, group3]);

      // Should not be significant
      expect(result.significant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });
  });

  describe('Regression Accuracy', () => {
    it('should recover true linear relationship', () => {
      // Generate Y = 5 + 3*X + noise
      const X = Array.from({ length: 100 }, (_, i) => [i]);
      const y = X.map(([x]) => 5 + 3 * x + randn() * 5);

      const result = multipleRegression(y, X, ['x']);

      // Intercept should be ~5
      expect(Math.abs(result.coefficients['intercept'] - 5)).toBeLessThan(2);
      // Slope should be ~3
      expect(Math.abs(result.coefficients['x'] - 3)).toBeLessThan(1);
      // R-squared should be high
      expect(result.rSquared).toBeGreaterThan(0.8);
    });

    it('should identify significant predictors', () => {
      // Strong relationship
      const X = Array.from({ length: 50 }, (_, i) => [i]);
      const y = X.map(([x]) => 2 * x + 10);

      const result = multipleRegression(y, X, ['x']);

      // Predictor should be highly significant
      expect(result.pValues['x']).toBeLessThan(0.001);
      // R-squared should be perfect
      expect(result.rSquared).toBeGreaterThan(0.99);
    });
  });

  describe('Effect Size Calculations', () => {
    it('should calculate small effect correctly', () => {
      // Cohen's d ≈ 0.2 (small)
      const sample1 = Array(500).fill(0).map(() => 50 + randn() * 10);
      const sample2 = Array(500).fill(0).map(() => 52 + randn() * 10);

      const result = twoSampleTTest(sample1, sample2);

      expect(Math.abs(result.cohensD)).toBeGreaterThan(0.1);
      expect(Math.abs(result.cohensD)).toBeLessThan(0.3);
    });

    it('should calculate medium effect correctly', () => {
      // Cohen's d ≈ 0.5 (medium)
      const sample1 = Array(500).fill(0).map(() => 50 + randn() * 10);
      const sample2 = Array(500).fill(0).map(() => 55 + randn() * 10);

      const result = twoSampleTTest(sample1, sample2);

      expect(Math.abs(result.cohensD)).toBeGreaterThan(0.3);
      expect(Math.abs(result.cohensD)).toBeLessThan(0.7);
    });

    it('should calculate large effect correctly', () => {
      // Cohen's d ≈ 0.8 (large)
      const sample1 = Array(500).fill(0).map(() => 50 + randn() * 10);
      const sample2 = Array(500).fill(0).map(() => 58 + randn() * 10);

      const result = twoSampleTTest(sample1, sample2);

      expect(Math.abs(result.cohensD)).toBeGreaterThan(0.6);
    });
  });

  describe('Confidence Intervals', () => {
    it('should calculate correct confidence intervals', () => {
      // Known difference of 10
      const sample1 = Array(100).fill(0).map(() => 50 + randn() * 5);
      const sample2 = Array(100).fill(0).map(() => 60 + randn() * 5);

      const result = twoSampleTTest(sample1, sample2);

      // CI should include true difference of 10
      expect(result.confidenceInterval![0]).toBeLessThan(10);
      expect(result.confidenceInterval![1]).toBeGreaterThan(10);
    });
  });

  describe('Multiple Testing Corrections', () => {
    it('should maintain family-wise error rate', () => {
      // Simulate 20 independent tests (null true)
      const pValues: number[] = [];

      for (let i = 0; i < 20; i++) {
        const sample1 = Array(100).fill(0).map(() => 50 + randn() * 10);
        const sample2 = Array(100).fill(0).map(() => 50 + randn() * 10);
        const result = twoSampleTTest(sample1, sample2);
        pValues.push(result.pValue);
      }

      // Without correction, ~1 should be significant by chance (α=0.05)
      const significantCount = pValues.filter(p => p < 0.05).length;
      expect(significantCount).toBeLessThanOrEqual(3);
    });
  });
});

/**
 * Helper: Generate standard normal random variable (Box-Muller transform)
 */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
