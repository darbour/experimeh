/**
 * Multiple Testing Corrections for Experimentation
 *
 * Implements various methods to control Type I error rate when conducting
 * multiple hypothesis tests simultaneously.
 *
 * Critical for:
 * - Testing multiple metrics
 * - Factorial designs with multiple comparisons
 * - Sequential testing
 * - Subgroup analysis
 *
 * References:
 * - Benjamini, Y., & Hochberg, Y. (1995). "Controlling the False Discovery Rate"
 * - Holm, S. (1979). "A Simple Sequentially Rejective Multiple Test Procedure"
 * - Bonferroni, C. E. (1936). "Teoria statistica delle classi e calcolo delle probabilita"
 * - Kohavi, R., Tang, D., & Xu, Y. (2020). "Trustworthy Online Controlled Experiments"
 */

/**
 * Result after multiple testing correction
 */
export interface CorrectedTest {
  testName: string;
  originalPValue: number;
  adjustedPValue: number;
  significant: boolean;
  rejected: boolean; // Whether null hypothesis is rejected
}

/**
 * Multiple testing correction result
 */
export interface MultipleTestingResult {
  method: string;
  alpha: number;
  numTests: number;
  numSignificant: number;
  tests: CorrectedTest[];
  familyWiseErrorRate?: number; // FWER for methods that control it
  falseDiscoveryRate?: number; // FDR for methods that control it
}

/**
 * Sequential testing result
 */
export interface SequentialTestResult {
  currentPValue: number;
  adjustedAlpha: number;
  decision: 'continue' | 'stop_accept' | 'stop_reject';
  testNumber: number;
  spentAlpha: number;
  remainingAlpha: number;
}

// ============================================================================
// Bonferroni Correction
// ============================================================================

/**
 * Bonferroni correction for multiple testing
 *
 * Most conservative method. Controls Family-Wise Error Rate (FWER).
 * Adjusts significance level by dividing by number of tests.
 *
 * Formula:
 *   α_adjusted = α / m
 *   where m is the number of tests
 *
 * Or equivalently, adjust p-values:
 *   p_adjusted = min(1, p * m)
 *
 * Pros: Simple, controls FWER strongly
 * Cons: Very conservative, low power with many tests
 *
 * Reference: Bonferroni, C. E. (1936)
 *
 * @param pValues - Array of p-values from multiple tests
 * @param testNames - Names of tests (optional)
 * @param alpha - Family-wise error rate to control
 */
export function bonferroniCorrection(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): MultipleTestingResult {
  const m = pValues.length;

  if (m === 0) {
    throw new Error('Need at least one p-value');
  }

  const adjustedAlpha = alpha / m;

  const tests: CorrectedTest[] = pValues.map((p, i) => {
    // Adjust p-value by multiplying by number of tests
    const adjustedP = Math.min(1, p * m);
    const significant = adjustedP < alpha;

    return {
      testName: testNames?.[i] ?? `Test ${i + 1}`,
      originalPValue: p,
      adjustedPValue: adjustedP,
      significant,
      rejected: significant
    };
  });

  const numSignificant = tests.filter(t => t.significant).length;

  return {
    method: 'Bonferroni',
    alpha,
    numTests: m,
    numSignificant,
    tests,
    familyWiseErrorRate: alpha
  };
}

// ============================================================================
// Holm-Bonferroni (Step-Down) Correction
// ============================================================================

/**
 * Holm-Bonferroni sequential rejection procedure
 *
 * More powerful than Bonferroni while still controlling FWER.
 * Tests are ordered by p-value and tested sequentially with
 * decreasing stringency.
 *
 * Algorithm:
 *   1. Sort p-values: p₁ ≤ p₂ ≤ ... ≤ pₘ
 *   2. For i = 1 to m:
 *      - Compare pᵢ to α/(m - i + 1)
 *      - If pᵢ > α/(m - i + 1), stop and accept all remaining
 *      - Otherwise, reject Hᵢ and continue
 *
 * Reference: Holm, S. (1979). "A Simple Sequentially Rejective Multiple
 * Test Procedure"
 *
 * @param pValues - Array of p-values
 * @param testNames - Names of tests
 * @param alpha - Family-wise error rate
 */
export function holmBonferroniCorrection(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): MultipleTestingResult {
  const m = pValues.length;

  if (m === 0) {
    throw new Error('Need at least one p-value');
  }

  // Create array of indices and sort by p-value
  const indices = Array.from({ length: m }, (_, i) => i);
  indices.sort((a, b) => pValues[a] - pValues[b]);

  const tests: CorrectedTest[] = [];
  let allRejected = true;

  for (let i = 0; i < m; i++) {
    const idx = indices[i];
    const p = pValues[idx];

    // Adjusted alpha for this step
    const adjustedAlpha = alpha / (m - i);

    // Adjusted p-value (for reporting)
    // p_adj = max(p * (m - i), previous p_adj)
    const adjustedP = Math.min(1, p * (m - i));

    // If this test fails, all subsequent tests also fail
    const rejected = allRejected && (p <= adjustedAlpha);
    if (!rejected) {
      allRejected = false;
    }

    tests.push({
      testName: testNames?.[idx] ?? `Test ${idx + 1}`,
      originalPValue: p,
      adjustedPValue: adjustedP,
      significant: rejected,
      rejected
    });
  }

  // Monotonicity constraint: adjusted p-values should be non-decreasing
  tests.sort((a, b) => pValues.indexOf(a.originalPValue) - pValues.indexOf(b.originalPValue));

  // Re-sort tests to original order
  const sortedTests: CorrectedTest[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const idx = indices[i];
    sortedTests[idx] = tests[i];
  }

  // Enforce monotonicity
  let maxAdjustedP = 0;
  for (let i = 0; i < m; i++) {
    const idx = indices[i];
    maxAdjustedP = Math.max(maxAdjustedP, sortedTests[idx].adjustedPValue);
    sortedTests[idx].adjustedPValue = maxAdjustedP;
  }

  const numSignificant = sortedTests.filter(t => t.significant).length;

  return {
    method: 'Holm-Bonferroni',
    alpha,
    numTests: m,
    numSignificant,
    tests: sortedTests,
    familyWiseErrorRate: alpha
  };
}

// ============================================================================
// Benjamini-Hochberg (FDR Control)
// ============================================================================

/**
 * Benjamini-Hochberg procedure for controlling False Discovery Rate
 *
 * Controls the expected proportion of false discoveries among rejections.
 * More powerful than FWER-controlling methods for large-scale testing.
 *
 * Algorithm:
 *   1. Sort p-values: p₁ ≤ p₂ ≤ ... ≤ pₘ
 *   2. Find largest i such that pᵢ ≤ (i/m) * α
 *   3. Reject H₁, H₂, ..., Hᵢ
 *
 * The FDR is the expected proportion: E[#false rejections / #rejections]
 *
 * Reference: Benjamini, Y., & Hochberg, Y. (1995). "Controlling the False
 * Discovery Rate: A Practical and Powerful Approach to Multiple Testing"
 *
 * @param pValues - Array of p-values
 * @param testNames - Names of tests
 * @param alpha - False discovery rate to control
 */
export function benjaminiHochbergCorrection(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): MultipleTestingResult {
  const m = pValues.length;

  if (m === 0) {
    throw new Error('Need at least one p-value');
  }

  // Create array of indices and sort by p-value
  const indices = Array.from({ length: m }, (_, i) => i);
  indices.sort((a, b) => pValues[a] - pValues[b]);

  // Find largest i where p_i <= (i/m) * alpha
  let maxRejectIndex = -1;

  for (let i = m - 1; i >= 0; i--) {
    const idx = indices[i];
    const p = pValues[idx];
    const threshold = ((i + 1) / m) * alpha;

    if (p <= threshold) {
      maxRejectIndex = i;
      break;
    }
  }

  // Create results
  const tests: CorrectedTest[] = new Array(m);

  for (let i = 0; i < m; i++) {
    const idx = indices[i];
    const p = pValues[idx];

    // Adjusted p-value: min over j>=i of (m/j) * p_j
    // For BH, it's simpler: p_adj = min(1, p * m / (i+1))
    const adjustedP = Math.min(1, (p * m) / (i + 1));

    const rejected = i <= maxRejectIndex;

    tests[idx] = {
      testName: testNames?.[idx] ?? `Test ${idx + 1}`,
      originalPValue: p,
      adjustedPValue: adjustedP,
      significant: rejected,
      rejected
    };
  }

  // Enforce monotonicity: adjusted p-values should be non-decreasing
  let maxAdjustedP = 0;
  for (let i = 0; i < m; i++) {
    const idx = indices[i];
    maxAdjustedP = Math.max(maxAdjustedP, tests[idx].adjustedPValue);
    tests[idx].adjustedPValue = maxAdjustedP;
  }

  const numSignificant = tests.filter(t => t.significant).length;

  // Estimate FDR
  const estimatedFDR = numSignificant > 0 ? alpha : 0;

  return {
    method: 'Benjamini-Hochberg',
    alpha,
    numTests: m,
    numSignificant,
    tests,
    falseDiscoveryRate: estimatedFDR
  };
}

// ============================================================================
// Benjamini-Yekutieli (FDR Control for Dependent Tests)
// ============================================================================

/**
 * Benjamini-Yekutieli procedure for FDR control with dependent tests
 *
 * More conservative than BH, but valid under arbitrary dependence.
 * Uses harmonic number correction factor.
 *
 * Algorithm: Same as BH but with adjusted threshold:
 *   pᵢ ≤ (i/m) * (α / c(m))
 *   where c(m) = Σ(1/j) for j=1 to m (harmonic number)
 *
 * Reference: Benjamini, Y., & Yekutieli, D. (2001). "The Control of the
 * False Discovery Rate in Multiple Testing under Dependency"
 *
 * @param pValues - Array of p-values
 * @param testNames - Names of tests
 * @param alpha - False discovery rate
 */
export function benjaminiYekutieliCorrection(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): MultipleTestingResult {
  const m = pValues.length;

  if (m === 0) {
    throw new Error('Need at least one p-value');
  }

  // Calculate harmonic number c(m)
  let harmonicSum = 0;
  for (let j = 1; j <= m; j++) {
    harmonicSum += 1 / j;
  }

  // Adjust alpha
  const adjustedAlpha = alpha / harmonicSum;

  // Use BH procedure with adjusted alpha
  const result = benjaminiHochbergCorrection(pValues, testNames, adjustedAlpha);

  return {
    ...result,
    method: 'Benjamini-Yekutieli',
    alpha // Report original alpha
  };
}

// ============================================================================
// Sequential Testing Adjustments
// ============================================================================

/**
 * Alpha spending function for sequential testing
 *
 * Allocates Type I error rate across multiple looks at the data.
 * Implements O'Brien-Fleming and Pocock spending functions.
 *
 * Reference: Lan, K. K., & DeMets, D. L. (1983). "Discrete Sequential
 * Boundaries for Clinical Trials"
 */
export type SpendingFunction = 'obrien-fleming' | 'pocock' | 'linear';

/**
 * Calculate alpha spent at a given information fraction
 *
 * @param informationFraction - Fraction of planned information (0 to 1)
 * @param totalAlpha - Total alpha to spend
 * @param spendingFunction - Type of spending function
 */
function alphaSpent(
  informationFraction: number,
  totalAlpha: number,
  spendingFunction: SpendingFunction
): number {
  if (informationFraction <= 0) return 0;
  if (informationFraction >= 1) return totalAlpha;

  switch (spendingFunction) {
    case 'obrien-fleming':
      // O'Brien-Fleming: Conservative early, liberal late
      // α(t) = 2(1 - Φ(z_α/2 / √t))
      const zAlpha = 1.96; // For alpha = 0.05
      const zValue = zAlpha / Math.sqrt(informationFraction);
      return 2 * (1 - normalCDF(zValue));

    case 'pocock':
      // Pocock: Constant spending rate
      // α(t) = α * log(1 + (e - 1) * t)
      return totalAlpha * Math.log(1 + (Math.E - 1) * informationFraction);

    case 'linear':
      // Linear spending
      return totalAlpha * informationFraction;

    default:
      throw new Error(`Unknown spending function: ${spendingFunction}`);
  }
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/**
 * Sequential testing with alpha spending
 *
 * Determines whether to stop or continue experiment based on current results
 * and alpha spending plan.
 *
 * @param currentPValue - P-value at current look
 * @param informationFraction - Fraction of planned sample size collected
 * @param previousSpentAlpha - Alpha already spent in previous looks
 * @param totalAlpha - Total alpha budget
 * @param spendingFunction - Alpha spending function to use
 */
export function sequentialTest(
  currentPValue: number,
  informationFraction: number,
  previousSpentAlpha: number,
  totalAlpha: number = 0.05,
  spendingFunction: SpendingFunction = 'obrien-fleming'
): SequentialTestResult {
  // Calculate total alpha spent up to this point
  const totalSpentAlpha = alphaSpent(informationFraction, totalAlpha, spendingFunction);

  // Alpha available for this test
  const availableAlpha = totalSpentAlpha - previousSpentAlpha;

  // Adjusted alpha for this specific test
  const adjustedAlpha = availableAlpha;

  // Remaining alpha for future tests
  const remainingAlpha = totalAlpha - totalSpentAlpha;

  // Decision
  let decision: 'continue' | 'stop_accept' | 'stop_reject';

  if (currentPValue <= adjustedAlpha) {
    // Significant result - can stop and reject null
    decision = 'stop_reject';
  } else if (informationFraction >= 1) {
    // Reached end of experiment - must stop
    decision = currentPValue <= totalAlpha ? 'stop_reject' : 'stop_accept';
  } else {
    // Continue experiment
    decision = 'continue';
  }

  // Calculate which test number this is (approximate)
  const testNumber = Math.ceil(informationFraction * 10); // Assume up to 10 looks

  return {
    currentPValue,
    adjustedAlpha,
    decision,
    testNumber,
    spentAlpha: totalSpentAlpha,
    remainingAlpha
  };
}

/**
 * Group Sequential Design boundaries
 *
 * Calculates stopping boundaries for a group sequential design with
 * multiple planned interim analyses.
 *
 * @param numLooks - Number of planned interim analyses
 * @param totalAlpha - Total Type I error rate
 * @param spendingFunction - Alpha spending function
 * @returns Array of adjusted alpha values for each look
 */
export function groupSequentialBoundaries(
  numLooks: number,
  totalAlpha: number = 0.05,
  spendingFunction: SpendingFunction = 'obrien-fleming'
): number[] {
  const boundaries: number[] = [];

  for (let i = 1; i <= numLooks; i++) {
    const informationFraction = i / numLooks;
    const cumulativeAlpha = alphaSpent(informationFraction, totalAlpha, spendingFunction);

    // Incremental alpha for this look
    const previousAlpha = i > 1 ? alphaSpent((i - 1) / numLooks, totalAlpha, spendingFunction) : 0;
    const incrementalAlpha = cumulativeAlpha - previousAlpha;

    boundaries.push(incrementalAlpha);
  }

  return boundaries;
}

// ============================================================================
// Šidák Correction
// ============================================================================

/**
 * Šidák correction for multiple testing
 *
 * Similar to Bonferroni but slightly less conservative.
 * Assumes test independence.
 *
 * Formula:
 *   α_adjusted = 1 - (1 - α)^(1/m)
 *
 * Or for p-values:
 *   p_adjusted = 1 - (1 - p)^m
 *
 * Reference: Šidák, Z. (1967). "Rectangular Confidence Regions for the Means
 * of Multivariate Normal Distributions"
 *
 * @param pValues - Array of p-values
 * @param testNames - Names of tests
 * @param alpha - Family-wise error rate
 */
export function sidakCorrection(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): MultipleTestingResult {
  const m = pValues.length;

  if (m === 0) {
    throw new Error('Need at least one p-value');
  }

  const adjustedAlpha = 1 - Math.pow(1 - alpha, 1 / m);

  const tests: CorrectedTest[] = pValues.map((p, i) => {
    // Adjust p-value: 1 - (1 - p)^m
    const adjustedP = Math.min(1, 1 - Math.pow(1 - p, m));
    const significant = adjustedP < alpha;

    return {
      testName: testNames?.[i] ?? `Test ${i + 1}`,
      originalPValue: p,
      adjustedPValue: adjustedP,
      significant,
      rejected: significant
    };
  });

  const numSignificant = tests.filter(t => t.significant).length;

  return {
    method: 'Šidák',
    alpha,
    numTests: m,
    numSignificant,
    tests,
    familyWiseErrorRate: alpha
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compare different correction methods
 *
 * @param pValues - Array of p-values
 * @param testNames - Names of tests
 * @param alpha - Significance level
 * @returns Comparison of all methods
 */
export function compareCorrections(
  pValues: number[],
  testNames?: string[],
  alpha: number = 0.05
): {
  bonferroni: MultipleTestingResult;
  holmBonferroni: MultipleTestingResult;
  benjaminiHochberg: MultipleTestingResult;
  sidak: MultipleTestingResult;
} {
  return {
    bonferroni: bonferroniCorrection(pValues, testNames, alpha),
    holmBonferroni: holmBonferroniCorrection(pValues, testNames, alpha),
    benjaminiHochberg: benjaminiHochbergCorrection(pValues, testNames, alpha),
    sidak: sidakCorrection(pValues, testNames, alpha)
  };
}

/**
 * Recommend correction method based on context
 *
 * @param numTests - Number of tests to perform
 * @param testType - Type of testing scenario
 * @returns Recommended method and explanation
 */
export function recommendCorrection(
  numTests: number,
  testType: 'confirmatory' | 'exploratory' | 'factorial' | 'sequential'
): { method: string; reasoning: string } {
  if (testType === 'confirmatory' && numTests <= 5) {
    return {
      method: 'Bonferroni',
      reasoning: 'Confirmatory analysis with few tests - use conservative Bonferroni to strongly control FWER'
    };
  }

  if (testType === 'confirmatory' && numTests > 5) {
    return {
      method: 'Holm-Bonferroni',
      reasoning: 'Confirmatory analysis with multiple tests - Holm-Bonferroni provides more power than Bonferroni while controlling FWER'
    };
  }

  if (testType === 'exploratory' || numTests > 10) {
    return {
      method: 'Benjamini-Hochberg',
      reasoning: 'Exploratory analysis or many tests - FDR control is more powerful for discovery'
    };
  }

  if (testType === 'factorial') {
    return {
      method: 'Benjamini-Hochberg',
      reasoning: 'Factorial designs with interaction tests - FDR control balances discovery and false positives'
    };
  }

  if (testType === 'sequential') {
    return {
      method: 'Sequential with alpha spending',
      reasoning: 'Sequential testing requires alpha spending functions like O\'Brien-Fleming'
    };
  }

  return {
    method: 'Holm-Bonferroni',
    reasoning: 'Default choice - good balance of power and Type I error control'
  };
}
