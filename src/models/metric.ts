/**
 * Metric Event Data Models
 *
 * TypeScript types for tracking metric events and measurements.
 * Metrics are the outcomes we measure to evaluate experiment performance.
 */

/**
 * Type of metric measurement
 */
export enum MetricType {
  /** Count of occurrences (e.g., clicks, purchases) */
  COUNT = 'count',
  /** Continuous value (e.g., revenue, time spent) */
  CONTINUOUS = 'continuous',
  /** Binary outcome (0 or 1, success or failure) */
  BINARY = 'binary',
  /** Categorical outcome */
  CATEGORICAL = 'categorical',
  /** Rate or proportion */
  RATE = 'rate',
}

/**
 * How a metric should be aggregated
 */
export enum MetricAggregation {
  /** Sum of all values */
  SUM = 'sum',
  /** Average of all values */
  MEAN = 'mean',
  /** Median value */
  MEDIAN = 'median',
  /** Count of events */
  COUNT = 'count',
  /** Unique count (deduplicated) */
  UNIQUE_COUNT = 'unique_count',
  /** Minimum value */
  MIN = 'min',
  /** Maximum value */
  MAX = 'max',
  /** 95th percentile */
  P95 = 'p95',
  /** 99th percentile */
  P99 = 'p99',
  /** Conversion rate (binary outcomes) */
  CONVERSION_RATE = 'conversion_rate',
}

/**
 * Time window for metric calculation
 */
export enum MetricTimeWindow {
  /** Measure immediately */
  IMMEDIATE = 'immediate',
  /** Within 24 hours */
  DAY_1 = 'day_1',
  /** Within 7 days */
  DAY_7 = 'day_7',
  /** Within 30 days */
  DAY_30 = 'day_30',
  /** Within 90 days */
  DAY_90 = 'day_90',
  /** Custom window */
  CUSTOM = 'custom',
}

/**
 * Metric event - a single measurement
 */
export interface MetricEvent {
  /** Unique identifier */
  id: string;
  /** Name of the metric (e.g., "checkout_completed", "revenue") */
  eventName: string;
  /** Metric definition ID (links to metric configuration) */
  metricId?: string;

  /** Unit identifier (user, session, etc.) */
  unitId: string;
  /** Type of unit */
  unitType: string;

  /** Numeric value (for continuous metrics) */
  value?: number;
  /** Categorical value (for categorical metrics) */
  category?: string;
  /** Binary outcome (for conversion metrics) */
  success?: boolean;

  /** When event occurred */
  timestamp: Date;
  /** When event was received/processed */
  receivedAt: Date;

  /** Session identifier */
  sessionId?: string;
  /** Transaction/order identifier (for revenue metrics) */
  transactionId?: string;

  /** Experiments this event should be attributed to */
  experimentIds: string[];
  /** Variants user was in for each experiment */
  variantKeys: Record<string, string>;

  /** Event properties */
  properties: Record<string, unknown>;
  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** Source of the event (SDK, API, etc.) */
  source: string;
  /** Version of source */
  sourceVersion?: string;
}

/**
 * Request to log a metric event
 */
export interface LogMetricRequest {
  /** Metric name */
  eventName: string;
  /** Unit identifier */
  unitId: string;
  /** Value (for continuous metrics) */
  value?: number;
  /** Category (for categorical metrics) */
  category?: string;
  /** Success flag (for binary metrics) */
  success?: boolean;
  /** Timestamp (defaults to now) */
  timestamp?: Date;
  /** Session ID */
  sessionId?: string;
  /** Transaction ID */
  transactionId?: string;
  /** Properties */
  properties?: Record<string, unknown>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch metric logging
 */
export interface BatchLogMetricRequest {
  /** List of metrics to log */
  metrics: LogMetricRequest[];
  /** Common context for all metrics */
  commonContext?: {
    sessionId?: string;
    source?: string;
    sourceVersion?: string;
  };
}

/**
 * Response from logging metrics
 */
export interface LogMetricResponse {
  /** Created metric events */
  events: MetricEvent[];
  /** Number accepted */
  accepted: number;
  /** Number rejected */
  rejected: number;
  /** Errors for rejected events */
  errors: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Metric definition/configuration
 */
export interface MetricDefinition {
  /** Unique identifier */
  id: string;
  /** Machine-readable key */
  key: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;

  /** Type of metric */
  type: MetricType;
  /** How to aggregate */
  aggregation: MetricAggregation;
  /** Time window for measurement */
  timeWindow: MetricTimeWindow;
  /** Custom time window (if using CUSTOM) */
  customTimeWindowHours?: number;

  /** Event name(s) that contribute to this metric */
  eventNames: string[];
  /** Optional filter expression */
  filter?: string;

  /** Whether this is a guardrail metric */
  isGuardrail: boolean;
  /** Guardrail threshold (metric should not drop below this) */
  guardrailThreshold?: number;

  /** Expected direction of improvement */
  expectedDirection: 'increase' | 'decrease' | 'none';
  /** Whether higher is better */
  higherIsBetter: boolean;

  /** Unit of measurement (e.g., "$", "seconds", "clicks") */
  unit?: string;
  /** Format for display (e.g., "currency", "percentage") */
  displayFormat?: string;

  /** Tags */
  tags: string[];
  /** Owner */
  owner: string;

  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Request to create metric definition
 */
export interface CreateMetricDefinitionRequest {
  key: string;
  name: string;
  description: string;
  type: MetricType;
  aggregation: MetricAggregation;
  timeWindow: MetricTimeWindow;
  customTimeWindowHours?: number;
  eventNames: string[];
  filter?: string;
  isGuardrail?: boolean;
  guardrailThreshold?: number;
  expectedDirection: 'increase' | 'decrease' | 'none';
  higherIsBetter: boolean;
  unit?: string;
  displayFormat?: string;
  tags?: string[];
  owner: string;
}

/**
 * Metric value computed for a specific unit and time window
 */
export interface ComputedMetricValue {
  /** Metric definition ID */
  metricId: string;
  /** Metric key */
  metricKey: string;
  /** Unit identifier */
  unitId: string;
  /** Computed value */
  value: number;
  /** Time window */
  windowStart: Date;
  windowEnd: Date;
  /** Number of events that contributed */
  eventCount: number;
  /** When computed */
  computedAt: Date;
}

/**
 * Aggregated metric statistics across multiple units
 */
export interface MetricStatistics {
  /** Metric identifier */
  metricId: string;
  /** Metric key */
  metricKey: string;
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
  /** Sample size */
  sampleSize: number;
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Percentiles */
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  /** Sum of all values */
  sum: number;
}

/**
 * Metric comparison between variants
 */
export interface MetricComparison {
  /** Metric being compared */
  metricId: string;
  metricKey: string;
  /** Control variant */
  control: {
    variantKey: string;
    statistics: MetricStatistics;
  };
  /** Treatment variant */
  treatment: {
    variantKey: string;
    statistics: MetricStatistics;
  };
  /** Absolute difference */
  absoluteDifference: number;
  /** Relative difference (percentage) */
  relativeDifference: number;
  /** Statistical significance */
  pValue: number;
  /** Confidence interval */
  confidenceInterval: {
    lower: number;
    upper: number;
    level: number; // e.g., 0.95
  };
}

/**
 * Time series data point for a metric
 */
export interface MetricTimeSeries {
  /** Timestamp */
  timestamp: Date;
  /** Value at this time */
  value: number;
  /** Sample size at this time */
  sampleSize: number;
  /** Confidence bounds */
  confidenceBounds?: {
    lower: number;
    upper: number;
  };
}

/**
 * Metric trend over time
 */
export interface MetricTrend {
  /** Metric identifier */
  metricId: string;
  metricKey: string;
  /** Variant */
  variantKey?: string;
  /** Time series data */
  timeSeries: MetricTimeSeries[];
  /** Overall trend direction */
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  /** Slope of trend */
  slope?: number;
}

/**
 * Real-time metric snapshot
 */
export interface MetricSnapshot {
  /** Metric identifier */
  metricId: string;
  metricKey: string;
  /** Experiment ID */
  experimentId: string;
  /** Current value per variant */
  byVariant: Record<string, {
    value: number;
    sampleSize: number;
    lastUpdated: Date;
  }>;
  /** When snapshot was taken */
  snapshotTime: Date;
}

/**
 * Metric alert configuration
 */
export interface MetricAlert {
  /** Unique identifier */
  id: string;
  /** Metric being monitored */
  metricId: string;
  /** Alert condition */
  condition: {
    /** Comparison operator */
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    /** Threshold value */
    threshold: number;
  };
  /** Whether alert is active */
  enabled: boolean;
  /** Who to notify */
  notificationChannels: string[];
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Triggered alert
 */
export interface TriggeredAlert {
  /** Alert ID */
  alertId: string;
  /** Metric ID */
  metricId: string;
  /** Experiment ID */
  experimentId: string;
  /** Variant key (if variant-specific) */
  variantKey?: string;
  /** Actual value that triggered alert */
  actualValue: number;
  /** Threshold that was breached */
  threshold: number;
  /** When alert was triggered */
  triggeredAt: Date;
  /** Severity */
  severity: 'critical' | 'warning' | 'info';
  /** Message */
  message: string;
}

/**
 * Metric validation result
 */
export interface MetricValidation {
  /** Whether metric data is valid */
  isValid: boolean;
  /** Issues found */
  issues: Array<{
    type: 'error' | 'warning';
    message: string;
    field?: string;
  }>;
  /** Data quality score (0-100) */
  qualityScore: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Helper to check if metric is guardrail
 */
export function isGuardrailMetric(metric: MetricDefinition): boolean {
  return metric.isGuardrail;
}

/**
 * Helper to format metric value for display
 */
export function formatMetricValue(value: number, definition: MetricDefinition): string {
  if (definition.displayFormat === 'percentage') {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (definition.displayFormat === 'currency') {
    return `${definition.unit || '$'}${value.toFixed(2)}`;
  }
  if (definition.unit) {
    return `${value.toFixed(2)} ${definition.unit}`;
  }
  return value.toFixed(2);
}

/**
 * Type guard for continuous metrics
 */
export function isContinuousMetric(event: MetricEvent): event is MetricEvent & { value: number } {
  return event.value !== undefined && event.value !== null;
}

/**
 * Type guard for binary metrics
 */
export function isBinaryMetric(event: MetricEvent): event is MetricEvent & { success: boolean } {
  return event.success !== undefined && event.success !== null;
}

/**
 * Type guard for categorical metrics
 */
export function isCategoricalMetric(event: MetricEvent): event is MetricEvent & { category: string } {
  return event.category !== undefined && event.category !== null;
}
