/**
 * Core types for the Experimeh React SDK
 */

import { ReactNode } from 'react';

export interface ExperimentProviderProps {
  /** Base URL of the Experimeh API */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** User identifier */
  userId: string;
  /** Enable caching (default: true) */
  cacheEnabled?: boolean;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTTL?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Children components */
  children: ReactNode;
}

export interface Assignment {
  /** Unique identifier for the assignment */
  id: string;
  /** Experiment identifier */
  experimentKey: string;
  /** User/subject identifier */
  userId: string;
  /** Variant key assigned to the user */
  variantKey: string;
  /** Allocation group (for analysis) */
  allocationGroup?: string;
  /** When the assignment was created */
  assignedAt: Date;
  /** Assignment metadata */
  metadata?: Record<string, any>;
}

export interface Experiment {
  /** Unique experiment key */
  key: string;
  /** Human-readable experiment name */
  name: string;
  /** Current experiment status */
  status: 'draft' | 'running' | 'paused' | 'completed';
  /** Available variants */
  variants: Variant[];
  /** Experiment configuration */
  config?: Record<string, any>;
}

export interface Variant {
  /** Variant key */
  key: string;
  /** Variant name */
  name: string;
  /** Allocation weight */
  weight: number;
  /** Variant configuration/payload */
  config?: Record<string, any>;
}

export interface UseExperimentResult {
  /** Assignment data */
  assignment: Assignment | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch assignment */
  refetch: () => Promise<void>;
}

export interface UseAssignmentOptions {
  /** Automatically track exposure when assignment is loaded */
  autoTrackExposure?: boolean;
  /** Metadata to include with exposure tracking */
  metadata?: Record<string, any>;
}

export interface UseAssignmentResult {
  /** Variant key */
  variantKey: string | null;
  /** Full assignment data */
  assignment: Assignment | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

export interface ExperimentGateProps {
  /** Experiment key to check */
  experiment: string;
  /** Variant key to match */
  variant: string | string[];
  /** Children to render if variant matches */
  children: ReactNode;
  /** Fallback to render if variant doesn't match */
  fallback?: ReactNode;
  /** Automatically track exposure (default: true) */
  autoTrackExposure?: boolean;
}

export interface FeatureFlagProps {
  /** Feature flag key */
  flag: string;
  /** Children to render if flag is enabled */
  children: ReactNode;
  /** Fallback to render if flag is disabled */
  fallback?: ReactNode;
  /** Automatically track exposure (default: true) */
  autoTrackExposure?: boolean;
}

export interface ExperimentContextValue {
  /** Current user ID */
  userId: string;
  /** Get assignment for an experiment */
  getAssignment: (experimentKey: string) => Promise<Assignment>;
  /** Track exposure event */
  trackExposure: (
    experimentKey: string,
    variantKey: string,
    metadata?: Record<string, any>
  ) => Promise<void>;
  /** Track metric event */
  trackMetric: (
    metricKey: string,
    value: number,
    metadata?: Record<string, any>
  ) => Promise<void>;
  /** Get experiment details */
  getExperiment: (experimentKey: string) => Promise<Experiment>;
  /** Clear cache */
  clearCache: () => void;
}
