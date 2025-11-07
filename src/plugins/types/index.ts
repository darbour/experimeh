/**
 * TypeScript type definitions for the plugin system
 *
 * Mirrors Python plugin structures to enable seamless interoperability
 * between TypeScript and Python analysis plugins.
 */

/**
 * Plugin metadata for discovery and validation
 */
export interface PluginMetadata {
  name: string;
  version: string;
  author: string;
  description: string;
  supportedDesignTypes: string[];
  requiredMetrics: string[];
  optionalMetrics: string[];
  minSampleSize?: number;
  assumptions: string[];
  references: string[];
}

/**
 * Plugin capabilities declaration
 */
export interface PluginCapabilities {
  supportedDesignTypes: Set<string>;
  supportedMetricTypes: Set<string>;
  handlesTemporalCorrelation: boolean;
  handlesSpatialCorrelation: boolean;
  handlesClustering: boolean;
  handlesRepeatedMeasures: boolean;
  handlesInteractions: boolean;
  handlesCovariates: boolean;
  requiresBalancedDesign: boolean;
  requiresEqualVariance: boolean;
  requiresNormality: boolean;
  minimumClusters?: number;
  minimumTimePeriods?: number;
  supportsLargeDatasets: boolean;
  supportsStreaming: boolean;
  parallelizable: boolean;
}

/**
 * Analysis configuration passed to plugins
 */
export interface AnalysisConfig {
  alpha?: number;
  power?: number;
  minDetectableEffect?: number;
  correctionMethod?: 'bonferroni' | 'holm' | 'bh' | 'by' | 'sidak' | 'none';
  bootstrapIterations?: number;
  customParams?: Record<string, any>;
}

/**
 * Comprehensive analysis result from plugins
 */
export interface AnalysisResult {
  estimates: Record<string, number>;
  confidenceIntervals: Record<string, [number, number]>;
  pValues?: Record<string, number>;
  standardErrors: Record<string, number>;
  method: string;
  modelFormula?: string;
  degreesOfFreedom?: Record<string, number>;
  sampleSizes: Record<string, number>;
  effectiveSampleSize?: number;
  modelFit?: Record<string, any>;
  residualDiagnostics?: Record<string, any>;
  assumptionsMet: Record<string, boolean>;
  warnings: string[];
  interactionEffects?: Record<string, number>;
  temporalEffects?: Record<string, number>;
  spatialEffects?: Record<string, any>;
  randomEffects?: Record<string, any>;
  plots?: Record<string, any>;
  effectSizes?: Record<string, number>;
  bayesianPosterior?: Record<string, any>;
  sensitivityAnalysis?: Record<string, any>;
}

/**
 * Execution request for plugin analysis
 */
export interface PluginExecutionRequest {
  pluginName: string;
  data: any[];
  config: AnalysisConfig;
}

/**
 * Plugin validation result
 */
export interface PluginValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Plugin execution metrics for monitoring
 */
export interface PluginExecutionMetrics {
  pluginName: string;
  version: string;
  executionTime: number;
  dataPoints: number;
  memoryUsage: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  pluginPath: string;
  pythonPath?: string;
  timeout?: number;
  maxConcurrentExecutions?: number;
  environment?: Record<string, string>;
  enableCaching?: boolean;
  cacheRtl?: number;
}

/**
 * Experimental context structures
 */

export interface TemporalStructure {
  timeColumn: string;
  timeUnit: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';
  periodColumn?: string;
  sequenceColumn?: string;
  baselinePeriod?: [Date, Date];
  autocorrelationStructure?: 'ar1' | 'ma1' | 'arma' | 'none';
}

export interface SpatialStructure {
  geoUnitColumn: string;
  geoLevel: 'zip' | 'city' | 'dma' | 'state' | 'country' | 'custom';
  coordinatesLat?: string;
  coordinatesLon?: string;
  adjacencyMatrix?: number[][];
  distanceMatrix?: number[][];
}

export interface ClusterStructure {
  clusterColumn: string;
  clusterLevel: string;
  nestingStructure?: string[];
  clusterSizeColumn?: string;
  intraclusterCorrelation?: number;
}

export interface FactorialStructure {
  factors: string[];
  levelsPerFactor: Record<string, string[]>;
  interactionTerms?: string[][];
  blockingFactors?: string[];
  fractionalDesign?: string;
}

export interface WithinSubjectsStructure {
  subjectColumn: string;
  conditionColumn: string;
  orderColumn?: string;
  periodColumn?: string;
  carryoverPeriods?: number;
}

export interface SteppedWedgeStructure {
  clusterColumn: string;
  timePeriodColumn: string;
  rolloutSequence: string[][];
  nPeriodsPre: number;
  nPeriodsPost: number;
  transitionPeriods?: number[];
}

export interface MetricSpecification {
  name: string;
  column: string;
  metricType: 'continuous' | 'binary' | 'count' | 'proportion' | 'duration' | 'rate';
  aggregation?: 'sum' | 'mean' | 'median' | 'count' | 'rate';
  transformation?: 'log' | 'sqrt' | 'logit' | 'identity' | 'rank';
  numeratorColumn?: string;
  denominatorColumn?: string;
  winsorizePercentile?: number;
  outlierThresholdSd?: number;
  higherIsBetter: boolean;
}

export interface ExperimentalDesign {
  designType: 'ab' | 'multivariate' | 'factorial' | 'switchback' | 'geo' |
                'stepped_wedge' | 'within_subjects' | 'crossover' | 'cluster_randomized';
  treatmentColumn: string;
  controlValue: string;
  treatmentValues: string[];
  temporal?: TemporalStructure;
  spatial?: SpatialStructure;
  cluster?: ClusterStructure;
  factorial?: FactorialStructure;
  withinSubjects?: WithinSubjectsStructure;
  steppedWedge?: SteppedWedgeStructure;
  covariates?: string[];
  stratificationVars?: string[];
  blockingVars?: string[];
  randomizationUnit: string;
  analysisUnit?: string;
}

export interface ExperimentalContext {
  design: ExperimentalDesign;
  metrics: MetricSpecification[];
  data: any[];
  nTotal: number;
  nPerTreatment: Record<string, number>;
  startDate?: Date;
  endDate?: Date;
  sampleRatioMismatch?: number;
  missingDataRate?: number;
  precomputedStats?: Record<string, any>;
}
