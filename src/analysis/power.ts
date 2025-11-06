/**
 * Power Analysis and Sample Size Calculations for Experimentation
 *
 * Implements statistical power analysis for determining:
 * - Required sample size given desired power and effect size
 * - Achieved power given sample size and observed effect
 * - Minimum detectable effect given sample size and power
 *
 * Critical for experiment planning and avoiding underpowered experiments.
 *
 * References:
 * - Cohen, J. (1988). "Statistical Power Analysis for the Behavioral Sciences"
 * - Kohavi, R., et al. (2020). "Trustworthy Online Controlled Experiments"
 * - Deng, A., et al. (2013). "Improving the Sensitivity of Online Controlled Experiments"
 */

/**
 * Power analysis result
 */
export interface PowerAnalysisResult {
  test: string;
  alpha: number;
  power: number;
  effectSize: number;
  sampleSizePerGroup: number;
  totalSampleSize: number;
  assumptions: string[];
}

/**
 * Minimum detectable effect result
 */
export interface MinimumDetectableEffectResult {
  test: string;
  alpha: number;
  power: number;
  sampleSizePerGroup: number;
  minimumDetectableEffect: number;
  relativeChange: number; // For proportion tests
  assumptions: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Standard normal quantile function approximation
 * Uses Beasley-Springer-Moro algorithm
 */
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }

  // Use rational approximation for better accuracy
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ];

  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ];

  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ];

  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    // Lower tail
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    // Central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Upper tail
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

/**
 * Non-central t-distribution power calculation approximation
 * Uses normal approximation for large df
 */
function nonCentralTPower(ncp: number, df: number, alpha: number): number {
  // For large df, use normal approximation
  if (df > 100) {
    const zAlpha = normalQuantile(1 - alpha / 2);
    const zPower = ncp - zAlpha;
    return 1 - normalCDF(-zPower);
  }

  // For smaller df, use approximation based on normal with correction
  const zAlpha = normalQuantile(1 - alpha / 2);
  const correctedNCP = ncp * Math.sqrt(df / (df + 1));
  const zPower = correctedNCP - zAlpha;
  return 1 - normalCDF(-zPower);
}

/**
 * Normal CDF
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

// ============================================================================
// Two-Sample T-Test Power Analysis
// ============================================================================

/**
 * Calculate required sample size for two-sample t-test
 *
 * Uses the formula for equal sample sizes:
 *   n = 2 * (z_α/2 + z_β)² * σ² / δ²
 *
 * where:
 *   z_α/2 = critical value for two-tailed test
 *   z_β = critical value for power (1 - β)
 *   σ = common standard deviation
 *   δ = effect size (difference in means)
 *
 * @param effectSize - Cohen's d (standardized effect size)
 * @param alpha - Type I error rate (default 0.05)
 * @param power - Desired power (default 0.8)
 * @param ratio - Ratio of sample sizes n2/n1 (default 1 for equal)
 * @returns Sample size per group
 */
export function tTestSampleSize(
  effectSize: number,
  alpha: number = 0.05,
  power: number = 0.8,
  ratio: number = 1
): PowerAnalysisResult {
  if (effectSize <= 0) {
    throw new Error('Effect size must be positive');
  }

  if (alpha <= 0 || alpha >= 1) {
    throw new Error('Alpha must be between 0 and 1');
  }

  if (power <= 0 || power >= 1) {
    throw new Error('Power must be between 0 and 1');
  }

  // Critical values
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);

  // Sample size for group 1
  const n1 = Math.ceil(
    (Math.pow(zAlpha + zBeta, 2) * (1 + 1/ratio)) / Math.pow(effectSize, 2)
  );

  // Sample size for group 2
  const n2 = Math.ceil(n1 * ratio);

  return {
    test: 'Two-sample t-test',
    alpha,
    power,
    effectSize,
    sampleSizePerGroup: n1,
    totalSampleSize: n1 + n2,
    assumptions: [
      'Continuous outcome variable',
      'Normal distribution (or large sample for CLT)',
      'Equal variances (or use Welch\'s t-test)',
      `Effect size (Cohen's d): ${effectSize.toFixed(3)}`
    ]
  };
}

/**
 * Calculate achieved power for t-test given sample size and effect
 *
 * @param sampleSize - Sample size per group
 * @param effectSize - Cohen's d
 * @param alpha - Type I error rate
 */
export function tTestPower(
  sampleSize: number,
  effectSize: number,
  alpha: number = 0.05
): number {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const ncp = effectSize * Math.sqrt(sampleSize / 2);
  const zPower = ncp - zAlpha;

  return 1 - normalCDF(-zPower);
}

/**
 * Calculate minimum detectable effect for t-test
 *
 * @param sampleSize - Sample size per group
 * @param alpha - Type I error rate
 * @param power - Desired power
 */
export function tTestMDE(
  sampleSize: number,
  alpha: number = 0.05,
  power: number = 0.8
): MinimumDetectableEffectResult {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);

  const mde = (zAlpha + zBeta) * Math.sqrt(2 / sampleSize);

  return {
    test: 'Two-sample t-test',
    alpha,
    power,
    sampleSizePerGroup: sampleSize,
    minimumDetectableEffect: mde,
    relativeChange: 0, // Not applicable for t-test
    assumptions: [
      'Continuous outcome variable',
      'Normal distribution or large sample',
      'Equal sample sizes in both groups'
    ]
  };
}

// ============================================================================
// Two-Proportion Z-Test Power Analysis
// ============================================================================

/**
 * Calculate required sample size for two-proportion z-test
 *
 * Uses the formula:
 *   n = [(z_α/2 * √(2p̄(1-p̄)) + z_β * √(p₁(1-p₁) + p₂(1-p₂)))]² / (p₁ - p₂)²
 *
 * where p̄ = (p₁ + p₂) / 2
 *
 * @param baselineRate - Baseline conversion rate (p₁)
 * @param minDetectableEffect - Minimum detectable effect (absolute change)
 * @param alpha - Type I error rate
 * @param power - Desired power
 * @param ratio - Ratio of sample sizes
 */
export function proportionTestSampleSize(
  baselineRate: number,
  minDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8,
  ratio: number = 1
): PowerAnalysisResult {
  if (baselineRate <= 0 || baselineRate >= 1) {
    throw new Error('Baseline rate must be between 0 and 1');
  }

  const p1 = baselineRate;
  const p2 = baselineRate + minDetectableEffect;

  if (p2 <= 0 || p2 >= 1) {
    throw new Error('Treatment rate must be between 0 and 1');
  }

  const pBar = (p1 + p2) / 2;

  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);

  // Sample size calculation with ratio adjustment
  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );

  const n1 = Math.ceil((numerator * (1 + 1/ratio)) / Math.pow(p2 - p1, 2));
  const n2 = Math.ceil(n1 * ratio);

  const relativeChange = ((p2 - p1) / p1) * 100;

  return {
    test: 'Two-proportion z-test',
    alpha,
    power,
    effectSize: minDetectableEffect,
    sampleSizePerGroup: n1,
    totalSampleSize: n1 + n2,
    assumptions: [
      'Binary outcome (conversion/no conversion)',
      'Independent observations',
      'Large sample (np ≥ 5 and n(1-p) ≥ 5)',
      `Baseline rate: ${(p1 * 100).toFixed(2)}%`,
      `Treatment rate: ${(p2 * 100).toFixed(2)}%`,
      `Relative change: ${relativeChange.toFixed(2)}%`
    ]
  };
}

/**
 * Calculate achieved power for proportion test
 *
 * @param sampleSize - Sample size per group
 * @param baselineRate - Control group conversion rate
 * @param treatmentRate - Treatment group conversion rate
 * @param alpha - Type I error rate
 */
export function proportionTestPower(
  sampleSize: number,
  baselineRate: number,
  treatmentRate: number,
  alpha: number = 0.05
): number {
  const p1 = baselineRate;
  const p2 = treatmentRate;
  const pBar = (p1 + p2) / 2;

  const zAlpha = normalQuantile(1 - alpha / 2);

  const se0 = Math.sqrt(2 * pBar * (1 - pBar) / sampleSize);
  const se1 = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / sampleSize);

  const ncp = Math.abs(p2 - p1) / se1;
  const criticalValue = zAlpha * se0 / se1;

  return 1 - normalCDF(criticalValue - ncp) + normalCDF(-criticalValue - ncp);
}

/**
 * Calculate minimum detectable effect for proportion test
 *
 * @param sampleSize - Sample size per group
 * @param baselineRate - Control group conversion rate
 * @param alpha - Type I error rate
 * @param power - Desired power
 */
export function proportionTestMDE(
  sampleSize: number,
  baselineRate: number,
  alpha: number = 0.05,
  power: number = 0.8
): MinimumDetectableEffectResult {
  const p1 = baselineRate;

  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);

  // Iterative solution for MDE
  // Start with approximate solution
  let p2 = p1;
  let iterations = 0;
  const maxIterations = 100;
  const tolerance = 0.0001;

  // Binary search for MDE
  let low = 0;
  let high = 1;

  while (iterations < maxIterations) {
    p2 = (low + high) / 2;
    const pBar = (p1 + p2) / 2;

    const numerator = zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
                     zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));

    const requiredN = Math.pow(numerator / (p2 - p1), 2);

    if (Math.abs(requiredN - sampleSize) < tolerance) {
      break;
    }

    if (requiredN > sampleSize) {
      // Need larger effect
      low = p2;
    } else {
      // Can detect smaller effect
      high = p2;
    }

    iterations++;
  }

  const mdeAbsolute = p2 - p1;
  const mdeRelative = (mdeAbsolute / p1) * 100;

  return {
    test: 'Two-proportion z-test',
    alpha,
    power,
    sampleSizePerGroup: sampleSize,
    minimumDetectableEffect: mdeAbsolute,
    relativeChange: mdeRelative,
    assumptions: [
      'Binary outcome variable',
      'Independent observations',
      'Large sample for normal approximation',
      `Baseline rate: ${(p1 * 100).toFixed(2)}%`,
      `Detectable treatment rate: ${(p2 * 100).toFixed(2)}%`
    ]
  };
}

// ============================================================================
// ANOVA Power Analysis
// ============================================================================

/**
 * Calculate required sample size for one-way ANOVA
 *
 * Uses Cohen's f as effect size measure:
 *   f² = σ_between² / σ_within²
 *
 * @param numGroups - Number of groups (k)
 * @param effectSize - Cohen's f
 * @param alpha - Type I error rate
 * @param power - Desired power
 */
export function anovaSampleSize(
  numGroups: number,
  effectSize: number,
  alpha: number = 0.05,
  power: number = 0.8
): PowerAnalysisResult {
  if (numGroups < 2) {
    throw new Error('Need at least 2 groups for ANOVA');
  }

  // Convert to phi coefficient
  const phi = effectSize;

  // Use F-distribution approximation
  const dfBetween = numGroups - 1;

  // Iterative solution for sample size
  let nPerGroup = 10;
  let currentPower = 0;

  while (currentPower < power && nPerGroup < 10000) {
    nPerGroup += 1;
    const dfWithin = numGroups * (nPerGroup - 1);
    const ncp = nPerGroup * numGroups * phi * phi;

    // Approximate power using non-central F distribution
    currentPower = anovaPowerApproximation(ncp, dfBetween, dfWithin, alpha);
  }

  return {
    test: 'One-way ANOVA',
    alpha,
    power: currentPower,
    effectSize,
    sampleSizePerGroup: nPerGroup,
    totalSampleSize: nPerGroup * numGroups,
    assumptions: [
      'Continuous outcome variable',
      'Normal distribution in each group',
      'Equal variances across groups (homoscedasticity)',
      `Number of groups: ${numGroups}`,
      `Effect size (Cohen's f): ${effectSize.toFixed(3)}`
    ]
  };
}

/**
 * Approximate power for ANOVA using non-central F distribution
 */
function anovaPowerApproximation(
  ncp: number,
  df1: number,
  df2: number,
  alpha: number
): number {
  // Critical F-value (approximation)
  const fCritical = fQuantile(1 - alpha, df1, df2);

  // Use normal approximation for power
  // This is simplified - exact calculation requires non-central F
  const lambda = ncp;
  const zAlpha = normalQuantile(1 - alpha);

  // Approximate non-central F with chi-square approximation
  const meanNonCentral = df1 + lambda;
  const varNonCentral = 2 * (df1 + 2 * lambda);

  const zScore = (fCritical * df1 - meanNonCentral) / Math.sqrt(varNonCentral);

  return 1 - normalCDF(zScore);
}

/**
 * Approximate F distribution quantile
 */
function fQuantile(p: number, df1: number, df2: number): number {
  // Use chi-square approximation
  // F(df1, df2) ≈ χ²(df1) / df1
  const z = normalQuantile(p);

  // Rough approximation
  return 1 + (z * Math.sqrt(2 / df1));
}

/**
 * Calculate power for ANOVA given sample size
 *
 * @param sampleSizePerGroup - Sample size per group
 * @param numGroups - Number of groups
 * @param effectSize - Cohen's f
 * @param alpha - Type I error rate
 */
export function anovaPower(
  sampleSizePerGroup: number,
  numGroups: number,
  effectSize: number,
  alpha: number = 0.05
): number {
  const dfBetween = numGroups - 1;
  const dfWithin = numGroups * (sampleSizePerGroup - 1);
  const ncp = sampleSizePerGroup * numGroups * effectSize * effectSize;

  return anovaPowerApproximation(ncp, dfBetween, dfWithin, alpha);
}

// ============================================================================
// Factorial Design Power Analysis
// ============================================================================

/**
 * Calculate sample size for factorial design (2x2)
 *
 * For factorial designs, need to power for:
 * - Main effect A
 * - Main effect B
 * - Interaction A×B
 *
 * Interaction effects typically require 4× sample size of main effects
 *
 * @param mainEffectSize - Expected main effect size (Cohen's d)
 * @param interactionEffectSize - Expected interaction effect size
 * @param alpha - Type I error rate (consider adjustment for multiple tests)
 * @param power - Desired power
 */
export function factorialSampleSize(
  mainEffectSize: number,
  interactionEffectSize: number,
  alpha: number = 0.05,
  power: number = 0.8
): {
  mainEffect: PowerAnalysisResult;
  interaction: PowerAnalysisResult;
  recommended: PowerAnalysisResult;
} {
  // Sample size for main effects
  const mainEffect = tTestSampleSize(mainEffectSize, alpha, power);

  // Sample size for interaction (typically requires more)
  const interaction = tTestSampleSize(interactionEffectSize, alpha, power);

  // Take the larger sample size to power all tests
  const recommended = interaction.sampleSizePerGroup > mainEffect.sampleSizePerGroup
    ? interaction
    : mainEffect;

  recommended.test = 'Factorial design (2×2)';
  recommended.assumptions = [
    ...recommended.assumptions,
    'Four treatment combinations in 2×2 design',
    'Sample size applies to each of 4 cells',
    `Main effect size: ${mainEffectSize.toFixed(3)}`,
    `Interaction effect size: ${interactionEffectSize.toFixed(3)}`
  ];

  return {
    mainEffect,
    interaction,
    recommended
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert between different effect size measures
 */
export function convertEffectSize(
  value: number,
  from: 'cohens-d' | 'cohens-f' | 'eta-squared' | 'r',
  to: 'cohens-d' | 'cohens-f' | 'eta-squared' | 'r'
): number {
  // Convert to Cohen's d first
  let d: number;

  switch (from) {
    case 'cohens-d':
      d = value;
      break;
    case 'cohens-f':
      d = 2 * value;
      break;
    case 'eta-squared':
      d = 2 * Math.sqrt(value / (1 - value));
      break;
    case 'r':
      d = (2 * value) / Math.sqrt(1 - value * value);
      break;
  }

  // Convert from Cohen's d to target
  switch (to) {
    case 'cohens-d':
      return d;
    case 'cohens-f':
      return d / 2;
    case 'eta-squared':
      return (d * d) / (d * d + 4);
    case 'r':
      return d / Math.sqrt(d * d + 4);
  }
}

/**
 * Interpret effect size magnitude
 */
export function interpretEffectSize(
  effectSize: number,
  measure: 'cohens-d' | 'cohens-f' = 'cohens-d'
): string {
  let d = measure === 'cohens-d' ? effectSize : effectSize * 2;
  d = Math.abs(d);

  if (d < 0.2) return 'negligible';
  if (d < 0.5) return 'small';
  if (d < 0.8) return 'medium';
  return 'large';
}

/**
 * Calculate sample size for a given runtime and traffic
 *
 * Helps translate sample size requirements into experiment duration
 *
 * @param sampleSizeRequired - Total sample size needed
 * @param dailyTraffic - Average daily users/sessions
 * @param allocationPercentage - Percentage allocated to experiment (0-100)
 * @returns Estimated days to reach sample size
 */
export function estimateRuntime(
  sampleSizeRequired: number,
  dailyTraffic: number,
  allocationPercentage: number = 100
): {
  days: number;
  weeks: number;
  recommendation: string;
} {
  const dailyExperimentTraffic = (dailyTraffic * allocationPercentage) / 100;
  const days = Math.ceil(sampleSizeRequired / dailyExperimentTraffic);
  const weeks = days / 7;

  let recommendation = '';

  if (days < 7) {
    recommendation = 'Short runtime - ensure you capture day-of-week effects by running at least 1 week';
  } else if (days > 28) {
    recommendation = 'Long runtime - consider increasing traffic allocation or detecting larger effects';
  } else {
    recommendation = 'Reasonable runtime for experiment';
  }

  return { days, weeks, recommendation };
}

/**
 * Calculate required traffic allocation for desired runtime
 *
 * @param sampleSizeRequired - Total sample size needed
 * @param targetDays - Desired experiment duration
 * @param dailyTraffic - Average daily users/sessions
 * @returns Required allocation percentage
 */
export function calculateAllocation(
  sampleSizeRequired: number,
  targetDays: number,
  dailyTraffic: number
): {
  allocationPercentage: number;
  recommendation: string;
} {
  const requiredDailyTraffic = sampleSizeRequired / targetDays;
  const allocationPercentage = (requiredDailyTraffic / dailyTraffic) * 100;

  let recommendation = '';

  if (allocationPercentage > 100) {
    recommendation = 'Insufficient traffic - experiment will take longer than target or need smaller MDE';
  } else if (allocationPercentage > 50) {
    recommendation = 'High allocation required - ensure this does not impact other experiments';
  } else {
    recommendation = 'Reasonable allocation percentage';
  }

  return {
    allocationPercentage: Math.min(100, allocationPercentage),
    recommendation
  };
}
