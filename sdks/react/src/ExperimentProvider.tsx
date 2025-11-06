/**
 * ExperimentProvider - Context provider for Experimeh
 */

import React, { useMemo } from 'react';
import { ExperimentClient } from '@experimeh/browser';
import { ExperimentContext } from './context';
import { ExperimentProviderProps, Assignment, Experiment } from './types';

export const ExperimentProvider: React.FC<ExperimentProviderProps> = ({
  apiUrl,
  apiKey,
  userId,
  cacheEnabled = true,
  cacheTTL = 300000,
  maxRetries = 3,
  timeout = 5000,
  children,
}) => {
  // Create client instance
  const client = useMemo(
    () =>
      new ExperimentClient({
        apiUrl,
        apiKey,
        cacheEnabled,
        cacheTTL,
        maxRetries,
        timeout,
      }),
    [apiUrl, apiKey, cacheEnabled, cacheTTL, maxRetries, timeout]
  );

  // Create context value
  const contextValue = useMemo(
    () => ({
      userId,
      getAssignment: async (experimentKey: string): Promise<Assignment> => {
        return client.getAssignment(experimentKey, userId);
      },
      trackExposure: async (
        experimentKey: string,
        variantKey: string,
        metadata?: Record<string, any>
      ): Promise<void> => {
        return client.trackExposure(experimentKey, userId, variantKey, metadata);
      },
      trackMetric: async (
        metricKey: string,
        value: number,
        metadata?: Record<string, any>
      ): Promise<void> => {
        return client.trackMetric(metricKey, userId, value, metadata);
      },
      getExperiment: async (experimentKey: string): Promise<Experiment> => {
        return client.getExperiment(experimentKey);
      },
      clearCache: (): void => {
        client.clearCache();
      },
    }),
    [client, userId]
  );

  return (
    <ExperimentContext.Provider value={contextValue}>
      {children}
    </ExperimentContext.Provider>
  );
};

ExperimentProvider.displayName = 'ExperimentProvider';
