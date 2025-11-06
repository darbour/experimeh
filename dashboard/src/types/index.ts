// Experiment Types
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export type DesignType = 'ab' | 'factorial' | 'switchback' | 'stepped_wedge';

export interface Variant {
  name: string;
  allocation: number;
  config?: Record<string, any>;
}

export interface Metric {
  name: string;
  type: 'primary' | 'secondary' | 'guardrail';
  aggregation: 'mean' | 'sum' | 'count' | 'ratio';
  direction?: 'increase' | 'decrease';
  guardrail_threshold?: number;
}

export interface FactorialFactor {
  name: string;
  levels: string[];
}

export interface SwitchbackConfig {
  switch_duration_seconds: number;
  switch_unit: 'time' | 'user_session';
}

export interface SteppedWedgeConfig {
  num_steps: number;
  step_duration_seconds: number;
  rollout_order: 'sequential' | 'random';
}

export interface SegmentConfig {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  flag_key: string;
  design_type: DesignType;
  status: ExperimentStatus;
  variants: Variant[];
  metrics: Metric[];
  start_date?: string;
  end_date?: string;

  // Design-specific configs
  factors?: FactorialFactor[];
  switchback_config?: SwitchbackConfig;
  stepped_wedge_config?: SteppedWedgeConfig;

  // Segmentation
  segments?: SegmentConfig[];

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Stats
  total_assignments?: number;
  sample_size_per_variant?: number;
}

// Analysis Types
export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface StatisticalTest {
  test_type: string;
  statistic: number;
  p_value: number;
  degrees_of_freedom?: number;
}

export interface MetricResult {
  metric_name: string;
  variant_name: string;
  mean: number;
  std_dev: number;
  sample_size: number;
  confidence_interval: ConfidenceInterval;

  // Comparison to control
  effect_size?: number;
  relative_lift?: number;
  p_value?: number;
  is_significant?: boolean;

  // Guardrail
  is_guardrail_violated?: boolean;
}

export interface SegmentResult {
  segment_name: string;
  segment_filter: Record<string, any>;
  metric_results: MetricResult[];
}

export interface TimeSeriesPoint {
  timestamp: string;
  variant_name: string;
  metric_name: string;
  value: number;
  sample_size: number;
}

export interface AnalysisResult {
  experiment_id: string;
  analysis_id: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';

  // Results
  primary_metric_results: MetricResult[];
  secondary_metric_results: MetricResult[];
  guardrail_results: MetricResult[];

  // Statistical tests
  statistical_tests: StatisticalTest[];

  // Segmentation
  segment_results?: SegmentResult[];

  // Time series
  time_series?: TimeSeriesPoint[];

  // Recommendations
  recommendation?: {
    action: 'stop' | 'continue' | 'scale' | 'rollback';
    reason: string;
    confidence: number;
  };

  // Metadata
  analysis_duration_ms?: number;
  error?: string;
}

// Assignment Types
export interface Assignment {
  user_id: string;
  experiment_id: string;
  variant_name: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface AssignmentDistribution {
  variant_name: string;
  count: number;
  percentage: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Filter and Sort Types
export interface ExperimentFilters {
  status?: ExperimentStatus[];
  design_type?: DesignType[];
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// Form Types
export interface CreateExperimentForm {
  name: string;
  description: string;
  flag_key: string;
  design_type: DesignType;
  variants: Variant[];
  metrics: Metric[];
  start_date?: string;
  end_date?: string;
  factors?: FactorialFactor[];
  switchback_config?: SwitchbackConfig;
  stepped_wedge_config?: SteppedWedgeConfig;
  segments?: SegmentConfig[];
}

// Dashboard Stats
export interface DashboardStats {
  total_experiments: number;
  running_experiments: number;
  completed_experiments: number;
  total_assignments_today: number;
  recent_results: AnalysisResult[];
}
