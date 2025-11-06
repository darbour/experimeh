import { ExperimentClient } from '../src/client';
import { ValidationError, NetworkError } from '../src/errors';

// Mock fetch
global.fetch = jest.fn();

describe('ExperimentClient', () => {
  let client: ExperimentClient;

  beforeEach(() => {
    client = new ExperimentClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      cacheEnabled: false, // Disable cache for testing
    });

    (global.fetch as jest.Mock).mockClear();
  });

  describe('constructor', () => {
    it('should throw validation error if apiUrl is missing', () => {
      expect(() => {
        new ExperimentClient({
          apiUrl: '',
          apiKey: 'key',
        });
      }).toThrow(ValidationError);
    });

    it('should throw validation error if apiKey is missing', () => {
      expect(() => {
        new ExperimentClient({
          apiUrl: 'https://api.example.com',
          apiKey: '',
        });
      }).toThrow(ValidationError);
    });

    it('should create client with default config', () => {
      const client = new ExperimentClient({
        apiUrl: 'https://api.example.com',
        apiKey: 'key',
      });

      expect(client).toBeInstanceOf(ExperimentClient);
    });
  });

  describe('getAssignment', () => {
    it('should fetch assignment from API', async () => {
      const mockAssignment = {
        data: {
          id: 'assignment-1',
          experimentKey: 'exp-1',
          userId: 'user-123',
          variantKey: 'treatment',
          assignedAt: new Date().toISOString(),
        },
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAssignment,
      });

      const result = await client.getAssignment('exp-1', 'user-123');

      expect(result).toMatchObject({
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
      });
      expect(result.assignedAt).toBeInstanceOf(Date);
    });

    it('should throw validation error for missing experimentKey', async () => {
      await expect(
        client.getAssignment('', 'user-123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for missing userId', async () => {
      await expect(
        client.getAssignment('exp-1', '')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw network error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(
        client.getAssignment('exp-1', 'user-123')
      ).rejects.toThrow(NetworkError);
    });
  });

  describe('getExperiment', () => {
    it('should fetch experiment from API', async () => {
      const mockExperiment = {
        data: {
          key: 'exp-1',
          name: 'Test Experiment',
          status: 'running',
          variants: [
            { key: 'control', name: 'Control', weight: 0.5 },
            { key: 'treatment', name: 'Treatment', weight: 0.5 },
          ],
        },
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExperiment,
      });

      const result = await client.getExperiment('exp-1');

      expect(result).toMatchObject({
        key: 'exp-1',
        name: 'Test Experiment',
        status: 'running',
      });
      expect(result.variants).toHaveLength(2);
    });

    it('should throw validation error for missing experimentKey', async () => {
      await expect(
        client.getExperiment('')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('trackExposure', () => {
    it('should send exposure event to API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.trackExposure('exp-1', 'user-123', 'treatment');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/events/exposure',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key',
          }),
        })
      );
    });

    it('should throw validation error for missing parameters', async () => {
      await expect(
        client.trackExposure('', 'user-123', 'treatment')
      ).rejects.toThrow(ValidationError);

      await expect(
        client.trackExposure('exp-1', '', 'treatment')
      ).rejects.toThrow(ValidationError);

      await expect(
        client.trackExposure('exp-1', 'user-123', '')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('trackMetric', () => {
    it('should send metric event to API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.trackMetric('conversion', 'user-123', 1);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/events/metric',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw validation error for invalid value', async () => {
      await expect(
        client.trackMetric('conversion', 'user-123', 'invalid' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('retry logic', () => {
    it('should retry on network errors', async () => {
      const client = new ExperimentClient({
        apiUrl: 'https://api.example.com',
        apiKey: 'test-key',
        maxRetries: 2,
        retryDelay: 10,
        cacheEnabled: false,
      });

      // Fail twice, then succeed
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 'assignment-1',
              experimentKey: 'exp-1',
              userId: 'user-123',
              variantKey: 'treatment',
              assignedAt: new Date().toISOString(),
            },
            success: true,
          }),
        });

      const result = await client.getAssignment('exp-1', 'user-123');

      expect(result.variantKey).toBe('treatment');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' }),
      });

      await expect(
        client.getAssignment('exp-1', 'user-123')
      ).rejects.toThrow(NetworkError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
