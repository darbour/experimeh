/**
 * Experimeh React SDK
 *
 * A React SDK for feature flag experimentation with hooks and components.
 *
 * @packageDocumentation
 */

export { ExperimentProvider } from './ExperimentProvider';
export { ExperimentGate } from './ExperimentGate';
export { FeatureFlag } from './FeatureFlag';

export { useExperiment } from './useExperiment';
export { useAssignment } from './useAssignment';
export { useTrackMetric } from './useTrackMetric';

export { ExperimentContext } from './context';

export type {
  ExperimentProviderProps,
  Assignment,
  Experiment,
  Variant,
  UseExperimentResult,
  UseAssignmentOptions,
  UseAssignmentResult,
  ExperimentGateProps,
  FeatureFlagProps,
  ExperimentContextValue,
} from './types';
