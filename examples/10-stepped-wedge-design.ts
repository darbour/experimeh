/**
 * Example 10: Stepped Wedge Design
 *
 * This example demonstrates a stepped wedge cluster-randomized trial.
 * Use case: Hospital hand hygiene protocol rollout across multiple facilities.
 *
 * Stepped wedge designs are ideal when:
 * - All clusters should eventually receive the intervention (ethical/practical reasons)
 * - Logistical constraints prevent simultaneous rollout
 * - Cluster-level intervention (hospitals, schools, regions)
 * - Strong time trends are expected
 * - You want to control for secular trends
 *
 * In this example:
 * - 20 hospitals implementing a new hand hygiene protocol
 * - 5 time steps (each step = 3 months)
 * - All hospitals start in control, systematically switch to treatment
 * - Randomize the ORDER of switching, not the timing
 * - Measure hand hygiene compliance rates
 * - Account for time trends and cluster effects
 *
 * Run: npx ts-node examples/10-stepped-wedge-design.ts
 */

import { twoSampleTTest, multipleRegression } from '../src/analysis/statistical-tests';

// ============================================================================
// Step 1: Define Stepped Wedge Experiment
// ============================================================================

interface SteppedWedgeConfig {
  id: string;
  name: string;
  numClusters: number;
  numSteps: number;
  stepDurationDays: number;
  clusters: string[];
}

const experiment: SteppedWedgeConfig = {
  id: 'hand-hygiene-protocol',
  name: 'Hand Hygiene Protocol Rollout',
  numClusters: 20,
  numSteps: 5,
  stepDurationDays: 90, // 3 months per step
  clusters: Array.from({ length: 20 }, (_, i) => `hospital_${String(i + 1).padStart(2, '0')}`),
};

console.log('='.repeat(80));
console.log('STEPPED WEDGE DESIGN EXAMPLE');
console.log('='.repeat(80));
console.log(`\nExperiment: ${experiment.name}`);
console.log(`ID: ${experiment.id}`);
console.log(`Clusters: ${experiment.numClusters} hospitals`);
console.log(`Time Steps: ${experiment.numSteps} (${experiment.stepDurationDays} days each)`);
console.log(`Total Duration: ${experiment.numSteps * experiment.stepDurationDays} days (~${(experiment.numSteps * experiment.stepDurationDays / 30).toFixed(1)} months)`);

console.log('\nKey Characteristics:');
console.log('  ✓ All hospitals start in CONTROL');
console.log('  ✓ At each step, some hospitals switch to TREATMENT');
console.log('  ✓ Switches are UNIDIRECTIONAL (no switching back)');
console.log('  ✓ ORDER of switching is randomized');
console.log('  ✓ By the end, all hospitals are in TREATMENT');

// ============================================================================
// Step 2: Generate Randomized Switching Schedule
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('GENERATING SWITCHING SCHEDULE');
console.log('='.repeat(80));

interface SteppedWedgeSchedule {
  clusterToStep: Map<string, number>;
  stepToClusters: Map<number, string[]>;
}

/**
 * Generate a balanced stepped wedge schedule
 * Randomizes which clusters switch at each step
 */
function generateSteppedWedgeSchedule(
  clusters: string[],
  numSteps: number,
  seed: string
): SteppedWedgeSchedule {
  // Use seed for deterministic randomization
  const rng = seededRandom(seed);

  // Shuffle clusters
  const shuffled = [...clusters].sort(() => rng() - 0.5);

  // Distribute clusters evenly across steps (steps 1 to numSteps-1)
  // Step 0: All in control
  // Step numSteps: All in treatment (last cluster switches)
  const clustersPerStep = Math.ceil(clusters.length / (numSteps - 1));

  const clusterToStep = new Map<string, number>();
  const stepToClusters = new Map<number, string[]>();

  // Initialize all steps
  for (let step = 0; step < numSteps; step++) {
    stepToClusters.set(step, []);
  }

  // Assign clusters to switching steps (1 through numSteps-1)
  shuffled.forEach((cluster, index) => {
    const switchStep = Math.min(
      Math.floor(index / clustersPerStep) + 1,
      numSteps - 1
    );
    clusterToStep.set(cluster, switchStep);
    stepToClusters.get(switchStep)!.push(cluster);
  });

  return { clusterToStep, stepToClusters };
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: string): () => number {
  let value = 0;
  for (let i = 0; i < seed.length; i++) {
    value = (value * 31 + seed.charCodeAt(i)) % 2147483647;
  }

  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

const schedule = generateSteppedWedgeSchedule(
  experiment.clusters,
  experiment.numSteps,
  experiment.id
);

console.log('\nRandomized Switching Schedule:');
for (let step = 1; step < experiment.numSteps; step++) {
  const clusters = schedule.stepToClusters.get(step) || [];
  console.log(`\nStep ${step} (Days ${(step - 1) * experiment.stepDurationDays + 1}-${step * experiment.stepDurationDays}):`);
  console.log(`  ${clusters.length} hospitals switch to TREATMENT`);
  console.log(`  → ${clusters.join(', ')}`);
}

// ============================================================================
// Step 3: Visualize Schedule as ASCII Table
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STEPPED WEDGE SCHEDULE VISUALIZATION');
console.log('='.repeat(80));

function displayScheduleTable(
  clusters: string[],
  schedule: SteppedWedgeSchedule,
  numSteps: number
) {
  console.log('\nC = Control, T = Treatment\n');

  // Header
  const header = 'Hospital'.padEnd(15) + ' │ ' +
    Array.from({ length: numSteps }, (_, i) => `Step ${i}`).join(' │ ');
  console.log(header);
  console.log('─'.repeat(header.length));

  // Rows for each cluster
  clusters.slice(0, 10).forEach(cluster => {
    const switchStep = schedule.clusterToStep.get(cluster)!;
    const row = cluster.padEnd(15) + ' │ ' +
      Array.from({ length: numSteps }, (_, step) => {
        const status = step >= switchStep ? ' T  ' : ' C  ';
        return status;
      }).join(' │ ');
    console.log(row);
  });

  console.log('... (showing first 10 hospitals)');

  // Summary row
  console.log('\nTreatment Coverage by Step:');
  for (let step = 0; step < numSteps; step++) {
    const inTreatment = clusters.filter(c =>
      schedule.clusterToStep.get(c)! <= step
    ).length;
    const percentage = (inTreatment / clusters.length * 100).toFixed(0);
    console.log(`  Step ${step}: ${inTreatment}/${clusters.length} hospitals (${percentage}%)`);
  }
}

displayScheduleTable(experiment.clusters, schedule, experiment.numSteps);

// ============================================================================
// Step 4: Simulate Data Collection
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING DATA COLLECTION');
console.log('='.repeat(80));

interface Observation {
  hospital: string;
  step: number;
  dayInStudy: number;
  condition: 'control' | 'treatment';
  complianceRate: number; // Percentage (0-100)
}

/**
 * Simulate hand hygiene compliance data
 *
 * Effects to model:
 * - Treatment effect: ~12% absolute improvement
 * - Time trend: Natural improvement over time (~0.5% per step)
 * - Cluster effect: Each hospital has baseline variation
 * - Random noise: Measurement variability
 */
function simulateSteppedWedgeData(
  clusters: string[],
  schedule: SteppedWedgeSchedule,
  numSteps: number,
  stepDurationDays: number
): Observation[] {
  const observations: Observation[] = [];

  // Generate random baseline for each hospital (55-65% compliance)
  const hospitalBaselines = new Map<string, number>();
  clusters.forEach(hospital => {
    hospitalBaselines.set(hospital, 55 + Math.random() * 10);
  });

  // Parameters
  const treatmentEffect = 12; // 12% absolute improvement
  const timeEffect = 0.5; // 0.5% improvement per step (secular trend)
  const measurementNoise = 3; // Standard deviation of measurement error

  // Collect data at each step for each hospital
  for (let step = 0; step < numSteps; step++) {
    const dayInStudy = step * stepDurationDays + Math.floor(stepDurationDays / 2);

    clusters.forEach(hospital => {
      const switchStep = schedule.clusterToStep.get(hospital)!;
      const condition = step >= switchStep ? 'treatment' : 'control';

      // Calculate expected compliance
      const baseline = hospitalBaselines.get(hospital)!;
      const timeImprovement = timeEffect * step;
      const treatmentImprovement = condition === 'treatment' ? treatmentEffect : 0;

      // Add random noise (normal distribution approximation)
      const noise = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * measurementNoise;

      const complianceRate = Math.min(100, Math.max(0,
        baseline + timeImprovement + treatmentImprovement + noise
      ));

      observations.push({
        hospital,
        step,
        dayInStudy,
        condition,
        complianceRate,
      });
    });
  }

  return observations;
}

const observations = simulateSteppedWedgeData(
  experiment.clusters,
  schedule,
  experiment.numSteps,
  experiment.stepDurationDays
);

console.log(`\nGenerated ${observations.length} observations`);
console.log(`  (${experiment.numClusters} hospitals × ${experiment.numSteps} time steps)`);

// Show sample data
console.log('\nSample Data (first hospital across all steps):');
console.log('Step │ Day │ Condition │ Compliance');
console.log('─'.repeat(45));
const firstHospital = experiment.clusters[0];
observations
  .filter(obs => obs.hospital === firstHospital)
  .forEach(obs => {
    console.log(
      `  ${obs.step}  │ ${String(obs.dayInStudy).padStart(3)} │ ${obs.condition.padEnd(9)} │ ${obs.complianceRate.toFixed(1)}%`
    );
  });

// ============================================================================
// Step 5: Calculate Summary Statistics
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SUMMARY STATISTICS BY CONDITION');
console.log('='.repeat(80));

const controlObs = observations.filter(obs => obs.condition === 'control');
const treatmentObs = observations.filter(obs => obs.condition === 'treatment');

const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
const std = (arr: number[]) => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1));
};

const controlRates = controlObs.map(o => o.complianceRate);
const treatmentRates = treatmentObs.map(o => o.complianceRate);

console.log('\nControl Condition:');
console.log(`  Observations: ${controlObs.length}`);
console.log(`  Mean compliance: ${mean(controlRates).toFixed(2)}%`);
console.log(`  Std deviation: ${std(controlRates).toFixed(2)}%`);
console.log(`  Range: ${Math.min(...controlRates).toFixed(1)}% - ${Math.max(...controlRates).toFixed(1)}%`);

console.log('\nTreatment Condition:');
console.log(`  Observations: ${treatmentObs.length}`);
console.log(`  Mean compliance: ${mean(treatmentRates).toFixed(2)}%`);
console.log(`  Std deviation: ${std(treatmentRates).toFixed(2)}%`);
console.log(`  Range: ${Math.min(...treatmentRates).toFixed(1)}% - ${Math.max(...treatmentRates).toFixed(1)}%`);

console.log('\nRaw Difference:');
console.log(`  ${(mean(treatmentRates) - mean(controlRates)).toFixed(2)}% improvement`);
console.log('  (Note: This is confounded with time trends!)');

// ============================================================================
// Step 6: Naive Analysis (WRONG - Ignores Time and Clustering)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('NAIVE ANALYSIS - Simple t-test (INCORRECT)');
console.log('='.repeat(80));

console.log('\n⚠️  WARNING: This analysis is WRONG for stepped wedge designs!');
console.log('   It ignores:');
console.log('   - Time trends (secular changes)');
console.log('   - Cluster correlation (ICC)');
console.log('   - Unbalanced exposure periods\n');

const naiveTest = twoSampleTTest(controlRates, treatmentRates, 0.05);

console.log('Naive t-test Results:');
console.log(`  Control mean: ${naiveTest.mean1.toFixed(2)}%`);
console.log(`  Treatment mean: ${naiveTest.mean2.toFixed(2)}%`);
console.log(`  Difference: ${(naiveTest.mean2 - naiveTest.mean1).toFixed(2)}%`);
console.log(`  P-value: ${naiveTest.pValue.toFixed(6)}`);
console.log(`  Significant: ${naiveTest.significant ? 'YES' : 'NO'}`);

console.log('\n❌ This overstates the treatment effect by including time trends!');
console.log('   Proper analysis must adjust for step (time) effects.');

// ============================================================================
// Step 7: Proper Analysis with Time Trend Adjustment
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PROPER ANALYSIS - Regression with Time Adjustment');
console.log('='.repeat(80));

console.log('\nModel: Compliance = β₀ + β₁(Treatment) + β₂(Step) + ε');
console.log('  β₁ = Treatment effect (controlling for time)');
console.log('  β₂ = Time trend effect');

// Prepare regression data
const Y = observations.map(obs => obs.complianceRate);
const X = observations.map(obs => [
  1, // Intercept
  obs.condition === 'treatment' ? 1 : 0, // Treatment indicator
  obs.step, // Time step
]);

const regression = multipleRegression(Y, X, ['Intercept', 'Treatment', 'Step'], 0.05);

console.log('\nRegression Results:');
console.log('──────────────────────────────────────────────────────');
console.log('Variable    │ Coefficient │   SE    │ t-stat │ p-value');
console.log('──────────────────────────────────────────────────────');

const vars = ['Intercept', 'Treatment', 'Step'];
vars.forEach(v => {
  console.log(
    `${v.padEnd(12)}│ ${regression.coefficients[v].toFixed(3).padStart(11)} │ ${regression.standardErrors[v].toFixed(3).padStart(7)} │ ${regression.tStatistics[v].toFixed(2).padStart(6)} │ ${regression.pValues[v].toFixed(4)}`
  );
});

console.log('──────────────────────────────────────────────────────');

console.log(`\nModel Fit:`);
console.log(`  R² = ${regression.rSquared.toFixed(4)}`);
console.log(`  Adjusted R² = ${regression.adjustedRSquared.toFixed(4)}`);
console.log(`  F-statistic = ${regression.fStatistic.toFixed(2)} (p = ${regression.fPValue.toFixed(6)})`);

// ============================================================================
// Step 8: Interpret Results
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('INTERPRETATION');
console.log('='.repeat(80));

const treatmentCoef = regression.coefficients['Treatment'];
const treatmentPValue = regression.pValues['Treatment'];
const stepCoef = regression.coefficients['Step'];

console.log('\n📊 Treatment Effect (Adjusted for Time):');
console.log(`   ${treatmentCoef.toFixed(2)}% improvement in hand hygiene compliance`);
console.log(`   P-value: ${treatmentPValue.toFixed(6)}`);
console.log(`   ${treatmentPValue < 0.05 ? '✓ Statistically significant' : '✗ Not statistically significant'}`);

console.log('\n📈 Time Trend Effect:');
console.log(`   ${stepCoef.toFixed(2)}% improvement per step (90 days)`);
console.log(`   This represents secular improvement independent of treatment`);

console.log('\n🔍 Key Insights:');
console.log(`   1. Naive analysis (${(naiveTest.mean2 - naiveTest.mean1).toFixed(2)}%) OVERESTIMATED the effect`);
console.log(`   2. After controlling for time trends, true effect is ${treatmentCoef.toFixed(2)}%`);
console.log(`   3. Time trend accounts for ${stepCoef.toFixed(2)}% × ${experiment.numSteps - 1} = ${(stepCoef * (experiment.numSteps - 1)).toFixed(2)}% improvement`);

// ============================================================================
// Step 9: Calculate Intraclass Correlation Coefficient (ICC)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('CLUSTER CORRELATION ANALYSIS - ICC');
console.log('='.repeat(80));

console.log('\nIntraclass Correlation Coefficient (ICC):');
console.log('  Measures how similar observations are within the same hospital.');
console.log('  ICC = Between-cluster variance / Total variance');

/**
 * Calculate ICC using one-way ANOVA approach
 */
function calculateICC(observations: Observation[]): number {
  // Group by cluster
  const clusterGroups = new Map<string, number[]>();
  observations.forEach(obs => {
    if (!clusterGroups.has(obs.hospital)) {
      clusterGroups.set(obs.hospital, []);
    }
    clusterGroups.get(obs.hospital)!.push(obs.complianceRate);
  });

  const k = clusterGroups.size; // Number of clusters
  const clusterSizes = Array.from(clusterGroups.values()).map(g => g.length);
  const n = clusterSizes.reduce((a, b) => a + b, 0); // Total observations

  // Grand mean
  const allValues = Array.from(clusterGroups.values()).flat();
  const grandMean = mean(allValues);

  // Cluster means
  const clusterMeans = Array.from(clusterGroups.values()).map(group => mean(group));

  // Between-cluster sum of squares
  let ssb = 0;
  Array.from(clusterGroups.values()).forEach((group, i) => {
    ssb += group.length * Math.pow(clusterMeans[i] - grandMean, 2);
  });

  // Within-cluster sum of squares
  let ssw = 0;
  Array.from(clusterGroups.values()).forEach((group, i) => {
    group.forEach(value => {
      ssw += Math.pow(value - clusterMeans[i], 2);
    });
  });

  // Degrees of freedom
  const dfb = k - 1;
  const dfw = n - k;

  // Mean squares
  const msb = ssb / dfb;
  const msw = ssw / dfw;

  // Average cluster size (for unbalanced design)
  const n0 = (n - clusterSizes.reduce((sum, ni) => sum + ni * ni, 0) / n) / (k - 1);

  // ICC
  const icc = (msb - msw) / (msb + (n0 - 1) * msw);

  return Math.max(0, icc); // ICC can't be negative
}

const icc = calculateICC(observations);

console.log(`\n  ICC = ${icc.toFixed(4)}`);

if (icc < 0.01) {
  console.log('  → Very low clustering (hospitals are independent)');
} else if (icc < 0.05) {
  console.log('  → Low clustering (some hospital-level correlation)');
} else if (icc < 0.10) {
  console.log('  → Moderate clustering (notable hospital effects)');
} else {
  console.log('  → High clustering (strong hospital-level effects)');
}

console.log('\n💡 Interpretation:');
console.log(`  ${(icc * 100).toFixed(2)}% of variance is between hospitals`);
console.log(`  ${((1 - icc) * 100).toFixed(2)}% of variance is within hospitals`);
console.log('\n  This ICC should be used for future sample size calculations');
console.log('  for cluster-randomized trials in this setting.');

// ============================================================================
// Step 10: Visualize Results by Time Step
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('COMPLIANCE TRENDS OVER TIME');
console.log('='.repeat(80));

// Calculate means by step and condition
const stepMeans = new Map<number, { control: number[], treatment: number[] }>();
for (let step = 0; step < experiment.numSteps; step++) {
  stepMeans.set(step, { control: [], treatment: [] });
}

observations.forEach(obs => {
  const stepData = stepMeans.get(obs.step)!;
  stepData[obs.condition].push(obs.complianceRate);
});

console.log('\nMean Compliance by Step:');
console.log('Step │ Control │ Treatment │ # Control │ # Treatment │ Difference');
console.log('─'.repeat(70));

for (let step = 0; step < experiment.numSteps; step++) {
  const stepData = stepMeans.get(step)!;
  const controlMean = stepData.control.length > 0 ? mean(stepData.control) : null;
  const treatmentMean = stepData.treatment.length > 0 ? mean(stepData.treatment) : null;
  const diff = (controlMean !== null && treatmentMean !== null)
    ? treatmentMean - controlMean
    : null;

  console.log(
    ` ${step}   │ ${controlMean !== null ? controlMean.toFixed(1).padStart(7) + '%' : '   -    '} │ ${treatmentMean !== null ? treatmentMean.toFixed(1).padStart(9) + '%' : '    -     '} │ ${String(stepData.control.length).padStart(9)} │ ${String(stepData.treatment.length).padStart(11)} │ ${diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%' : '   -'}`
  );
}

console.log('\nNote: Control group shrinks as hospitals switch to treatment.');

// ============================================================================
// Step 11: Advantages vs. Standard RCT
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STEPPED WEDGE vs. STANDARD PARALLEL RCT');
console.log('='.repeat(80));

console.log('\n✅ Advantages of Stepped Wedge Design:');
console.log(`
  1. Ethical: All clusters eventually receive intervention
     → Important when intervention is believed beneficial
     → Hard to justify permanent control groups

  2. Practical: Staggered rollout is often logistically necessary
     → Can't implement everywhere simultaneously
     → Allows learning and refinement during rollout

  3. Political: More acceptable to stakeholders
     → "Everyone gets it, just at different times"
     → Randomizing order is easier to justify than randomizing access

  4. Efficiency: More observations per cluster
     → Each cluster serves as its own control (before switching)
     → Can achieve adequate power with fewer clusters

  5. Controls for time: Built-in adjustment for secular trends
     → Design naturally separates treatment vs. time effects
`);

console.log('⚠️  Disadvantages of Stepped Wedge Design:');
console.log(`
  1. Requires longer duration
     → Must wait for all steps to complete
     → Longer than parallel RCT with same clusters

  2. Assumes unidirectional, sustained effect
     → Can't measure what happens if treatment is removed
     → Not suitable for interventions with carryover effects

  3. More complex analysis
     → Must account for time trends
     → Must account for clustering (ICC)
     → Requires mixed-effects or GEE models

  4. Vulnerable to time-varying confounders
     → If something else changes during study, hard to disentangle
     → External events can confound results

  5. Assumes treatment effect is constant over time
     → If effect changes with calendar time, hard to detect
`);

// ============================================================================
// Step 12: Power Analysis Considerations
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SAMPLE SIZE & POWER CONSIDERATIONS');
console.log('='.repeat(80));

console.log('\nFactors Affecting Statistical Power:');
console.log(`
  1. Number of clusters (k)
     → More clusters = more power
     → This study: ${experiment.numClusters} hospitals

  2. Number of time steps (T)
     → More steps = more observations per cluster
     → This study: ${experiment.numSteps} steps

  3. Cluster size (m)
     → Larger clusters provide more data
     → But benefit decreases as ICC increases

  4. Intraclass correlation (ICC)
     → Higher ICC = less power (observations are correlated)
     → This study: ICC = ${icc.toFixed(4)}

  5. Treatment effect size (δ)
     → Larger effects easier to detect
     → This study: ${treatmentCoef.toFixed(2)}% (${(treatmentCoef / mean(controlRates) * 100).toFixed(1)}% relative)

  6. Secular trend
     → Stronger trends can mask or mimic treatment effects
     → This study: ${stepCoef.toFixed(2)}% per step
`);

console.log('\n📐 Design Effect for Clustered Design:');
const m = observations.length / experiment.numClusters; // Avg observations per cluster
const designEffect = 1 + (m - 1) * icc;
console.log(`  Design Effect = 1 + (m - 1) × ICC`);
console.log(`               = 1 + (${m.toFixed(1)} - 1) × ${icc.toFixed(4)}`);
console.log(`               = ${designEffect.toFixed(2)}`);
console.log(`\n  → Need ${designEffect.toFixed(1)}× more observations than individual randomization`);

// ============================================================================
// Step 13: Common Pitfalls and Best Practices
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('COMMON PITFALLS & BEST PRACTICES');
console.log('='.repeat(80));

console.log('\n❌ Common Mistakes:');
console.log(`
  1. Ignoring time trends
     ❌ Comparing control vs. treatment without adjusting for step
     ✓  Use regression or mixed models with time as covariate

  2. Ignoring clustering
     ❌ Treating each observation as independent
     ✓  Account for ICC in analysis (GEE or mixed-effects models)

  3. Incomplete implementation
     ❌ Some clusters don't complete all steps
     ✓  Ensure complete data collection at each step

  4. Contamination between clusters
     ❌ Treatment "leaks" to control clusters
     ✓  Ensure clear cluster boundaries and adherence

  5. Changing intervention over time
     ❌ "Learning" causes later implementations to differ
     ✓  Standardize intervention protocol from the start
`);

console.log('\n✅ Best Practices:');
console.log(`
  1. Randomize cluster order
     → Prevents selection bias in which clusters switch when
     → Use blocked randomization for balance

  2. Pre-specify analysis plan
     → Primary outcome and adjustment variables
     → How to handle missing data

  3. Collect baseline data
     → Measure outcomes before any cluster switches
     → Enables better control for time trends

  4. Monitor fidelity
     → Ensure intervention is implemented as intended
     → Check for contamination or non-compliance

  5. Plan for appropriate analysis
     → Use mixed-effects models or GEE
     → Report ICC for future studies
     → Adjust for time and cluster effects
`);

// ============================================================================
// Step 14: When to Use Stepped Wedge Design
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('WHEN TO USE STEPPED WEDGE DESIGN');
console.log('='.repeat(80));

console.log('\n🎯 Stepped Wedge is IDEAL when:');
console.log(`
  ✓ Intervention is believed beneficial (unethical to withhold)
  ✓ Logistical constraints prevent simultaneous rollout
  ✓ Cluster-level intervention (hospitals, schools, regions)
  ✓ Sufficient time for staggered implementation
  ✓ Sustainable, unidirectional intervention effect
  ✓ Resources to implement proper analysis (mixed models)
`);

console.log('\n🚫 Stepped Wedge is NOT suitable when:');
console.log(`
  ✗ Rapid results needed (parallel RCT is faster)
  ✗ Intervention has carryover or washout period
  ✗ Treatment effect may vary with calendar time
  ✗ High risk of time-varying confounders
  ✗ Cannot ensure sustained implementation
  ✗ Clusters are very heterogeneous (high ICC)
`);

console.log('\n💡 Real-World Examples:');
console.log(`
  Healthcare:
  → Hand hygiene protocols (this example)
  → Electronic health record systems
  → New clinical guidelines or procedures

  Education:
  → New curriculum rollout across schools
  → Teacher training programs
  → Educational technology implementation

  Public Health:
  → Water sanitation interventions
  → Vaccination campaigns
  → Health promotion programs

  Policy:
  → Regulatory changes across regions
  → Social welfare programs
  → Infrastructure improvements
`);

// ============================================================================
// Step 15: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS');
console.log('='.repeat(80));

console.log(`
1. Design Characteristics:
   → All clusters start in control, switch to treatment at randomized times
   → Unidirectional switching (no reversal)
   → Randomize ORDER, not TIMING
   → Everyone eventually receives intervention

2. Analysis Requirements:
   → MUST adjust for time trends (secular changes)
   → MUST account for clustering (ICC)
   → Use mixed-effects models or GEE
   → Report both treatment and time effects

3. Statistical Power:
   → Power depends on: # clusters, # steps, cluster size, ICC
   → Design effect = 1 + (m-1)×ICC
   → Need more clusters than individual randomization
   → ICC from pilot studies crucial for planning

4. Advantages:
   → Ethical - everyone receives intervention
   → Practical - matches real-world rollout constraints
   → Efficient - within-cluster control
   → Controls for time trends by design

5. Challenges:
   → Longer duration than parallel RCT
   → Complex analysis required
   → Vulnerable to time-varying confounders
   → Assumes sustained, constant treatment effect

6. Use When:
   → Intervention believed beneficial (can't withhold)
   → Logistical constraints prevent simultaneous rollout
   → Sufficient time available
   → Cluster-level intervention
   → Sustainable implementation feasible
`);

console.log('\n' + '='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  schedule,
  observations,
  regression,
  icc,
  calculateICC,
  generateSteppedWedgeSchedule,
};
