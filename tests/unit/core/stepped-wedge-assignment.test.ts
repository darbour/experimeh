/**
 * Unit Tests for Stepped Wedge Assignment
 * Tests assignment logic, schedule generation, and validation
 */

import { hashExperiment } from '../../../src/core/hash';

/**
 * Stepped Wedge Design Configuration
 */
export interface SteppedWedgeConfig {
  numSteps: number;
  stepDurationMinutes: number;
  numClusters: number;
  schedule?: SteppedWedgeSchedule;
  clusterKey: string;
  permanentControlClusters?: string[];
}

export interface SteppedWedgeSchedule {
  stepToClusters: Record<number, string[]>;
  clusterToStep: Record<string, number>;
  seed: string;
}

export interface SteppedWedgeAssignmentResult {
  variantKey: string;
  inExperiment: boolean;
  reason: string;
  currentStep: number;
  stepStart: Date;
  stepEnd: Date;
  clusterId: string;
  switchStep: number;
  inTreatment: boolean;
  metadata?: Record<string, any>;
}

export interface ExperimentConfig {
  id: string;
  key: string;
  startDate: Date;
  designType: string;
  designConfig?: any;
}

/**
 * Deterministic shuffle using seed
 */
export function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let currentHash = hashExperiment(seed, 'shuffle', '');

  for (let i = arr.length - 1; i > 0; i--) {
    currentHash = hashExperiment(seed, 'shuffle', currentHash.toString());
    const j = currentHash % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Generate stepped wedge switching schedule
 * Randomly assigns clusters to steps while ensuring balance
 */
export function generateSteppedWedgeSchedule(
  numClusters: number,
  numSteps: number,
  seed: string
): SteppedWedgeSchedule {
  if (numClusters <= 0) throw new Error('numClusters must be positive');
  if (numSteps <= 0) throw new Error('numSteps must be positive');

  // Create cluster IDs
  const clusterIds = Array.from({ length: numClusters }, (_, i) => `cluster-${i + 1}`);

  // Shuffle clusters deterministically based on seed
  const shuffled = shuffleWithSeed(clusterIds, seed);

  // Distribute clusters evenly across steps
  const clustersPerStep = Math.ceil(numClusters / numSteps);

  const stepToClusters: Record<number, string[]> = {};
  const clusterToStep: Record<string, number> = {};

  shuffled.forEach((clusterId, index) => {
    // Step 0 is baseline (all control), so switching starts at step 1
    const switchStep = Math.floor(index / clustersPerStep) + 1;
    const cappedStep = Math.min(switchStep, numSteps);

    if (!stepToClusters[cappedStep]) {
      stepToClusters[cappedStep] = [];
    }
    stepToClusters[cappedStep].push(clusterId);
    clusterToStep[clusterId] = cappedStep;
  });

  return {
    stepToClusters,
    clusterToStep,
    seed,
  };
}

/**
 * Extract cluster ID from context
 */
export function extractClusterId(context: Record<string, any>, clusterKey: string): string {
  const clusterId = context[clusterKey];
  if (!clusterId) {
    throw new Error(`Cluster key '${clusterKey}' not found in context`);
  }
  return String(clusterId);
}

/**
 * Stepped Wedge Assignment
 * Cluster-level unidirectional switching from control to treatment
 */
export function assignSteppedWedge(
  experiment: ExperimentConfig,
  clusterId: string,
  currentTime: Date = new Date()
): SteppedWedgeAssignmentResult {
  const config = experiment.designConfig as SteppedWedgeConfig;

  if (!config || !config.numSteps || !config.stepDurationMinutes) {
    throw new Error('Stepped wedge requires numSteps and stepDurationMinutes in designConfig');
  }

  if (!clusterId) {
    throw new Error('clusterId is required for stepped wedge assignment');
  }

  // Calculate current step
  const startTime = experiment.startDate.getTime();
  const currentTimeMs = currentTime.getTime();
  const elapsedMinutes = (currentTimeMs - startTime) / (1000 * 60);
  const currentStep = Math.floor(elapsedMinutes / config.stepDurationMinutes);

  // Clamp to valid range [0, numSteps]
  const validStep = Math.max(0, Math.min(currentStep, config.numSteps));

  // Calculate step boundaries
  const stepStart = new Date(
    startTime + validStep * config.stepDurationMinutes * 60 * 1000
  );
  const stepEnd = new Date(
    startTime + (validStep + 1) * config.stepDurationMinutes * 60 * 1000
  );

  // Generate or retrieve switching schedule
  const schedule = config.schedule || generateSteppedWedgeSchedule(
    config.numClusters,
    config.numSteps,
    experiment.id // Use as seed for deterministic randomization
  );

  // Check if this is a permanent control cluster
  const isPermanentControl = config.permanentControlClusters?.includes(clusterId);

  // Determine when this cluster switches
  const switchStep = isPermanentControl
    ? Infinity
    : schedule.clusterToStep[clusterId];

  if (switchStep === undefined && !isPermanentControl) {
    throw new Error(`Cluster ${clusterId} not found in schedule`);
  }

  // Check if in treatment (switched already)
  const inTreatment = validStep >= switchStep;

  return {
    variantKey: inTreatment ? 'treatment' : 'control',
    inExperiment: true,
    reason: `stepped_wedge_step_${validStep}_cluster_${clusterId}`,
    currentStep: validStep,
    stepStart,
    stepEnd,
    clusterId,
    switchStep,
    inTreatment,
    metadata: {
      totalSteps: config.numSteps,
      stepDurationMinutes: config.stepDurationMinutes,
      isPermanentControl,
    },
  };
}

describe('Stepped Wedge Assignment', () => {
  const createSteppedWedgeExperiment = (config?: Partial<SteppedWedgeConfig>): ExperimentConfig => ({
    id: 'exp-stepped-wedge',
    key: 'test_stepped_wedge',
    startDate: new Date('2025-01-01T00:00:00Z'),
    designType: 'stepped_wedge',
    designConfig: {
      numSteps: 4,
      stepDurationMinutes: 60,
      numClusters: 12,
      clusterKey: 'hospital_id',
      ...config,
    },
  });

  describe('assignSteppedWedge', () => {
    describe('Basic Assignment', () => {
      it('should assign control before switch step', () => {
        const experiment = createSteppedWedgeExperiment();
        const currentTime = new Date('2025-01-01T00:30:00Z'); // Step 0

        const assignment = assignSteppedWedge(experiment, 'cluster-1', currentTime);

        expect(assignment.variantKey).toBe('control');
        expect(assignment.inTreatment).toBe(false);
        expect(assignment.currentStep).toBe(0);
      });

      it('should assign treatment after switch step', () => {
        const experiment = createSteppedWedgeExperiment();
        // Get the switch step for cluster-1
        const schedule = generateSteppedWedgeSchedule(12, 4, experiment.id);
        const switchStep = schedule.clusterToStep['cluster-1'];

        // Time after switch
        const currentTime = new Date(
          experiment.startDate.getTime() + (switchStep + 1) * 60 * 60 * 1000
        );

        const assignment = assignSteppedWedge(experiment, 'cluster-1', currentTime);

        expect(assignment.variantKey).toBe('treatment');
        expect(assignment.inTreatment).toBe(true);
        expect(assignment.currentStep).toBeGreaterThanOrEqual(switchStep);
      });

      it('should assign treatment at exactly switch step', () => {
        const experiment = createSteppedWedgeExperiment();
        const schedule = generateSteppedWedgeSchedule(12, 4, experiment.id);
        const switchStep = schedule.clusterToStep['cluster-1'];

        // Exactly at switch step
        const currentTime = new Date(
          experiment.startDate.getTime() + switchStep * 60 * 60 * 1000
        );

        const assignment = assignSteppedWedge(experiment, 'cluster-1', currentTime);

        expect(assignment.inTreatment).toBe(true);
        expect(assignment.currentStep).toBe(switchStep);
      });

      it('should calculate correct step number', () => {
        const experiment = createSteppedWedgeExperiment();

        const step0 = assignSteppedWedge(
          experiment,
          'cluster-1',
          new Date('2025-01-01T00:30:00Z')
        );
        const step1 = assignSteppedWedge(
          experiment,
          'cluster-1',
          new Date('2025-01-01T01:30:00Z')
        );
        const step2 = assignSteppedWedge(
          experiment,
          'cluster-1',
          new Date('2025-01-01T02:30:00Z')
        );

        expect(step0.currentStep).toBe(0);
        expect(step1.currentStep).toBe(1);
        expect(step2.currentStep).toBe(2);
      });

      it('should maintain cluster stickiness', () => {
        const experiment = createSteppedWedgeExperiment();
        const clusterId = 'cluster-5';

        // Multiple assignments at different times
        const assignment1 = assignSteppedWedge(
          experiment,
          clusterId,
          new Date('2025-01-01T00:30:00Z')
        );
        const assignment2 = assignSteppedWedge(
          experiment,
          clusterId,
          new Date('2025-01-01T01:30:00Z')
        );

        // Switch step should be the same
        expect(assignment1.switchStep).toBe(assignment2.switchStep);
        expect(assignment1.clusterId).toBe(assignment2.clusterId);
      });
    });

    describe('Edge Cases', () => {
      it('should handle time before experiment start', () => {
        const experiment = createSteppedWedgeExperiment();
        const beforeStart = new Date('2024-12-31T23:00:00Z');

        const assignment = assignSteppedWedge(experiment, 'cluster-1', beforeStart);

        expect(assignment.currentStep).toBe(0);
        expect(assignment.variantKey).toBe('control');
      });

      it('should handle time after experiment end', () => {
        const experiment = createSteppedWedgeExperiment();
        const wayAfter = new Date('2025-01-01T10:00:00Z'); // Way after 4 steps

        const assignment = assignSteppedWedge(experiment, 'cluster-1', wayAfter);

        expect(assignment.currentStep).toBe(4); // Capped at numSteps
        expect(assignment.variantKey).toBe('treatment'); // All clusters treated by end
      });

      it('should handle unknown cluster ID', () => {
        const experiment = createSteppedWedgeExperiment();

        expect(() => {
          assignSteppedWedge(experiment, 'unknown-cluster', new Date());
        }).toThrow('not found in schedule');
      });

      it('should handle missing clusterId', () => {
        const experiment = createSteppedWedgeExperiment();

        expect(() => {
          assignSteppedWedge(experiment, '', new Date());
        }).toThrow('clusterId is required');
      });

      it('should handle missing config', () => {
        const experiment: ExperimentConfig = {
          id: 'exp-bad',
          key: 'bad',
          startDate: new Date(),
          designType: 'stepped_wedge',
          designConfig: {},
        };

        expect(() => {
          assignSteppedWedge(experiment, 'cluster-1', new Date());
        }).toThrow('requires numSteps and stepDurationMinutes');
      });

      it('should handle permanent control clusters', () => {
        const experiment = createSteppedWedgeExperiment({
          permanentControlClusters: ['cluster-999'],
        });

        const assignment = assignSteppedWedge(
          experiment,
          'cluster-999',
          new Date('2025-01-01T10:00:00Z') // Way in the future
        );

        expect(assignment.variantKey).toBe('control');
        expect(assignment.inTreatment).toBe(false);
        expect(assignment.switchStep).toBe(Infinity);
        expect(assignment.metadata?.isPermanentControl).toBe(true);
      });
    });

    describe('Step Boundaries', () => {
      it('should include correct step start and end times', () => {
        const experiment = createSteppedWedgeExperiment();
        const currentTime = new Date('2025-01-01T01:30:00Z'); // Step 1

        const assignment = assignSteppedWedge(experiment, 'cluster-1', currentTime);

        expect(assignment.stepStart.getTime()).toBe(
          new Date('2025-01-01T01:00:00Z').getTime()
        );
        expect(assignment.stepEnd.getTime()).toBe(
          new Date('2025-01-01T02:00:00Z').getTime()
        );
      });

      it('should have stepEnd after stepStart', () => {
        const experiment = createSteppedWedgeExperiment();
        const assignment = assignSteppedWedge(experiment, 'cluster-1', new Date());

        expect(assignment.stepEnd.getTime()).toBeGreaterThan(
          assignment.stepStart.getTime()
        );
      });
    });

    describe('Metadata', () => {
      it('should include metadata in result', () => {
        const experiment = createSteppedWedgeExperiment();
        const assignment = assignSteppedWedge(experiment, 'cluster-1', new Date());

        expect(assignment.metadata).toBeDefined();
        expect(assignment.metadata?.totalSteps).toBe(4);
        expect(assignment.metadata?.stepDurationMinutes).toBe(60);
      });

      it('should include reason string', () => {
        const experiment = createSteppedWedgeExperiment();
        const assignment = assignSteppedWedge(experiment, 'cluster-5', new Date());

        expect(assignment.reason).toContain('stepped_wedge');
        expect(assignment.reason).toContain('cluster-5');
      });
    });
  });

  describe('generateSteppedWedgeSchedule', () => {
    describe('Schedule Generation', () => {
      it('should generate valid schedule', () => {
        const schedule = generateSteppedWedgeSchedule(12, 4, 'test-seed');

        expect(schedule.stepToClusters).toBeDefined();
        expect(schedule.clusterToStep).toBeDefined();
        expect(schedule.seed).toBe('test-seed');
      });

      it('should assign all clusters to steps', () => {
        const numClusters = 12;
        const schedule = generateSteppedWedgeSchedule(numClusters, 4, 'test-seed');

        const assignedClusters = Object.keys(schedule.clusterToStep);
        expect(assignedClusters).toHaveLength(numClusters);

        // All cluster IDs present
        for (let i = 1; i <= numClusters; i++) {
          expect(assignedClusters).toContain(`cluster-${i}`);
        }
      });

      it('should distribute clusters across steps', () => {
        const schedule = generateSteppedWedgeSchedule(12, 4, 'test-seed');

        // Check that clusters are distributed (not all in one step)
        const stepsUsed = Object.keys(schedule.stepToClusters).map(Number);
        expect(stepsUsed.length).toBeGreaterThan(1);
      });

      it('should balance clusters across steps', () => {
        const numClusters = 12;
        const numSteps = 4;
        const schedule = generateSteppedWedgeSchedule(numClusters, numSteps, 'test-seed');

        const expectedPerStep = Math.ceil(numClusters / numSteps);

        // Each step should have approximately equal clusters
        Object.values(schedule.stepToClusters).forEach(clusters => {
          expect(clusters.length).toBeLessThanOrEqual(expectedPerStep);
          expect(clusters.length).toBeGreaterThan(0);
        });
      });

      it('should start switching at step 1 (not step 0)', () => {
        const schedule = generateSteppedWedgeSchedule(12, 4, 'test-seed');

        // All switch steps should be >= 1 (step 0 is baseline)
        Object.values(schedule.clusterToStep).forEach(switchStep => {
          expect(switchStep).toBeGreaterThanOrEqual(1);
        });
      });

      it('should not exceed numSteps', () => {
        const numSteps = 4;
        const schedule = generateSteppedWedgeSchedule(12, numSteps, 'test-seed');

        Object.values(schedule.clusterToStep).forEach(switchStep => {
          expect(switchStep).toBeLessThanOrEqual(numSteps);
        });
      });
    });

    describe('Determinism', () => {
      it('should be deterministic with same seed', () => {
        const schedule1 = generateSteppedWedgeSchedule(12, 4, 'same-seed');
        const schedule2 = generateSteppedWedgeSchedule(12, 4, 'same-seed');

        expect(schedule1.clusterToStep).toEqual(schedule2.clusterToStep);
        expect(schedule1.stepToClusters).toEqual(schedule2.stepToClusters);
      });

      it('should differ with different seeds', () => {
        const schedule1 = generateSteppedWedgeSchedule(12, 4, 'seed-1');
        const schedule2 = generateSteppedWedgeSchedule(12, 4, 'seed-2');

        // Schedules should be different (very unlikely to be identical)
        expect(schedule1.clusterToStep).not.toEqual(schedule2.clusterToStep);
      });

      it('should produce same assignment for same cluster ID and seed', () => {
        const seed = 'consistent-seed';
        const schedule = generateSteppedWedgeSchedule(12, 4, seed);
        const clusterId = 'cluster-5';

        const step1 = schedule.clusterToStep[clusterId];

        // Generate again with same seed
        const schedule2 = generateSteppedWedgeSchedule(12, 4, seed);
        const step2 = schedule2.clusterToStep[clusterId];

        expect(step1).toBe(step2);
      });
    });

    describe('Edge Cases', () => {
      it('should handle more clusters than steps', () => {
        const schedule = generateSteppedWedgeSchedule(20, 4, 'test-seed');

        expect(Object.keys(schedule.clusterToStep)).toHaveLength(20);
        // All clusters should be assigned
      });

      it('should handle fewer clusters than steps', () => {
        const schedule = generateSteppedWedgeSchedule(3, 10, 'test-seed');

        expect(Object.keys(schedule.clusterToStep)).toHaveLength(3);
        // All clusters assigned, some steps may be empty
      });

      it('should handle single cluster', () => {
        const schedule = generateSteppedWedgeSchedule(1, 4, 'test-seed');

        expect(Object.keys(schedule.clusterToStep)).toHaveLength(1);
        expect(schedule.clusterToStep['cluster-1']).toBeDefined();
      });

      it('should handle single step', () => {
        const schedule = generateSteppedWedgeSchedule(12, 1, 'test-seed');

        // All clusters switch at step 1
        Object.values(schedule.clusterToStep).forEach(step => {
          expect(step).toBe(1);
        });
      });

      it('should throw for zero clusters', () => {
        expect(() => {
          generateSteppedWedgeSchedule(0, 4, 'test-seed');
        }).toThrow('numClusters must be positive');
      });

      it('should throw for zero steps', () => {
        expect(() => {
          generateSteppedWedgeSchedule(12, 0, 'test-seed');
        }).toThrow('numSteps must be positive');
      });

      it('should throw for negative values', () => {
        expect(() => {
          generateSteppedWedgeSchedule(-5, 4, 'test-seed');
        }).toThrow('numClusters must be positive');

        expect(() => {
          generateSteppedWedgeSchedule(12, -4, 'test-seed');
        }).toThrow('numSteps must be positive');
      });
    });

    describe('Schedule Consistency', () => {
      it('should have bidirectional mapping consistency', () => {
        const schedule = generateSteppedWedgeSchedule(12, 4, 'test-seed');

        // Every cluster in clusterToStep should appear in stepToClusters
        Object.entries(schedule.clusterToStep).forEach(([clusterId, step]) => {
          expect(schedule.stepToClusters[step]).toContain(clusterId);
        });

        // Every cluster in stepToClusters should appear in clusterToStep
        Object.entries(schedule.stepToClusters).forEach(([step, clusters]) => {
          clusters.forEach(clusterId => {
            expect(schedule.clusterToStep[clusterId]).toBe(Number(step));
          });
        });
      });

      it('should not have duplicate clusters in stepToClusters', () => {
        const schedule = generateSteppedWedgeSchedule(12, 4, 'test-seed');

        const allClusters: string[] = [];
        Object.values(schedule.stepToClusters).forEach(clusters => {
          allClusters.push(...clusters);
        });

        const uniqueClusters = new Set(allClusters);
        expect(allClusters.length).toBe(uniqueClusters.size);
      });
    });
  });

  describe('shuffleWithSeed', () => {
    it('should shuffle array deterministically', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled1 = shuffleWithSeed(array, 'test-seed');
      const shuffled2 = shuffleWithSeed(array, 'test-seed');

      expect(shuffled1).toEqual(shuffled2);
    });

    it('should preserve all elements', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      expect(shuffled.sort()).toEqual(array.sort());
      expect(shuffled.length).toBe(array.length);
    });

    it('should produce different order than original', () => {
      const array = Array.from({ length: 20 }, (_, i) => i);
      const shuffled = shuffleWithSeed(array, 'test-seed');

      // Very unlikely to be in same order
      expect(shuffled).not.toEqual(array);
    });

    it('should produce different shuffles for different seeds', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled1 = shuffleWithSeed(array, 'seed-1');
      const shuffled2 = shuffleWithSeed(array, 'seed-2');

      expect(shuffled1).not.toEqual(shuffled2);
    });

    it('should handle empty array', () => {
      const shuffled = shuffleWithSeed([], 'test-seed');
      expect(shuffled).toEqual([]);
    });

    it('should handle single element', () => {
      const shuffled = shuffleWithSeed([42], 'test-seed');
      expect(shuffled).toEqual([42]);
    });

    it('should not mutate original array', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffleWithSeed(original, 'test-seed');

      expect(original).toEqual(copy);
    });
  });

  describe('extractClusterId', () => {
    it('should extract cluster ID from context', () => {
      const context = { hospital_id: 'hosp-123', user_id: 'user-456' };
      const clusterId = extractClusterId(context, 'hospital_id');

      expect(clusterId).toBe('hosp-123');
    });

    it('should convert non-string values to string', () => {
      const context = { region_id: 42 };
      const clusterId = extractClusterId(context, 'region_id');

      expect(clusterId).toBe('42');
      expect(typeof clusterId).toBe('string');
    });

    it('should throw if key not found', () => {
      const context = { user_id: 'user-123' };

      expect(() => {
        extractClusterId(context, 'hospital_id');
      }).toThrow("Cluster key 'hospital_id' not found");
    });

    it('should throw for null value', () => {
      const context = { hospital_id: null };

      expect(() => {
        extractClusterId(context, 'hospital_id');
      }).toThrow('not found');
    });

    it('should throw for undefined value', () => {
      const context = { hospital_id: undefined };

      expect(() => {
        extractClusterId(context, 'hospital_id');
      }).toThrow('not found');
    });
  });

  describe('Integration Tests', () => {
    it('should produce consistent assignments across multiple calls', () => {
      const experiment = createSteppedWedgeExperiment();
      const clusterId = 'cluster-7';
      const time = new Date('2025-01-01T02:30:00Z');

      const assignments = Array.from({ length: 100 }, () =>
        assignSteppedWedge(experiment, clusterId, time)
      );

      // All assignments should be identical
      const firstAssignment = assignments[0];
      assignments.forEach(assignment => {
        expect(assignment.variantKey).toBe(firstAssignment.variantKey);
        expect(assignment.switchStep).toBe(firstAssignment.switchStep);
        expect(assignment.currentStep).toBe(firstAssignment.currentStep);
      });
    });

    it('should handle multiple clusters at same time', () => {
      const experiment = createSteppedWedgeExperiment();
      const time = new Date('2025-01-01T02:30:00Z');

      const clusterAssignments = Array.from({ length: 12 }, (_, i) =>
        assignSteppedWedge(experiment, `cluster-${i + 1}`, time)
      );

      // All should have same current step
      clusterAssignments.forEach(assignment => {
        expect(assignment.currentStep).toBe(2);
      });

      // But different switch steps
      const switchSteps = new Set(
        clusterAssignments.map(a => a.switchStep)
      );
      expect(switchSteps.size).toBeGreaterThan(1);
    });

    it('should progress through time correctly', () => {
      const experiment = createSteppedWedgeExperiment();
      const clusterId = 'cluster-1';

      // Track progression through steps
      const times = [
        new Date('2025-01-01T00:30:00Z'), // Step 0
        new Date('2025-01-01T01:30:00Z'), // Step 1
        new Date('2025-01-01T02:30:00Z'), // Step 2
        new Date('2025-01-01T03:30:00Z'), // Step 3
        new Date('2025-01-01T04:30:00Z'), // Step 4
      ];

      const assignments = times.map(time =>
        assignSteppedWedge(experiment, clusterId, time)
      );

      // Current step should increase
      assignments.forEach((assignment, i) => {
        expect(assignment.currentStep).toBe(i);
      });

      // Once switched, should stay in treatment
      let switched = false;
      assignments.forEach(assignment => {
        if (assignment.inTreatment) {
          switched = true;
        }
        if (switched) {
          expect(assignment.inTreatment).toBe(true);
        }
      });
    });
  });
});
