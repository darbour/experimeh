/**
 * Example 02: Factorial Design (2x2)
 *
 * This example demonstrates a 2x2 factorial experiment testing two factors simultaneously.
 * Use case: Testing button color AND button text on a landing page.
 *
 * Factors:
 * - Button Color: Blue (control) vs. Green (treatment)
 * - Button Text: "Buy Now" (control) vs. "Get Started" (treatment)
 *
 * This creates 4 treatment combinations:
 * 1. Blue + "Buy Now" (control-control)
 * 2. Blue + "Get Started" (control-treatment)
 * 3. Green + "Buy Now" (treatment-control)
 * 4. Green + "Get Started" (treatment-treatment)
 *
 * Benefits:
 * - Test 2 factors with same sample size as testing each separately
 * - Detect interaction effects (do factors work better/worse together?)
 * - More efficient than running sequential experiments
 *
 * Run: npx ts-node examples/02-factorial-design.ts
 */

import { anova, twoWayAnova } from '../src/analysis/statistical-tests';
import { factorialSampleSize } from '../src/analysis/power';
import { hashAssignment } from '../src/core/hash';

// ============================================================================
// Step 1: Define Factorial Experiment
// ============================================================================

interface FactorialExperiment {
  id: string;
  name: string;
  factors: Array<{
    name: string;
    levels: string[];
  }>;
}

const experiment: FactorialExperiment = {
  id: 'landing-page-factorial',
  name: 'Landing Page Factorial Experiment',
  factors: [
    {
      name: 'buttonColor',
      levels: ['blue', 'green'],
    },
    {
      name: 'buttonText',
      levels: ['buy-now', 'get-started'],
    },
  ],
};

console.log('='.repeat(80));
console.log('FACTORIAL DESIGN (2×2) EXAMPLE');
console.log('='.repeat(80));
console.log(`\nExperiment: ${experiment.name}`);
console.log(`ID: ${experiment.id}`);
console.log('\nFactors:');
experiment.factors.forEach(factor => {
  console.log(`  ${factor.name}: ${factor.levels.join(' vs. ')}`);
});

// Generate all treatment combinations
interface TreatmentCombination {
  buttonColor: string;
  buttonText: string;
  label: string;
}

const treatmentCombinations: TreatmentCombination[] = [];
for (const color of experiment.factors[0].levels) {
  for (const text of experiment.factors[1].levels) {
    treatmentCombinations.push({
      buttonColor: color,
      buttonText: text,
      label: `${color}-${text}`,
    });
  }
}

console.log('\nTreatment Combinations:');
treatmentCombinations.forEach((combo, i) => {
  console.log(`  ${i + 1}. ${combo.buttonColor} button with "${combo.buttonText}" text`);
});

// ============================================================================
// Step 2: Power Analysis for Factorial Design
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('POWER ANALYSIS - Factorial Design');
console.log('='.repeat(80));

// For factorial designs, we need to consider:
// - Main effect of factor A
// - Main effect of factor B
// - Interaction effect A×B

const mainEffectSize = 0.3; // Cohen's d for main effects
const interactionEffectSize = 0.25; // Smaller - interactions typically harder to detect

console.log('\nExpected Effect Sizes:');
console.log(`  Main effects (Color, Text): Cohen's d = ${mainEffectSize}`);
console.log(`  Interaction effect: Cohen's d = ${interactionEffectSize}`);

const powerAnalysis = factorialSampleSize(
  mainEffectSize,
  interactionEffectSize,
  0.05, // alpha
  0.8   // power
);

console.log('\nRequired Sample Size:');
console.log(`  Per treatment cell: ${powerAnalysis.recommended.sampleSizePerGroup.toLocaleString()}`);
console.log(`  Total across 4 cells: ${(powerAnalysis.recommended.sampleSizePerGroup * 4).toLocaleString()}`);
console.log('\nNote: Interaction effects typically require larger samples than main effects.');

// ============================================================================
// Step 3: User Assignment Function
// ============================================================================

/**
 * Assign user to factorial treatment combination
 * Each user gets one level of each factor
 */
function assignUser(userId: string, experiment: FactorialExperiment): TreatmentCombination {
  // Hash-based assignment ensures consistency
  const hash = hashAssignment(userId, experiment.id);

  // Assign to one of 4 combinations with equal probability (25% each)
  const combinationIndex = Math.floor(hash * treatmentCombinations.length);

  return treatmentCombinations[combinationIndex];
}

// ============================================================================
// Step 4: Simulate User Traffic
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING USER TRAFFIC');
console.log('='.repeat(80));

interface UserEvent {
  userId: string;
  buttonColor: string;
  buttonText: string;
  combination: string;
  converted: boolean;
  timeOnPage: number; // Secondary metric
}

const events: UserEvent[] = [];
const numUsers = 8000; // 2000 per cell

// Simulate conversion rates with main effects and interaction
// Main effects:
// - Green buttons: +2% conversion rate
// - "Get Started" text: +1.5% conversion rate
// Interaction:
// - Green + "Get Started" has additional synergy: +1% extra

const baselineRate = 0.10; // 10% baseline

function getConversionRate(color: string, text: string): number {
  let rate = baselineRate;

  // Main effect of color
  if (color === 'green') {
    rate += 0.02;
  }

  // Main effect of text
  if (text === 'get-started') {
    rate += 0.015;
  }

  // Interaction effect (synergy when both are treatment)
  if (color === 'green' && text === 'get-started') {
    rate += 0.01; // Extra boost from combination
  }

  return rate;
}

function getTimeOnPage(color: string, text: string): number {
  // Base time on page: 45 seconds
  let baseTime = 45;

  // Add some variation
  const variation = (Math.random() - 0.5) * 20;

  // Color effect: green buttons slightly increase engagement
  if (color === 'green') {
    baseTime += 3;
  }

  // Text effect: "Get Started" increases time
  if (text === 'get-started') {
    baseTime += 5;
  }

  return Math.max(10, baseTime + variation);
}

for (let i = 0; i < numUsers; i++) {
  const userId = `user_${i}`;
  const assignment = assignUser(userId, experiment);

  const conversionRate = getConversionRate(assignment.buttonColor, assignment.buttonText);
  const converted = Math.random() < conversionRate;
  const timeOnPage = getTimeOnPage(assignment.buttonColor, assignment.buttonText);

  events.push({
    userId,
    buttonColor: assignment.buttonColor,
    buttonText: assignment.buttonText,
    combination: assignment.label,
    converted,
    timeOnPage,
  });
}

console.log(`\nSimulated ${events.length.toLocaleString()} user sessions`);

// ============================================================================
// Step 5: Aggregate Data by Treatment Combination
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('DATA AGGREGATION BY TREATMENT COMBINATION');
console.log('='.repeat(80));

interface CellData {
  buttonColor: string;
  buttonText: string;
  combination: string;
  users: number;
  conversions: number;
  conversionRate: number;
  avgTimeOnPage: number;
}

// Group by treatment combination
const cellGroups = events.reduce((acc, event) => {
  if (!acc[event.combination]) {
    acc[event.combination] = [];
  }
  acc[event.combination].push(event);
  return acc;
}, {} as Record<string, UserEvent[]>);

const cellData: CellData[] = Object.entries(cellGroups).map(([combination, cellEvents]) => {
  const users = cellEvents.length;
  const conversions = cellEvents.filter(e => e.converted).length;
  const conversionRate = conversions / users;
  const avgTimeOnPage = cellEvents.reduce((sum, e) => sum + e.timeOnPage, 0) / users;

  const [color, text] = combination.split('-');

  return {
    buttonColor: color,
    buttonText: text,
    combination,
    users,
    conversions,
    conversionRate,
    avgTimeOnPage,
  };
});

console.log('\nTreatment Combination Results:');
console.log('\n' + '-'.repeat(80));
console.log('Button Color | Button Text    | Users  | Conv. | Conv. Rate | Avg Time');
console.log('-'.repeat(80));
cellData.forEach(cell => {
  const colorLabel = cell.buttonColor.padEnd(12);
  const textLabel = cell.buttonText.padEnd(14);
  const usersLabel = cell.users.toString().padStart(6);
  const convLabel = cell.conversions.toString().padStart(5);
  const rateLabel = `${(cell.conversionRate * 100).toFixed(2)}%`.padStart(10);
  const timeLabel = `${cell.avgTimeOnPage.toFixed(1)}s`.padStart(8);

  console.log(`${colorLabel} | ${textLabel} | ${usersLabel} | ${convLabel} | ${rateLabel} | ${timeLabel}`);
});
console.log('-'.repeat(80));

// ============================================================================
// Step 6: Main Effect Analysis - Button Color
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('MAIN EFFECT ANALYSIS - Button Color');
console.log('='.repeat(80));

// Aggregate across button text levels
const blueEvents = events.filter(e => e.buttonColor === 'blue');
const greenEvents = events.filter(e => e.buttonColor === 'green');

const blueConversionRate = blueEvents.filter(e => e.converted).length / blueEvents.length;
const greenConversionRate = greenEvents.filter(e => e.converted).length / greenEvents.length;

console.log('\nButton Color Main Effect:');
console.log(`  Blue: ${(blueConversionRate * 100).toFixed(2)}% (n=${blueEvents.length})`);
console.log(`  Green: ${(greenConversionRate * 100).toFixed(2)}% (n=${greenEvents.length})`);
console.log(`  Difference: ${((greenConversionRate - blueConversionRate) * 100).toFixed(2)}%`);
console.log(`  Relative Lift: ${(((greenConversionRate - blueConversionRate) / blueConversionRate) * 100).toFixed(1)}%`);

// ============================================================================
// Step 7: Main Effect Analysis - Button Text
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('MAIN EFFECT ANALYSIS - Button Text');
console.log('='.repeat(80));

// Aggregate across button color levels
const buyNowEvents = events.filter(e => e.buttonText === 'buy-now');
const getStartedEvents = events.filter(e => e.buttonText === 'get-started');

const buyNowConversionRate = buyNowEvents.filter(e => e.converted).length / buyNowEvents.length;
const getStartedConversionRate = getStartedEvents.filter(e => e.converted).length / getStartedEvents.length;

console.log('\nButton Text Main Effect:');
console.log(`  "Buy Now": ${(buyNowConversionRate * 100).toFixed(2)}% (n=${buyNowEvents.length})`);
console.log(`  "Get Started": ${(getStartedConversionRate * 100).toFixed(2)}% (n=${getStartedEvents.length})`);
console.log(`  Difference: ${((getStartedConversionRate - buyNowConversionRate) * 100).toFixed(2)}%`);
console.log(`  Relative Lift: ${(((getStartedConversionRate - buyNowConversionRate) / buyNowConversionRate) * 100).toFixed(1)}%`);

// ============================================================================
// Step 8: Interaction Effect Analysis
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('INTERACTION EFFECT ANALYSIS');
console.log('='.repeat(80));

console.log(`
An interaction occurs when the effect of one factor depends on the level of another.

Visualization:
`);

// Create a simple interaction plot
const blueBuyNow = cellData.find(c => c.buttonColor === 'blue' && c.buttonText === 'buy-now')!;
const blueGetStarted = cellData.find(c => c.buttonColor === 'blue' && c.buttonText === 'get-started')!;
const greenBuyNow = cellData.find(c => c.buttonColor === 'green' && c.buttonText === 'buy-now')!;
const greenGetStarted = cellData.find(c => c.buttonColor === 'green' && c.buttonText === 'get-started')!;

console.log('Conversion Rate by Combination:');
console.log(`
                Buy Now    Get Started
    Blue        ${(blueBuyNow.conversionRate * 100).toFixed(2)}%       ${(blueGetStarted.conversionRate * 100).toFixed(2)}%
    Green       ${(greenBuyNow.conversionRate * 100).toFixed(2)}%       ${(greenGetStarted.conversionRate * 100).toFixed(2)}%
`);

// Calculate interaction effect
// Interaction = (Green-GetStarted - Green-BuyNow) - (Blue-GetStarted - Blue-BuyNow)
const textEffectForGreen = greenGetStarted.conversionRate - greenBuyNow.conversionRate;
const textEffectForBlue = blueGetStarted.conversionRate - blueBuyNow.conversionRate;
const interactionEffect = textEffectForGreen - textEffectForBlue;

console.log('Interaction Effect:');
console.log(`  Text effect for Green buttons: ${(textEffectForGreen * 100).toFixed(2)}%`);
console.log(`  Text effect for Blue buttons: ${(textEffectForBlue * 100).toFixed(2)}%`);
console.log(`  Interaction: ${(interactionEffect * 100).toFixed(2)}%`);

if (Math.abs(interactionEffect) > 0.005) {
  console.log(`
  ✓ INTERACTION DETECTED: The effect of button text is ${Math.abs(interactionEffect * 100).toFixed(1)}% stronger
    when combined with green buttons. This suggests a SYNERGY between the factors.
  `);
} else {
  console.log(`
  ✗ NO SIGNIFICANT INTERACTION: The factors appear to work independently.
  `);
}

// ============================================================================
// Step 9: Two-Way ANOVA
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('TWO-WAY ANOVA - Statistical Significance');
console.log('='.repeat(80));

// Prepare data for ANOVA
const outcomes = events.map(e => e.converted ? 1 : 0);
const factor1 = events.map(e => e.buttonColor);
const factor2 = events.map(e => e.buttonText);

const anovaResult = twoWayAnova(
  outcomes,
  factor1,
  factor2,
  0.05
);

console.log('\nTwo-Way ANOVA Results:');
console.log(`\nMain Effect - Button Color:`);
console.log(`  F-statistic: ${anovaResult.mainEffect1.fStatistic.toFixed(4)}`);
console.log(`  P-value: ${anovaResult.mainEffect1.pValue.toFixed(6)}`);
console.log(`  Significant: ${anovaResult.mainEffect1.significant ? 'YES ✓' : 'NO ✗'}`);

console.log(`\nMain Effect - Button Text:`);
console.log(`  F-statistic: ${anovaResult.mainEffect2.fStatistic.toFixed(4)}`);
console.log(`  P-value: ${anovaResult.mainEffect2.pValue.toFixed(6)}`);
console.log(`  Significant: ${anovaResult.mainEffect2.significant ? 'YES ✓' : 'NO ✗'}`);

console.log(`\nInteraction Effect (Color × Text):`);
console.log(`  F-statistic: ${anovaResult.interaction.fStatistic.toFixed(4)}`);
console.log(`  P-value: ${anovaResult.interaction.pValue.toFixed(6)}`);
console.log(`  Significant: ${anovaResult.interaction.significant ? 'YES ✓' : 'NO ✗'}`);

// ============================================================================
// Step 10: Recommendation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));

const bestCombination = cellData.reduce((best, cell) =>
  cell.conversionRate > best.conversionRate ? cell : best
);

console.log(`\nBest Performing Combination:`);
console.log(`  ${bestCombination.buttonColor} button with "${bestCombination.buttonText}" text`);
console.log(`  Conversion Rate: ${(bestCombination.conversionRate * 100).toFixed(2)}%`);
console.log(`  Lift over baseline: ${(((bestCombination.conversionRate - baselineRate) / baselineRate) * 100).toFixed(1)}%`);

if (anovaResult.interaction.significant) {
  console.log(`
✓ RECOMMENDATION: Deploy the FULL combination (${bestCombination.buttonColor} + ${bestCombination.buttonText})

  The significant interaction effect means these factors work better TOGETHER than separately.
  Deploying only one factor would miss out on the synergy.

  Key Insights:
  1. Both factors independently improve conversion
  2. Combining them creates additional lift beyond additive effects
  3. Maximum benefit achieved with full combination
  `);
} else {
  console.log(`
✓ RECOMMENDATION: Deploy both changes

  No significant interaction detected, meaning the factors work independently.
  You can deploy them together or separately and expect similar total lift.

  Key Insights:
  1. Color change: ${((greenConversionRate - blueConversionRate) / blueConversionRate * 100).toFixed(1)}% lift
  2. Text change: ${((getStartedConversionRate - buyNowConversionRate) / buyNowConversionRate * 100).toFixed(1)}% lift
  3. Total expected lift: Sum of individual effects
  `);
}

// ============================================================================
// Step 11: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Factorial Design');
console.log('='.repeat(80));

console.log(`
1. Efficiency: Test multiple factors with the same sample size as testing
   each factor separately in sequential experiments.

2. Main Effects: The average effect of one factor across all levels of
   other factors. Useful for understanding each factor's contribution.

3. Interaction Effects: When factors combine in non-additive ways. This is
   the unique insight factorial designs provide!

4. Power Considerations: Interaction effects typically require 4× more
   sample size than main effects. Plan accordingly.

5. Interpretation Priority:
   - If interaction is significant: Interpret combinations, not main effects
   - If no interaction: Main effects are interpretable independently

6. Practical Applications:
   - UI design: color + text + layout
   - Pricing: price level + payment plan + discount
   - Recommendations: algorithm + presentation + timing

7. Extensions: Can extend to 3+ factors (2×2×2), but complexity grows fast.
   Consider fractional factorial designs for many factors.
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  assignUser,
  cellData,
  anovaResult,
  interactionEffect,
};
