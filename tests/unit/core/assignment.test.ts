/**
 * Unit Tests for Assignment Algorithms
 * Tests A/B, factorial, switchback, and within-subjects assignment
 */

import {
  assignSimpleAB,
  assignFactorial,
  assignSwitchback,
  assignWithinSubjects,
  assign,
  batchAssign,
  validateExperiment,
  isInExperimentTraffic,
  ExperimentConfig,
} from '../../../src/core/assignment';

describe('Assignment Algorithms', () => {
  describe('isInExperimentTraffic', () => {
    it('should include all users when traffic is 100%', () => {
      const results = Array.from({ length: 100 }, (_, i) =>
        isInExperimentTraffic('exp-123', `user-${i}`, 100)
      );
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should exclude all users when traffic is 0%', () => {
      const results = Array.from({ length: 100 }, (_, i) =>
        isInExperimentTraffic('exp-123', `user-${i}`, 0)
      );
      expect(results.every(r => r === false)).toBe(true);
    });

    it('should include approximately 50% when traffic is 50%', () => {
      const results = Array.from({ length: 10000 }, (_, i) =>
        isInExperimentTraffic('exp-123', `user-${i}`, 50)
      );
      const included = results.filter(r => r).length;

      // Should be around 5000 ± 300
      expect(included).toBeGreaterThan(4700);
      expect(included).toBeLessThan(5300);
    });

    it('should be deterministic for same user', () => {
      const result1 = isInExperimentTraffic('exp-123', 'user-456', 50);
      const result2 = isInExperimentTraffic('exp-123', 'user-456', 50);
      expect(result1).toBe(result2);
    });

    it('should be independent across experiments', () => {
      const exp1 = isInExperimentTraffic('exp-1', 'user-456', 50);
      const exp2 = isInExperimentTraffic('exp-2', 'user-456', 50);
      // May be same or different, but should be deterministic
      expect(typeof exp1).toBe('boolean');
      expect(typeof exp2).toBe('boolean');
    });
  });

  describe('assignSimpleAB', () => {
    const createABExperiment = (trafficAllocation = 100): ExperimentConfig => ({
      id: 'exp-123',
      key: 'test_ab',
      variants: [
        { key: 'control', name: 'Control', allocation: 50 },
        { key: 'treatment', name: 'Treatment', allocation: 50 },
      ],
      trafficAllocation,
      designType: 'ab',
      randomizationUnit: 'user',
      startDate: new Date('2025-01-01'),
    });

    it('should assign users to control or treatment', () => {
      const experiment = createABExperiment();
      const assignments = Array.from({ length: 100 }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      assignments.forEach(a => {
        expect(['control', 'treatment']).toContain(a.variantKey);
        expect(a.inExperiment).toBe(true);
      });
    });

    it('should distribute users roughly 50/50', () => {
      const experiment = createABExperiment();
      const assignments = Array.from({ length: 10000 }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const controlCount = assignments.filter(a => a.variantKey === 'control').length;
      const treatmentCount = assignments.filter(a => a.variantKey === 'treatment').length;

      // Should be around 5000 each ± 300
      expect(controlCount).toBeGreaterThan(4700);
      expect(controlCount).toBeLessThan(5300);
      expect(treatmentCount).toBeGreaterThan(4700);
      expect(treatmentCount).toBeLessThan(5300);
    });

    it('should be deterministic for same user', () => {
      const experiment = createABExperiment();
      const assignment1 = assignSimpleAB(experiment, 'user-456');
      const assignment2 = assignSimpleAB(experiment, 'user-456');

      expect(assignment1.variantKey).toBe(assignment2.variantKey);
      expect(assignment1.reason).toBe(assignment2.reason);
    });

    it('should respect traffic allocation', () => {
      const experiment = createABExperiment(50);
      const assignments = Array.from({ length: 10000 }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const excluded = assignments.filter(a => !a.inExperiment).length;
      // About 50% should be excluded (± 300)
      expect(excluded).toBeGreaterThan(4700);
      expect(excluded).toBeLessThan(5300);
    });

    it('should handle weighted allocations', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-weighted',
        key: 'test_weighted',
        variants: [
          { key: 'control', name: 'Control', allocation: 25 },
          { key: 'treatment', name: 'Treatment', allocation: 75 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const assignments = Array.from({ length: 10000 }, (_, i) =>
        assignSimpleAB(experiment, `user-${i}`)
      );

      const controlCount = assignments.filter(a => a.variantKey === 'control').length;
      const treatmentCount = assignments.filter(a => a.variantKey === 'treatment').length;

      // Control: ~2500 (±300), Treatment: ~7500 (±300)
      expect(controlCount).toBeGreaterThan(2200);
      expect(controlCount).toBeLessThan(2800);
      expect(treatmentCount).toBeGreaterThan(7200);
      expect(treatmentCount).toBeLessThan(7800);
    });

    it('should throw error if allocations do not sum to 100', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-invalid',
        key: 'test_invalid',
        variants: [
          { key: 'control', name: 'Control', allocation: 40 },
          { key: 'treatment', name: 'Treatment', allocation: 40 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      expect(() => assignSimpleAB(experiment, 'user-123')).toThrow(
        'Variant allocations must sum to 100'
      );
    });

    it('should include metadata in assignment result', () => {
      const experiment = createABExperiment();
      const assignment = assignSimpleAB(experiment, 'user-123');

      expect(assignment.metadata).toBeDefined();
      expect(assignment.metadata?.hashValue).toBeDefined();
      expect(assignment.metadata?.percentage).toBeDefined();
      expect(assignment.metadata?.allocation).toBeDefined();
    });
  });

  describe('assignFactorial', () => {
    const createFactorialExperiment = (): ExperimentConfig => ({
      id: 'exp-factorial',
      key: 'test_factorial',
      variants: [
        { key: 'button_color:blue_button_text:buy_now', name: 'Blue / Buy Now', allocation: 25 },
        { key: 'button_color:blue_button_text:purchase', name: 'Blue / Purchase', allocation: 25 },
        { key: 'button_color:green_button_text:buy_now', name: 'Green / Buy Now', allocation: 25 },
        { key: 'button_color:green_button_text:purchase', name: 'Green / Purchase', allocation: 25 },
      ],
      trafficAllocation: 100,
      designType: 'factorial',
      designConfig: {
        factors: [
          { name: 'button_color', levels: ['blue', 'green'] },
          { name: 'button_text', levels: ['buy_now', 'purchase'] },
        ],
      },
      randomizationUnit: 'user',
      startDate: new Date('2025-01-01'),
    });

    it('should assign all factors independently', () => {
      const experiment = createFactorialExperiment();
      const assignment = assignFactorial(experiment, 'user-123');

      expect(assignment.factorAssignments).toBeDefined();
      expect(assignment.factorAssignments['button_color']).toBeDefined();
      expect(assignment.factorAssignments['button_text']).toBeDefined();
      expect(['blue', 'green']).toContain(assignment.factorAssignments['button_color']);
      expect(['buy_now', 'purchase']).toContain(assignment.factorAssignments['button_text']);
    });

    it('should ensure factorial independence', () => {
      const experiment = createFactorialExperiment();
      const assignments = Array.from({ length: 10000 }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      // Count combinations
      const combinations = {
        'blue_buy_now': 0,
        'blue_purchase': 0,
        'green_buy_now': 0,
        'green_purchase': 0,
      };

      assignments.forEach(a => {
        const color = a.factorAssignments['button_color'];
        const text = a.factorAssignments['button_text'];
        const combo = `${color}_${text}`;
        combinations[combo as keyof typeof combinations]++;
      });

      // Each combination should appear ~2500 times (±300)
      Object.values(combinations).forEach(count => {
        expect(count).toBeGreaterThan(2200);
        expect(count).toBeLessThan(2800);
      });
    });

    it('should be deterministic for same user', () => {
      const experiment = createFactorialExperiment();
      const assignment1 = assignFactorial(experiment, 'user-456');
      const assignment2 = assignFactorial(experiment, 'user-456');

      expect(assignment1.factorAssignments).toEqual(assignment2.factorAssignments);
      expect(assignment1.variantKey).toBe(assignment2.variantKey);
    });

    it('should respect traffic allocation', () => {
      const experiment = createFactorialExperiment();
      experiment.trafficAllocation = 50;

      const assignments = Array.from({ length: 10000 }, (_, i) =>
        assignFactorial(experiment, `user-${i}`)
      );

      const excluded = assignments.filter(a => !a.inExperiment).length;
      expect(excluded).toBeGreaterThan(4700);
      expect(excluded).toBeLessThan(5300);
    });

    it('should throw error if no factors specified', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-invalid',
        key: 'test_invalid',
        variants: [],
        trafficAllocation: 100,
        designType: 'factorial',
        designConfig: {},
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      expect(() => assignFactorial(experiment, 'user-123')).toThrow(
        'Factorial experiment requires factors'
      );
    });

    it('should include metadata about factors', () => {
      const experiment = createFactorialExperiment();
      const assignment = assignFactorial(experiment, 'user-123');

      expect(assignment.metadata?.numFactors).toBe(2);
      expect(assignment.metadata?.totalCombinations).toBe(4);
    });
  });

  describe('assignSwitchback', () => {
    const createSwitchbackExperiment = (): ExperimentConfig => ({
      id: 'exp-switchback',
      key: 'test_switchback',
      variants: [
        { key: 'control', name: 'Control', allocation: 50 },
        { key: 'treatment', name: 'Treatment', allocation: 50 },
      ],
      trafficAllocation: 100,
      designType: 'switchback',
      designConfig: {
        periodMinutes: 60,
        washoutMinutes: 5,
      },
      randomizationUnit: 'user',
      startDate: new Date('2025-01-01T00:00:00Z'),
    });

    it('should assign all users in same period to same variant', () => {
      const experiment = createSwitchbackExperiment();
      const currentTime = new Date('2025-01-01T01:30:00Z'); // Period 1

      const assignments = Array.from({ length: 100 }, (_, i) =>
        assignSwitchback(experiment, currentTime)
      );

      const firstVariant = assignments[0].variantKey;
      expect(assignments.every(a => a.variantKey === firstVariant)).toBe(true);
    });

    it('should calculate correct period number', () => {
      const experiment = createSwitchbackExperiment();

      const period0 = assignSwitchback(experiment, new Date('2025-01-01T00:30:00Z'));
      const period1 = assignSwitchback(experiment, new Date('2025-01-01T01:30:00Z'));
      const period2 = assignSwitchback(experiment, new Date('2025-01-01T02:30:00Z'));

      expect(period0.periodNumber).toBe(0);
      expect(period1.periodNumber).toBe(1);
      expect(period2.periodNumber).toBe(2);
    });

    it('should switch variants between periods', () => {
      const experiment = createSwitchbackExperiment();

      const assignments = Array.from({ length: 10 }, (_, i) => {
        const time = new Date('2025-01-01T00:00:00Z');
        time.setMinutes(i * 65); // Move through periods
        return assignSwitchback(experiment, time);
      });

      // Should see both variants at least once
      const variants = new Set(assignments.map(a => a.variantKey));
      expect(variants.size).toBeGreaterThan(1);
    });

    it('should handle washout periods', () => {
      const experiment = createSwitchbackExperiment();

      // Time in washout period (55-60 minutes into period)
      const washoutTime = new Date('2025-01-01T00:58:00Z');
      const assignment = assignSwitchback(experiment, washoutTime);

      expect(assignment.inExperiment).toBe(false);
      expect(assignment.reason).toBe('in_washout_period');
    });

    it('should not be in washout during active period', () => {
      const experiment = createSwitchbackExperiment();

      // Time in active period (30 minutes into period)
      const activeTime = new Date('2025-01-01T00:30:00Z');
      const assignment = assignSwitchback(experiment, activeTime);

      expect(assignment.inExperiment).toBe(true);
      expect(assignment.reason).toBe('assigned_switchback_period');
    });

    it('should include period boundaries in result', () => {
      const experiment = createSwitchbackExperiment();
      const currentTime = new Date('2025-01-01T01:30:00Z');
      const assignment = assignSwitchback(experiment, currentTime);

      expect(assignment.periodStart).toBeDefined();
      expect(assignment.periodEnd).toBeDefined();
      expect(assignment.periodStart.getTime()).toBeLessThan(assignment.periodEnd.getTime());
    });

    it('should throw error if periodMinutes not specified', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-invalid',
        key: 'test_invalid',
        variants: [{ key: 'control', name: 'Control', allocation: 100 }],
        trafficAllocation: 100,
        designType: 'switchback',
        designConfig: {},
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      expect(() => assignSwitchback(experiment)).toThrow(
        'Switchback experiment requires periodMinutes'
      );
    });
  });

  describe('assignWithinSubjects', () => {
    const createWithinSubjectsExperiment = (): ExperimentConfig => ({
      id: 'exp-within',
      key: 'test_within',
      variants: [
        { key: 'v1', name: 'Variant 1', allocation: 33.33 },
        { key: 'v2', name: 'Variant 2', allocation: 33.33 },
        { key: 'v3', name: 'Variant 3', allocation: 33.34 },
      ],
      trafficAllocation: 100,
      designType: 'within_subjects',
      designConfig: {
        counterbalancingScheme: 'latin_square',
      },
      randomizationUnit: 'user',
      startDate: new Date('2025-01-01'),
    });

    it('should assign different variants across sessions', () => {
      const experiment = createWithinSubjectsExperiment();
      const assignments = [
        assignWithinSubjects(experiment, 'user-123', 0),
        assignWithinSubjects(experiment, 'user-123', 1),
        assignWithinSubjects(experiment, 'user-123', 2),
      ];

      const variants = new Set(assignments.map(a => a.variantKey));
      expect(variants.size).toBe(3); // All three variants
    });

    it('should ensure all variants appear once per cycle', () => {
      const experiment = createWithinSubjectsExperiment();
      const numVariants = experiment.variants.length;

      const assignments = Array.from({ length: numVariants }, (_, i) =>
        assignWithinSubjects(experiment, 'user-123', i)
      );

      const variantKeys = assignments.map(a => a.variantKey);
      const uniqueVariants = new Set(variantKeys);

      expect(uniqueVariants.size).toBe(numVariants);
      expect(Array.from(uniqueVariants).sort()).toEqual(
        experiment.variants.map(v => v.key).sort()
      );
    });

    it('should cycle through order repeatedly', () => {
      const experiment = createWithinSubjectsExperiment();

      const session0 = assignWithinSubjects(experiment, 'user-123', 0);
      const session3 = assignWithinSubjects(experiment, 'user-123', 3);
      const session6 = assignWithinSubjects(experiment, 'user-123', 6);

      // Should repeat the same variant every 3 sessions
      expect(session0.variantKey).toBe(session3.variantKey);
      expect(session3.variantKey).toBe(session6.variantKey);
    });

    it('should counterbalance across users', () => {
      const experiment = createWithinSubjectsExperiment();

      // Get first session assignments for multiple users
      const firstSessionAssignments = Array.from({ length: 300 }, (_, i) =>
        assignWithinSubjects(experiment, `user-${i}`, 0)
      );

      // Count how many start with each variant
      const startCounts: Record<string, number> = { v1: 0, v2: 0, v3: 0 };
      firstSessionAssignments.forEach(a => {
        startCounts[a.variantKey]++;
      });

      // Each variant should start ~100 times (±30)
      Object.values(startCounts).forEach(count => {
        expect(count).toBeGreaterThan(70);
        expect(count).toBeLessThan(130);
      });
    });

    it('should be deterministic for same user and session', () => {
      const experiment = createWithinSubjectsExperiment();
      const assignment1 = assignWithinSubjects(experiment, 'user-123', 5);
      const assignment2 = assignWithinSubjects(experiment, 'user-123', 5);

      expect(assignment1.variantKey).toBe(assignment2.variantKey);
      expect(assignment1.orderSequence).toEqual(assignment2.orderSequence);
    });

    it('should throw error for negative session number', () => {
      const experiment = createWithinSubjectsExperiment();

      expect(() => assignWithinSubjects(experiment, 'user-123', -1)).toThrow(
        'sessionNumber must be non-negative'
      );
    });

    it('should include order sequence in result', () => {
      const experiment = createWithinSubjectsExperiment();
      const assignment = assignWithinSubjects(experiment, 'user-123', 0);

      expect(assignment.orderSequence).toBeDefined();
      expect(assignment.orderSequence.length).toBe(3);
      expect(assignment.sessionNumber).toBe(0);
    });

    it('should support sequential counterbalancing', () => {
      const experiment = createWithinSubjectsExperiment();
      experiment.designConfig!.counterbalancingScheme = 'sequential';

      const assignments = Array.from({ length: 3 }, (_, i) =>
        assignWithinSubjects(experiment, 'user-123', i)
      );

      // Should follow variant order exactly
      expect(assignments[0].variantKey).toBe('v1');
      expect(assignments[1].variantKey).toBe('v2');
      expect(assignments[2].variantKey).toBe('v3');
    });

    it('should support random counterbalancing', () => {
      const experiment = createWithinSubjectsExperiment();
      experiment.designConfig!.counterbalancingScheme = 'random';

      const assignments = Array.from({ length: 3 }, (_, i) =>
        assignWithinSubjects(experiment, 'user-123', i)
      );

      // Should still see all variants (but order may differ from sequential)
      const variants = new Set(assignments.map(a => a.variantKey));
      expect(variants.size).toBe(3);
    });
  });

  describe('assign (Universal Function)', () => {
    it('should route to correct algorithm for A/B test', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-ab',
        key: 'test_ab',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const assignment = assign(experiment, 'user-123');
      expect(['control', 'treatment']).toContain(assignment.variantKey);
    });

    it('should route to factorial algorithm', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-factorial',
        key: 'test_factorial',
        variants: [],
        trafficAllocation: 100,
        designType: 'factorial',
        designConfig: {
          factors: [
            { name: 'color', levels: ['blue', 'green'] },
          ],
        },
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const assignment = assign(experiment, 'user-123');
      expect('factorAssignments' in assignment).toBe(true);
    });

    it('should throw error for within-subjects without session number', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-within',
        key: 'test_within',
        variants: [{ key: 'v1', name: 'V1', allocation: 100 }],
        trafficAllocation: 100,
        designType: 'within_subjects',
        designConfig: { counterbalancingScheme: 'latin_square' },
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      expect(() => assign(experiment, 'user-123')).toThrow(
        'sessionNumber required for within-subjects'
      );
    });
  });

  describe('batchAssign', () => {
    it('should assign multiple units efficiently', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-batch',
        key: 'test_batch',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const unitIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const results = batchAssign(experiment, unitIds);

      expect(results.size).toBe(100);
      results.forEach((assignment, unitId) => {
        expect(['control', 'treatment']).toContain(assignment.variantKey);
      });
    });
  });

  describe('validateExperiment', () => {
    it('should return no errors for valid experiment', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-123',
        key: 'test_valid',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date('2025-01-01'),
      };

      const errors = validateExperiment(experiment);
      expect(errors).toEqual([]);
    });

    it('should detect missing ID', () => {
      const experiment = {
        key: 'test',
        variants: [],
        trafficAllocation: 100,
        designType: 'ab' as const,
        randomizationUnit: 'user' as const,
        startDate: new Date(),
      } as any;

      const errors = validateExperiment(experiment);
      expect(errors.some(e => e.includes('ID'))).toBe(true);
    });

    it('should detect invalid traffic allocation', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-123',
        key: 'test',
        variants: [],
        trafficAllocation: 150,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date(),
      };

      const errors = validateExperiment(experiment);
      expect(errors.some(e => e.includes('Traffic allocation'))).toBe(true);
    });

    it('should detect incorrect allocation sum', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-123',
        key: 'test',
        variants: [
          { key: 'control', name: 'Control', allocation: 40 },
          { key: 'treatment', name: 'Treatment', allocation: 40 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date(),
      };

      const errors = validateExperiment(experiment);
      expect(errors.some(e => e.includes('must sum to 100'))).toBe(true);
    });

    it('should detect duplicate variant keys', () => {
      const experiment: ExperimentConfig = {
        id: 'exp-123',
        key: 'test',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'control', name: 'Control 2', allocation: 50 },
        ],
        trafficAllocation: 100,
        designType: 'ab',
        randomizationUnit: 'user',
        startDate: new Date(),
      };

      const errors = validateExperiment(experiment);
      expect(errors.some(e => e.includes('Duplicate variant key'))).toBe(true);
    });
  });
});
