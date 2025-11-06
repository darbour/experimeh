/**
 * FeatureFlag - Feature flag component
 */

import React from 'react';
import { useAssignment } from './useAssignment';
import { FeatureFlagProps } from './types';

export const FeatureFlag: React.FC<FeatureFlagProps> = ({
  flag,
  children,
  fallback = null,
  autoTrackExposure = true,
}) => {
  const { variantKey, loading, error } = useAssignment(flag, {
    autoTrackExposure,
  });

  // Loading state
  if (loading) {
    return <>{fallback}</>;
  }

  // Error state - fail closed (feature disabled)
  if (error) {
    console.error('FeatureFlag error:', error);
    return <>{fallback}</>;
  }

  // Check if enabled
  const isEnabled = variantKey === 'enabled' || variantKey === 'on' || variantKey === 'true';

  return <>{isEnabled ? children : fallback}</>;
};

FeatureFlag.displayName = 'FeatureFlag';
