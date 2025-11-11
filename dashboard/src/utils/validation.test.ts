/**
 * Unit tests for validation schemas and functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateExperimentKey,
  validateExperimentName,
  validatePrimaryMetric,
  validateVariantCount,
  validateVariantAllocations,
  validatePowerAnalysis,
  validateFactorialConfig,
  validateSwitchbackConfig,
  validateSteppedWedgeConfig,
  validateStep3,
} from './validation';

describe('validateExperimentKey', () => {
  it('should accept valid experiment keys', () => {
    expect(validateExperimentKey('my-experiment').success).toBe(true);
    expect(validateExperimentKey('test-123').success).toBe(true);
    expect(validateExperimentKey('checkout-flow-2025').success).toBe(true);
    expect(validateExperimentKey('abc').success).toBe(true); // min length
  });

  it('should reject keys that are too short', () => {
    const result = validateExperimentKey('ab');
    expect(result.success).toBe(false);
    expect(result.errors.experimentKey).toContain('at least 3 characters');
  });

  it('should reject keys that are too long', () => {
    const longKey = 'a'.repeat(51);
    const result = validateExperimentKey(longKey);
    expect(result.success).toBe(false);
    expect(result.errors.experimentKey).toContain('at most 50 characters');
  });

  it('should reject keys with uppercase letters', () => {
    const result = validateExperimentKey('MyExperiment');
    expect(result.success).toBe(false);
    expect(result.errors.experimentKey).toContain('lowercase');
  });

  it('should reject keys with underscores', () => {
    const result = validateExperimentKey('my_experiment');
    expect(result.success).toBe(false);
    expect(result.errors.experimentKey).toContain('lowercase');
  });

  it('should reject keys with spaces', () => {
    const result = validateExperimentKey('my experiment');
    expect(result.success).toBe(false);
  });

  it('should reject keys starting with hyphen', () => {
    const result = validateExperimentKey('-experiment');
    expect(result.success).toBe(false);
  });

  it('should reject keys ending with hyphen', () => {
    const result = validateExperimentKey('experiment-');
    expect(result.success).toBe(false);
  });

  it('should reject keys with consecutive hyphens', () => {
    const result = validateExperimentKey('my--experiment');
    expect(result.success).toBe(false);
  });
});

describe('validateExperimentName', () => {
  it('should accept valid experiment names', () => {
    expect(validateExperimentName('My Experiment').success).toBe(true);
    expect(validateExperimentName('Checkout Button Test 2025').success).toBe(true);
    expect(validateExperimentName('abc').success).toBe(true); // min length
  });

  it('should reject names that are too short', () => {
    const result = validateExperimentName('ab');
    expect(result.success).toBe(false);
    expect(result.errors.experimentName).toContain('at least 3 characters');
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(101);
    const result = validateExperimentName(longName);
    expect(result.success).toBe(false);
    expect(result.errors.experimentName).toContain('at most 100 characters');
  });

  it('should trim whitespace', () => {
    const result = validateExperimentName('  Valid Name  ');
    expect(result.success).toBe(true);
  });
});

describe('validatePrimaryMetric', () => {
  it('should accept valid metric names', () => {
    expect(validatePrimaryMetric('conversion_rate').success).toBe(true);
    expect(validatePrimaryMetric('Revenue').success).toBe(true);
    expect(validatePrimaryMetric('CTR').success).toBe(true);
  });

  it('should reject empty metric names', () => {
    const result = validatePrimaryMetric('');
    expect(result.success).toBe(false);
    expect(result.errors.primaryMetric).toContain('cannot be empty');
  });

  it('should reject metric names that are too long', () => {
    const longMetric = 'a'.repeat(101);
    const result = validatePrimaryMetric(longMetric);
    expect(result.success).toBe(false);
    expect(result.errors.primaryMetric).toContain('at most 100 characters');
  });
});

describe('validateVariantCount', () => {
  it('should accept 2 variants for A/B test', () => {
    const result = validateVariantCount('ab', 2);
    expect(result.success).toBe(true);
  });

  it('should reject non-2 variants for A/B test', () => {
    const result1 = validateVariantCount('ab', 1);
    expect(result1.success).toBe(false);
    expect(result1.errors.variantCount).toContain('exactly 2 variants');

    const result2 = validateVariantCount('ab', 3);
    expect(result2.success).toBe(false);
  });

  it('should accept 4+ variants for factorial design', () => {
    expect(validateVariantCount('factorial', 4).success).toBe(true);
    expect(validateVariantCount('factorial', 6).success).toBe(true);
    expect(validateVariantCount('factorial', 8).success).toBe(true);
  });

  it('should reject <4 variants for factorial design', () => {
    const result = validateVariantCount('factorial', 2);
    expect(result.success).toBe(false);
    expect(result.errors.variantCount).toContain('at least 4 variants');
  });

  it('should accept 2+ variants for switchback', () => {
    expect(validateVariantCount('switchback', 2).success).toBe(true);
    expect(validateVariantCount('switchback', 3).success).toBe(true);
  });

  it('should reject <2 variants for switchback', () => {
    const result = validateVariantCount('switchback', 1);
    expect(result.success).toBe(false);
    expect(result.errors.variantCount).toContain('at least 2 variants');
  });

  it('should accept 2 variants for stepped wedge', () => {
    const result = validateVariantCount('stepped_wedge', 2);
    expect(result.success).toBe(true);
  });

  it('should reject non-2 variants for stepped wedge', () => {
    const result1 = validateVariantCount('stepped_wedge', 1);
    expect(result1.success).toBe(false);
    expect(result1.errors.variantCount).toContain('exactly 2 variants');

    const result2 = validateVariantCount('stepped_wedge', 3);
    expect(result2.success).toBe(false);
  });
});

describe('validateVariantAllocations', () => {
  it('should accept allocations that sum to 100%', () => {
    const allocations = [
      {
        flagVariantId: '1',
        flagVariantKey: 'v1',
        experimentRole: 'control' as const,
        allocationPercentage: 50,
      },
      {
        flagVariantId: '2',
        flagVariantKey: 'v2',
        experimentRole: 'treatment' as const,
        allocationPercentage: 50,
      },
    ];
    const result = validateVariantAllocations(allocations);
    expect(result.success).toBe(true);
  });

  it('should reject allocations that do not sum to 100%', () => {
    const allocations = [
      {
        flagVariantId: '1',
        flagVariantKey: 'v1',
        experimentRole: 'control' as const,
        allocationPercentage: 40,
      },
      {
        flagVariantId: '2',
        flagVariantKey: 'v2',
        experimentRole: 'treatment' as const,
        allocationPercentage: 50,
      },
    ];
    const result = validateVariantAllocations(allocations);
    expect(result.success).toBe(false);
    expect(result.errors.variantAllocations).toContain('sum to 100%');
  });

  it('should reject fewer than 2 allocations', () => {
    const allocations = [
      {
        flagVariantId: '1',
        flagVariantKey: 'v1',
        experimentRole: 'control' as const,
        allocationPercentage: 100,
      },
    ];
    const result = validateVariantAllocations(allocations);
    expect(result.success).toBe(false);
    expect(result.errors.variantAllocations).toContain('At least 2');
  });

  it('should accept allocations with small floating point errors', () => {
    const allocations = [
      {
        flagVariantId: '1',
        flagVariantKey: 'v1',
        experimentRole: 'control' as const,
        allocationPercentage: 33.33,
      },
      {
        flagVariantId: '2',
        flagVariantKey: 'v2',
        experimentRole: 'treatment' as const,
        allocationPercentage: 33.33,
      },
      {
        flagVariantId: '3',
        flagVariantKey: 'v3',
        experimentRole: 'treatment_1' as const,
        allocationPercentage: 33.34,
      },
    ];
    const result = validateVariantAllocations(allocations);
    expect(result.success).toBe(true);
  });
});

describe('validatePowerAnalysis', () => {
  it('should accept valid power analysis', () => {
    const powerAnalysis = {
      baselineValue: 0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0.05,
      power: 0.8,
      requiredSampleSize: 1000,
    };
    const result = validatePowerAnalysis(powerAnalysis);
    expect(result.success).toBe(true);
  });

  it('should reject negative baseline value', () => {
    const powerAnalysis = {
      baselineValue: -0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0.05,
      power: 0.8,
      requiredSampleSize: 1000,
    };
    const result = validatePowerAnalysis(powerAnalysis);
    expect(result.success).toBe(false);
  });

  it('should reject invalid alpha values', () => {
    const result1 = validatePowerAnalysis({
      baselineValue: 0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0,
      power: 0.8,
      requiredSampleSize: 1000,
    });
    expect(result1.success).toBe(false);

    const result2 = validatePowerAnalysis({
      baselineValue: 0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0.6,
      power: 0.8,
      requiredSampleSize: 1000,
    });
    expect(result2.success).toBe(false);
  });

  it('should reject invalid power values', () => {
    const result1 = validatePowerAnalysis({
      baselineValue: 0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0.05,
      power: 0.4,
      requiredSampleSize: 1000,
    });
    expect(result1.success).toBe(false);

    const result2 = validatePowerAnalysis({
      baselineValue: 0.1,
      minimumDetectableEffect: 0.02,
      alpha: 0.05,
      power: 1.0,
      requiredSampleSize: 1000,
    });
    expect(result2.success).toBe(false);
  });
});

describe('validateFactorialConfig', () => {
  it('should accept valid factorial config', () => {
    const config = {
      factors: [
        { name: 'Color', levels: ['red', 'blue'] },
        { name: 'Size', levels: ['small', 'large'] },
      ],
    };
    const result = validateFactorialConfig(config);
    expect(result.success).toBe(true);
  });

  it('should reject fewer than 2 factors', () => {
    const config = {
      factors: [{ name: 'Color', levels: ['red', 'blue'] }],
    };
    const result = validateFactorialConfig(config);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain('at least 2 factors');
  });

  it('should reject factors with fewer than 2 levels', () => {
    const config = {
      factors: [
        { name: 'Color', levels: ['red'] },
        { name: 'Size', levels: ['small', 'large'] },
      ],
    };
    const result = validateFactorialConfig(config);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain('at least 2 levels');
  });
});

describe('validateSwitchbackConfig', () => {
  it('should accept valid switchback config', () => {
    const config = {
      periodLengthMinutes: 30,
      washoutPeriodMinutes: 5,
      numPeriods: 48,
    };
    const result = validateSwitchbackConfig(config);
    expect(result.success).toBe(true);
  });

  it('should reject invalid period length', () => {
    const config = {
      periodLengthMinutes: 0,
      washoutPeriodMinutes: 5,
      numPeriods: 48,
    };
    const result = validateSwitchbackConfig(config);
    expect(result.success).toBe(false);
  });

  it('should reject fewer than 2 periods', () => {
    const config = {
      periodLengthMinutes: 30,
      washoutPeriodMinutes: 5,
      numPeriods: 1,
    };
    const result = validateSwitchbackConfig(config);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain('At least 2 periods');
  });
});

describe('validateSteppedWedgeConfig', () => {
  it('should accept valid stepped wedge config', () => {
    const config = {
      clusters: ['cluster1', 'cluster2', 'cluster3'],
      stepsPerCluster: 4,
      stepLengthDays: 7,
    };
    const result = validateSteppedWedgeConfig(config);
    expect(result.success).toBe(true);
  });

  it('should reject fewer than 2 clusters', () => {
    const config = {
      clusters: ['cluster1'],
      stepsPerCluster: 4,
      stepLengthDays: 7,
    };
    const result = validateSteppedWedgeConfig(config);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.errors)).toContain('At least 2 clusters');
  });

  it('should reject invalid step length', () => {
    const config = {
      clusters: ['cluster1', 'cluster2'],
      stepsPerCluster: 4,
      stepLengthDays: 0,
    };
    const result = validateSteppedWedgeConfig(config);
    expect(result.success).toBe(false);
  });
});

describe('validateStep3', () => {
  it('should accept valid Step 3 data', () => {
    const data = {
      experimentName: 'My Experiment',
      experimentKey: 'my-experiment',
      primaryMetric: 'conversion_rate',
      secondaryMetrics: ['revenue', 'engagement'],
    };
    const result = validateStep3(data);
    expect(result.success).toBe(true);
  });

  it('should reject invalid experiment key', () => {
    const data = {
      experimentName: 'My Experiment',
      experimentKey: 'My_Experiment',
      primaryMetric: 'conversion_rate',
      secondaryMetrics: [],
    };
    const result = validateStep3(data);
    expect(result.success).toBe(false);
    expect(result.errors.experimentKey).toBeDefined();
  });

  it('should reject empty primary metric', () => {
    const data = {
      experimentName: 'My Experiment',
      experimentKey: 'my-experiment',
      primaryMetric: '',
      secondaryMetrics: [],
    };
    const result = validateStep3(data);
    expect(result.success).toBe(false);
    expect(result.errors.primaryMetric).toBeDefined();
  });

  it('should validate description if provided', () => {
    const data = {
      experimentName: 'My Experiment',
      experimentKey: 'my-experiment',
      description: 'a'.repeat(501), // Too long
      primaryMetric: 'conversion',
      secondaryMetrics: [],
    };
    const result = validateStep3(data);
    expect(result.success).toBe(false);
    expect(result.errors.description).toBeDefined();
  });
});
