/**
 * Example 08: CUPED Variance Reduction
 *
 * This example demonstrates CUPED (Controlled-experiment Using Pre-Experiment Data),
 * a powerful variance reduction technique that can increase experiment sensitivity by 20-50%.
 *
 * CUPED uses pre-experiment data (covariates) to reduce variance in your metrics,
 * allowing you to:
 * - Detect smaller effects with same sample size
 * - Reach conclusions faster
 * - Reduce required sample size for same power
 *
 * Use case: E-commerce A/B test with historical purchase data
 *
 * Run: npx ts-node examples/08-cuped-variance-reduction.ts
 */

import {
  applyCUPED,
  cupedABTest,
  estimateVarianceReduction,
  validateCovariate,
} from '../src/analysis/variance-reduction';
import { tTest } from '../src/analysis/statistical-tests';

console.log('='.repeat(80));
console.log('CUPED VARIANCE REDUCTION EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// Step 1: Understanding the Problem
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('THE PROBLEM: High Variance in E-commerce Metrics');
console.log('='.repeat(80));

console.log(`
Scenario: Testing a new product recommendation algorithm.

Primary metric: Revenue per user
Challenge: Revenue has HIGH variance
  - Some users spend $0
  - Some users spend $500+
  - Most users spend $10-50

This high variance reduces statistical power, requiring:
  - Large sample sizes
  - Long experiment runtimes
  - Or risk missing real effects

Solution: CUPED variance reduction
`);

// ============================================================================
// Step 2: Generate Simulated Data
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('GENERATING SIMULATED DATA');
console.log('='.repeat(80));

interface UserData {
  userId: string;
  variant: string;
  preRevenue: number; // Revenue in 30 days before experiment
  postRevenue: number; // Revenue during experiment
}

const numUsers = 2000; // 1000 per variant
const users: UserData[] = [];

console.log(`\nSimulating ${numUsers} users with pre and post-experiment revenue...`);

// Simulate users with correlated pre and post revenue
for (let i = 0; i < numUsers; i++) {
  const variant = i < numUsers / 2 ? 'control' : 'treatment';

  // Each user has a "propensity to spend" that persists over time
  const spendingPropensity = Math.random();

  // Pre-experiment revenue (influenced by spending propensity)
  const basePreRevenue = spendingPropensity * 100;
  const preRevenue = Math.max(0, basePreRevenue + (Math.random() - 0.5) * 50);

  // Post-experiment revenue (also influenced by same propensity)
  // Treatment increases revenue by 8% on average
  const treatmentEffect = variant === 'treatment' ? 1.08 : 1.0;
  const basePostRevenue = spendingPropensity * 100 * treatmentEffect;
  const postRevenue = Math.max(0, basePostRevenue + (Math.random() - 0.5) * 50);

  users.push({
    userId: `user_${i}`,
    variant,
    preRevenue,
    postRevenue,
  });
}

// Split by variant
const controlUsers = users.filter(u => u.variant === 'control');
const treatmentUsers = users.filter(u => u.variant === 'treatment');

console.log(`\nControl: ${controlUsers.length} users`);
console.log(`Treatment: ${treatmentUsers.length} users`);

// ============================================================================
// Step 3: Standard Analysis (Without CUPED)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STANDARD ANALYSIS (Without Variance Reduction)');
console.log('='.repeat(80));

const controlPostRevenues = controlUsers.map(u => u.postRevenue);
const treatmentPostRevenues = treatmentUsers.map(u => u.postRevenue);

const standardTest = tTest(controlPostRevenues, treatmentPostRevenues, 0.05);

console.log('\nStandard T-Test Results:');
console.log(`  Control Mean: $${standardTest.mean1.toFixed(2)}`);
console.log(`  Treatment Mean: $${standardTest.mean2.toFixed(2)}`);
console.log(`  Difference: $${(standardTest.mean2 - standardTest.mean1).toFixed(2)}`);
console.log(`  Relative Lift: ${(((standardTest.mean2 - standardTest.mean1) / standardTest.mean1) * 100).toFixed(2)}%`);
console.log(`  P-value: ${standardTest.pValue.toFixed(6)}`);
console.log(`  95% CI: [$${standardTest.confidenceInterval[0].toFixed(2)}, $${standardTest.confidenceInterval[1].toFixed(2)}]`);
console.log(`  Statistically Significant: ${standardTest.significant ? 'YES ✓' : 'NO ✗'}`);

if (!standardTest.significant) {
  console.log(`\n⚠ Standard analysis failed to detect a significant effect.`);
  console.log(`  This might be a false negative due to high variance.`);
}

// Calculate variance
const controlVariance = controlPostRevenues.reduce((sum, x) => {
  const mean = standardTest.mean1;
  return sum + Math.pow(x - mean, 2);
}, 0) / (controlPostRevenues.length - 1);

const treatmentVariance = treatmentPostRevenues.reduce((sum, x) => {
  const mean = standardTest.mean2;
  return sum + Math.pow(x - mean, 2);
}, 0) / (treatmentPostRevenues.length - 1);

console.log('\nVariance Analysis:');
console.log(`  Control Variance: ${controlVariance.toFixed(2)}`);
console.log(`  Control Std Dev: $${Math.sqrt(controlVariance).toFixed(2)}`);
console.log(`  Treatment Variance: ${treatmentVariance.toFixed(2)}`);
console.log(`  Treatment Std Dev: $${Math.sqrt(treatmentVariance).toFixed(2)}`);

// ============================================================================
// Step 4: Check Pre-Experiment Correlation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PRE-EXPERIMENT DATA ANALYSIS');
console.log('='.repeat(80));

// Estimate variance reduction potential
const historicalPost = users.map(u => u.postRevenue);
const historicalPre = users.map(u => u.preRevenue);

const vrEstimate = estimateVarianceReduction(historicalPost, historicalPre);

console.log('\nCorrelation Analysis:');
console.log(`  Correlation (pre vs. post revenue): ${vrEstimate.correlation.toFixed(3)}`);
console.log(`  Expected variance reduction: ${(100 - vrEstimate.expectedReduction).toFixed(1)}%`);
console.log(`  Recommendation: ${vrEstimate.recommendation}`);

// Validate covariate balance
const treatmentAssignments = users.map(u => u.variant === 'treatment' ? 1 : 0);
const preRevenues = users.map(u => u.preRevenue);

const covariateValidation = validateCovariate(preRevenues, treatmentAssignments);

console.log('\nCovariate Balance Check:');
console.log(`  Control pre-revenue: $${covariateValidation.balanceTest.controlMean.toFixed(2)}`);
console.log(`  Treatment pre-revenue: $${covariateValidation.balanceTest.treatmentMean.toFixed(2)}`);
console.log(`  Difference: $${covariateValidation.balanceTest.difference.toFixed(2)}`);
console.log(`  P-value: ${covariateValidation.balanceTest.pValue.toFixed(4)}`);
console.log(`  Balanced: ${covariateValidation.valid ? 'YES ✓' : 'NO ✗'}`);

if (!covariateValidation.valid) {
  console.log('\nIssues detected:');
  covariateValidation.issues.forEach(issue => console.log(`  - ${issue}`));
}

// ============================================================================
// Step 5: Apply CUPED
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('CUPED VARIANCE REDUCTION');
console.log('='.repeat(80));

console.log(`
CUPED adjusts the metric using pre-experiment data:
  Y_adjusted = Y - θ(X - E[X])

where:
  Y = post-experiment metric
  X = pre-experiment covariate
  θ = Cov(Y,X) / Var(X)  (optimal coefficient)
  E[X] = mean of covariate

The adjustment preserves the mean but reduces variance.
`);

const controlPost = controlUsers.map(u => u.postRevenue);
const controlPre = controlUsers.map(u => u.preRevenue);
const treatmentPost = treatmentUsers.map(u => u.postRevenue);
const treatmentPre = treatmentUsers.map(u => u.preRevenue);

const cupedResults = cupedABTest(
  controlPost,
  controlPre,
  treatmentPost,
  treatmentPre
);

console.log('\nCUPED Results:');

console.log('\nControl Group:');
console.log(`  Original Mean: $${cupedResults.control.original.mean.toFixed(2)}`);
console.log(`  Adjusted Mean: $${cupedResults.control.adjusted.mean.toFixed(2)}`);
console.log(`  Original Variance: ${cupedResults.control.original.variance.toFixed(2)}`);
console.log(`  Adjusted Variance: ${cupedResults.control.adjusted.variance.toFixed(2)}`);
console.log(`  Variance Reduction: ${cupedResults.control.varianceReduction.toFixed(1)}%`);
console.log(`  Theta (coefficient): ${cupedResults.control.theta.toFixed(4)}`);

console.log('\nTreatment Group:');
console.log(`  Original Mean: $${cupedResults.treatment.original.mean.toFixed(2)}`);
console.log(`  Adjusted Mean: $${cupedResults.treatment.adjusted.mean.toFixed(2)}`);
console.log(`  Original Variance: ${cupedResults.treatment.original.variance.toFixed(2)}`);
console.log(`  Adjusted Variance: ${cupedResults.treatment.adjusted.variance.toFixed(2)}`);
console.log(`  Variance Reduction: ${cupedResults.treatment.varianceReduction.toFixed(1)}%`);

console.log('\nTreatment Effect:');
console.log(`  Original Effect: $${cupedResults.treatmentEffect.original.toFixed(2)}`);
console.log(`  Adjusted Effect: $${cupedResults.treatmentEffect.adjusted.toFixed(2)}`);
console.log(`  Original SE: $${cupedResults.treatmentEffect.originalSE.toFixed(2)}`);
console.log(`  Adjusted SE: $${cupedResults.treatmentEffect.adjustedSE.toFixed(2)}`);
console.log(`  SE Reduction: ${cupedResults.treatmentEffect.varianceReduction.toFixed(1)}%`);

// ============================================================================
// Step 6: Statistical Test with CUPED
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('CUPED-ADJUSTED STATISTICAL TEST');
console.log('='.repeat(80));

// Calculate t-statistic and p-value for CUPED-adjusted data
const adjustedControlMean = cupedResults.control.adjusted.mean;
const adjustedTreatmentMean = cupedResults.treatment.adjusted.mean;
const adjustedEffect = cupedResults.treatmentEffect.adjusted;
const adjustedSE = cupedResults.treatmentEffect.adjustedSE;

const tStatistic = adjustedEffect / adjustedSE;
const df = controlPost.length + treatmentPost.length - 2;

// Approximate p-value using normal distribution (for large samples)
const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

console.log('\nCUPED-Adjusted Test:');
console.log(`  Adjusted Difference: $${adjustedEffect.toFixed(2)}`);
console.log(`  Standard Error: $${adjustedSE.toFixed(2)}`);
console.log(`  T-statistic: ${tStatistic.toFixed(3)}`);
console.log(`  P-value: ${pValue.toFixed(6)}`);
console.log(`  Statistically Significant: ${pValue < 0.05 ? 'YES ✓' : 'NO ✗'}`);

// Calculate confidence interval
const criticalValue = 1.96; // For 95% CI
const ciLower = adjustedEffect - criticalValue * adjustedSE;
const ciUpper = adjustedEffect + criticalValue * adjustedSE;

console.log(`  95% CI: [$${ciLower.toFixed(2)}, $${ciUpper.toFixed(2)}]`);

// ============================================================================
// Step 7: Compare Standard vs. CUPED
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('COMPARISON: Standard vs. CUPED');
console.log('='.repeat(80));

console.log('\n' + '-'.repeat(80));
console.log('Metric'.padEnd(30) + ' | Standard      | CUPED         | Improvement');
console.log('-'.repeat(80));

const comparisons = [
  {
    metric: 'Treatment Effect',
    standard: `$${standardTest.mean2 - standardTest.mean1.toFixed(2)}`,
    cuped: `$${adjustedEffect.toFixed(2)}`,
    improvement: 'Same (unbiased)',
  },
  {
    metric: 'Standard Error',
    standard: `$${((standardTest.confidenceInterval[1] - standardTest.confidenceInterval[0]) / (2 * 1.96)).toFixed(2)}`,
    cuped: `$${adjustedSE.toFixed(2)}`,
    improvement: `${cupedResults.treatmentEffect.varianceReduction.toFixed(0)}% reduction`,
  },
  {
    metric: 'P-value',
    standard: standardTest.pValue.toFixed(6),
    cuped: pValue.toFixed(6),
    improvement: pValue < standardTest.pValue ? 'More sensitive' : 'Similar',
  },
  {
    metric: 'Significant?',
    standard: standardTest.significant ? 'YES' : 'NO',
    cuped: pValue < 0.05 ? 'YES' : 'NO',
    improvement: (pValue < 0.05) && !standardTest.significant ? '✓ Detected!' : '',
  },
];

comparisons.forEach(({ metric, standard, cuped, improvement }) => {
  console.log(
    metric.padEnd(30) + ' | ' +
    standard.padEnd(13) + ' | ' +
    cuped.padEnd(13) + ' | ' +
    improvement
  );
});
console.log('-'.repeat(80));

// ============================================================================
// Step 8: Effective Sample Size Increase
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EFFECTIVE SAMPLE SIZE');
console.log('='.repeat(80));

const varianceReductionFactor = 1 - Math.pow(vrEstimate.correlation, 2);
const effectiveSampleSizeMultiplier = 1 / varianceReductionFactor;

console.log(`
CUPED increases statistical power as if you had more data.

With correlation ρ = ${vrEstimate.correlation.toFixed(3)}:
  Variance reduced by: ${(100 - varianceReductionFactor * 100).toFixed(1)}%
  Effective sample size multiplier: ${effectiveSampleSizeMultiplier.toFixed(2)}x

This means:
  Actual sample: ${numUsers.toLocaleString()} users
  Effective sample (CUPED): ~${Math.round(numUsers * effectiveSampleSizeMultiplier).toLocaleString()} users

Or equivalently:
  To achieve same power as ${numUsers.toLocaleString()} users with CUPED,
  you'd need ~${Math.round(numUsers * effectiveSampleSizeMultiplier).toLocaleString()} users without CUPED.

Practical benefit:
  - Run experiments ${(1 / varianceReductionFactor).toFixed(1)}x faster, OR
  - Detect ${(1 / Math.sqrt(varianceReductionFactor)).toFixed(1)}x smaller effects
`);

// ============================================================================
// Step 9: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - CUPED Variance Reduction');
console.log('='.repeat(80));

console.log(`
1. What is CUPED?
   - Uses pre-experiment data to reduce metric variance
   - Adjustment: Y_adjusted = Y - θ(X - E[X])
   - Preserves mean (unbiased) while reducing variance
   - Increases statistical power without more data

2. When to Use CUPED:
   - High-variance metrics (revenue, time spent, etc.)
   - Pre-experiment data available for same metric
   - Pre and post metrics are correlated (ρ > 0.3)
   - Need faster results or smaller detectable effects

3. Choosing Covariates:
   - Best: Same metric from pre-experiment period
   - Good: Highly correlated metrics
   - Check correlation: Need ρ > 0.3 for meaningful benefit
   - Verify balance: Covariate should be balanced across groups

4. Benefits:
   - Variance reduction: Typically 20-50%
   - Effective sample size increase: 1/(1-ρ²)
   - Faster experiment runtimes
   - Detect smaller effects
   - No additional data collection needed

5. Requirements:
   - Pre-experiment data must be available
   - Metric should be defined pre-experiment
   - Randomization should balance pre-metric
   - Pre-period should be representative

6. Limitations:
   - Only helps when ρ > 0.3
   - Requires pre-experiment data pipeline
   - Slightly more complex analysis
   - Can't use for new users (no history)

7. Implementation Tips:
   - Collect pre-metrics automatically
   - Use 7-30 days of pre-data
   - Check covariate balance in every experiment
   - Document correlation for metric catalog
   - Build CUPED into standard analysis

8. Common Pitfalls:
   - Using unbalanced covariates (introduces bias)
   - Choosing covariates post-hoc (p-hacking)
   - Not checking correlation first
   - Using too short pre-period (noisy)
   - Using post-treatment data as covariate

9. Advanced Extensions:
   - Multiple covariates (regression adjustment)
   - Stratified CUPED (by user segments)
   - CUPED + sequential testing
   - Pre-aggregated covariates

10. Real-World Impact:
    - 30-40% variance reduction is common
    - Can reduce experiment runtime by 50%
    - Particularly effective for:
      * Revenue metrics
      * Engagement metrics
      * Retention metrics
    - Less effective for:
      * Binary metrics with low correlation
      * New user metrics (no history)
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Helper function
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

// Export for testing
export {
  users,
  standardTest,
  cupedResults,
  pValue as cupedPValue,
  vrEstimate,
  effectiveSampleSizeMultiplier,
};
