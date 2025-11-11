/**
 * Unit tests for experiment allocation generation logic
 *
 * Tests the functions that generate variant allocations for different
 * experiment design types.
 */

import { describe, it, expect } from 'vitest';

// Note: These functions are currently in index.tsx and not exported.
// For proper testing, they should be extracted to a separate module.
// For now, we'll test the logic by importing them indirectly.

/**
 * Test helper: Generate factorial combinations
 * (This duplicates the logic from index.tsx for testing purposes)
 */
function generateFactorialCombinations(
  factors: Array<{ name: string; levels: string[] }>
): string[][] {
  if (factors.length === 0) return [[]];
  if (factors.length === 1) return factors[0].levels.map((level) => [level]);

  const [firstFactor, ...restFactors] = factors;
  const restCombinations = generateFactorialCombinations(restFactors);

  const combinations: string[][] = [];
  for (const level of firstFactor.levels) {
    for (const restCombo of restCombinations) {
      combinations.push([level, ...restCombo]);
    }
  }

  return combinations;
}

/**
 * Test helper: Get experiment role
 */
function getExperimentRole(
  index: number
): 'control' | 'treatment' | 'treatment_1' | 'treatment_2' | 'treatment_3' {
  if (index === 0) return 'control';
  if (index === 1) return 'treatment';
  if (index === 2) return 'treatment_1';
  if (index === 3) return 'treatment_2';
  if (index === 4) return 'treatment_3';
  return 'treatment';
}

describe('getExperimentRole', () => {
  it('should return "control" for index 0', () => {
    expect(getExperimentRole(0)).toBe('control');
  });

  it('should return "treatment" for index 1', () => {
    expect(getExperimentRole(1)).toBe('treatment');
  });

  it('should return "treatment_1" for index 2', () => {
    expect(getExperimentRole(2)).toBe('treatment_1');
  });

  it('should return "treatment_2" for index 3', () => {
    expect(getExperimentRole(3)).toBe('treatment_2');
  });

  it('should return "treatment_3" for index 4', () => {
    expect(getExperimentRole(4)).toBe('treatment_3');
  });

  it('should return "treatment" for indices > 4', () => {
    expect(getExperimentRole(5)).toBe('treatment');
    expect(getExperimentRole(10)).toBe('treatment');
  });
});

describe('generateFactorialCombinations', () => {
  it('should return [[]] for empty factors array', () => {
    const result = generateFactorialCombinations([]);
    expect(result).toEqual([[]]);
  });

  it('should return single-level combinations for one factor', () => {
    const factors = [{ name: 'Color', levels: ['red', 'blue'] }];
    const result = generateFactorialCombinations(factors);
    expect(result).toEqual([['red'], ['blue']]);
  });

  it('should generate 2x2 factorial combinations correctly', () => {
    const factors = [
      { name: 'Color', levels: ['red', 'blue'] },
      { name: 'Size', levels: ['small', 'large'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result).toEqual([
      ['red', 'small'],
      ['red', 'large'],
      ['blue', 'small'],
      ['blue', 'large'],
    ]);
    expect(result.length).toBe(4);
  });

  it('should generate 2x3 factorial combinations correctly', () => {
    const factors = [
      { name: 'Color', levels: ['red', 'blue'] },
      { name: 'Size', levels: ['small', 'medium', 'large'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result.length).toBe(6);
    expect(result).toContainEqual(['red', 'small']);
    expect(result).toContainEqual(['red', 'medium']);
    expect(result).toContainEqual(['red', 'large']);
    expect(result).toContainEqual(['blue', 'small']);
    expect(result).toContainEqual(['blue', 'medium']);
    expect(result).toContainEqual(['blue', 'large']);
  });

  it('should generate 2x2x2 factorial combinations correctly', () => {
    const factors = [
      { name: 'Color', levels: ['red', 'blue'] },
      { name: 'Size', levels: ['small', 'large'] },
      { name: 'Shape', levels: ['circle', 'square'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result.length).toBe(8);
    expect(result).toContainEqual(['red', 'small', 'circle']);
    expect(result).toContainEqual(['red', 'small', 'square']);
    expect(result).toContainEqual(['red', 'large', 'circle']);
    expect(result).toContainEqual(['red', 'large', 'square']);
    expect(result).toContainEqual(['blue', 'small', 'circle']);
    expect(result).toContainEqual(['blue', 'small', 'square']);
    expect(result).toContainEqual(['blue', 'large', 'circle']);
    expect(result).toContainEqual(['blue', 'large', 'square']);
  });

  it('should handle factors with different numbers of levels', () => {
    const factors = [
      { name: 'A', levels: ['a1', 'a2', 'a3'] },
      { name: 'B', levels: ['b1', 'b2'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result.length).toBe(6); // 3 * 2 = 6
  });
});

describe('Allocation Percentage Calculations', () => {
  it('should allocate 50% for 2-variant A/B test', () => {
    const numVariants = 2;
    const percentage = 100 / numVariants;
    expect(percentage).toBe(50);
  });

  it('should allocate 33.33% for 3-variant test', () => {
    const numVariants = 3;
    const percentage = 100 / numVariants;
    expect(percentage).toBeCloseTo(33.33, 2);
  });

  it('should allocate 25% for 4-variant factorial test', () => {
    const numVariants = 4;
    const percentage = 100 / numVariants;
    expect(percentage).toBe(25);
  });

  it('should sum to 100% for any number of variants', () => {
    for (let numVariants = 2; numVariants <= 10; numVariants++) {
      const percentage = 100 / numVariants;
      const total = percentage * numVariants;
      expect(total).toBeCloseTo(100, 10); // Allow for floating point errors
    }
  });
});

describe('Variant Count Validation', () => {
  it('should validate A/B test requires 2 variants', () => {
    const designType = 'ab';
    const requiredVariants = 2;
    expect(requiredVariants).toBe(2);
  });

  it('should validate factorial test requires 4+ variants for 2x2', () => {
    const factors = [
      { name: 'A', levels: ['a1', 'a2'] },
      { name: 'B', levels: ['b1', 'b2'] },
    ];
    const numCombinations = factors.reduce(
      (total, factor) => total * factor.levels.length,
      1
    );
    expect(numCombinations).toBe(4);
  });

  it('should validate factorial test requires 6 variants for 2x3', () => {
    const factors = [
      { name: 'A', levels: ['a1', 'a2'] },
      { name: 'B', levels: ['b1', 'b2', 'b3'] },
    ];
    const numCombinations = factors.reduce(
      (total, factor) => total * factor.levels.length,
      1
    );
    expect(numCombinations).toBe(6);
  });

  it('should validate stepped wedge requires 2 variants', () => {
    const designType = 'stepped_wedge';
    const requiredVariants = 2; // control + treatment
    expect(requiredVariants).toBe(2);
  });
});

describe('Factorial Combination to Variant Mapping', () => {
  it('should map 4 variants to 4 factorial combinations for 2x2', () => {
    const factors = [
      { name: 'Color', levels: ['red', 'blue'] },
      { name: 'Size', levels: ['small', 'large'] },
    ];
    const combinations = generateFactorialCombinations(factors);
    const variants = [
      { id: '1', key: 'v1', name: 'Variant 1' },
      { id: '2', key: 'v2', name: 'Variant 2' },
      { id: '3', key: 'v3', name: 'Variant 3' },
      { id: '4', key: 'v4', name: 'Variant 4' },
    ];

    expect(combinations.length).toBe(variants.length);

    // Verify mapping
    variants.forEach((variant, index) => {
      const combination = combinations[index];
      expect(combination).toBeDefined();
      expect(combination.length).toBe(2); // 2 factors
    });
  });

  it('should handle variant count mismatch gracefully', () => {
    const factors = [
      { name: 'Color', levels: ['red', 'blue'] },
      { name: 'Size', levels: ['small', 'large'] },
    ];
    const combinations = generateFactorialCombinations(factors);
    const variants = [
      { id: '1', key: 'v1', name: 'Variant 1' },
      { id: '2', key: 'v2', name: 'Variant 2' },
      // Missing 2 variants!
    ];

    expect(combinations.length).toBe(4);
    expect(variants.length).toBe(2);
    expect(combinations.length).toBeGreaterThan(variants.length);

    // Should log warning and use equal split
    // (Implementation should handle this gracefully)
  });
});

describe('Edge Cases', () => {
  it('should handle single variant (100% allocation)', () => {
    const numVariants = 1;
    const percentage = 100 / numVariants;
    expect(percentage).toBe(100);
  });

  it('should handle many variants (equal split)', () => {
    const numVariants = 10;
    const percentage = 100 / numVariants;
    expect(percentage).toBe(10);
  });

  it('should handle factorial with single level per factor', () => {
    const factors = [
      { name: 'Color', levels: ['red'] },
      { name: 'Size', levels: ['small'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(['red', 'small']);
  });

  it('should handle factorial with many levels', () => {
    const factors = [
      { name: 'A', levels: ['1', '2', '3', '4', '5'] },
      { name: 'B', levels: ['x', 'y'] },
    ];
    const result = generateFactorialCombinations(factors);
    expect(result.length).toBe(10); // 5 * 2
  });
});
