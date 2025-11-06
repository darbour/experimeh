/**
 * Example 07: Power Analysis and Sample Size Calculation
 *
 * This example demonstrates how to:
 * - Calculate required sample size before an experiment
 * - Calculate achieved power after an experiment
 * - Understand minimum detectable effects (MDE)
 * - Plan experiment duration based on traffic
 * - Avoid underpowered experiments
 *
 * Power analysis is CRITICAL for experiment planning. Running underpowered
 * experiments wastes time and resources while providing inconclusive results.
 *
 * Run: npx ts-node examples/07-power-analysis.ts
 */

import {
  proportionTestSampleSize,
  proportionTestPower,
  proportionTestMDE,
  tTestSampleSize,
  tTestPower,
  tTestMDE,
  estimateRuntime,
  calculateAllocation,
  convertEffectSize,
  interpretEffectSize,
} from '../src/analysis/power';

console.log('='.repeat(80));
console.log('POWER ANALYSIS EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// Scenario 1: Planning an A/B Test for Conversion Rate
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 1: Planning a Conversion Rate Experiment');
console.log('='.repeat(80));

console.log(`
You want to test a new checkout flow. Current conversion rate is 8%.
You want to detect at least a 15% relative improvement (1.2% absolute).

Question: How many users do you need?
`);

const scenario1 = {
  baselineRate: 0.08,
  relativeImprovement: 0.15, // 15% relative
  alpha: 0.05,
  power: 0.80,
};

const absoluteEffect = scenario1.baselineRate * scenario1.relativeImprovement;

console.log('Parameters:');
console.log(`  Baseline conversion rate: ${(scenario1.baselineRate * 100).toFixed(2)}%`);
console.log(`  Target improvement: ${(scenario1.relativeImprovement * 100).toFixed(0)}% relative`);
console.log(`  Minimum detectable effect: ${(absoluteEffect * 100).toFixed(2)}% absolute`);
console.log(`  Significance level (α): ${scenario1.alpha} (two-tailed)`);
console.log(`  Statistical power: ${scenario1.power}`);

const sampleSize1 = proportionTestSampleSize(
  scenario1.baselineRate,
  absoluteEffect,
  scenario1.alpha,
  scenario1.power
);

console.log('\nRequired Sample Size:');
console.log(`  Per variant: ${sampleSize1.sampleSizePerGroup.toLocaleString()} users`);
console.log(`  Total (both variants): ${sampleSize1.totalSampleSize.toLocaleString()} users`);

// Estimate runtime
const dailyTraffic = 5000;
const runtime1 = estimateRuntime(sampleSize1.totalSampleSize, dailyTraffic, 100);

console.log('\nEstimated Runtime:');
console.log(`  Daily traffic: ${dailyTraffic.toLocaleString()} users`);
console.log(`  Days needed: ${runtime1.days} days (${runtime1.weeks.toFixed(1)} weeks)`);
console.log(`  Recommendation: ${runtime1.recommendation}`);

// ============================================================================
// Scenario 2: What if we only have 2 weeks?
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 2: Constrained Runtime (2 weeks)');
console.log('='.repeat(80));

console.log(`
Business constraint: Experiment must complete within 2 weeks (14 days).
Daily traffic: ${dailyTraffic.toLocaleString()} users

Question: What's the minimum detectable effect with this constraint?
`);

const availableSampleSize = dailyTraffic * 14;
const sampleSizePerVariant = Math.floor(availableSampleSize / 2);

console.log(`\nAvailable Sample Size:`);
console.log(`  Total: ${availableSampleSize.toLocaleString()} users`);
console.log(`  Per variant: ${sampleSizePerVariant.toLocaleString()} users`);

const mde2 = proportionTestMDE(
  sampleSizePerVariant,
  scenario1.baselineRate,
  scenario1.alpha,
  scenario1.power
);

console.log('\nMinimum Detectable Effect:');
console.log(`  Absolute: ${(mde2.minimumDetectableEffect * 100).toFixed(2)}%`);
console.log(`  Relative: ${mde2.relativeChange.toFixed(1)}%`);

if (mde2.relativeChange > 20) {
  console.log(`\n⚠ WARNING: With ${sampleSizePerVariant.toLocaleString()} users per variant, you can only`);
  console.log(`  detect ${mde2.relativeChange.toFixed(0)}%+ improvements. Smaller effects will go undetected.`);
  console.log(`\nOptions:`);
  console.log(`  1. Run longer (${Math.ceil(runtime1.days / 7)} weeks recommended)`);
  console.log(`  2. Increase traffic allocation`);
  console.log(`  3. Accept lower power (e.g., 70% instead of 80%)`);
  console.log(`  4. Test larger changes only`);
} else {
  console.log(`\n✓ With ${sampleSizePerVariant.toLocaleString()} users, you can detect ${mde2.relativeChange.toFixed(0)}% improvements.`);
}

// ============================================================================
// Scenario 3: Post-Experiment Power Analysis
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 3: Post-Experiment Power Analysis');
console.log('='.repeat(80));

console.log(`
You just completed an experiment with 40,000 users per variant.
Control: 8.1% conversion
Treatment: 8.7% conversion
Difference: 0.6% absolute (7.4% relative)

Question: Did we have enough power to detect this effect?
`);

const scenario3 = {
  sampleSize: 40000,
  controlRate: 0.081,
  treatmentRate: 0.087,
  alpha: 0.05,
};

const achievedPower = proportionTestPower(
  scenario3.sampleSize,
  scenario3.controlRate,
  scenario3.treatmentRate,
  scenario3.alpha
);

console.log('\nPower Analysis:');
console.log(`  Sample size per variant: ${scenario3.sampleSize.toLocaleString()}`);
console.log(`  Observed effect: ${((scenario3.treatmentRate - scenario3.controlRate) * 100).toFixed(2)}%`);
console.log(`  Achieved power: ${(achievedPower * 100).toFixed(1)}%`);

if (achievedPower >= 0.8) {
  console.log(`\n✓ Good power (${(achievedPower * 100).toFixed(0)}%). The experiment was adequately powered.`);
} else if (achievedPower >= 0.5) {
  console.log(`\n⚠ Moderate power (${(achievedPower * 100).toFixed(0)}%). Results are somewhat reliable but could be stronger.`);
} else {
  console.log(`\n✗ Low power (${(achievedPower * 100).toFixed(0)}%). Experiment was underpowered - inconclusive results.`);
  console.log(`  Risk: Could be a false negative (missing a real effect).`);
}

// ============================================================================
// Scenario 4: Revenue Per User (Continuous Metric)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 4: Continuous Metric (Revenue Per User)');
console.log('='.repeat(80));

console.log(`
Testing a pricing change. Want to detect a $2 increase in average revenue.
Current average: $25 per user
Standard deviation: $15
Effect size in Cohen's d: ${(2 / 15).toFixed(3)}

Question: How many users needed?
`);

const scenario4 = {
  currentMean: 25,
  targetIncrease: 2,
  standardDeviation: 15,
  alpha: 0.05,
  power: 0.80,
};

const cohensD = scenario4.targetIncrease / scenario4.standardDeviation;

console.log('\nParameters:');
console.log(`  Current mean: $${scenario4.currentMean}`);
console.log(`  Target increase: $${scenario4.targetIncrease}`);
console.log(`  Standard deviation: $${scenario4.standardDeviation}`);
console.log(`  Effect size (Cohen's d): ${cohensD.toFixed(3)} (${interpretEffectSize(cohensD)})`);

const sampleSize4 = tTestSampleSize(cohensD, scenario4.alpha, scenario4.power);

console.log('\nRequired Sample Size:');
console.log(`  Per variant: ${sampleSize4.sampleSizePerGroup.toLocaleString()} users`);
console.log(`  Total: ${sampleSize4.totalSampleSize.toLocaleString()} users`);

console.log(`\nNote: Continuous metrics typically require LARGER samples than proportions`);
console.log(`due to higher variance. Consider variance reduction techniques (see Example 08).`);

// ============================================================================
// Scenario 5: Multiple Variants (A/B/C Test)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 5: Multiple Variants (A/B/C Test)');
console.log('='.repeat(80));

console.log(`
Testing 3 variants: Control, Variant A, Variant B
Need to compare each variant to control (2 comparisons)

Question: How does sample size change with multiple comparisons?
`);

// For multiple comparisons, need Bonferroni correction or increased sample size
const numComparisons = 2;
const bonferroniAlpha = scenario1.alpha / numComparisons;

console.log('\nApproach 1: Bonferroni Correction');
console.log(`  Original α: ${scenario1.alpha}`);
console.log(`  Number of comparisons: ${numComparisons}`);
console.log(`  Adjusted α: ${bonferroniAlpha.toFixed(4)}`);

const sampleSize5a = proportionTestSampleSize(
  scenario1.baselineRate,
  absoluteEffect,
  bonferroniAlpha,
  scenario1.power
);

console.log(`  Required per variant: ${sampleSize5a.sampleSizePerGroup.toLocaleString()} users`);
console.log(`  Total (3 variants): ${(sampleSize5a.sampleSizePerGroup * 3).toLocaleString()} users`);
console.log(`  Increase vs. A/B: ${(((sampleSize5a.sampleSizePerGroup * 3) / sampleSize1.totalSampleSize - 1) * 100).toFixed(0)}%`);

console.log('\nApproach 2: Sequential Testing');
console.log(`  Run A/B first, then test winner vs. C`);
console.log(`  Total time: 2× runtime of single A/B test`);
console.log(`  Total samples: Same as A/B test (but takes longer)`);

// ============================================================================
// Scenario 6: Traffic Allocation Planning
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 6: Traffic Allocation Planning');
console.log('='.repeat(80));

console.log(`
You have multiple experiments to run but limited traffic.
Total daily traffic: 10,000 users
Want to run experiment in 2 weeks

Question: What traffic allocation percentage needed?
`);

const totalDailyTraffic = 10000;
const targetDays = 14;
const requiredSamples = sampleSize1.totalSampleSize;

const allocation6 = calculateAllocation(
  requiredSamples,
  targetDays,
  totalDailyTraffic
);

console.log('\nTraffic Allocation:');
console.log(`  Required samples: ${requiredSamples.toLocaleString()}`);
console.log(`  Target duration: ${targetDays} days`);
console.log(`  Daily traffic: ${totalDailyTraffic.toLocaleString()}`);
console.log(`  Required allocation: ${allocation6.allocationPercentage.toFixed(1)}%`);
console.log(`  Recommendation: ${allocation6.recommendation}`);

console.log('\nAllocation Trade-offs:');
console.log(`  50% allocation: ${targetDays} days, leaves 50% for other experiments`);
console.log(`  75% allocation: ${Math.ceil(targetDays * 0.67)} days, leaves 25% for other experiments`);
console.log(`  100% allocation: ${Math.ceil(targetDays * 0.5)} days, blocks other experiments`);

// ============================================================================
// Scenario 7: Effect Size Interpretation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 7: Effect Size Guidelines');
console.log('='.repeat(80));

console.log(`
Understanding effect sizes helps set realistic experiment goals.
Cohen's conventions for standardized effect sizes:
`);

const effectSizes = [
  { cohensD: 0.1, interpretation: 'Negligible' },
  { cohensD: 0.2, interpretation: 'Small' },
  { cohensD: 0.5, interpretation: 'Medium' },
  { cohensD: 0.8, interpretation: 'Large' },
  { cohensD: 1.2, interpretation: 'Very Large' },
];

console.log('\nEffect Size   | Interpretation | Sample per Variant (80% power)');
console.log('-'.repeat(70));

effectSizes.forEach(({ cohensD, interpretation }) => {
  const ss = tTestSampleSize(cohensD, 0.05, 0.8);
  const label = `d = ${cohensD.toFixed(1)}`.padEnd(12);
  const interp = interpretation.padEnd(14);
  const sample = ss.sampleSizePerGroup.toLocaleString().padStart(10);

  console.log(`${label} | ${interp} | ${sample}`);
});

console.log(`
Industry Benchmarks:
- UI changes: 1-5% relative improvement (small effect)
- Algorithm improvements: 3-10% relative (small to medium)
- Major redesigns: 10-30% relative (medium to large)
- Pricing changes: 5-20% relative (small to medium)

Practical Implications:
- Small effects (< 5% relative) require large samples (months of data)
- Medium effects (5-15% relative) are commonly targeted (weeks of data)
- Large effects (> 15% relative) are rare in mature products
`);

// ============================================================================
// Scenario 8: Sample Size Sensitivity Analysis
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SCENARIO 8: Sample Size Sensitivity Analysis');
console.log('='.repeat(80));

console.log(`
How does required sample size vary with different parameters?
Baseline conversion rate: 8%
`);

console.log('\nEffect Size Sensitivity:');
console.log('MDE (relative) | MDE (absolute) | Sample per Variant');
console.log('-'.repeat(60));

const relativeEffects = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
relativeEffects.forEach(relEffect => {
  const absEffect = scenario1.baselineRate * relEffect;
  const ss = proportionTestSampleSize(scenario1.baselineRate, absEffect, scenario1.alpha, scenario1.power);

  console.log(
    `${(relEffect * 100).toFixed(0)}%`.padEnd(14) + ' | ' +
    `${(absEffect * 100).toFixed(2)}%`.padEnd(14) + ' | ' +
    ss.sampleSizePerGroup.toLocaleString().padStart(18)
  );
});

console.log('\nPower Sensitivity (for 10% relative effect):');
console.log('Target Power | Sample per Variant | Confidence');
console.log('-'.repeat(60));

const powers = [0.50, 0.70, 0.80, 0.90, 0.95];
const effect10pct = scenario1.baselineRate * 0.10;

powers.forEach(power => {
  const ss = proportionTestSampleSize(scenario1.baselineRate, effect10pct, scenario1.alpha, power);

  console.log(
    `${(power * 100).toFixed(0)}%`.padEnd(12) + ' | ' +
    ss.sampleSizePerGroup.toLocaleString().padStart(18) + ' | ' +
    `${((1 - (1 - power)) * 100).toFixed(0)}% chance to detect effect`
  );
});

// ============================================================================
// Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Power Analysis');
console.log('='.repeat(80));

console.log(`
1. ALWAYS Run Power Analysis Before Experiment:
   - Prevents wasting time on underpowered tests
   - Sets realistic expectations
   - Helps allocate resources efficiently

2. The Four Interconnected Parameters:
   - Sample size (n)
   - Effect size (δ)
   - Significance level (α, typically 0.05)
   - Power (1-β, typically 0.80)
   - Know any 3, calculate the 4th

3. Effect Size Considerations:
   - Small effects need large samples
   - Industry benchmarks: 1-15% relative improvement
   - Be realistic about expected lift
   - Smaller effects in mature products

4. Power Guidelines:
   - 80% power is standard (20% false negative risk)
   - 90% power for critical experiments
   - Never go below 70% power
   - Higher power = more certainty but larger samples

5. Multiple Comparisons:
   - More variants = need more samples or correction
   - Bonferroni correction is conservative
   - Consider sequential testing for many variants
   - FDR control for many metrics

6. Runtime Planning:
   - Balance sample size needs with business timelines
   - Account for day-of-week and seasonal effects
   - Minimum 1-2 weeks for most experiments
   - Longer for subtle effects or low traffic

7. Post-Experiment Power:
   - Always check achieved power
   - Low power + non-significant = inconclusive
   - High power + non-significant = likely no effect
   - Helps interpret null results correctly

8. Common Mistakes to Avoid:
   - Running underpowered experiments
   - P-hacking (stopping early when significant)
   - Ignoring multiple comparisons
   - Not accounting for actual traffic patterns
   - Testing too-subtle effects

9. Practical Rules of Thumb:
   - 2,000-5,000 per variant: Detect 10-15% relative
   - 10,000+ per variant: Detect 5-10% relative
   - 50,000+ per variant: Detect 2-5% relative
   - 100,000+ per variant: Detect < 2% relative

10. Tools and Resources:
    - Use power calculators before every experiment
    - Document assumptions and parameters
    - Review historical effect sizes
    - Build institutional knowledge
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  sampleSize1,
  mde2,
  achievedPower,
  sampleSize4,
  sampleSize5a,
  allocation6,
};
