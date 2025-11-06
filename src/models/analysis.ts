/**
 * Analysis Result Data Models
 *
 * TypeScript types for statistical analysis results, including frequentist
 * and Bayesian approaches, power analysis, and various experimental designs.
 */

/**
 * Type of statistical test performed
 */
export enum StatisticalTest {
  /** Two-sample t-test */
  T_TEST = 't_test',
  /** Z-test for proportions */
  Z_TEST = 'z_test',
  /** Chi-square test */
  CHI_SQUARE = 'chi_square',
  /** Analysis of Variance */
  ANOVA = 'anova',
  /** Mann-Whitney U test (non-parametric) */
  MANN_WHITNEY = 'mann_whitney',
  /** Wilcoxon signed-rank test */
  WILCOXON = 'wilcoxon',
  /** Linear regression */
  REGRESSION = 'regression',
  /** Bayesian analysis */
  BAYESIAN = 'bayesian',
}

/**
 * Status of an analysis
 */
export enum AnalysisStatus {
  /** Analysis is running */
  RUNNING = 'running',
  /** Analysis completed successfully */
  COMPLETED = 'completed',
  /** Analysis failed */
  FAILED = 'failed',
  /** Analysis is queued */
  QUEUED = 'queued',
}

/**
 * Significance level result
 */
export enum SignificanceLevel {
  /** Highly significant (p < 0.01) */
  HIGHLY_SIGNIFICANT = 'highly_significant',
  /** Significant (p < 0.05) */
  SIGNIFICANT = 'significant',
  /** Marginally significant (p < 0.1) */
  MARGINAL = 'marginal',
  /** Not significant (p >= 0.1) */
  NOT_SIGNIFICANT = 'not_significant',
}

/**
 * Recommendation from analysis
 */
export enum AnalysisRecommendation {
  /** Launch treatment variant */
  LAUNCH = 'launch',
  /** Continue experiment */
  CONTINUE = 'continue',
  /** Stop experiment, no winner */
  STOP_NO_WINNER = 'stop_no_winner',
  /** Stop experiment, issue detected */
  STOP_ISSUE = 'stop_issue',
  /** Needs more data */
  INSUFFICIENT_DATA = 'insufficient_data',
}

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  /** Lower bound */
  lower: number;
  /** Upper bound */
  upper: number;
  /** Confidence level (e.g., 0.95 for 95% CI) */
  level: number;
}

/**
 * Variant statistics
 */
export interface VariantStatistics {
  /** Variant key */
  variantKey: string;
  /** Variant name */
  variantName: string;
  /** Is this the control variant */
  isControl: boolean;
  /** Sample size */
  sampleSize: number;
  /** Mean value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Standard error */
  stdError: number;
  /** Median */
  median?: number;
  /** Variance */
  variance: number;
  /** Confidence interval for mean */
  confidenceInterval: ConfidenceInterval;
}

/**
 * Comparison between two variants
 */
export interface VariantComparison {
  /** Control variant */
  control: VariantStatistics;
  /** Treatment variant */
  treatment: VariantStatistics;
  /** Absolute difference */
  absoluteDifference: number;
  /** Relative difference (percentage) */
  relativeDifference: number;
  /** Standard error of difference */
  stdErrorDifference: number;
  /** Confidence interval for difference */
  confidenceInterval: ConfidenceInterval;
  /** Statistical test used */
  test: StatisticalTest;
  /** P-value */
  pValue: number;
  /** Significance level */
  significance: SignificanceLevel;
  /** Test statistic value */
  testStatistic: number;
  /** Degrees of freedom (if applicable) */
  degreesOfFreedom?: number;
}

/**
 * Bayesian analysis result
 */
export interface BayesianResult {
  /** Control variant */
  controlVariant: string;
  /** Treatment variant */
  treatmentVariant: string;
  /** Probability that treatment is better than control */
  probabilityToBeBest: number;
  /** Expected loss if wrong decision */
  expectedLoss: number;
  /** Credible interval for treatment effect */
  credibleInterval: ConfidenceInterval;
  /** Posterior mean of treatment effect */
  posteriorMean: number;
  /** Posterior standard deviation */
  posteriorStdDev: number;
  /** Prior parameters used */
  prior: {
    type: string;
    parameters: Record<string, number>;
  };
}

/**
 * Power analysis result
 */
export interface PowerAnalysisResult {
  /** Observed effect size */
  observedEffect: number;
  /** Statistical power achieved */
  power: number;
  /** Sample size used */
  sampleSize: number;
  /** Alpha level used */
  alpha: number;
  /** Minimum detectable effect */
  minimumDetectableEffect: number;
  /** Recommended sample size for desired power */
  recommendedSampleSize?: number;
  /** Is experiment adequately powered */
  isAdequatelyPowered: boolean;
}

/**
 * Sequential testing result
 */
export interface SequentialTestResult {
  /** Current sample size */
  currentSampleSize: number;
  /** Required sample size */
  targetSampleSize: number;
  /** Proportion of required data collected */
  progressPercentage: number;
  /** Current p-value */
  currentPValue: number;
  /** Sequential testing boundary */
  boundary: number;
  /** Whether to stop early */
  shouldStop: boolean;
  /** Reason for stopping (if applicable) */
  stopReason?: 'significant' | 'futile' | 'harm';
}

/**
 * Metric result for single metric
 */
export interface MetricResult {
  /** Metric ID */
  metricId: string;
  /** Metric key */
  metricKey: string;
  /** Metric name */
  metricName: string;
  /** Is primary metric */
  isPrimary: boolean;
  /** Is guardrail metric */
  isGuardrail: boolean;
  /** Variant statistics */
  variantStats: VariantStatistics[];
  /** Pairwise comparisons */
  comparisons: VariantComparison[];
  /** Bayesian result (if applicable) */
  bayesianResult?: BayesianResult;
  /** Whether guardrail was violated */
  guardrailViolated?: boolean;
}

/**
 * Factorial design analysis - main effect
 */
export interface MainEffect {
  /** Factor name */
  factorName: string;
  /** Levels being compared */
  levels: string[];
  /** Mean for each level */
  levelMeans: Record<string, number>;
  /** F-statistic */
  fStatistic: number;
  /** P-value */
  pValue: number;
  /** Significance */
  significance: SignificanceLevel;
  /** Effect size (eta squared) */
  effectSize: number;
}

/**
 * Factorial design analysis - interaction effect
 */
export interface InteractionEffect {
  /** Factors involved in interaction */
  factors: string[];
  /** F-statistic */
  fStatistic: number;
  /** P-value */
  pValue: number;
  /** Significance */
  significance: SignificanceLevel;
  /** Effect size */
  effectSize: number;
  /** Description of interaction */
  description: string;
}

/**
 * Factorial design analysis result
 */
export interface FactorialAnalysisResult {
  /** Main effects for each factor */
  mainEffects: MainEffect[];
  /** Interaction effects */
  interactionEffects: InteractionEffect[];
  /** Overall model fit */
  modelFit: {
    rSquared: number;
    adjustedRSquared: number;
    fStatistic: number;
    pValue: number;
  };
  /** Recommended best combination */
  recommendedCombination?: Record<string, string>;
}

/**
 * Within-subjects analysis result
 */
export interface WithinSubjectsAnalysisResult {
  /** Repeated measures ANOVA result */
  anovaResult: {
    fStatistic: number;
    pValue: number;
    significance: SignificanceLevel;
  };
  /** Pairwise comparisons between time points */
  pairwiseComparisons: VariantComparison[];
  /** Sphericity test result */
  sphericityTest?: {
    pValue: number;
    violated: boolean;
    correction: 'greenhouse_geisser' | 'huynh_feldt' | 'none';
  };
  /** Carryover effects detected */
  carryoverEffects?: {
    detected: boolean;
    pValue: number;
  };
}

/**
 * Switchback analysis result
 */
export interface SwitchbackAnalysisResult {
  /** Difference-in-differences estimate */
  didEstimate: number;
  /** Standard error of DiD estimate */
  didStdError: number;
  /** P-value for DiD estimate */
  didPValue: number;
  /** Confidence interval */
  confidenceInterval: ConfidenceInterval;
  /** Temporal autocorrelation detected */
  autocorrelation?: {
    lag1: number;
    significant: boolean;
  };
  /** Period-level results */
  periodResults: Array<{
    periodNumber: number;
    variant: string;
    mean: number;
    sampleSize: number;
  }>;
  /** Clustered standard errors used */
  clusteredStdErrors: boolean;
}

/**
 * Effect estimate with statistical measures
 *
 * Generic structure for representing an estimated effect from a model,
 * including the point estimate, uncertainty measures, and significance.
 */
export interface EffectEstimate {
  /** Point estimate of the effect */
  estimate: number;
  /** Standard error of the estimate */
  standardError: number;
  /** Confidence interval for the estimate */
  confidenceInterval: ConfidenceInterval;
  /** P-value for hypothesis test */
  pValue: number;
  /** Significance level */
  significance: SignificanceLevel;
  /** Test statistic (e.g., t-statistic, z-statistic) */
  testStatistic: number;
}

/**
 * Random effect for a single cluster
 *
 * Captures the cluster-specific deviation from the overall mean,
 * along with descriptive statistics for that cluster.
 */
export interface ClusterEffect {
  /** Cluster identifier */
  clusterId: string;
  /** Random intercept for this cluster (deviation from grand mean) */
  randomIntercept: number;
  /** Number of observations in this cluster */
  sampleSize: number;
  /** Mean outcome value for this cluster */
  meanOutcome: number;
}

/**
 * Stepped wedge analysis result
 *
 * Analysis for stepped wedge cluster randomized trials using mixed-effects
 * regression models. Accounts for clustering, temporal trends, and the
 * sequential rollout of treatment across clusters.
 */
export interface SteppedWedgeAnalysisResult {
  /** Type identifier for stepped wedge analysis */
  type: 'stepped_wedge';
  /** Treatment effect estimate (β_treatment) - primary parameter of interest */
  treatmentEffect: EffectEstimate;
  /** Time/step effect estimate (β_time) - captures secular trends */
  timeEffect: EffectEstimate;
  /** Intracluster correlation coefficient (ICC) - proportion of variance due to clustering */
  intraclusterCorrelation: number;
  /** Random effects for each cluster */
  clusterEffects: ClusterEffect[];
  /** Model fit statistics */
  modelFit: {
    /** Akaike Information Criterion */
    aic: number;
    /** Bayesian Information Criterion */
    bic: number;
    /** Log-likelihood of the fitted model */
    logLikelihood: number;
  };
  /** Validation of model assumptions */
  assumptions: {
    /** Whether residuals appear normally distributed */
    normalityOfResiduals: boolean;
    /** Whether variance is constant across groups/time */
    homoscedasticity: boolean;
    /** Whether temporal autocorrelation was detected */
    temporalAutocorrelation?: {
      detected: boolean;
      lag1Correlation: number;
    };
    /** Any assumption violations or concerns */
    issues: Array<{
      assumption: string;
      violated: boolean;
      severity: 'warning' | 'error';
      message: string;
    }>;
  };
}

/**
 * Multiple testing correction result
 */
export interface MultipleTestingCorrection {
  /** Method used */
  method: 'bonferroni' | 'benjamini_hochberg' | 'holm' | 'none';
  /** Original p-values */
  originalPValues: Record<string, number>;
  /** Adjusted p-values */
  adjustedPValues: Record<string, number>;
  /** Adjusted alpha level */
  adjustedAlpha: number;
  /** Number of hypotheses tested */
  numberOfTests: number;
}

/**
 * Sample ratio mismatch check
 */
export interface SampleRatioMismatch {
  /** Whether SRM was detected */
  detected: boolean;
  /** Expected ratios */
  expectedRatios: Record<string, number>;
  /** Observed ratios */
  observedRatios: Record<string, number>;
  /** Chi-square statistic */
  chiSquare: number;
  /** P-value */
  pValue: number;
  /** Severity if detected */
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Data quality checks
 */
export interface DataQualityCheck {
  /** Sample size adequacy */
  sampleSizeAdequate: boolean;
  /** Sample ratio mismatch */
  sampleRatioMismatch: SampleRatioMismatch;
  /** Outliers detected */
  outliersDetected: boolean;
  /** Outlier count */
  outlierCount?: number;
  /** Data completeness (0-1) */
  completeness: number;
  /** Issues found */
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
  }>;
}

/**
 * Complete experiment analysis result
 */
export interface ExperimentAnalysisResult {
  /** Unique identifier for this analysis */
  id: string;
  /** Experiment ID */
  experimentId: string;
  /** Experiment key */
  experimentKey: string;

  /** Analysis status */
  status: AnalysisStatus;
  /** When analysis was run */
  analyzedAt: Date;
  /** Time period analyzed */
  period: {
    start: Date;
    end: Date;
  };

  /** Overall sample size */
  totalSampleSize: number;
  /** Sample size per variant */
  sampleSizeByVariant: Record<string, number>;

  /** Results for each metric */
  metricResults: MetricResult[];
  /** Primary metric result */
  primaryMetricResult: MetricResult;

  /** Design-specific analysis */
  designAnalysis?:
    | { type: 'factorial'; result: FactorialAnalysisResult }
    | { type: 'within_subjects'; result: WithinSubjectsAnalysisResult }
    | { type: 'switchback'; result: SwitchbackAnalysisResult }
    | { type: 'stepped_wedge'; result: SteppedWedgeAnalysisResult };

  /** Power analysis */
  powerAnalysis: PowerAnalysisResult;
  /** Sequential testing result */
  sequentialTesting?: SequentialTestResult;
  /** Multiple testing correction */
  multipleTestingCorrection?: MultipleTestingCorrection;

  /** Data quality checks */
  dataQuality: DataQualityCheck;

  /** Overall recommendation */
  recommendation: AnalysisRecommendation;
  /** Explanation for recommendation */
  recommendationReason: string;
  /** Confidence in recommendation (0-100) */
  recommendationConfidence: number;

  /** Summary text */
  summary: string;
  /** Key insights */
  insights: string[];
  /** Warnings or concerns */
  warnings: string[];

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Request to run analysis
 */
export interface RunAnalysisRequest {
  /** Experiment ID or key */
  experimentKey: string;
  /** End date for analysis (defaults to now) */
  endDate?: Date;
  /** Start date for analysis (defaults to experiment start) */
  startDate?: Date;
  /** Metrics to analyze (defaults to all configured metrics) */
  metrics?: string[];
  /** Statistical test to use */
  statisticalTest?: StatisticalTest;
  /** Confidence level (defaults to 0.95) */
  confidenceLevel?: number;
  /** Whether to include Bayesian analysis */
  includeBayesian?: boolean;
  /** Multiple testing correction method */
  multipleTestingCorrection?: 'bonferroni' | 'benjamini_hochberg' | 'holm' | 'none';
}

/**
 * Scheduled analysis configuration
 */
export interface ScheduledAnalysis {
  /** Unique identifier */
  id: string;
  /** Experiment ID */
  experimentId: string;
  /** How often to run analysis */
  frequency: 'hourly' | 'daily' | 'weekly';
  /** Whether schedule is active */
  enabled: boolean;
  /** Last run time */
  lastRunAt?: Date;
  /** Next scheduled run */
  nextRunAt: Date;
  /** Analysis configuration */
  config: RunAnalysisRequest;
}

/**
 * Analysis comparison between two time periods
 */
export interface AnalysisComparison {
  /** Earlier analysis */
  baseline: ExperimentAnalysisResult;
  /** Later analysis */
  current: ExperimentAnalysisResult;
  /** Changes in key metrics */
  metricChanges: Array<{
    metricKey: string;
    baselineValue: number;
    currentValue: number;
    absoluteChange: number;
    percentChange: number;
  }>;
  /** Changes in significance */
  significanceChanges: Array<{
    metricKey: string;
    baselineSignificance: SignificanceLevel;
    currentSignificance: SignificanceLevel;
    changed: boolean;
  }>;
}

/**
 * Subgroup analysis result
 */
export interface SubgroupAnalysis {
  /** Subgroup identifier */
  subgroupId: string;
  /** Subgroup name */
  subgroupName: string;
  /** Filter used to define subgroup */
  filter: string;
  /** Sample size in subgroup */
  sampleSize: number;
  /** Metric results for this subgroup */
  metricResults: MetricResult[];
  /** Whether effect differs from overall */
  heterogeneousEffect: boolean;
  /** Interaction p-value */
  interactionPValue?: number;
}

/**
 * Heterogeneous treatment effect analysis
 */
export interface HeterogeneousTreatmentEffects {
  /** Overall treatment effect */
  overallEffect: number;
  /** Subgroup analyses */
  subgroups: SubgroupAnalysis[];
  /** Whether significant heterogeneity exists */
  significantHeterogeneity: boolean;
  /** Recommended segments */
  recommendedSegments?: Array<{
    segment: string;
    effect: number;
    pValue: number;
  }>;
}

/**
 * Analysis summary for dashboards
 */
export interface AnalysisSummary {
  experimentId: string;
  experimentName: string;
  status: AnalysisStatus;
  lastAnalyzedAt: Date;
  totalSampleSize: number;
  daysRunning: number;
  primaryMetricImprovement: number;
  primaryMetricSignificance: SignificanceLevel;
  recommendation: AnalysisRecommendation;
  guardrailsViolated: boolean;
}

/**
 * Type guard for factorial analysis
 */
export function isFactorialAnalysis(
  analysis: ExperimentAnalysisResult['designAnalysis']
): analysis is { type: 'factorial'; result: FactorialAnalysisResult } {
  return analysis?.type === 'factorial';
}

/**
 * Type guard for within-subjects analysis
 */
export function isWithinSubjectsAnalysis(
  analysis: ExperimentAnalysisResult['designAnalysis']
): analysis is { type: 'within_subjects'; result: WithinSubjectsAnalysisResult } {
  return analysis?.type === 'within_subjects';
}

/**
 * Type guard for switchback analysis
 */
export function isSwitchbackAnalysis(
  analysis: ExperimentAnalysisResult['designAnalysis']
): analysis is { type: 'switchback'; result: SwitchbackAnalysisResult } {
  return analysis?.type === 'switchback';
}

/**
 * Type guard for stepped wedge analysis
 */
export function isSteppedWedgeAnalysis(
  analysis: ExperimentAnalysisResult['designAnalysis']
): analysis is { type: 'stepped_wedge'; result: SteppedWedgeAnalysisResult } {
  return analysis?.type === 'stepped_wedge';
}

/**
 * Helper to determine if result is statistically significant
 */
export function isStatisticallySignificant(
  pValue: number,
  alpha: number = 0.05
): boolean {
  return pValue < alpha;
}

/**
 * Helper to get significance level from p-value
 */
export function getSignificanceLevel(pValue: number): SignificanceLevel {
  if (pValue < 0.01) return SignificanceLevel.HIGHLY_SIGNIFICANT;
  if (pValue < 0.05) return SignificanceLevel.SIGNIFICANT;
  if (pValue < 0.1) return SignificanceLevel.MARGINAL;
  return SignificanceLevel.NOT_SIGNIFICANT;
}

/**
 * Helper to calculate relative difference percentage
 */
export function calculateRelativeDifference(
  control: number,
  treatment: number
): number {
  if (control === 0) return 0;
  return ((treatment - control) / control) * 100;
}
