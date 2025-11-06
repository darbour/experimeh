/**
 * ExperimentGate - Conditional rendering based on experiment variant
 */

import React from 'react';
import { useAssignment } from './useAssignment';
import { ExperimentGateProps } from './types';

export const ExperimentGate: React.FC<ExperimentGateProps> = ({
  experiment,
  variant,
  children,
  fallback = null,
  autoTrackExposure = true,
}) => {
  const { variantKey, loading, error } = useAssignment(experiment, {
    autoTrackExposure,
  });

  // Loading state
  if (loading) {
    return <>{fallback}</>;
  }

  // Error state - fail closed (show fallback)
  if (error) {
    console.error('ExperimentGate error:', error);
    return <>{fallback}</>;
  }

  // Check if variant matches
  const variants = Array.isArray(variant) ? variant : [variant];
  const matches = variantKey && variants.includes(variantKey);

  return <>{matches ? children : fallback}</>;
};

ExperimentGate.displayName = 'ExperimentGate';
