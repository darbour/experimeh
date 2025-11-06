/**
 * Core Statistical Tests for Experimentation
 *
 * Implementation of frequentist statistical tests for A/B testing and experimental analysis.
 * All formulas are implemented from scratch for transparency and educational purposes.
 *
 * References:
 * - Montgomery, D. C. (2017). Design and Analysis of Experiments (9th ed.)
 * - Casella, G., & Berger, R. L. (2002). Statistical Inference (2nd ed.)
 * - Kohavi, R., Tang, D., & Xu, Y. (2020). Trustworthy Online Controlled Experiments
 */

/**
 * Core statistical test result interface
 */
export interface StatisticalTestResult {
  testName: string;
  statistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  confidenceInterval?: [number, number];
  effectSize?: number;
  significant: boolean;
  alpha: number;
}

/**
 * Two-sample t-test result with additional metrics
 */
export interface TTestResult extends StatisticalTestResult {
  mean1: number;
  mean2: number;
  variance1: number;
  variance2: number;
  n1: number;
  n2: number;
  pooledVariance?: number;
  standardError: number;
  cohensD: number; // Effect size
}

/**
 * Z-test result for proportions
 */
export interface ZTestResult extends StatisticalTestResult {
  proportion1: number;
  proportion2: number;
  n1: number;
  n2: number;
  pooledProportion: number;
  standardError: number;
  relativeChange: number; // Percentage change
}

/**
 * Chi-square test result
 */
export interface ChiSquareResult extends StatisticalTestResult {
  observedFrequencies: number[][];
  expectedFrequencies: number[][];
  cramersV: number; // Effect size
}

/**
 * ANOVA result
 */
export interface ANOVAResult extends StatisticalTestResult {
  fStatistic: number;
  betweenGroupsDF: number;
  withinGroupsDF: number;
  betweenGroupsMS: number;
  withinGroupsMS: number;
  groupMeans: number[];
  etaSquared: number; // Effect size
  postHoc?: PostHocResult[];
}

/**
 * Post-hoc pairwise comparison result
 */
export interface PostHocResult {
  group1: number;
  group2: number;
  meanDifference: number;
  pValue: number;
  significant: boolean;
}

/**
 * Regression result for interaction effects
 */
export interface RegressionResult {
  coefficients: { [key: string]: number };
  standardErrors: { [key: string]: number };
  tStatistics: { [key: string]: number };
  pValues: { [key: string]: number };
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
  residualStandardError: number;
  degreesOfFreedom: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) throw new Error('Cannot calculate mean of empty array');
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate variance (sample variance with Bessel's correction)
 */
function variance(values: number[], sampleMean?: number): number {
  if (values.length < 2) throw new Error('Need at least 2 values for variance');
  const m = sampleMean ?? mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - m, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
}

/**
 * Calculate standard deviation
 * @deprecated Use variance with sqrt instead
 */
// function _stdDev(values: number[], sampleMean?: number): number {
//   return Math.sqrt(variance(values, sampleMean));
// }

/**
 * Standard normal CDF (approximation using Abramowitz and Stegun formula)
 * Reference: Handbook of Mathematical Functions (1964)
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/**
 * Two-tailed p-value from z-statistic
 */
function zToPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/**
 * Student's t-distribution CDF approximation
 * Uses Hill's algorithm (1970) for better accuracy
 */
function tCDF(t: number, df: number): number {
  if (df < 1) throw new Error('Degrees of freedom must be >= 1');

  // For large df, approximate with normal
  if (df > 1000) return normalCDF(t);

  const x = df / (df + t * t);

  // Incomplete beta function approximation
  let sum = 0;
  let term = 1;

  for (let i = 0; i < 100; i++) {
    if (Math.abs(term) < 1e-10) break;
    sum += term;
    term *= (df / 2 + i) * (1 - x) / (i + 1);
  }

  const betaApprox = Math.pow(x, df / 2) * sum / (df / 2);
  const prob = t < 0 ? betaApprox / 2 : 1 - betaApprox / 2;

  return prob;
}

/**
 * Two-tailed p-value from t-statistic
 */
function tToPValue(t: number, df: number): number {
  return 2 * (1 - tCDF(Math.abs(t), df));
}

/**
 * Chi-square CDF approximation
 * Uses Wilson-Hilferty transformation for better accuracy
 */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  if (df < 1) throw new Error('Degrees of freedom must be >= 1');

  // Wilson-Hilferty transformation
  const z = Math.pow(x / df, 1/3) - (1 - 2/(9*df)) / Math.sqrt(2/(9*df));
  return normalCDF(z);
}

/**
 * F-distribution CDF approximation
 */
function fCDF(f: number, df1: number, _df2: number): number {
  if (f <= 0) return 0;

  // Beta distribution transformation
  // const x = (_df2) / (_df2 + df1 * f);

  // For simplicity, use chi-square approximation
  // More accurate methods exist but are complex
  const chiSq = df1 * f;
  return 1 - chiSquareCDF(chiSq, df1);
}

// ============================================================================
// T-Tests
// ============================================================================

/**
 * Two-sample t-test (Welch's t-test)
 *
 * Tests whether two samples have significantly different means.
 * Uses Welch's correction for unequal variances (more robust than Student's t-test).
 *
 * Formula:
 *   t = (mean1 - mean2) / SE
 *   SE = sqrt(s1²/n1 + s2²/n2)
 *   df = (s1²/n1 + s2²/n2)² / ((s1²/n1)²/(n1-1) + (s2²/n2)²/(n2-1)) [Welch-Satterthwaite]
 *
 * Reference: Welch, B. L. (1947). "The generalization of Student's problem when
 * several different population variances are involved"
 *
 * @param sample1 - First sample (e.g., control group)
 * @param sample2 - Second sample (e.g., treatment group)
 * @param alpha - Significance level (default 0.05)
 * @param equalVariance - If true, use pooled variance (Student's t-test)
 */
export function twoSampleTTest(
  sample1: number[],
  sample2: number[],
  alpha: number = 0.05,
  equalVariance: boolean = false
): TTestResult {
  if (sample1.length < 2 || sample2.length < 2) {
    throw new Error('Each sample must have at least 2 observations');
  }

  const n1 = sample1.length;
  const n2 = sample2.length;
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = variance(sample1, mean1);
  const var2 = variance(sample2, mean2);

  let standardError: number;
  let df: number;
  let pooledVar: number | undefined;

  if (equalVariance) {
    // Student's t-test with pooled variance
    pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    standardError = Math.sqrt(pooledVar * (1/n1 + 1/n2));
    df = n1 + n2 - 2;
  } else {
    // Welch's t-test (does not assume equal variances)
    standardError = Math.sqrt(var1/n1 + var2/n2);

    // Welch-Satterthwaite degrees of freedom
    const s1_n1 = var1 / n1;
    const s2_n2 = var2 / n2;
    df = Math.pow(s1_n1 + s2_n2, 2) /
         (Math.pow(s1_n1, 2)/(n1-1) + Math.pow(s2_n2, 2)/(n2-1));
  }

  const tStatistic = (mean1 - mean2) / standardError;
  const pValue = tToPValue(tStatistic, df);

  // Confidence interval for difference in means
  // CI = (mean1 - mean2) ± t_critical * SE
  // Approximation: t_critical ≈ 1.96 for large df (95% CI)
  const tCritical = df > 30 ? 1.96 : 2.0 + 6/df; // Rough approximation
  const marginOfError = tCritical * standardError;
  const confidenceInterval: [number, number] = [
    (mean1 - mean2) - marginOfError,
    (mean1 - mean2) + marginOfError
  ];

  // Cohen's d (effect size)
  // d = (mean1 - mean2) / pooled_sd
  const pooledSD = equalVariance && pooledVar !== undefined
    ? Math.sqrt(pooledVar)
    : Math.sqrt((var1 + var2) / 2);
  const cohensD = (mean1 - mean2) / pooledSD;

  return {
    testName: equalVariance ? "Student's t-test" : "Welch's t-test",
    statistic: tStatistic,
    pValue,
    degreesOfFreedom: df,
    confidenceInterval,
    effectSize: cohensD,
    significant: pValue < alpha,
    alpha,
    mean1,
    mean2,
    variance1: var1,
    variance2: var2,
    n1,
    n2,
    pooledVariance: pooledVar,
    standardError,
    cohensD
  };
}

// ============================================================================
// Z-Tests for Proportions
// ============================================================================

/**
 * Two-proportion z-test
 *
 * Tests whether two proportions are significantly different.
 * Common for conversion rate testing in A/B tests.
 *
 * Formula:
 *   z = (p1 - p2) / SE
 *   SE = sqrt(p_pooled * (1 - p_pooled) * (1/n1 + 1/n2))
 *   p_pooled = (x1 + x2) / (n1 + n2)
 *
 * Reference: Agresti, A. (2002). "Categorical Data Analysis"
 *
 * @param successes1 - Number of successes in sample 1
 * @param n1 - Total observations in sample 1
 * @param successes2 - Number of successes in sample 2
 * @param n2 - Total observations in sample 2
 * @param alpha - Significance level
 */
export function twoProportionZTest(
  successes1: number,
  n1: number,
  successes2: number,
  n2: number,
  alpha: number = 0.05
): ZTestResult {
  if (n1 < 5 || n2 < 5) {
    console.warn('Warning: Sample sizes < 5 may violate normal approximation assumptions');
  }

  if (successes1 > n1 || successes2 > n2) {
    throw new Error('Successes cannot exceed total observations');
  }

  const p1 = successes1 / n1;
  const p2 = successes2 / n2;

  // Pooled proportion under null hypothesis
  const pooledP = (successes1 + successes2) / (n1 + n2);

  // Standard error using pooled proportion
  const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

  // Handle edge case of zero standard error
  if (standardError === 0) {
    return {
      testName: 'Two-proportion z-test',
      statistic: 0,
      pValue: 1,
      confidenceInterval: [0, 0],
      effectSize: 0,
      significant: false,
      alpha,
      proportion1: p1,
      proportion2: p2,
      n1,
      n2,
      pooledProportion: pooledP,
      standardError: 0,
      relativeChange: 0
    };
  }

  const zStatistic = (p1 - p2) / standardError;
  const pValue = zToPValue(zStatistic);

  // Confidence interval for difference in proportions
  // Use unpooled SE for CI
  const unpooledSE = Math.sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2);
  const marginOfError = 1.96 * unpooledSE; // 95% CI
  const confidenceInterval: [number, number] = [
    (p1 - p2) - marginOfError,
    (p1 - p2) + marginOfError
  ];

  // Relative change (percentage)
  const relativeChange = p2 !== 0 ? ((p1 - p2) / p2) * 100 : 0;

  // Effect size (h - Cohen's h for proportions)
  const h = 2 * (Math.asin(Math.sqrt(p1)) - Math.asin(Math.sqrt(p2)));

  return {
    testName: 'Two-proportion z-test',
    statistic: zStatistic,
    pValue,
    confidenceInterval,
    effectSize: h,
    significant: pValue < alpha,
    alpha,
    proportion1: p1,
    proportion2: p2,
    n1,
    n2,
    pooledProportion: pooledP,
    standardError,
    relativeChange
  };
}

// ============================================================================
// Chi-Square Test
// ============================================================================

/**
 * Chi-square test of independence
 *
 * Tests whether two categorical variables are independent.
 *
 * Formula:
 *   χ² = Σ((O - E)² / E)
 *   where O = observed frequency, E = expected frequency
 *   E[i,j] = (row_total[i] * col_total[j]) / grand_total
 *
 * Reference: Pearson, K. (1900). "On the criterion that a given system of deviations"
 *
 * @param observed - 2D array of observed frequencies
 * @param alpha - Significance level
 */
export function chiSquareTest(
  observed: number[][],
  alpha: number = 0.05
): ChiSquareResult {
  const rows = observed.length;
  const cols = observed[0].length;

  if (rows < 2 || cols < 2) {
    throw new Error('Need at least 2x2 contingency table');
  }

  // Calculate row and column totals
  const rowTotals = observed.map(row => row.reduce((sum, val) => sum + val, 0));
  const colTotals: number[] = [];
  for (let j = 0; j < cols; j++) {
    colTotals[j] = observed.reduce((sum, row) => sum + row[j], 0);
  }
  const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);

  // Calculate expected frequencies
  const expected: number[][] = [];
  for (let i = 0; i < rows; i++) {
    expected[i] = [];
    for (let j = 0; j < cols; j++) {
      expected[i][j] = (rowTotals[i] * colTotals[j]) / grandTotal;

      if (expected[i][j] < 5) {
        console.warn(`Warning: Expected frequency ${expected[i][j]} < 5 at cell [${i},${j}]. Chi-square test may be unreliable.`);
      }
    }
  }

  // Calculate chi-square statistic
  let chiSquare = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const diff = observed[i][j] - expected[i][j];
      chiSquare += (diff * diff) / expected[i][j];
    }
  }

  // Degrees of freedom
  const df = (rows - 1) * (cols - 1);

  // P-value
  const pValue = 1 - chiSquareCDF(chiSquare, df);

  // Cramér's V (effect size)
  // V = sqrt(χ² / (n * min(rows-1, cols-1)))
  const cramersV = Math.sqrt(chiSquare / (grandTotal * Math.min(rows - 1, cols - 1)));

  return {
    testName: 'Chi-square test of independence',
    statistic: chiSquare,
    pValue,
    degreesOfFreedom: df,
    significant: pValue < alpha,
    alpha,
    observedFrequencies: observed,
    expectedFrequencies: expected,
    cramersV,
    effectSize: cramersV
  };
}

// ============================================================================
// ANOVA (Analysis of Variance)
// ============================================================================

/**
 * One-way ANOVA
 *
 * Tests whether means of 3+ groups are significantly different.
 *
 * Formula:
 *   F = MS_between / MS_within
 *   MS_between = SS_between / df_between
 *   MS_within = SS_within / df_within
 *   SS_between = Σ n_i * (mean_i - grand_mean)²
 *   SS_within = Σ Σ (x_ij - mean_i)²
 *
 * Reference: Fisher, R. A. (1925). "Statistical Methods for Research Workers"
 *
 * @param groups - Array of groups, each containing observations
 * @param alpha - Significance level
 */
export function oneWayANOVA(
  groups: number[][],
  alpha: number = 0.05
): ANOVAResult {
  const k = groups.length; // Number of groups

  if (k < 2) {
    throw new Error('Need at least 2 groups for ANOVA');
  }

  // Check each group has enough observations
  groups.forEach((group, i) => {
    if (group.length < 2) {
      throw new Error(`Group ${i} has fewer than 2 observations`);
    }
  });

  // Calculate group means and sizes
  const groupMeans = groups.map(group => mean(group));
  const groupSizes = groups.map(group => group.length);
  const totalN = groupSizes.reduce((sum, n) => sum + n, 0);

  // Calculate grand mean
  const allValues = groups.flat();
  const grandMean = mean(allValues);

  // Calculate Sum of Squares Between (SS_between)
  let ssBetween = 0;
  for (let i = 0; i < k; i++) {
    ssBetween += groupSizes[i] * Math.pow(groupMeans[i] - grandMean, 2);
  }

  // Calculate Sum of Squares Within (SS_within)
  let ssWithin = 0;
  for (let i = 0; i < k; i++) {
    for (const value of groups[i]) {
      ssWithin += Math.pow(value - groupMeans[i], 2);
    }
  }

  // Degrees of freedom
  const dfBetween = k - 1;
  const dfWithin = totalN - k;

  // Mean Squares
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  // F-statistic
  const fStatistic = msBetween / msWithin;

  // P-value
  const pValue = 1 - fCDF(fStatistic, dfBetween, dfWithin);

  // Effect size (eta-squared)
  // η² = SS_between / SS_total
  const ssTotal = ssBetween + ssWithin;
  const etaSquared = ssBetween / ssTotal;

  return {
    testName: 'One-way ANOVA',
    statistic: fStatistic,
    fStatistic,
    pValue,
    significant: pValue < alpha,
    alpha,
    betweenGroupsDF: dfBetween,
    withinGroupsDF: dfWithin,
    degreesOfFreedom: dfBetween, // Primary DF
    betweenGroupsMS: msBetween,
    withinGroupsMS: msWithin,
    groupMeans,
    etaSquared,
    effectSize: etaSquared
  };
}

/**
 * Factorial ANOVA (Two-way ANOVA)
 *
 * Tests main effects and interaction effects in factorial designs.
 *
 * Reference: Montgomery, D. C. (2017). "Design and Analysis of Experiments"
 *
 * @param data - Array of observations with factor assignments
 * @param factorA - Array of factor A levels for each observation
 * @param factorB - Array of factor B levels for each observation
 * @param alpha - Significance level
 */
export function factorialANOVA(
  data: number[],
  factorA: (string | number)[],
  factorB: (string | number)[],
  alpha: number = 0.05
): {
  mainEffectA: ANOVAResult;
  mainEffectB: ANOVAResult;
  interactionEffect: ANOVAResult;
} {
  if (data.length !== factorA.length || data.length !== factorB.length) {
    throw new Error('Data and factor arrays must have the same length');
  }

  // Get unique levels
  const levelsA = Array.from(new Set(factorA));
  const levelsB = Array.from(new Set(factorB));

  const a = levelsA.length;
  const b = levelsB.length;
  const n = data.length;

  // Calculate grand mean
  const grandMean = mean(data);

  // Calculate cell means
  const cellMeans: { [key: string]: number } = {};
  const cellCounts: { [key: string]: number } = {};

  for (let i = 0; i < n; i++) {
    const key = `${factorA[i]}_${factorB[i]}`;
    if (!cellMeans[key]) {
      cellMeans[key] = 0;
      cellCounts[key] = 0;
    }
    cellMeans[key] += data[i];
    cellCounts[key]++;
  }

  for (const key in cellMeans) {
    cellMeans[key] /= cellCounts[key];
  }

  // Calculate marginal means for each factor
  const marginalMeansA: { [key: string]: number } = {};
  const marginalMeansB: { [key: string]: number } = {};

  for (const levelA of levelsA) {
    const values = data.filter((_, i) => factorA[i] === levelA);
    marginalMeansA[String(levelA)] = mean(values);
  }

  for (const levelB of levelsB) {
    const values = data.filter((_, i) => factorB[i] === levelB);
    marginalMeansB[String(levelB)] = mean(values);
  }

  // Calculate Sum of Squares
  let ssA = 0; // Main effect A
  let ssB = 0; // Main effect B
  let ssAB = 0; // Interaction
  let ssWithin = 0; // Error/Residual

  // SS for main effect A
  for (const levelA of levelsA) {
    const count = factorA.filter(f => f === levelA).length;
    ssA += count * Math.pow(marginalMeansA[String(levelA)] - grandMean, 2);
  }

  // SS for main effect B
  for (const levelB of levelsB) {
    const count = factorB.filter(f => f === levelB).length;
    ssB += count * Math.pow(marginalMeansB[String(levelB)] - grandMean, 2);
  }

  // SS for interaction AB
  for (const levelA of levelsA) {
    for (const levelB of levelsB) {
      const key = `${levelA}_${levelB}`;
      if (cellCounts[key] && cellCounts[key] > 0) {
        const expected = marginalMeansA[String(levelA)] + marginalMeansB[String(levelB)] - grandMean;
        ssAB += cellCounts[key] * Math.pow(cellMeans[key] - expected, 2);
      }
    }
  }

  // SS within (error)
  for (let i = 0; i < n; i++) {
    const key = `${factorA[i]}_${factorB[i]}`;
    ssWithin += Math.pow(data[i] - cellMeans[key], 2);
  }

  // Degrees of freedom
  const dfA = a - 1;
  const dfB = b - 1;
  const dfAB = (a - 1) * (b - 1);
  const dfWithin = n - a * b;

  // Mean Squares
  const msA = ssA / dfA;
  const msB = ssB / dfB;
  const msAB = ssAB / dfAB;
  const msWithin = ssWithin / dfWithin;

  // F-statistics
  const fA = msA / msWithin;
  const fB = msB / msWithin;
  const fAB = msAB / msWithin;

  // P-values
  const pValueA = 1 - fCDF(fA, dfA, dfWithin);
  const pValueB = 1 - fCDF(fB, dfB, dfWithin);
  const pValueAB = 1 - fCDF(fAB, dfAB, dfWithin);

  // Effect sizes
  const ssTotal = ssA + ssB + ssAB + ssWithin;
  const etaSquaredA = ssA / ssTotal;
  const etaSquaredB = ssB / ssTotal;
  const etaSquaredAB = ssAB / ssTotal;

  return {
    mainEffectA: {
      testName: 'Factorial ANOVA - Main Effect A',
      statistic: fA,
      fStatistic: fA,
      pValue: pValueA,
      significant: pValueA < alpha,
      alpha,
      betweenGroupsDF: dfA,
      withinGroupsDF: dfWithin,
      degreesOfFreedom: dfA,
      betweenGroupsMS: msA,
      withinGroupsMS: msWithin,
      groupMeans: levelsA.map(l => marginalMeansA[String(l)]),
      etaSquared: etaSquaredA,
      effectSize: etaSquaredA
    },
    mainEffectB: {
      testName: 'Factorial ANOVA - Main Effect B',
      statistic: fB,
      fStatistic: fB,
      pValue: pValueB,
      significant: pValueB < alpha,
      alpha,
      betweenGroupsDF: dfB,
      withinGroupsDF: dfWithin,
      degreesOfFreedom: dfB,
      betweenGroupsMS: msB,
      withinGroupsMS: msWithin,
      groupMeans: levelsB.map(l => marginalMeansB[String(l)]),
      etaSquared: etaSquaredB,
      effectSize: etaSquaredB
    },
    interactionEffect: {
      testName: 'Factorial ANOVA - Interaction A×B',
      statistic: fAB,
      fStatistic: fAB,
      pValue: pValueAB,
      significant: pValueAB < alpha,
      alpha,
      betweenGroupsDF: dfAB,
      withinGroupsDF: dfWithin,
      degreesOfFreedom: dfAB,
      betweenGroupsMS: msAB,
      withinGroupsMS: msWithin,
      groupMeans: [],
      etaSquared: etaSquaredAB,
      effectSize: etaSquaredAB
    }
  };
}

// ============================================================================
// Regression Analysis for Interaction Effects
// ============================================================================

/**
 * Multiple linear regression
 *
 * Used to test for interaction effects in factorial experiments.
 * Model: Y = β₀ + β₁X₁ + β₂X₂ + β₃X₁X₂ + ε
 *
 * Reference: Kutner, M. H., et al. (2004). "Applied Linear Statistical Models"
 *
 * @param y - Dependent variable (outcome)
 * @param X - Independent variables (design matrix, including interaction terms)
 * @param variableNames - Names for each predictor
 * @param alpha - Significance level
 */
export function multipleRegression(
  y: number[],
  X: number[][],
  variableNames: string[],
  _alpha: number = 0.05
): RegressionResult {
  const n = y.length;
  const p = X[0].length; // Number of predictors

  if (n !== X.length) {
    throw new Error('Y and X dimensions must match');
  }

  if (n <= p) {
    throw new Error('Need more observations than predictors');
  }

  // Add intercept column if not present
  const hasIntercept = X.every(row => row[0] === 1);
  const XWithIntercept = hasIntercept ? X : X.map(row => [1, ...row]);
  const finalP = hasIntercept ? p : p + 1;
  const finalNames = hasIntercept ? variableNames : ['intercept', ...variableNames];

  // Calculate (X'X)^(-1) using simple Gaussian elimination
  // For production, use a proper matrix library
  const XtX = matrixMultiply(transpose(XWithIntercept), XWithIntercept);
  const XtXInv = matrixInverse(XtX);
  const Xty = matrixVectorMultiply(transpose(XWithIntercept), y);

  // β = (X'X)^(-1) X'y
  const coefficients = matrixVectorMultiply(XtXInv, Xty);

  // Predictions and residuals
  const yHat = XWithIntercept.map(row =>
    row.reduce((sum, x, i) => sum + x * coefficients[i], 0)
  );
  const residuals = y.map((yi, i) => yi - yHat[i]);

  // Sum of squares
  const yMean = mean(y);
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
  const ssRegression = ssTotal - ssResidual;

  // R-squared and adjusted R-squared
  const rSquared = ssRegression / ssTotal;
  const adjustedRSquared = 1 - (ssResidual / (n - finalP)) / (ssTotal / (n - 1));

  // Mean squared error
  const mse = ssResidual / (n - finalP);
  const residualSE = Math.sqrt(mse);

  // Standard errors of coefficients
  // SE(β) = sqrt(MSE * diag((X'X)^(-1)))
  const standardErrors: number[] = [];
  for (let i = 0; i < finalP; i++) {
    standardErrors[i] = Math.sqrt(mse * XtXInv[i][i]);
  }

  // T-statistics and p-values
  const tStatistics: number[] = [];
  const pValues: number[] = [];
  const df = n - finalP;

  for (let i = 0; i < finalP; i++) {
    tStatistics[i] = coefficients[i] / standardErrors[i];
    pValues[i] = tToPValue(tStatistics[i], df);
  }

  // Overall F-statistic
  const fStatistic = (ssRegression / (finalP - 1)) / (ssResidual / (n - finalP));
  const fPValue = 1 - fCDF(fStatistic, finalP - 1, n - finalP);

  // Convert arrays to objects
  const coefficientsObj: { [key: string]: number } = {};
  const standardErrorsObj: { [key: string]: number } = {};
  const tStatisticsObj: { [key: string]: number } = {};
  const pValuesObj: { [key: string]: number } = {};

  for (let i = 0; i < finalP; i++) {
    const name = finalNames[i];
    coefficientsObj[name] = coefficients[i];
    standardErrorsObj[name] = standardErrors[i];
    tStatisticsObj[name] = tStatistics[i];
    pValuesObj[name] = pValues[i];
  }

  return {
    coefficients: coefficientsObj,
    standardErrors: standardErrorsObj,
    tStatistics: tStatisticsObj,
    pValues: pValuesObj,
    rSquared,
    adjustedRSquared,
    fStatistic,
    fPValue,
    residualStandardError: residualSE,
    degreesOfFreedom: df
  };
}

// ============================================================================
// Matrix Helper Functions (for regression)
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
      throw new Error('Matrix is singular or nearly singular');
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

  // Extract inverse from augmented matrix
  return augmented.map(row => row.slice(n));
}
