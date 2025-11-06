/**
 * Example 01: Simple A/B Test
 *
 * This example demonstrates a basic A/B test comparing a control vs. treatment variant.
 * Use case: Testing a new call-to-action button on a checkout page.
 *
 * Objectives:
 * - Create a simple A/B experiment
 * - Assign users to variants
 * - Track exposures when users see the experiment
 * - Track conversion events
 * - Analyze results using statistical tests
 *
 * Run: npx ts-node examples/01-simple-ab-test.ts
 */

import {
  tTest,
  proportionTest,
} from '../src/analysis/statistical-tests';
import { proportionTestSampleSize } from '../src/analysis/power';
import { hashAssignment } from '../src/core/hash';

// ============================================================================
// Step 1: Define Experiment Configuration
// ============================================================================

interface Experiment {
  id: string;
  name: string;
  variants: Array<{
    key: string;
    name: string;
    allocation: number; // Percentage 0-100
  }>;
}

const experiment: Experiment = {
  id: 'checkout-cta-button',
  name: 'Checkout CTA Button Test',
  variants: [
    { key: 'control', name: 'Original Button', allocation: 50 },
    { key: 'treatment', name: 'New Bold Button', allocation: 50 },
  ],
};

console.log('='.repeat(80));
console.log('SIMPLE A/B TEST EXAMPLE');
console.log('='.repeat(80));
console.log(`\nExperiment: ${experiment.name}`);
console.log(`ID: ${experiment.id}`);
console.log('\nVariants:');
experiment.variants.forEach(v => {
  console.log(`  - ${v.name} (${v.key}): ${v.allocation}% traffic`);
});

// ============================================================================
// Step 2: Power Analysis - Calculate Required Sample Size
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('POWER ANALYSIS - Sample Size Calculation');
console.log('='.repeat(80));

// Define experiment parameters
const baselineConversionRate = 0.05; // 5% current conversion rate
const minimumDetectableEffect = 0.01; // Want to detect 1% absolute increase (20% relative)
const alpha = 0.05; // 5% significance level
const power = 0.8; // 80% power

console.log('\nParameters:');
console.log(`  Baseline conversion rate: ${(baselineConversionRate * 100).toFixed(2)}%`);
console.log(`  Minimum detectable effect: ${(minimumDetectableEffect * 100).toFixed(2)}% (absolute)`);
console.log(`  Relative change: ${((minimumDetectableEffect / baselineConversionRate) * 100).toFixed(1)}%`);
console.log(`  Significance level (α): ${alpha}`);
console.log(`  Statistical power: ${power}`);

const powerAnalysis = proportionTestSampleSize(
  baselineConversionRate,
  minimumDetectableEffect,
  alpha,
  power
);

console.log('\nRequired Sample Size:');
console.log(`  Per variant: ${powerAnalysis.sampleSizePerGroup.toLocaleString()} users`);
console.log(`  Total: ${powerAnalysis.totalSampleSize.toLocaleString()} users`);

// ============================================================================
// Step 3: User Assignment Function
// ============================================================================

/**
 * Assign a user to a variant using consistent hashing
 * This ensures the same user always gets the same variant
 */
function assignUser(userId: string, experiment: Experiment): string {
  const hash = hashAssignment(userId, experiment.id);

  // Cumulative allocation
  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.allocation;
    if (hash * 100 < cumulative) {
      return variant.key;
    }
  }

  // Fallback to control
  return experiment.variants[0].key;
}

// ============================================================================
// Step 4: Simulate User Traffic and Track Events
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING USER TRAFFIC');
console.log('='.repeat(80));

interface UserEvent {
  userId: string;
  variant: string;
  exposed: boolean;
  converted: boolean;
  revenue?: number;
}

const events: UserEvent[] = [];
const numUsers = 10000; // Simulate 10,000 users

// Simulate different conversion rates for control vs. treatment
const controlConversionRate = 0.05; // 5%
const treatmentConversionRate = 0.062; // 6.2% (24% relative improvement)

for (let i = 0; i < numUsers; i++) {
  const userId = `user_${i}`;

  // Assign user to variant
  const variant = assignUser(userId, experiment);

  // Simulate exposure (95% of assigned users actually see the experiment)
  const exposed = Math.random() < 0.95;

  if (!exposed) {
    continue; // Skip users who didn't see the experiment
  }

  // Simulate conversion based on variant
  const conversionRate = variant === 'control'
    ? controlConversionRate
    : treatmentConversionRate;

  const converted = Math.random() < conversionRate;

  // Simulate revenue (if converted)
  const revenue = converted ? 50 + Math.random() * 100 : undefined;

  events.push({
    userId,
    variant,
    exposed,
    converted,
    revenue,
  });
}

console.log(`\nSimulated ${events.length.toLocaleString()} user exposures`);

// ============================================================================
// Step 5: Aggregate Data by Variant
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('DATA AGGREGATION');
console.log('='.repeat(80));

interface VariantData {
  variant: string;
  users: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  averageRevenue: number;
  revenuePerUser: number;
}

// Group events by variant
const variantGroups = events.reduce((acc, event) => {
  if (!acc[event.variant]) {
    acc[event.variant] = [];
  }
  acc[event.variant].push(event);
  return acc;
}, {} as Record<string, UserEvent[]>);

// Calculate metrics for each variant
const variantData: VariantData[] = Object.entries(variantGroups).map(([variant, variantEvents]) => {
  const users = variantEvents.length;
  const conversions = variantEvents.filter(e => e.converted).length;
  const conversionRate = conversions / users;
  const totalRevenue = variantEvents.reduce((sum, e) => sum + (e.revenue || 0), 0);
  const averageRevenue = totalRevenue / conversions;
  const revenuePerUser = totalRevenue / users;

  return {
    variant,
    users,
    conversions,
    conversionRate,
    totalRevenue,
    averageRevenue,
    revenuePerUser,
  };
});

console.log('\nVariant Statistics:');
variantData.forEach(data => {
  console.log(`\n${data.variant.toUpperCase()}:`);
  console.log(`  Users: ${data.users.toLocaleString()}`);
  console.log(`  Conversions: ${data.conversions.toLocaleString()}`);
  console.log(`  Conversion Rate: ${(data.conversionRate * 100).toFixed(2)}%`);
  console.log(`  Total Revenue: $${data.totalRevenue.toFixed(2)}`);
  console.log(`  Average Order Value: $${data.averageRevenue.toFixed(2)}`);
  console.log(`  Revenue per User: $${data.revenuePerUser.toFixed(2)}`);
});

// ============================================================================
// Step 6: Statistical Analysis - Conversion Rate (Proportion Test)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STATISTICAL ANALYSIS - Conversion Rate');
console.log('='.repeat(80));

const controlData = variantData.find(d => d.variant === 'control')!;
const treatmentData = variantData.find(d => d.variant === 'treatment')!;

const conversionTest = proportionTest(
  {
    successes: controlData.conversions,
    total: controlData.users,
  },
  {
    successes: treatmentData.conversions,
    total: treatmentData.users,
  },
  alpha
);

console.log('\nConversion Rate Test Results:');
console.log(`  Control Rate: ${(conversionTest.rate1 * 100).toFixed(3)}%`);
console.log(`  Treatment Rate: ${(conversionTest.rate2 * 100).toFixed(3)}%`);
console.log(`  Absolute Difference: ${((conversionTest.rate2 - conversionTest.rate1) * 100).toFixed(3)}%`);
console.log(`  Relative Difference: ${(((conversionTest.rate2 - conversionTest.rate1) / conversionTest.rate1) * 100).toFixed(2)}%`);
console.log(`  P-value: ${conversionTest.pValue.toFixed(6)}`);
console.log(`  95% CI: [${(conversionTest.confidenceInterval[0] * 100).toFixed(3)}%, ${(conversionTest.confidenceInterval[1] * 100).toFixed(3)}%]`);
console.log(`  Statistically Significant: ${conversionTest.significant ? 'YES ✓' : 'NO ✗'}`);

// ============================================================================
// Step 7: Statistical Analysis - Revenue per User (T-Test)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STATISTICAL ANALYSIS - Revenue per User');
console.log('='.repeat(80));

// Extract revenue per user for each group (including zeros)
const controlRevenues = variantGroups['control'].map(e => e.revenue || 0);
const treatmentRevenues = variantGroups['treatment'].map(e => e.revenue || 0);

const revenueTest = tTest(controlRevenues, treatmentRevenues, alpha);

console.log('\nRevenue per User Test Results:');
console.log(`  Control Mean: $${revenueTest.mean1.toFixed(2)}`);
console.log(`  Treatment Mean: $${revenueTest.mean2.toFixed(2)}`);
console.log(`  Absolute Difference: $${(revenueTest.mean2 - revenueTest.mean1).toFixed(2)}`);
console.log(`  Relative Difference: ${(((revenueTest.mean2 - revenueTest.mean1) / revenueTest.mean1) * 100).toFixed(2)}%`);
console.log(`  P-value: ${revenueTest.pValue.toFixed(6)}`);
console.log(`  95% CI: [$${revenueTest.confidenceInterval[0].toFixed(2)}, $${revenueTest.confidenceInterval[1].toFixed(2)}]`);
console.log(`  Statistically Significant: ${revenueTest.significant ? 'YES ✓' : 'NO ✗'}`);

// ============================================================================
// Step 8: Decision and Recommendation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));

const significantConversion = conversionTest.significant;
const significantRevenue = revenueTest.significant;
const positiveConversion = conversionTest.rate2 > conversionTest.rate1;
const positiveRevenue = revenueTest.mean2 > revenueTest.mean1;

console.log('\nDecision Summary:');
console.log(`  Conversion Rate Improvement: ${significantConversion ? 'Significant ✓' : 'Not Significant ✗'}`);
console.log(`  Revenue Improvement: ${significantRevenue ? 'Significant ✓' : 'Not Significant ✗'}`);

if (significantConversion && positiveConversion) {
  console.log('\n✓ RECOMMENDATION: SHIP IT!');
  console.log(`  The new button design improves conversion rate by ${(((conversionTest.rate2 - conversionTest.rate1) / conversionTest.rate1) * 100).toFixed(1)}%.`);
  console.log(`  Expected annual impact: Estimate based on current traffic.`);

  // Calculate projected impact
  const annualVisitors = 1000000; // Example: 1M annual visitors
  const expectedAdditionalConversions = annualVisitors * (conversionTest.rate2 - conversionTest.rate1);
  const expectedAdditionalRevenue = expectedAdditionalConversions * controlData.averageRevenue;

  console.log(`\n  Projected Annual Impact (assuming 1M visitors):`);
  console.log(`    Additional conversions: ${expectedAdditionalConversions.toFixed(0)}`);
  console.log(`    Additional revenue: $${expectedAdditionalRevenue.toLocaleString()}`);
} else if (!significantConversion && !significantRevenue) {
  console.log('\n✗ RECOMMENDATION: NO CHANGE');
  console.log('  The new design does not show statistically significant improvement.');
  console.log('  Consider testing a more substantial change or running the test longer.');
} else {
  console.log('\n⚠ RECOMMENDATION: MIXED RESULTS');
  console.log('  Results are mixed. Consider additional analysis or a longer test period.');
}

// ============================================================================
// Step 9: Sample Size Check
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SAMPLE SIZE VALIDATION');
console.log('='.repeat(80));

console.log('\nActual vs. Required Sample Size:');
console.log(`  Required per variant: ${powerAnalysis.sampleSizePerGroup.toLocaleString()}`);
console.log(`  Actual control: ${controlData.users.toLocaleString()}`);
console.log(`  Actual treatment: ${treatmentData.users.toLocaleString()}`);

if (controlData.users >= powerAnalysis.sampleSizePerGroup &&
    treatmentData.users >= powerAnalysis.sampleSizePerGroup) {
  console.log('\n✓ Sample size requirements met.');
} else {
  console.log('\n⚠ Warning: Sample size below requirement. Results may be underpowered.');
}

// ============================================================================
// Step 10: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS');
console.log('='.repeat(80));

console.log(`
1. Power Analysis First: Always calculate required sample size before running.

2. Consistent Assignment: Use deterministic hashing to ensure users always
   see the same variant.

3. Track Both Exposures and Conversions: Only analyze users who were actually
   exposed to the experiment.

4. Multiple Metrics: Analyze both primary (conversion rate) and secondary
   (revenue) metrics.

5. Statistical Significance: Use appropriate tests (proportion test for rates,
   t-test for continuous metrics).

6. Practical Significance: Even if statistically significant, consider if the
   improvement is meaningful for the business.

7. Confidence Intervals: Report confidence intervals, not just p-values, to
   understand the range of possible effects.
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  assignUser,
  variantData,
  conversionTest,
  revenueTest,
};
