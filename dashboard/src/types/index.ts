// Feature Flag Types
export type FlagStatus = 'enabled' | 'disabled' | 'archived';

export interface FlagVariant {
  id: string;
  key: string;
  name: string;
  description?: string;
  value: unknown;
  weight?: number;
}

export interface LinkedExperiment {
  experimentId: string;
  experimentKey: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  priority: number;
  linkedAt: Date | string;
  activatedAt?: Date | string;
  completedAt?: Date | string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: FlagStatus;
  variants: FlagVariant[];
  defaultVariantId: string;
  linkedExperiments: LinkedExperiment[];
  environment: string;
  tags?: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: string;
}

export interface CreateFeatureFlagForm {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  variants: Omit<FlagVariant, 'id'>[];
  defaultVariantId?: string;
  environment: string;
  tags?: string[];
}

export interface FeatureFlagFilters {
  status?: FlagStatus[];
  environment?: string[];
  search?: string;
  hasExperiments?: boolean;
}

// Variant Allocation Types (for linking flag variants to experiment roles)
export interface VariantAllocation {
  id?: string;
  flagVariantId: string;
  flagVariantKey: string;
  experimentRole: 'control' | 'treatment' | 'treatment_1' | 'treatment_2' | 'treatment_3';
  allocationPercentage: number;
  description?: string;
}

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
  key: string;

  // Feature flag relationship (REQUIRED)
  featureFlagId: string;
  variantAllocations: VariantAllocation[];

  // Legacy (deprecated - use featureFlagId)
  flag_key?: string;

  design_type: DesignType;
  status: ExperimentStatus;
  variants: Variant[];
  metrics: Metric[];
  primaryMetric: string;
  secondaryMetrics?: string[];
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
  key: string;
  description: string;

  // Feature flag relationship (REQUIRED)
  featureFlagId: string;
  variantAllocations: Omit<VariantAllocation, 'id'>[];

  design_type: DesignType;
  primaryMetric: string;
  secondaryMetrics?: string[];
  variants?: Variant[];
  metrics?: Metric[];
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

// Survey Experiments Types
export type SurveyAnalysisType = 'paired_comparison' | 'multi_item';
export type SurveyAnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SurveyAnalysis {
  id: string;
  name: string;
  analysisType: SurveyAnalysisType;
  status: SurveyAnalysisStatus;
  createdAt: string;
  completedAt?: string;
  config: any;
  results?: SurveyAnalysisResult;
  qualityChecks?: SurveyQualityResults;
  error?: string;
}

export interface SurveyAnalysisResult {
  method: string;
  estimates: Record<string, number>;
  confidence_intervals: Record<string, [number, number]>;
  p_values: Record<string, number>;
  standard_errors: Record<string, number>;
  sample_sizes: Record<string, number>;
  effect_sizes?: Record<string, number>;
  assumptions_met?: Record<string, boolean>;
  warnings?: string[];
  residual_diagnostics?: Record<string, any>;
  random_effects?: Record<string, any>;
  temporal_effects?: Record<string, any>;
  effective_sample_size?: number;
}

export interface QualityCheck {
  n_flagged?: number;
  pct_flagged?: number;
  flagged_respondents?: string[];
  avg_rate?: number;
  threshold?: number;
  error?: string;
}

export interface BiasCheck {
  detected?: boolean;
  significant?: boolean;
  p_value?: number;
  correlation?: number;
  interpretation?: string;
  error?: string;
}

export interface SurveyQualityResults {
  quality_checks: {
    straightlining?: QualityCheck & { n_straightliners?: number; pct_straightliners?: number };
    speeding?: QualityCheck & { n_speeders?: number; pct_speeders?: number };
    attention?: QualityCheck & { n_failed?: number; pct_failed?: number; pass_rate?: number };
    response_variance?: QualityCheck & { n_low_variance?: number; pct_low_variance?: number; avg_variance?: number };
  };
  bias_checks: {
    order_bias?: BiasCheck & { order_bias_detected?: boolean; spearman_correlation?: number; linear_slope?: number };
    scale_bias?: BiasCheck & { extreme_usage?: number; midpoint_usage?: number; extreme_avoidance?: boolean };
  };
  balance_checks: {
    randomization?: {
      all_balanced?: boolean;
      imbalanced_variables?: string[];
      n_imbalanced?: number;
    };
  };
}

export interface SurveyAnalysisConfig {
  // Common config
  alpha?: number;

  // Paired comparison config
  subject_column?: string;
  condition_column?: string;
  metric_column?: string;
  control_value?: string;
  treatment_value?: string;
  order_column?: string;

  // Multi-item config
  respondent_column?: string;
  item_column?: string;
  treatment_column?: string;

  // Quality checks config
  rating_columns?: string[];
  duration_column?: string;
  attention_column?: string;
  attention_correct_answer?: any;
  covariate_columns?: string[];
}
