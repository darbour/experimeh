/**
 * Statistical Validation Tests for Factorial Independence
 * Verifies factors are independent using correlation tests
 */

import {
  assignFactorial,
  ExperimentConfig,
} from '../../src/core/assignment';
import { hashFactorialFactor } from '../../src/core/hash';

describe('Factorial Independence Statistical Validation', () => {
  const createFactorialExperiment = (): ExperimentConfig => ({
    id: 'factorial-independence',
    key: 'factorial_independence',
    variants: [
      { key: 'blue_small', name: 'Blue Small', allocation: 25 },
      { key: 'blue_large', name: 'Blue Large', allocation: 25 },
      { key: 'green_small', name: 'Green Small', allocation: 25 },
      { key: 'green_large', name: 'Green Large', allocation: 25 },
    ],
    trafficAllocation: 100,
    designType: 'factorial',
    designConfig: {
      factors: [
        { name: 'color', levels: ['blue', 'green'] },
        { name: 'size', levels: ['small', 'large'] },
      ],
    },
    randomizationUnit: 'user',
    startDate: new Date('2025-01-01'),
  });

  describe('2x2 Factorial Independence', () => {
    it('should assign factors independently with 10,000 users', () => {
      const experiment = createFactorialExperiment();
      const numUsers = 10000;

      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      // Count all four combinations
      const combinations = {
        blue_small: 0,
        blue_large: 0,
        green_small: 0,
        green_large: 0,
      };

      assignments.forEach(a => {
        const color = a.factorAssignments!['color'];
        const size = a.factorAssignments!['size'];
        const key = `${color}_${size}`;
        combinations[key as keyof typeof combinations]++;
      });

      // Each combination should be ~25% (2500 ± 200)
      Object.values(combinations).forEach(count => {
        expect(count).toBeGreaterThan(2300);
        expect(count).toBeLessThan(2700);
      });
    });

    it('should verify zero correlation between factors', () => {
      const experiment = createFactorialExperiment();
      const numUsers = 10000;

      const colorValues: number[] = [];
      const sizeValues: number[] = [];

      for (let i = 0; i < numUsers; i++) {
        const assignment = assignFactorial(experiment, `user-${i}`);
        // Convert to numeric: blue=0, green=1, small=0, large=1
        colorValues.push(assignment.factorAssignments!['color'] === 'green' ? 1 : 0);
        sizeValues.push(assignment.factorAssignments!['size'] === 'large' ? 1 : 0);
      }

      // Calculate Pearson correlation
      const correlation = calculateCorrelation(colorValues, sizeValues);

      // Correlation should be very close to 0 (independent)
      expect(Math.abs(correlation)).toBeLessThan(0.05);
    });

    it('should maintain marginal distributions of 50/50', () => {
      const experiment = createFactorialExperiment();
      const numUsers = 10000;

      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      const colorCounts = { blue: 0, green: 0 };
      const sizeCounts = { small: 0, large: 0 };

      assignments.forEach(a => {
        colorCounts[a.factorAssignments!['color'] as 'blue' | 'green']++;
        sizeCounts[a.factorAssignments!['size'] as 'small' | 'large']++;
      });

      // Each factor level should be ~50% (5000 ± 300)
      expect(colorCounts.blue).toBeGreaterThan(4700);
      expect(colorCounts.blue).toBeLessThan(5300);
      expect(colorCounts.green).toBeGreaterThan(4700);
      expect(colorCounts.green).toBeLessThan(5300);

      expect(sizeCounts.small).toBeGreaterThan(4700);
      expect(sizeCounts.small).toBeLessThan(5300);
      expect(sizeCounts.large).toBeGreaterThan(4700);
      expect(sizeCounts.large).toBeLessThan(5300);
    });
  });

  describe('3x3 Factorial Independence', () => {
    it('should verify independence in 3x3 design', () => {
      const experiment: ExperimentConfig = {
        id: 'factorial-3x3',
        key: 'factorial_3x3',
        variants: Array.from({ length: 9 }, (_, i) => ({
          key: `v${i}`,
          name: `V${i}`,
          allocation: 100 / 9,
        })),
        trafficAllocation: 100,
        designType: 'factorial',
        designConfig: {
          factors: [
            { name: 'factor_a', levels: ['a1', 'a2', 'a3'] },
            { name: 'factor_b', levels: ['b1', 'b2', 'b3'] },
          ],
        },
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const numUsers = 9000;
      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      // Count combinations
      const counts: Record<string, number> = {};
      assignments.forEach(a => {
        const key = `${a.factorAssignments!['factor_a']}_${a.factorAssignments!['factor_b']}`;
        counts[key] = (counts[key] || 0) + 1;
      });

      // Should have 9 combinations, each ~1000 ± 150
      expect(Object.keys(counts).length).toBe(9);
      Object.values(counts).forEach(count => {
        expect(count).toBeGreaterThan(850);
        expect(count).toBeLessThan(1150);
      });
    });
  });

  describe('Factor Hash Independence', () => {
    it('should generate independent hashes for different factors', () => {
      const numUsers = 10000;
      const correlations: number[] = [];

      // Test multiple pairs of factors
      const factorPairs = [
        ['color', 'size'],
        ['layout', 'cta_text'],
        ['image', 'headline'],
      ];

      factorPairs.forEach(([factor1, factor2]) => {
        const hashes1: number[] = [];
        const hashes2: number[] = [];

        for (let i = 0; i < numUsers; i++) {
          const userId = `user-${i}`;
          hashes1.push(hashFactorialFactor('exp-123', userId, factor1) % 2);
          hashes2.push(hashFactorialFactor('exp-123', userId, factor2) % 2);
        }

        const correlation = calculateCorrelation(hashes1, hashes2);
        correlations.push(Math.abs(correlation));
      });

      // All correlations should be near zero
      correlations.forEach(corr => {
        expect(corr).toBeLessThan(0.05);
      });
    });
  });

  describe('Chi-Square Independence Test', () => {
    it('should pass chi-square test for independence', () => {
      const experiment = createFactorialExperiment();
      const numUsers = 10000;

      const assignments = Array.from({ length: numUsers }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      // Create contingency table
      const observed = [
        [0, 0], // blue: [small, large]
        [0, 0], // green: [small, large]
      ];

      assignments.forEach(a => {
        const colorIdx = a.factorAssignments!['color'] === 'blue' ? 0 : 1;
        const sizeIdx = a.factorAssignments!['size'] === 'small' ? 0 : 1;
        observed[colorIdx][sizeIdx]++;
      });

      // Calculate chi-square statistic
      const chiSquare = calculateChiSquare(observed);

      // For 1 degree of freedom, critical value at α=0.05 is 3.841
      // We expect chi-square to be much lower (indicating independence)
      expect(chiSquare).toBeLessThan(10);
    });
  });
});

/**
 * Helper: Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Helper: Calculate chi-square statistic for 2x2 table
 */
function calculateChiSquare(observed: number[][]): number {
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = [
    observed[0][0] + observed[1][0],
    observed[0][1] + observed[1][1],
  ];
  const total = rowTotals.reduce((a, b) => a + b, 0);

  let chiSquare = 0;

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / total;
      const diff = observed[i][j] - expected;
      chiSquare += (diff * diff) / expected;
    }
  }

  return chiSquare;
}
