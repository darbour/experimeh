/**
 * useExperiment hook - Get experiment assignment
 */

import { useState, useEffect, useCallback, useContext } from 'react';
import { ExperimentContext } from './context';
import { UseExperimentResult } from './types';

export function useExperiment(experimentKey: string): UseExperimentResult {
  const context = useContext(ExperimentContext);

  if (!context) {
    throw new Error('useExperiment must be used within ExperimentProvider');
  }

  const [assignment, setAssignment] = useState<UseExperimentResult['assignment']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignment = useCallback(async () => {
    if (!experimentKey) {
      setError(new Error('experimentKey is required'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await context.getAssignment(experimentKey);
      setAssignment(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [context, experimentKey]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  return {
    assignment,
    loading,
    error,
    refetch: fetchAssignment,
  };
}
