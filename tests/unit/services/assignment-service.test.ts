/**
 * Unit Tests for Assignment Service
 * Tests assignment consistency and all experiment types with mocked dependencies
 */

import { AssignmentService } from '../../../src/services/assignment-service';
import { ConfigurationService } from '../../../src/services/configuration-service';
import { Experiment } from '../../../src/types';

const createMockConfigService = () => ({
  getExperiment: jest.fn(),
  getExperimentByKey: jest.fn(),
  listExperiments: jest.fn(),
  createExperiment: jest.fn(),
  updateExperiment: jest.fn(),
  deleteExperiment: jest.fn(),
});

const createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

describe('AssignmentService', () => {
  let service: AssignmentService;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockConfigService = createMockConfigService();
    mockCache = createMockCache();
    mockLogger = createMockLogger();

    service = new AssignmentService({
      configurationService: mockConfigService as any,
      cache: mockCache as any,
      logger: mockLogger as any,
      assignmentCacheTtlSeconds: 86400,
      enableLogging: false, // Disable logging in tests
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('A/B Test Assignment', () => {
    const abExperiment: Experiment = {
      id: 'exp-ab',
      key: 'test_ab',
      name: 'A/B Test',
      description: '',
      status: 'running',
      designType: 'ab',
      hypotheses: 'Test',
      primaryMetric: 'conversion',
      secondaryMetrics: [],
      guardrailMetrics: [],
      randomizationUnit: 'user',
      assignmentKey: 'user_id',
      variants: [
        { key: 'control', name: 'Control', allocation: 50 },
        { key: 'treatment', name: 'Treatment', allocation: 50 },
      ],
      designConfig: { type: 'ab' },
      trafficAllocation: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
      version: 1,
    };

    it('should assign user to A/B experiment', async () => {
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(abExperiment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAssignment('test_ab', context);

      expect(result.assigned).toBe(true);
      expect(['control', 'treatment']).toContain(result.variantKey);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return consistent assignment for same user', async () => {
      mockConfigService.getExperimentByKey.mockResolvedValue(abExperiment);

      const context = {
        unitId: 'user-456',
        userId: 'user-456',
        attributes: {},
      };

      // Clear cache to ensure we're not using cached values
      mockCache.get.mockResolvedValue(null);

      const result1 = await service.getAssignment('test_ab', context);
      const result2 = await service.getAssignment('test_ab', context);

      expect(result1.variantKey).toBe(result2.variantKey);
    });

    it('should use cached assignment when available', async () => {
      const cachedAssignment = {
        variantKey: 'control',
        assigned: true,
        reason: 'assigned',
      };

      mockCache.get.mockResolvedValue(cachedAssignment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAssignment('test_ab', context);

      expect(result).toEqual(cachedAssignment);
      expect(mockConfigService.getExperimentByKey).not.toHaveBeenCalled();
    });

    it('should return control when experiment not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(null);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAssignment('nonexistent', context);

      expect(result.assigned).toBe(false);
      expect(result.variantKey).toBe('control');
      expect(result.reason).toBe('experiment_not_found');
    });

    it('should return control when experiment is not running', async () => {
      const draftExperiment = { ...abExperiment, status: 'draft' as const };
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(draftExperiment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAssignment('test_ab', context);

      expect(result.assigned).toBe(false);
      expect(result.reason).toBe('experiment_draft');
    });
  });

  describe('Factorial Experiment Assignment', () => {
    const factorialExperiment: Experiment = {
      id: 'exp-factorial',
      key: 'test_factorial',
      name: 'Factorial Test',
      description: '',
      status: 'running',
      designType: 'factorial',
      hypotheses: 'Test',
      primaryMetric: 'conversion',
      secondaryMetrics: [],
      guardrailMetrics: [],
      randomizationUnit: 'user',
      assignmentKey: 'user_id',
      variants: [
        { key: 'blue_small', name: 'Blue Small', allocation: 25 },
        { key: 'blue_large', name: 'Blue Large', allocation: 25 },
        { key: 'green_small', name: 'Green Small', allocation: 25 },
        { key: 'green_large', name: 'Green Large', allocation: 25 },
      ],
      designConfig: {
        type: 'factorial',
        factors: [
          { name: 'color', levels: ['blue', 'green'] },
          { name: 'size', levels: ['small', 'large'] },
        ],
      },
      trafficAllocation: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
      version: 1,
    };

    it('should assign user to factorial experiment', async () => {
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(factorialExperiment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAssignment('test_factorial', context);

      expect(result.assigned).toBe(true);
      expect(result.factors).toBeDefined();
      expect(result.factors!['color']).toBeDefined();
      expect(result.factors!['size']).toBeDefined();
    });

    it('should assign factors independently', async () => {
      mockConfigService.getExperimentByKey.mockResolvedValue(factorialExperiment);

      // Test multiple users
      const assignments = await Promise.all(
        Array.from({ length: 100 }, async (_, i) => {
          mockCache.get.mockResolvedValue(null);
          const context = {
            unitId: `user-${i}`,
            userId: `user-${i}`,
            attributes: {},
          };
          return service.getAssignment('test_factorial', context);
        })
      );

      // Count combinations
      const colorCounts: Record<string, number> = { blue: 0, green: 0 };
      const sizeCounts: Record<string, number> = { small: 0, large: 0 };

      assignments.forEach(a => {
        if (a.factors) {
          colorCounts[a.factors.color]++;
          sizeCounts[a.factors.size]++;
        }
      });

      // Each factor level should appear roughly equally
      expect(colorCounts.blue).toBeGreaterThan(30);
      expect(colorCounts.green).toBeGreaterThan(30);
      expect(sizeCounts.small).toBeGreaterThan(30);
      expect(sizeCounts.large).toBeGreaterThan(30);
    });
  });

  describe('Switchback Experiment Assignment', () => {
    const switchbackExperiment: Experiment = {
      id: 'exp-switchback',
      key: 'test_switchback',
      name: 'Switchback Test',
      description: '',
      status: 'running',
      designType: 'switchback',
      hypotheses: 'Test',
      primaryMetric: 'conversion',
      secondaryMetrics: [],
      guardrailMetrics: [],
      randomizationUnit: 'user',
      assignmentKey: 'user_id',
      variants: [
        { key: 'control', name: 'Control', allocation: 50 },
        { key: 'treatment', name: 'Treatment', allocation: 50 },
      ],
      designConfig: {
        type: 'switchback',
        switchbackPeriodMinutes: 60,
      },
      trafficAllocation: 100,
      startDate: new Date('2025-01-01T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
      version: 1,
    };

    it('should assign based on time period', async () => {
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(switchbackExperiment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
        timestamp: new Date('2025-01-01T01:30:00Z'), // Period 1
      };

      const result = await service.getAssignment('test_switchback', context);

      expect(result.assigned).toBe(true);
      expect(['control', 'treatment']).toContain(result.variantKey);
    });

    it('should assign all users in same period to same variant', async () => {
      mockConfigService.getExperimentByKey.mockResolvedValue(switchbackExperiment);

      const timestamp = new Date('2025-01-01T01:30:00Z');

      const assignments = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          mockCache.get.mockResolvedValue(null);
          const context = {
            unitId: `user-${i}`,
            userId: `user-${i}`,
            attributes: {},
            timestamp,
          };
          return service.getAssignment('test_switchback', context);
        })
      );

      // All assignments should be the same variant
      const firstVariant = assignments[0].variantKey;
      expect(assignments.every(a => a.variantKey === firstVariant)).toBe(true);
    });
  });

  describe('Within-Subjects Experiment Assignment', () => {
    const withinSubjectsExperiment: Experiment = {
      id: 'exp-within',
      key: 'test_within',
      name: 'Within Subjects Test',
      description: '',
      status: 'running',
      designType: 'within_subjects',
      hypotheses: 'Test',
      primaryMetric: 'conversion',
      secondaryMetrics: [],
      guardrailMetrics: [],
      randomizationUnit: 'user',
      assignmentKey: 'user_id',
      variants: [
        { key: 'v1', name: 'Variant 1', allocation: 33.33 },
        { key: 'v2', name: 'Variant 2', allocation: 33.33 },
        { key: 'v3', name: 'Variant 3', allocation: 33.34 },
      ],
      designConfig: {
        type: 'within_subjects',
        counterbalancingScheme: 'latin_square',
      },
      trafficAllocation: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
      version: 1,
    };

    it('should assign based on session number', async () => {
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(withinSubjectsExperiment);

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: { sessionNumber: 0 },
      };

      const result = await service.getAssignment('test_within', context);

      expect(result.assigned).toBe(true);
      expect(['v1', 'v2', 'v3']).toContain(result.variantKey);
    });

    it('should assign different variants across sessions', async () => {
      mockConfigService.getExperimentByKey.mockResolvedValue(withinSubjectsExperiment);

      const assignments = await Promise.all(
        Array.from({ length: 3 }, async (_, i) => {
          mockCache.get.mockResolvedValue(null);
          const context = {
            unitId: 'user-123',
            userId: 'user-123',
            attributes: { sessionNumber: i },
          };
          return service.getAssignment('test_within', context);
        })
      );

      // Should see all three variants
      const variants = new Set(assignments.map(a => a.variantKey));
      expect(variants.size).toBe(3);
    });
  });

  describe('getAllAssignments', () => {
    it('should return assignments for all running experiments', async () => {
      const experiments = [
        {
          id: 'exp-1',
          key: 'test_1',
          status: 'running',
          variants: [{ key: 'control', name: 'Control', allocation: 100 }],
          designType: 'ab',
          trafficAllocation: 100,
        },
        {
          id: 'exp-2',
          key: 'test_2',
          status: 'running',
          variants: [{ key: 'control', name: 'Control', allocation: 100 }],
          designType: 'ab',
          trafficAllocation: 100,
        },
      ] as Experiment[];

      mockConfigService.listExperiments.mockResolvedValue({
        experiments,
        total: 2,
      });
      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockImplementation((key: string) =>
        Promise.resolve(experiments.find(e => e.key === key) || null)
      );

      const context = {
        unitId: 'user-123',
        userId: 'user-123',
        attributes: {},
      };

      const result = await service.getAllAssignments(context);

      expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });

  describe('forceAssignment', () => {
    it('should force specific assignment', async () => {
      const experiment: Experiment = {
        id: 'exp-123',
        key: 'test',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
      } as Experiment;

      mockConfigService.getExperimentByKey.mockResolvedValue(experiment);

      await service.forceAssignment('test', 'user-123', 'treatment');

      expect(mockCache.set).toHaveBeenCalledWith(
        'assignment:test:user-123',
        expect.objectContaining({
          variantKey: 'treatment',
          assigned: true,
          reason: 'forced',
        }),
        expect.any(Number)
      );
    });

    it('should throw error when experiment not found', async () => {
      mockConfigService.getExperimentByKey.mockResolvedValue(null);

      await expect(
        service.forceAssignment('nonexistent', 'user-123', 'treatment')
      ).rejects.toThrow();
    });

    it('should throw error when variant not found', async () => {
      const experiment: Experiment = {
        id: 'exp-123',
        key: 'test',
        variants: [
          { key: 'control', name: 'Control', allocation: 100 },
        ],
      } as Experiment;

      mockConfigService.getExperimentByKey.mockResolvedValue(experiment);

      await expect(
        service.forceAssignment('test', 'user-123', 'invalid_variant')
      ).rejects.toThrow();
    });
  });

  describe('clearAssignmentCache', () => {
    it('should clear assignment cache for user', async () => {
      await service.clearAssignmentCache('test', 'user-123');

      expect(mockCache.delete).toHaveBeenCalledWith('assignment:test:user-123');
    });
  });

  describe('Unit ID Resolution', () => {
    it('should use unitId when provided', async () => {
      const experiment: Experiment = {
        id: 'exp-123',
        key: 'test',
        status: 'running',
        variants: [{ key: 'control', name: 'Control', allocation: 100 }],
        designType: 'ab',
        trafficAllocation: 100,
      } as Experiment;

      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(experiment);

      const context = {
        unitId: 'custom-unit-123',
        userId: 'user-456',
        attributes: {},
      };

      await service.getAssignment('test', context);

      expect(mockCache.set).toHaveBeenCalledWith(
        'assignment:test:custom-unit-123',
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should fallback to userId when unitId not provided', async () => {
      const experiment: Experiment = {
        id: 'exp-123',
        key: 'test',
        status: 'running',
        variants: [{ key: 'control', name: 'Control', allocation: 100 }],
        designType: 'ab',
        trafficAllocation: 100,
      } as Experiment;

      mockCache.get.mockResolvedValue(null);
      mockConfigService.getExperimentByKey.mockResolvedValue(experiment);

      const context = {
        userId: 'user-456',
        attributes: {},
      };

      await service.getAssignment('test', context);

      expect(mockCache.set).toHaveBeenCalledWith(
        'assignment:test:user-456',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });
});
