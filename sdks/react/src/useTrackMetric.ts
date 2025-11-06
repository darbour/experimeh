/**
 * useTrackMetric hook - Track metrics
 */

import { useCallback, useContext } from 'react';
import { ExperimentContext } from './context';

export function useTrackMetric() {
  const context = useContext(ExperimentContext);

  if (!context) {
    throw new Error('useTrackMetric must be used within ExperimentProvider');
  }

  return useCallback(
    async (
      metricKey: string,
      value: number,
      metadata?: Record<string, any>
    ): Promise<void> => {
      try {
        await context.trackMetric(metricKey, value, metadata);
      } catch (error) {
        console.error('Failed to track metric:', error);
        throw error;
      }
    },
    [context]
  );
}
