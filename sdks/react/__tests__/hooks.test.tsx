import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { ExperimentProvider } from '../src/ExperimentProvider';
import { useExperiment } from '../src/useExperiment';
import { useAssignment } from '../src/useAssignment';
import { useTrackMetric } from '../src/useTrackMetric';
import { ExperimentClient } from '@experimeh/browser';

const mockClient = ExperimentClient as jest.MockedClass<typeof ExperimentClient>;

describe('React SDK Hooks', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExperimentProvider
      apiUrl="https://api.example.com"
      apiKey="test-key"
      userId="user-123"
    >
      {children}
    </ExperimentProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useExperiment', () => {
    it('should fetch assignment on mount', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      const { result } = renderHook(() => useExperiment('exp-1'), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.assignment).toBe(null);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.assignment).toEqual(mockAssignment);
      expect(result.current.error).toBe(null);
    });

    it('should handle errors', async () => {
      const mockError = new Error('API error');

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useExperiment('exp-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.assignment).toBe(null);
      expect(result.current.error).toEqual(mockError);
    });

    it('should throw error if used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useExperiment('exp-1'));
      }).toThrow('useExperiment must be used within ExperimentProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useAssignment', () => {
    it('should return variant key', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      const { result } = renderHook(() => useAssignment('exp-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.variantKey).toBe('treatment');
      expect(result.current.assignment).toEqual(mockAssignment);
    });

    it('should auto-track exposure when enabled', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);
      mockInstance.trackExposure.mockResolvedValueOnce(undefined);

      const { result } = renderHook(
        () => useAssignment('exp-1', { autoTrackExposure: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockInstance.trackExposure).toHaveBeenCalledWith(
        'exp-1',
        'treatment',
        undefined
      );
    });

    it('should not track exposure when disabled', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      const { result } = renderHook(
        () => useAssignment('exp-1', { autoTrackExposure: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockInstance.trackExposure).not.toHaveBeenCalled();
    });
  });

  describe('useTrackMetric', () => {
    it('should track metric', async () => {
      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.trackMetric.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useTrackMetric(), { wrapper });

      await result.current('conversion', 1);

      expect(mockInstance.trackMetric).toHaveBeenCalledWith(
        'conversion',
        1,
        undefined
      );
    });

    it('should track metric with metadata', async () => {
      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.trackMetric.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useTrackMetric(), { wrapper });

      const metadata = { page: '/checkout' };
      await result.current('conversion', 1, metadata);

      expect(mockInstance.trackMetric).toHaveBeenCalledWith(
        'conversion',
        1,
        metadata
      );
    });

    it('should throw error if used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useTrackMetric());
      }).toThrow('useTrackMetric must be used within ExperimentProvider');

      consoleSpy.mockRestore();
    });
  });
});
