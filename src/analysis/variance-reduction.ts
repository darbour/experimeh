/**
 * Variance Reduction Techniques for Experimentation
 *
 * Implements CUPED (Controlled-experiment Using Pre-Experiment Data) and
 * related variance reduction methods to improve experiment sensitivity.
 *
 * Variance reduction allows:
 * - Detecting smaller effects with same sample size
 * - Reaching conclusions faster
 * - Reducing required sample size for same power
 *
 * References:
 * - Deng, A., et al. (2013). "Improving the Sensitivity of Online Controlled
 *   Experiments by Utilizing Pre-Experiment Data"
 * - Xie, H., & Aurisset, J. (2016). "Improving the Sensitivity of Online
 *   Controlled Experiments: Case Studies at Netflix"
 * - Kohavi, R., et al. (2020). "Trustworthy Online Controlled Experiments"
 */

/**
 * CUPED adjustment result
 */
export interface CUPEDResult {
  original: {
    mean: number;
    variance: number;
    standardError: number;
  };
  adjusted: {
    mean: number;
    variance: number;
    standardError: number;
  };
  theta: number; // Optimal adjustment coefficient
  varianceReduction: number; // Percentage reduction in variance
  effectiveN: number; // Effective sample size increase
  correlation: number; // Correlation between pre and post metric
}

/**
 * Stratified analysis result
 */
export interface StratifiedResult {
  overall: {
    mean: number;
    variance: number;
    treatmentEffect: number;
  };
  strata: Array<{
    stratum: string | number;
    n: number;
    mean: number;
    treatmentEffect: number;
  }>;
  varianceReduction: number;
}

/**
 * Regression adjustment result
 */
export interface RegressionAdjustmentResult {
  original: {
    treatmentEffect: number;
    standardError: number;
    variance: number;
  };
  adjusted: {
    treatmentEffect: number;
    standardError: number;
    variance: number;
  };
  covariates: Array<{
    name: string;
    coefficient: number;
    significance: number;
  }>;
  rSquared: number;
  varianceReduction: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mean(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function variance(values: number[], sampleMean?: number): number {
  const m = sampleMean ?? mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - m, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
}

function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('Arrays must have same length');
  }

  const meanX = mean(x);
  const meanY = mean(y);
  const n = x.length;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY);
  }

  return sum / (n - 1);
}

function correlation(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const stdX = Math.sqrt(variance(x));
  const stdY = Math.sqrt(variance(y));

  return cov / (stdX * stdY);
}

// ============================================================================
// CUPED (Controlled-experiment Using Pre-Experiment Data)
// ============================================================================

/**
 * Apply CUPED variance reduction
 *
 * CUPED adjusts the outcome metric using pre-experiment data to reduce variance.
 * The adjusted metric is:
 *   Y_adjusted = Y - θ(X - E[X])
 *
 * where:
 *   Y = post-experiment metric
 *   X = pre-experiment metric (covariate)
 *   θ = Cov(Y,X) / Var(X) (optimal coefficient)
 *   E[X] = expected value of covariate
 *
 * The adjustment:
 * - Is unbiased (E[Y_adjusted] = E[Y])
 * - Reduces variance: Var(Y_adjusted) = Var(Y) * (1 - ρ²)
 * - ρ = correlation between Y and X
 *
 * Reference: Deng et al. (2013)
 *
 * @param postMetric - Post-experiment outcomes (Y)
 * @param preMetric - Pre-experiment covariates (X)
 * @param preMetricMean - Optional: pre-computed mean of pre-metric across population
 * @returns CUPED adjusted results
 */
export function applyCUPED(
  postMetric: number[],
  preMetric: number[],
  preMetricMean?: number
): CUPEDResult {
  if (postMetric.length !== preMetric.length) {
    throw new Error('Post-metric and pre-metric must have same length');
  }

  if (postMetric.length < 2) {
    throw new Error('Need at least 2 observations');
  }

  // Calculate statistics
  const yMean = mean(postMetric);
  const yVar = variance(postMetric, yMean);
  const ySE = Math.sqrt(yVar / postMetric.length);

  const xMean = preMetricMean ?? mean(preMetric);
  const xVar = variance(preMetric, mean(preMetric));

  const cov = covariance(postMetric, preMetric);
  const corr = correlation(postMetric, preMetric);

  // Optimal theta (adjustment coefficient)
  // θ = Cov(Y, X) / Var(X)
  const theta = cov / xVar;

  // Apply CUPED adjustment
  const adjustedMetric = postMetric.map((y, i) => y - theta * (preMetric[i] - xMean));

  const adjustedMean = mean(adjustedMetric);
  const adjustedVar = variance(adjustedMetric, adjustedMean);
  const adjustedSE = Math.sqrt(adjustedVar / adjustedMetric.length);

  // Variance reduction
  // Var(Y_adj) = Var(Y) * (1 - ρ²)
  const theoreticalVarReduction = (1 - corr * corr) * 100;
  const actualVarReduction = ((yVar - adjustedVar) / yVar) * 100;

  // Effective sample size increase
  // n_effective = n / (1 - ρ²)
  const effectiveN = postMetric.length / (1 - corr * corr);

  return {
    original: {
      mean: yMean,
      variance: yVar,
      standardError: ySE
    },
    adjusted: {
      mean: adjustedMean,
      variance: adjustedVar,
      standardError: adjustedSE
    },
    theta,
    varianceReduction: actualVarReduction,
    effectiveN,
    correlation: corr
  };
}

/**
 * Apply CUPED to A/B test
 *
 * Applies CUPED separately to control and treatment groups,
 * then computes the treatment effect with reduced variance.
 *
 * @param controlPost - Control group post-experiment metric
 * @param controlPre - Control group pre-experiment metric
 * @param treatmentPost - Treatment group post-experiment metric
 * @param treatmentPre - Treatment group pre-experiment metric
 * @param preMetricMean - Optional: overall pre-metric mean
 */
export function cupedABTest(
  controlPost: number[],
  controlPre: number[],
  treatmentPost: number[],
  treatmentPre: number[],
  preMetricMean?: number
): {
  control: CUPEDResult;
  treatment: CUPEDResult;
  treatmentEffect: {
    original: number;
    adjusted: number;
    originalSE: number;
    adjustedSE: number;
    varianceReduction: number;
  };
} {
  // Calculate overall pre-metric mean if not provided
  const overallPreMean = preMetricMean ?? mean([...controlPre, ...treatmentPre]);

  // Apply CUPED to each group
  const controlResult = applyCUPED(controlPost, controlPre, overallPreMean);
  const treatmentResult = applyCUPED(treatmentPost, treatmentPre, overallPreMean);

  // Treatment effect (difference in means)
  const originalEffect = treatmentResult.original.mean - controlResult.original.mean;
  const adjustedEffect = treatmentResult.adjusted.mean - controlResult.adjusted.mean;

  // Standard error of difference
  const originalSE = Math.sqrt(
    controlResult.original.variance / controlPost.length +
    treatmentResult.original.variance / treatmentPost.length
  );

  const adjustedSE = Math.sqrt(
    controlResult.adjusted.variance / controlPost.length +
    treatmentResult.adjusted.variance / treatmentPost.length
  );

  const varianceReduction = ((originalSE * originalSE - adjustedSE * adjustedSE) /
                             (originalSE * originalSE)) * 100;

  return {
    control: controlResult,
    treatment: treatmentResult,
    treatmentEffect: {
      original: originalEffect,
      adjusted: adjustedEffect,
      originalSE,
      adjustedSE,
      varianceReduction
    }
  };
}

// ============================================================================
// Multiple Covariates (Regression-based CUPED)
// ============================================================================

/**
 * Apply CUPED with multiple covariates using regression
 *
 * Extends CUPED to use multiple pre-experiment variables.
 * Fits regression: Y = β₀ + β₁X₁ + β₂X₂ + ... + ε
 * Uses residuals as adjusted metric: Y_adj = Y - Ŷ + Ȳ
 *
 * @param postMetric - Post-experiment outcome
 * @param covariates - Matrix of pre-experiment covariates [n × k]
 * @param covariateNames - Names of covariates
 */
export function cupedMultipleCovariates(
  postMetric: number[],
  covariates: number[][],
  covariateNames: string[]
): RegressionAdjustmentResult {
  const n = postMetric.length;

  if (covariates.length !== n) {
    throw new Error('Covariates and post-metric must have same length');
  }

  // Add intercept to covariates
  const X = covariates.map(row => [1, ...row]);

  // Fit linear regression using least squares
  // β = (X'X)^(-1) X'y
  const XtX = matrixMultiply(transpose(X), X);
  const XtXInv = matrixInverse(XtX);
  const Xty = matrixVectorMultiply(transpose(X), postMetric);
  const coefficients = matrixVectorMultiply(XtXInv, Xty);

  // Predictions and residuals
  const predictions = X.map(row =>
    row.reduce((sum, x, i) => sum + x * coefficients[i], 0)
  );

  const yMean = mean(postMetric);
  const residuals = postMetric.map((y, i) => y - predictions[i]);

  // Adjusted metric: Y_adj = residuals + Ȳ
  const adjustedMetric = residuals.map(r => r + yMean);

  // Calculate statistics
  const originalVar = variance(postMetric);
  const adjustedVar = variance(adjustedMetric);
  const originalSE = Math.sqrt(originalVar / n);
  const adjustedSE = Math.sqrt(adjustedVar / n);

  // R-squared
  const ssTotal = postMetric.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  // Variance reduction
  const varianceReduction = ((originalVar - adjustedVar) / originalVar) * 100;

  // Covariate information
  const covariateInfo = covariateNames.map((name, i) => ({
    name,
    coefficient: coefficients[i + 1], // Skip intercept
    significance: Math.abs(coefficients[i + 1]) // Simplified
  }));

  return {
    original: {
      treatmentEffect: 0, // Will be calculated in context of A/B test
      standardError: originalSE,
      variance: originalVar
    },
    adjusted: {
      treatmentEffect: 0, // Will be calculated in context of A/B test
      standardError: adjustedSE,
      variance: adjustedVar
    },
    covariates: covariateInfo,
    rSquared,
    varianceReduction
  };
}

// ============================================================================
// Stratified Analysis
// ============================================================================

/**
 * Stratified analysis for variance reduction
 *
 * Analyzes experiment within predefined strata (e.g., user segments, regions)
 * and combines results using weighted average.
 *
 * Reduces variance when:
 * - Within-stratum variance < overall variance
 * - Strata are defined pre-experiment
 * - Stratification variable correlated with outcome
 *
 * @param outcomes - Outcome values
 * @param strata - Stratum assignment for each observation
 * @param weights - Optional: stratum weights (default: proportional to size)
 */
export function stratifiedAnalysis(
  outcomes: number[],
  strata: (string | number)[],
  weights?: { [stratum: string]: number }
): StratifiedResult {
  if (outcomes.length !== strata.length) {
    throw new Error('Outcomes and strata must have same length');
  }

  // Group by strata
  const strataGroups: { [key: string]: number[] } = {};

  for (let i = 0; i < outcomes.length; i++) {
    const stratumKey = String(strata[i]);
    if (!strataGroups[stratumKey]) {
      strataGroups[stratumKey] = [];
    }
    strataGroups[stratumKey].push(outcomes[i]);
  }

  // Calculate within-stratum statistics
  const strataResults: Array<{
    stratum: string;
    n: number;
    mean: number;
    variance: number;
    weight: number;
  }> = [];

  let totalN = outcomes.length;

  for (const stratumKey in strataGroups) {
    const stratumOutcomes = strataGroups[stratumKey];
    const n = stratumOutcomes.length;
    const stratumMean = mean(stratumOutcomes);
    const stratumVar = variance(stratumOutcomes);

    // Weight: proportion of total sample (or custom)
    const weight = weights?.[stratumKey] ?? n / totalN;

    strataResults.push({
      stratum: stratumKey,
      n,
      mean: stratumMean,
      variance: stratumVar,
      weight
    });
  }

  // Weighted mean
  const stratifiedMean = strataResults.reduce(
    (sum, s) => sum + s.mean * s.weight,
    0
  );

  // Stratified variance (weighted)
  const stratifiedVariance = strataResults.reduce(
    (sum, s) => sum + s.variance * s.weight * s.weight,
    0
  );

  // Original (unstratified) variance
  const overallMean = mean(outcomes);
  const overallVariance = variance(outcomes);

  // Variance reduction
  const varianceReduction = ((overallVariance - stratifiedVariance) /
                             overallVariance) * 100;

  return {
    overall: {
      mean: stratifiedMean,
      variance: stratifiedVariance,
      treatmentEffect: 0 // Context-dependent
    },
    strata: strataResults.map(s => ({
      stratum: s.stratum,
      n: s.n,
      mean: s.mean,
      treatmentEffect: 0 // Context-dependent
    })),
    varianceReduction
  };
}

/**
 * Stratified A/B test analysis
 *
 * @param controlOutcomes - Control group outcomes
 * @param controlStrata - Control group strata
 * @param treatmentOutcomes - Treatment group outcomes
 * @param treatmentStrata - Treatment group strata
 */
export function stratifiedABTest(
  controlOutcomes: number[],
  controlStrata: (string | number)[],
  treatmentOutcomes: number[],
  treatmentStrata: (string | number)[]
): {
  control: StratifiedResult;
  treatment: StratifiedResult;
  treatmentEffect: {
    overall: number;
    byStratum: { [stratum: string]: number };
    varianceReduction: number;
  };
} {
  const controlResult = stratifiedAnalysis(controlOutcomes, controlStrata);
  const treatmentResult = stratifiedAnalysis(treatmentOutcomes, treatmentStrata);

  // Overall treatment effect
  const overallEffect = treatmentResult.overall.mean - controlResult.overall.mean;

  // Treatment effect by stratum
  const effectByStratum: { [stratum: string]: number } = {};

  for (const treatmentStratum of treatmentResult.strata) {
    const matchingControl = controlResult.strata.find(
      s => s.stratum === treatmentStratum.stratum
    );

    if (matchingControl) {
      effectByStratum[treatmentStratum.stratum] =
        treatmentStratum.mean - matchingControl.mean;
    }
  }

  // Variance reduction
  const unstratifiedVar =
    variance(controlOutcomes) / controlOutcomes.length +
    variance(treatmentOutcomes) / treatmentOutcomes.length;

  const stratifiedVar =
    controlResult.overall.variance +
    treatmentResult.overall.variance;

  const varianceReduction = ((unstratifiedVar - stratifiedVar) /
                             unstratifiedVar) * 100;

  return {
    control: controlResult,
    treatment: treatmentResult,
    treatmentEffect: {
      overall: overallEffect,
      byStratum: effectByStratum,
      varianceReduction
    }
  };
}

// ============================================================================
// Matrix Helper Functions
// ============================================================================

function transpose(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = Array(cols).fill(0).map(() => Array(rows).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }

  return result;
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;

  const result: number[][] = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

function matrixInverse(matrix: number[][]): number[][] {
  const n = matrix.length;

  // Create augmented matrix [A|I]
  const augmented: number[][] = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
  ]);

  // Gaussian elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Make diagonal element 1
    const pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Matrix is singular');
    }

    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot;
    }

    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
  }

  // Extract inverse
  return augmented.map(row => row.slice(n));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate potential variance reduction from historical data
 *
 * Helps determine if CUPED is worthwhile before running experiment.
 *
 * @param historicalPost - Historical outcome data
 * @param historicalPre - Historical covariate data
 * @returns Expected variance reduction percentage
 */
export function estimateVarianceReduction(
  historicalPost: number[],
  historicalPre: number[]
): {
  expectedReduction: number;
  correlation: number;
  recommendation: string;
} {
  const corr = correlation(historicalPost, historicalPre);
  const expectedReduction = (1 - corr * corr) * 100;

  let recommendation = '';

  if (Math.abs(corr) < 0.3) {
    recommendation = 'Low correlation - CUPED may not provide significant benefit';
  } else if (Math.abs(corr) < 0.6) {
    recommendation = 'Moderate correlation - CUPED should provide noticeable variance reduction';
  } else {
    recommendation = 'High correlation - CUPED will substantially improve sensitivity';
  }

  return {
    expectedReduction,
    correlation: corr,
    recommendation
  };
}

/**
 * Validate covariate for CUPED
 *
 * Checks if covariate is suitable for variance reduction.
 *
 * @param covariate - Covariate data
 * @param treatment - Treatment assignments (0 = control, 1 = treatment)
 * @returns Validation result
 */
export function validateCovariate(
  covariate: number[],
  treatment: number[]
): {
  valid: boolean;
  issues: string[];
  balanceTest: {
    controlMean: number;
    treatmentMean: number;
    difference: number;
    pValue: number;
  };
} {
  const issues: string[] = [];

  // Check for missing values
  if (covariate.some(x => isNaN(x) || x === null || x === undefined)) {
    issues.push('Covariate contains missing values');
  }

  // Check variance
  const covVar = variance(covariate);
  if (covVar === 0 || covVar < 1e-10) {
    issues.push('Covariate has zero or near-zero variance');
  }

  // Check balance between treatment groups
  const controlCov = covariate.filter((_, i) => treatment[i] === 0);
  const treatmentCov = covariate.filter((_, i) => treatment[i] === 1);

  if (controlCov.length === 0 || treatmentCov.length === 0) {
    issues.push('Covariate not available for all treatment groups');
  }

  const controlMean = mean(controlCov);
  const treatmentMean = mean(treatmentCov);
  const difference = Math.abs(treatmentMean - controlMean);

  // Simple t-test for balance
  const pooledVar = (variance(controlCov) + variance(treatmentCov)) / 2;
  const se = Math.sqrt(pooledVar * (1/controlCov.length + 1/treatmentCov.length));
  const tStat = difference / se;

  // Approximate p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  if (pValue < 0.05) {
    issues.push('Covariate significantly imbalanced between groups (p < 0.05)');
  }

  return {
    valid: issues.length === 0,
    issues,
    balanceTest: {
      controlMean,
      treatmentMean,
      difference,
      pValue
    }
  };
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}
