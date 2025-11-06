/**
 * Unit Tests for Configuration Service
 * Tests CRUD operations, validation, and caching
 */

import { ConfigurationService } from '../../../src/services/configuration-service';
import { Experiment, FeatureFlag } from '../../../src/types';
import { ValidationError, NotFoundError, ConflictError } from '../../../src/types/errors';

// Mock implementations
const createMockStore = () => ({
  createExperiment: jest.fn(),
  updateExperiment: jest.fn(),
  getExperiment: jest.fn(),
  getExperimentByKey: jest.fn(),
  listExperiments: jest.fn(),
  deleteExperiment: jest.fn(),
  createFeatureFlag: jest.fn(),
  updateFeatureFlag: jest.fn(),
  getFeatureFlag: jest.fn(),
  getFeatureFlagByKey: jest.fn(),
  listFeatureFlags: jest.fn(),
  deleteFeatureFlag: jest.fn(),
  logChange: jest.fn(),
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

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let mockStore: ReturnType<typeof createMockStore>;
  let mockCache: ReturnType<typeof createMockCache>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockStore = createMockStore();
    mockCache = createMockCache();
    mockLogger = createMockLogger();

    service = new ConfigurationService({
      store: mockStore as any,
      cache: mockCache as any,
      logger: mockLogger as any,
      cacheTtlSeconds: 300,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createExperiment', () => {
    const validExperimentData = {
      key: 'test_experiment',
      name: 'Test Experiment',
      description: 'Test description',
      status: 'draft' as const,
      designType: 'ab' as const,
      hypotheses: 'Test hypothesis',
      primaryMetric: 'conversion_rate',
      secondaryMetrics: [],
      guardrailMetrics: [],
      randomizationUnit: 'user' as const,
      assignmentKey: 'user_id',
      variants: [
        { key: 'control', name: 'Control', allocation: 50 },
        { key: 'treatment', name: 'Treatment', allocation: 50 },
      ],
      designConfig: {
        type: 'ab' as const,
      },
      trafficAllocation: 100,
      createdBy: 'user-123',
    };

    it('should create experiment successfully', async () => {
      const createdExperiment = {
        id: 'exp-123',
        ...validExperimentData,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      mockStore.getExperimentByKey.mockResolvedValue(null);
      mockStore.createExperiment.mockResolvedValue(createdExperiment);
      mockStore.logChange.mockResolvedValue(undefined);

      const result = await service.createExperiment(validExperimentData);

      expect(result).toEqual(createdExperiment);
      expect(mockStore.createExperiment).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledTimes(2); // Cache by ID and key
      expect(mockStore.logChange).toHaveBeenCalledWith(
        'experiment',
        'exp-123',
        'create',
        expect.any(Object),
        'user-123'
      );
    });

    it('should throw ValidationError for invalid data', async () => {
      const invalidData = {
        ...validExperimentData,
        key: '', // Empty key
      };

      await expect(service.createExperiment(invalidData)).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError for duplicate key', async () => {
      mockStore.getExperimentByKey.mockResolvedValue({ id: 'existing' });

      await expect(service.createExperiment(validExperimentData)).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when allocations do not sum to 100', async () => {
      const invalidData = {
        ...validExperimentData,
        variants: [
          { key: 'control', name: 'Control', allocation: 40 },
          { key: 'treatment', name: 'Treatment', allocation: 40 },
        ],
      };

      mockStore.getExperimentByKey.mockResolvedValue(null);

      await expect(service.createExperiment(invalidData)).rejects.toThrow(
        /must sum to 100/
      );
    });

    it('should validate factorial design configuration', async () => {
      const factorialData = {
        ...validExperimentData,
        designType: 'factorial' as const,
        designConfig: {
          type: 'factorial' as const,
          factors: [],
        },
        variants: [
          { key: 'v1', name: 'V1', allocation: 100 },
        ],
      };

      mockStore.getExperimentByKey.mockResolvedValue(null);

      await expect(service.createExperiment(factorialData)).rejects.toThrow(
        /factors/
      );
    });

    it('should validate switchback design configuration', async () => {
      const switchbackData = {
        ...validExperimentData,
        designType: 'switchback' as const,
        designConfig: {
          type: 'switchback' as const,
        },
      };

      mockStore.getExperimentByKey.mockResolvedValue(null);

      await expect(service.createExperiment(switchbackData)).rejects.toThrow(
        /switchbackPeriodMinutes/
      );
    });
  });

  describe('updateExperiment', () => {
    const existingExperiment: Experiment = {
      id: 'exp-123',
      key: 'test_experiment',
      name: 'Test Experiment',
      description: 'Test',
      status: 'draft',
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

    it('should update experiment successfully', async () => {
      const updates = { description: 'Updated description' };
      const updatedExperiment = { ...existingExperiment, ...updates };

      mockCache.get.mockResolvedValue(existingExperiment);
      mockStore.updateExperiment.mockResolvedValue(updatedExperiment);
      mockStore.logChange.mockResolvedValue(undefined);

      const result = await service.updateExperiment('exp-123', updates, 'user-456');

      expect(result).toEqual(updatedExperiment);
      expect(mockStore.updateExperiment).toHaveBeenCalledWith('exp-123', updates);
      expect(mockCache.delete).toHaveBeenCalledTimes(2); // Delete by ID and key
      expect(mockStore.logChange).toHaveBeenCalled();
    });

    it('should throw NotFoundError when experiment does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockStore.getExperiment.mockResolvedValue(null);

      await expect(
        service.updateExperiment('exp-999', {}, 'user-456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should prevent updating immutable fields on running experiments', async () => {
      const runningExperiment = { ...existingExperiment, status: 'running' as const };
      mockCache.get.mockResolvedValue(runningExperiment);

      const updates = {
        variants: [{ key: 'new', name: 'New', allocation: 100 }],
      };

      await expect(
        service.updateExperiment('exp-123', updates, 'user-456')
      ).rejects.toThrow(ConflictError);
    });

    it('should allow updating mutable fields on running experiments', async () => {
      const runningExperiment = { ...existingExperiment, status: 'running' as const };
      const updates = { description: 'New description' };
      const updatedExperiment = { ...runningExperiment, ...updates };

      mockCache.get.mockResolvedValue(runningExperiment);
      mockStore.updateExperiment.mockResolvedValue(updatedExperiment);

      const result = await service.updateExperiment('exp-123', updates, 'user-456');

      expect(result).toEqual(updatedExperiment);
    });
  });

  describe('getExperiment', () => {
    it('should return experiment from cache if available', async () => {
      const experiment = { id: 'exp-123', key: 'test' } as Experiment;
      mockCache.get.mockResolvedValue(experiment);

      const result = await service.getExperiment('exp-123');

      expect(result).toEqual(experiment);
      expect(mockStore.getExperiment).not.toHaveBeenCalled();
    });

    it('should fetch from store and cache if not in cache', async () => {
      const experiment = { id: 'exp-123', key: 'test' } as Experiment;
      mockCache.get.mockResolvedValue(null);
      mockStore.getExperiment.mockResolvedValue(experiment);

      const result = await service.getExperiment('exp-123');

      expect(result).toEqual(experiment);
      expect(mockStore.getExperiment).toHaveBeenCalledWith('exp-123');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return null when experiment does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockStore.getExperiment.mockResolvedValue(null);

      const result = await service.getExperiment('exp-999');

      expect(result).toBeNull();
    });
  });

  describe('getExperimentByKey', () => {
    it('should return experiment from cache if available', async () => {
      const experiment = { id: 'exp-123', key: 'test' } as Experiment;
      mockCache.get.mockResolvedValue(experiment);

      const result = await service.getExperimentByKey('test');

      expect(result).toEqual(experiment);
      expect(mockStore.getExperimentByKey).not.toHaveBeenCalled();
    });

    it('should fetch from store and cache if not in cache', async () => {
      const experiment = { id: 'exp-123', key: 'test' } as Experiment;
      mockCache.get.mockResolvedValue(null);
      mockStore.getExperimentByKey.mockResolvedValue(experiment);

      const result = await service.getExperimentByKey('test');

      expect(result).toEqual(experiment);
      expect(mockStore.getExperimentByKey).toHaveBeenCalledWith('test');
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('listExperiments', () => {
    it('should list experiments with filters', async () => {
      const experiments = [
        { id: 'exp-1', status: 'running' },
        { id: 'exp-2', status: 'running' },
      ] as Experiment[];

      mockStore.listExperiments.mockResolvedValue({
        experiments,
        total: 2,
      });

      const result = await service.listExperiments({
        status: ['running'],
        limit: 10,
      });

      expect(result.experiments).toEqual(experiments);
      expect(result.total).toBe(2);
      expect(mockStore.listExperiments).toHaveBeenCalledWith({
        status: ['running'],
        limit: 10,
      });
    });
  });

  describe('deleteExperiment', () => {
    const experiment: Experiment = {
      id: 'exp-123',
      key: 'test',
      status: 'draft',
    } as Experiment;

    it('should delete experiment successfully', async () => {
      mockCache.get.mockResolvedValue(experiment);
      mockStore.deleteExperiment.mockResolvedValue(true);

      const result = await service.deleteExperiment('exp-123', 'user-456');

      expect(result).toBe(true);
      expect(mockStore.deleteExperiment).toHaveBeenCalledWith('exp-123');
      expect(mockCache.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.logChange).toHaveBeenCalled();
    });

    it('should throw NotFoundError when experiment does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockStore.getExperiment.mockResolvedValue(null);

      await expect(
        service.deleteExperiment('exp-999', 'user-456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should prevent deleting running experiments', async () => {
      const runningExperiment = { ...experiment, status: 'running' as const };
      mockCache.get.mockResolvedValue(runningExperiment);

      await expect(
        service.deleteExperiment('exp-123', 'user-456')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Feature Flag Operations', () => {
    const validFlagData = {
      key: 'test_flag',
      name: 'Test Flag',
      description: 'Test',
      enabled: true,
      defaultValue: false,
      variants: [
        { key: 'on', value: true, weight: 50 },
        { key: 'off', value: false, weight: 50 },
      ],
    };

    describe('createFeatureFlag', () => {
      it('should create feature flag successfully', async () => {
        const createdFlag = {
          id: 'flag-123',
          ...validFlagData,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        };

        mockStore.getFeatureFlagByKey.mockResolvedValue(null);
        mockStore.createFeatureFlag.mockResolvedValue(createdFlag);

        const result = await service.createFeatureFlag(validFlagData);

        expect(result).toEqual(createdFlag);
        expect(mockStore.createFeatureFlag).toHaveBeenCalled();
        expect(mockCache.set).toHaveBeenCalledTimes(2);
      });

      it('should throw ConflictError for duplicate key', async () => {
        mockStore.getFeatureFlagByKey.mockResolvedValue({ id: 'existing' });

        await expect(service.createFeatureFlag(validFlagData)).rejects.toThrow(ConflictError);
      });

      it('should validate variant weights sum to 100', async () => {
        const invalidData = {
          ...validFlagData,
          variants: [
            { key: 'on', value: true, weight: 40 },
            { key: 'off', value: false, weight: 40 },
          ],
        };

        mockStore.getFeatureFlagByKey.mockResolvedValue(null);

        await expect(service.createFeatureFlag(invalidData)).rejects.toThrow(
          /must sum to 100/
        );
      });
    });

    describe('updateFeatureFlag', () => {
      const existingFlag: FeatureFlag = {
        id: 'flag-123',
        key: 'test_flag',
        name: 'Test Flag',
        description: '',
        enabled: true,
        defaultValue: false,
        variants: [],
        targetingRules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      it('should update feature flag successfully', async () => {
        const updates = { enabled: false };
        const updatedFlag = { ...existingFlag, ...updates };

        mockCache.get.mockResolvedValue(existingFlag);
        mockStore.updateFeatureFlag.mockResolvedValue(updatedFlag);

        const result = await service.updateFeatureFlag('flag-123', updates);

        expect(result).toEqual(updatedFlag);
        expect(mockStore.updateFeatureFlag).toHaveBeenCalled();
      });
    });

    describe('getFeatureFlag', () => {
      it('should return flag from cache if available', async () => {
        const flag = { id: 'flag-123' } as FeatureFlag;
        mockCache.get.mockResolvedValue(flag);

        const result = await service.getFeatureFlag('flag-123');

        expect(result).toEqual(flag);
      });
    });

    describe('deleteFeatureFlag', () => {
      it('should delete feature flag successfully', async () => {
        const flag: FeatureFlag = { id: 'flag-123', key: 'test' } as FeatureFlag;
        mockCache.get.mockResolvedValue(flag);
        mockStore.deleteFeatureFlag.mockResolvedValue(true);

        const result = await service.deleteFeatureFlag('flag-123');

        expect(result).toBe(true);
        expect(mockStore.deleteFeatureFlag).toHaveBeenCalled();
      });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache experiment by both ID and key', async () => {
      const experiment: Experiment = {
        id: 'exp-123',
        key: 'test_key',
      } as Experiment;

      mockStore.getExperimentByKey.mockResolvedValue(null);
      mockStore.createExperiment.mockResolvedValue(experiment);
      mockStore.logChange.mockResolvedValue(undefined);

      await service.createExperiment({
        key: 'test_key',
        name: 'Test',
        status: 'draft',
        designType: 'ab',
        hypotheses: 'test',
        primaryMetric: 'metric',
        randomizationUnit: 'user',
        assignmentKey: 'user_id',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        designConfig: { type: 'ab' },
        trafficAllocation: 100,
        createdBy: 'user-123',
      } as any);

      expect(mockCache.set).toHaveBeenCalledWith(
        'experiment:exp-123',
        experiment,
        300
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'experiment:key:test_key',
        experiment,
        300
      );
    });

    it('should gracefully handle cache failures', async () => {
      mockCache.set.mockRejectedValue(new Error('Cache error'));

      const experiment = { id: 'exp-123', key: 'test' } as Experiment;
      mockStore.getExperiment.mockResolvedValue(experiment);

      // Should not throw even if cache fails
      const result = await service.getExperiment('exp-123');

      expect(result).toEqual(experiment);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
