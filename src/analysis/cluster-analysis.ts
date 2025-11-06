/**
 * Cluster Analysis Methods
 *
 * Statistical methods for analyzing clustered data where observations are grouped
 * into clusters (e.g., schools, hospitals, time periods). Within-cluster correlation
 * violates the independence assumption of standard statistical tests, requiring
 * specialized methods.
 *
 * Key concepts:
 * - Clustered standard errors: Adjust SE for within-cluster correlation
 * - Cluster bootstrap: Resample clusters (not individuals) for inference
 * - Design effect: Efficiency loss from clustering vs simple random sampling
 *
 * Applications:
 * - Stepped wedge designs
 * - Cluster randomized trials
 * - Switchback experiments
 * - Hierarchical/multilevel data
 *
 * References:
 * - Cameron & Miller (2015). A Practitioner's Guide to Cluster-Robust Inference.
 *   Journal of Human Resources, 50(2), 317-372.
 * - Efron & Tibshirani (1993). An Introduction to the Bootstrap.
 * - Donner & Klar (2000). Design and Analysis of Cluster Randomization Trials
 *   in Health Research.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Clustered data structure for analysis
 */
export interface ClusteredData {
  /** Outcome values */
  outcomes: number[];
  /** Treatment assignment (0 or 1) */
  treatments: number[];
  /** Cluster identifiers */
  clusterIds: string[];
  /** Optional: time or period indicators */
  periods?: number[];
  /** Optional: covariates */
  covariates?: { [name: string]: number[] };
}

/**
 * Cluster-robust standard error result
 */
export interface ClusterRobustSEResult {
  /** Original (naive) standard error */
  naiveSE: number;
  /** Cluster-robust standard error */
  clusterRobustSE: number;
  /** Ratio of robust to naive SE */
  seInflation: number;
  /** Number of clusters */
  numClusters: number;
  /** Design effect */
  designEffect: number;
}

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  /** Point estimate */
  estimate: number;
  /** Bootstrap standard error */
  standardError: number;
  /** Bootstrap confidence interval (percentile method) */
  confidenceInterval: [number, number];
  /** Bootstrap confidence interval (bias-corrected) */
  bcConfidenceInterval: [number, number];
  /** Number of bootstrap samples */
  numBootstraps: number;
  /** Bootstrap distribution */
  bootstrapDistribution: number[];
}

/**
 * Design effect result
 */
export interface DesignEffectResult {
  /** Design effect: DEFF = 1 + (m - 1) × ICC */
  designEffect: number;
  /** Average cluster size */
  averageClusterSize: number;
  /** Intracluster correlation coefficient */
  icc: number;
  /** Effective sample size: n / DEFF */
  effectiveSampleSize: number;
  /** Interpretation */
  interpretation: string;
}

// ============================================================================
// Cluster-Robust Standard Errors
// ============================================================================

/**
 * Calculate cluster-robust standard errors (sandwich estimator)
 *
 * Cluster-robust SEs account for arbitrary within-cluster correlation without
 * requiring a specific correlation structure. This is the "sandwich" or
 * "Huber-White" estimator adapted for clustering.
 *
 * Method:
 * 1. Fit OLS regression to get coefficients
 * 2. Calculate cluster-specific score contributions
 * 3. Compute sandwich covariance matrix: (X'X)^-1 * M * (X'X)^-1
 *    where M = Σ_c (X_c' ε_c)(X_c' ε_c)'
 * 4. Extract SE from diagonal of covariance matrix
 *
 * Assumptions:
 * - Clusters are independent (critical!)
 * - Number of clusters is reasonably large (G ≥ 20-30)
 * - Cluster sizes can be unequal
 *
 * When to use:
 * - Cluster randomized trials
 * - Panel data / repeated measures
 * - Spatially or temporally clustered data
 * - Any grouped data with potential within-group correlation
 *
 * @param data - Clustered data
 * @returns Cluster-robust and naive standard errors
 */
export function calculateClusteredStandardErrors(
  data: ClusteredData
): ClusterRobustSEResult {
  const n = data.outcomes.length;

  // Build design matrix [intercept, treatment]
  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 0; i < n; i++) {
    X.push([1, data.treatments[i]]);
    y.push(data.outcomes[i]);
  }

  // Fit OLS regression
  const coefficients = fitOLS(X, y);
  const beta0 = coefficients[0]; // intercept
  const beta1 = coefficients[1]; // treatment effect

  // Calculate residuals
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    const predicted = beta0 + beta1 * data.treatments[i];
    residuals.push(y[i] - predicted);
  }

  // Standard (naive) variance-covariance matrix
  const XtX = matrixMultiply(transpose(X), X);
  const XtXinv = invert2x2(XtX);

  // Residual variance
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const sigma2 = rss / (n - 2);

  // Naive SE for treatment effect
  const naiveSE = Math.sqrt(XtXinv[1][1] * sigma2);

  // Cluster-robust variance (sandwich estimator)
  const clusterIds = Array.from(new Set(data.clusterIds));
  const numClusters = clusterIds.length;

  // Calculate cluster-specific contributions to score
  // M = Σ_c (X_c' ε_c)(X_c' ε_c)'
  const M: number[][] = [[0, 0], [0, 0]];

  for (const clusterId of clusterIds) {
    // Get indices for this cluster
    const clusterIndices = data.clusterIds
      .map((id, i) => id === clusterId ? i : -1)
      .filter(i => i !== -1);

    // X_c' * ε_c (2x1 vector)
    const Xc_eps: number[] = [0, 0];
    for (const idx of clusterIndices) {
      Xc_eps[0] += X[idx][0] * residuals[idx]; // intercept * residual
      Xc_eps[1] += X[idx][1] * residuals[idx]; // treatment * residual
    }

    // Add (X_c' ε_c)(X_c' ε_c)' to M
    M[0][0] += Xc_eps[0] * Xc_eps[0];
    M[0][1] += Xc_eps[0] * Xc_eps[1];
    M[1][0] += Xc_eps[1] * Xc_eps[0];
    M[1][1] += Xc_eps[1] * Xc_eps[1];
  }

  // Finite sample adjustment: multiply by G/(G-1) where G = number of clusters
  const adjustment = numClusters / (numClusters - 1);
  M[0][0] *= adjustment;
  M[0][1] *= adjustment;
  M[1][0] *= adjustment;
  M[1][1] *= adjustment;

  // Sandwich variance: V = (X'X)^-1 * M * (X'X)^-1
  const V = matrixMultiply(matrixMultiply(XtXinv, M), XtXinv);

  // Cluster-robust SE for treatment effect
  const clusterRobustSE = Math.sqrt(V[1][1]);

  // SE inflation ratio
  const seInflation = clusterRobustSE / naiveSE;

  // Calculate design effect
  const icc = calculateICCFromResiduals(data, residuals);
  const avgClusterSize = n / numClusters;
  const designEffect = 1 + (avgClusterSize - 1) * icc;

  return {
    naiveSE,
    clusterRobustSE,
    seInflation,
    numClusters,
    designEffect
  };
}

/**
 * Fit OLS regression
 * Returns [intercept, slope] for simple regression
 */
function fitOLS(X: number[][], y: number[]): number[] {
  const n = y.length;
  const k = X[0].length;

  // Compute X'X and X'y
  const XtX: number[][] = Array(k).fill(0).map(() => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let l = 0; l < k; l++) {
        XtX[j][l] += X[i][j] * X[i][l];
      }
    }
  }

  // Solve (X'X)^-1 X'y
  const XtXinv = invert2x2(XtX);
  const coefficients: number[] = Array(k).fill(0);

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      coefficients[i] += XtXinv[i][j] * Xty[j];
    }
  }

  return coefficients;
}

// ============================================================================
// Cluster Bootstrap
// ============================================================================

/**
 * Cluster bootstrap for inference
 *
 * Standard bootstrap resamples individuals, which is invalid for clustered data
 * because it breaks the cluster structure. Cluster bootstrap resamples entire
 * clusters, preserving within-cluster correlation.
 *
 * Algorithm:
 * 1. Randomly sample G clusters with replacement (where G = number of clusters)
 * 2. Include all observations from sampled clusters
 * 3. Calculate statistic of interest (e.g., treatment effect)
 * 4. Repeat B times to build bootstrap distribution
 * 5. Calculate SE and CI from bootstrap distribution
 *
 * Confidence intervals:
 * - Percentile: Simply use 2.5th and 97.5th percentiles
 * - Bias-corrected (BC): Adjust for bias in bootstrap distribution
 *
 * Requirements:
 * - At least 20-30 clusters for reliable inference
 * - At least 1000 bootstrap samples (more is better)
 *
 * Advantages:
 * - Makes minimal distributional assumptions
 * - Accounts for within-cluster correlation automatically
 * - Provides valid inference even with small number of clusters
 *
 * @param data - Clustered data
 * @param numBootstraps - Number of bootstrap samples (default 1000)
 * @param confidenceLevel - Confidence level (default 0.95)
 * @returns Bootstrap results
 */
export function clusterBootstrap(
  data: ClusteredData,
  numBootstraps: number = 1000,
  confidenceLevel: number = 0.95
): BootstrapResult {
  // Original treatment effect
  const originalEffect = calculateTreatmentEffect(data);

  // Get unique cluster IDs
  const clusterIds = Array.from(new Set(data.clusterIds));
  const numClusters = clusterIds.length;

  // Bootstrap distribution
  const bootstrapDistribution: number[] = [];

  for (let b = 0; b < numBootstraps; b++) {
    // Sample clusters with replacement
    const sampledClusters: string[] = [];
    for (let i = 0; i < numClusters; i++) {
      const randomIdx = Math.floor(Math.random() * numClusters);
      sampledClusters.push(clusterIds[randomIdx]);
    }

    // Build bootstrap sample
    const bootstrapOutcomes: number[] = [];
    const bootstrapTreatments: number[] = [];
    const bootstrapClusterIds: string[] = [];

    for (let c = 0; c < sampledClusters.length; c++) {
      const clusterId = sampledClusters[c];
      const clusterIndices = data.clusterIds
        .map((id, i) => id === clusterId ? i : -1)
        .filter(i => i !== -1);

      // Add all observations from this cluster
      for (const idx of clusterIndices) {
        bootstrapOutcomes.push(data.outcomes[idx]);
        bootstrapTreatments.push(data.treatments[idx]);
        // Use new cluster ID to maintain proper clustering
        bootstrapClusterIds.push(`boot_${c}`);
      }
    }

    // Calculate treatment effect for bootstrap sample
    const bootstrapData: ClusteredData = {
      outcomes: bootstrapOutcomes,
      treatments: bootstrapTreatments,
      clusterIds: bootstrapClusterIds
    };

    const effect = calculateTreatmentEffect(bootstrapData);
    bootstrapDistribution.push(effect);
  }

  // Sort bootstrap distribution
  bootstrapDistribution.sort((a, b) => a - b);

  // Bootstrap standard error
  const bootstrapMean = bootstrapDistribution.reduce((sum, v) => sum + v, 0) / numBootstraps;
  const bootstrapVariance = bootstrapDistribution.reduce(
    (sum, v) => sum + Math.pow(v - bootstrapMean, 2),
    0
  ) / (numBootstraps - 1);
  const standardError = Math.sqrt(bootstrapVariance);

  // Percentile confidence interval
  const alpha = 1 - confidenceLevel;
  const lowerIdx = Math.floor(numBootstraps * alpha / 2);
  const upperIdx = Math.floor(numBootstraps * (1 - alpha / 2));
  const confidenceInterval: [number, number] = [
    bootstrapDistribution[lowerIdx],
    bootstrapDistribution[upperIdx]
  ];

  // Bias-corrected confidence interval
  // Count proportion of bootstrap estimates less than original
  const proportionLess = bootstrapDistribution.filter(v => v < originalEffect).length / numBootstraps;
  const z0 = normalQuantile(proportionLess);

  // Adjust percentiles for bias
  const zAlphaLower = normalQuantile(alpha / 2);
  const zAlphaUpper = normalQuantile(1 - alpha / 2);

  const bcLowerPercentile = normalCDF(2 * z0 + zAlphaLower);
  const bcUpperPercentile = normalCDF(2 * z0 + zAlphaUpper);

  const bcLowerIdx = Math.floor(numBootstraps * bcLowerPercentile);
  const bcUpperIdx = Math.floor(numBootstraps * bcUpperPercentile);

  const bcConfidenceInterval: [number, number] = [
    bootstrapDistribution[Math.max(0, Math.min(numBootstraps - 1, bcLowerIdx))],
    bootstrapDistribution[Math.max(0, Math.min(numBootstraps - 1, bcUpperIdx))]
  ];

  return {
    estimate: originalEffect,
    standardError,
    confidenceInterval,
    bcConfidenceInterval,
    numBootstraps,
    bootstrapDistribution
  };
}

/**
 * Calculate simple treatment effect (mean difference)
 */
function calculateTreatmentEffect(data: ClusteredData): number {
  const control = data.outcomes.filter((_, i) => data.treatments[i] === 0);
  const treatment = data.outcomes.filter((_, i) => data.treatments[i] === 1);

  const controlMean = control.reduce((sum, v) => sum + v, 0) / control.length;
  const treatmentMean = treatment.reduce((sum, v) => sum + v, 0) / treatment.length;

  return treatmentMean - controlMean;
}

// ============================================================================
// Design Effect
// ============================================================================

/**
 * Calculate design effect for clustered data
 *
 * Design effect (DEFF) quantifies the loss of statistical efficiency from clustering
 * compared to simple random sampling.
 *
 * Formula: DEFF = 1 + (m - 1) × ICC
 *
 * Where:
 * - m: average cluster size
 * - ICC: intracluster correlation coefficient
 *
 * Interpretation:
 * - DEFF = 1: No clustering effect (ICC = 0)
 * - DEFF = 2: Need twice as many individuals to achieve same power as SRS
 * - DEFF = 3: Need three times as many individuals
 *
 * Effective sample size: n_eff = n / DEFF
 *
 * Design effect is critical for:
 * 1. Sample size calculation (inflate required n by DEFF)
 * 2. Power analysis (actual power lower by factor of DEFF)
 * 3. Standard error adjustment (SE inflated by √DEFF)
 *
 * Example:
 * - 10 clusters of size 50 each (n = 500)
 * - ICC = 0.05
 * - DEFF = 1 + (50 - 1) × 0.05 = 3.45
 * - Effective n = 500 / 3.45 = 145
 *
 * @param data - Clustered data
 * @param icc - Intracluster correlation (optional, will be calculated if not provided)
 * @returns Design effect and related metrics
 */
export function calculateDesignEffect(
  data: ClusteredData,
  icc?: number
): DesignEffectResult {
  const n = data.outcomes.length;
  const clusterIds = Array.from(new Set(data.clusterIds));
  const numClusters = clusterIds.length;

  // Calculate cluster sizes
  const clusterSizes: number[] = [];
  for (const clusterId of clusterIds) {
    const size = data.clusterIds.filter(id => id === clusterId).length;
    clusterSizes.push(size);
  }

  // Average cluster size (arithmetic mean)
  const avgClusterSize = n / numClusters;

  // Calculate ICC if not provided
  if (icc === undefined) {
    // Simple regression to get residuals
    const control = data.outcomes.filter((_, i) => data.treatments[i] === 0);
    const treatment = data.outcomes.filter((_, i) => data.treatments[i] === 1);
    const controlMean = control.reduce((sum, v) => sum + v, 0) / control.length;
    const treatmentMean = treatment.reduce((sum, v) => sum + v, 0) / treatment.length;

    const residuals: number[] = [];
    for (let i = 0; i < n; i++) {
      const predicted = data.treatments[i] === 0 ? controlMean : treatmentMean;
      residuals.push(data.outcomes[i] - predicted);
    }

    icc = calculateICCFromResiduals(data, residuals);
  }

  // Design effect: DEFF = 1 + (m - 1) * ICC
  const designEffect = 1 + (avgClusterSize - 1) * icc;

  // Effective sample size
  const effectiveSampleSize = n / designEffect;

  // Interpretation
  let interpretation: string;
  if (designEffect < 1.5) {
    interpretation = 'Low design effect - clustering has minimal impact on efficiency';
  } else if (designEffect < 3) {
    interpretation = 'Moderate design effect - clustering reduces effective sample size moderately';
  } else {
    interpretation = 'High design effect - clustering substantially reduces effective sample size. ' +
                    'Consider increasing number of clusters.';
  }

  return {
    designEffect,
    averageClusterSize: avgClusterSize,
    icc,
    effectiveSampleSize,
    interpretation
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate ICC from residuals
 */
function calculateICCFromResiduals(
  data: ClusteredData,
  residuals: number[]
): number {
  const clusterIds = Array.from(new Set(data.clusterIds));

  // Group residuals by cluster
  const clusterResiduals: { [clusterId: string]: number[] } = {};
  for (let i = 0; i < residuals.length; i++) {
    const clusterId = data.clusterIds[i];
    if (!clusterResiduals[clusterId]) {
      clusterResiduals[clusterId] = [];
    }
    clusterResiduals[clusterId].push(residuals[i]);
  }

  // Calculate cluster means
  const clusterMeans: number[] = [];
  const clusterSizes: number[] = [];
  let grandSum = 0;
  let grandN = 0;

  for (const clusterId of clusterIds) {
    const residualsInCluster = clusterResiduals[clusterId];
    const mean = residualsInCluster.reduce((sum, v) => sum + v, 0) / residualsInCluster.length;
    clusterMeans.push(mean);
    clusterSizes.push(residualsInCluster.length);
    grandSum += residualsInCluster.reduce((sum, v) => sum + v, 0);
    grandN += residualsInCluster.length;
  }

  const grandMean = grandSum / grandN;

  // Between-cluster variance
  let ssBetween = 0;
  for (let i = 0; i < clusterIds.length; i++) {
    ssBetween += clusterSizes[i] * Math.pow(clusterMeans[i] - grandMean, 2);
  }

  // Within-cluster variance
  let ssWithin = 0;
  for (const clusterId of clusterIds) {
    const residualsInCluster = clusterResiduals[clusterId];
    const mean = clusterMeans[clusterIds.indexOf(clusterId)];
    for (const r of residualsInCluster) {
      ssWithin += Math.pow(r - mean, 2);
    }
  }

  const k = clusterIds.length;
  const msBetween = ssBetween / (k - 1);
  const msWithin = ssWithin / (grandN - k);

  // Harmonic mean of cluster sizes
  const harmonicMean = grandN / clusterSizes.reduce((sum, n) => sum + 1/n, 0);

  // ICC
  const betweenVar = Math.max(0, (msBetween - msWithin) / harmonicMean);
  const withinVar = msWithin;
  const icc = betweenVar / (betweenVar + withinVar);

  return Math.max(0, Math.min(1, icc));
}

// ============================================================================
// Matrix Operations
// ============================================================================

/**
 * Matrix transpose
 */
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

/**
 * Matrix multiplication
 */
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

/**
 * Invert 2x2 matrix
 */
function invert2x2(matrix: number[][]): number[][] {
  const a = matrix[0][0];
  const b = matrix[0][1];
  const c = matrix[1][0];
  const d = matrix[1][1];

  const det = a * d - b * c;

  if (Math.abs(det) < 1e-10) {
    throw new Error('Matrix is singular');
  }

  return [
    [d / det, -b / det],
    [-c / det, a / det]
  ];
}

/**
 * Standard normal CDF
 */
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return x > 0 ? 1 - p : p;
}

/**
 * Standard normal quantile (inverse CDF)
 * Beasley-Springer-Moro approximation
 */
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    // Return extreme values instead of throwing error for edge cases
    return p <= 0 ? -8 : 8;
  }

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

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}
