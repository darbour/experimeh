/**
 * useAssignment hook - Get assignment with auto-tracking
 */

import { useEffect } from 'react';
import { useExperiment } from './useExperiment';
import { useContext } from 'react';
import { ExperimentContext } from './context';
import { UseAssignmentOptions, UseAssignmentResult } from './types';

export function useAssignment(
  experimentKey: string,
  options: UseAssignmentOptions = {}
): UseAssignmentResult {
  const context = useContext(ExperimentContext);

  if (!context) {
    throw new Error('useAssignment must be used within ExperimentProvider');
  }

  const { assignment, loading, error } = useExperiment(experimentKey);
  const { autoTrackExposure = false, metadata } = options;

  // Auto-track exposure when assignment loads
  useEffect(() => {
    if (autoTrackExposure && assignment && !loading && !error) {
      context.trackExposure(
        assignment.experimentKey,
        assignment.variantKey,
        metadata
      ).catch((err) => {
        console.error('Failed to track exposure:', err);
      });
    }
  }, [autoTrackExposure, assignment, loading, error, context, metadata]);

  return {
    variantKey: assignment?.variantKey || null,
    assignment,
    loading,
    error,
  };
}
