/**
 * Core types for the Experimeh Browser SDK
 */

export interface ExperimentClientConfig {
  /** Base URL of the Experimeh API */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable local storage caching (default: true) */
  cacheEnabled?: boolean;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTTL?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
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

export interface MetricEvent {
  /** Metric name/key */
  metricKey: string;
  /** User/subject identifier */
  userId: string;
  /** Metric value */
  value: number;
  /** Event timestamp */
  timestamp?: Date;
  /** Event metadata */
  metadata?: Record<string, any>;
}

export interface ExposureEvent {
  /** Experiment key */
  experimentKey: string;
  /** User/subject identifier */
  userId: string;
  /** Variant key shown to user */
  variantKey: string;
  /** Exposure timestamp */
  timestamp?: Date;
  /** Exposure metadata */
  metadata?: Record<string, any>;
}

export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttl: number;
}

export interface APIResponse<T> {
  /** Response data */
  data: T;
  /** Success status */
  success: boolean;
  /** Error message if any */
  error?: string;
}
