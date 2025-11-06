/**
 * Statistical Analysis Engine for Feature Flag Experimentation
 *
 * Comprehensive suite of statistical tools for A/B testing and experimentation.
 *
 * Modules:
 * - statistical-tests: Frequentist tests (t-test, z-test, chi-square, ANOVA, regression)
 * - bayesian: Bayesian analysis (Beta-Binomial, Normal-Normal models)
 * - corrections: Multiple testing corrections (Bonferroni, BH, Holm, sequential)
 * - power: Power analysis and sample size calculations
 * - variance-reduction: CUPED and stratification for improved sensitivity
 * - analyzer: Main orchestrator for experiment analysis
 */

// Statistical Tests
export {
  twoSampleTTest,
  twoProportionZTest,
  chiSquareTest,
  oneWayANOVA,
  factorialANOVA,
  multipleRegression,
  type TTestResult,
  type ZTestResult,
  type ChiSquareResult,
  type ANOVAResult,
  type PostHocResult,
  type RegressionResult,
  type StatisticalTestResult
} from './statistical-tests';

// Bayesian Analysis
export {
  bayesianProportionTest,
  bayesianContinuousTest,
  thompsonSampling,
  calculateRegret,
  type BayesianProportionResult,
  type BayesianContinuousResult,
  type BetaDistribution,
  type NormalDistribution
} from './bayesian';

// Multiple Testing Corrections
export {
  bonferroniCorrection,
  holmBonferroniCorrection,
  benjaminiHochbergCorrection,
  benjaminiYekutieliCorrection,
  sidakCorrection,
  sequentialTest,
  groupSequentialBoundaries,
  compareCorrections,
  recommendCorrection,
  type CorrectedTest,
  type MultipleTestingResult,
  type SequentialTestResult,
  type SpendingFunction
} from './corrections';

// Power Analysis
export {
  tTestSampleSize,
  tTestPower,
  tTestMDE,
  proportionTestSampleSize,
  proportionTestPower,
  proportionTestMDE,
  anovaSampleSize,
  anovaPower,
  factorialSampleSize,
  convertEffectSize,
  interpretEffectSize,
  estimateRuntime,
  calculateAllocation,
  type PowerAnalysisResult,
  type MinimumDetectableEffectResult
} from './power';

// Variance Reduction
export {
  applyCUPED,
  cupedABTest,
  cupedMultipleCovariates,
  stratifiedAnalysis,
  stratifiedABTest,
  estimateVarianceReduction,
  validateCovariate,
  type CUPEDResult,
  type StratifiedResult,
  type RegressionAdjustmentResult
} from './variance-reduction';

// Main Analyzer
export {
  ExperimentAnalyzer,
  quickABAnalysis,
  calculateSampleSize,
  type ExperimentData,
  type FactorialDesign,
  type AnalysisResult,
  type FactorialAnalysisResult,
  type SwitchbackAnalysisResult
} from './analyzer';

// Re-export default
export { default } from './analyzer';
