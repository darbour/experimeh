/**
 * Example 03: Switchback Experiment
 *
 * This example demonstrates a switchback (time-based) experiment for marketplace scenarios.
 * Use case: Testing surge pricing algorithm in a rideshare marketplace.
 *
 * Switchback experiments are useful when:
 * - Network effects exist (one user's treatment affects others)
 * - Spillover effects are present
 * - Geographic or temporal clustering makes sense
 * - You want to compare time periods rather than individual units
 *
 * In this example:
 * - Switch between control and treatment pricing algorithms every hour
 * - Measure both driver and rider metrics
 * - Account for temporal patterns (day of week, time of day)
 * - Handle interference between users in the marketplace
 *
 * Run: npx ts-node examples/03-switchback-experiment.ts
 */

import { tTest, pairedTTest } from '../src/analysis/statistical-tests';

// ============================================================================
// Step 1: Define Switchback Experiment
// ============================================================================

interface SwitchbackExperiment {
  id: string;
  name: string;
  switchbackPeriodMinutes: number;
  variants: Array<{
    key: string;
    name: string;
    description: string;
  }>;
}

const experiment: SwitchbackExperiment = {
  id: 'surge-pricing-v2',
  name: 'Dynamic Surge Pricing Algorithm V2',
  switchbackPeriodMinutes: 60, // Switch every hour
  variants: [
    {
      key: 'control',
      name: 'Current Algorithm',
      description: 'Fixed surge multipliers based on demand/supply ratio',
    },
    {
      key: 'treatment',
      name: 'ML-based Dynamic Pricing',
      description: 'Machine learning model predicting optimal pricing in real-time',
    },
  ],
};

console.log('='.repeat(80));
console.log('SWITCHBACK EXPERIMENT EXAMPLE');
console.log('='.repeat(80));
console.log(`\nExperiment: ${experiment.name}`);
console.log(`ID: ${experiment.id}`);
console.log(`Switchback Period: ${experiment.switchbackPeriodMinutes} minutes`);
console.log('\nVariants:');
experiment.variants.forEach(v => {
  console.log(`  ${v.key}: ${v.name}`);
  console.log(`    ${v.description}`);
});

// ============================================================================
// Step 2: Switchback Assignment Logic
// ============================================================================

/**
 * Assign variant based on time period
 * All users in the same time period get the same variant
 */
function getVariantForTime(timestamp: Date, experiment: SwitchbackExperiment): string {
  // Calculate which switchback period this timestamp falls into
  const millisPerPeriod = experiment.switchbackPeriodMinutes * 60 * 1000;
  const periodsSinceEpoch = Math.floor(timestamp.getTime() / millisPerPeriod);

  // Alternate between control and treatment
  return periodsSinceEpoch % 2 === 0 ? 'control' : 'treatment';
}

console.log('\n' + '='.repeat(80));
console.log('SWITCHBACK PATTERN');
console.log('='.repeat(80));

// Show example switchback pattern
const startDate = new Date('2024-01-15T00:00:00Z');
console.log('\nExample Schedule (24 hours):');
console.log('Time Period              | Variant');
console.log('-'.repeat(45));

for (let hour = 0; hour < 24; hour += 2) {
  const time = new Date(startDate.getTime() + hour * 60 * 60 * 1000);
  const variant = getVariantForTime(time, experiment);
  const timeStr = time.toISOString().substring(11, 16);

  console.log(`${timeStr} - ${(hour + 2).toString().padStart(2, '0')}:00 UTC      | ${variant}`);
}

// ============================================================================
// Step 3: Simulate Marketplace Events
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING MARKETPLACE EVENTS');
console.log('='.repeat(80));

interface RideRequest {
  timestamp: Date;
  variant: string;
  requestId: string;
  matched: boolean; // Did a driver accept?
  waitTimeMinutes?: number;
  rideCompleted: boolean;
  surgeMultiplier?: number;
  fare?: number;
  driverEarnings?: number;
  riderRating?: number;
  driverRating?: number;
}

const rides: RideRequest[] = [];

// Simulate 7 days of data
const experimentStart = new Date('2024-01-15T00:00:00Z');
const daysToSimulate = 7;
const ridesPerHour = 100;

console.log(`\nSimulating ${daysToSimulate} days of rideshare data...`);
console.log(`Average rides per hour: ${ridesPerHour}`);

for (let day = 0; day < daysToSimulate; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(
      experimentStart.getTime() + (day * 24 + hour) * 60 * 60 * 1000
    );

    // Vary rides per hour based on time of day (more during commute hours)
    const hourlyDemandMultiplier = getHourlyDemandMultiplier(hour);
    const ridesThisHour = Math.round(ridesPerHour * hourlyDemandMultiplier);

    const variant = getVariantForTime(hourStart, experiment);

    // Generate rides for this hour
    for (let i = 0; i < ridesThisHour; i++) {
      const minuteOffset = Math.random() * 60;
      const timestamp = new Date(hourStart.getTime() + minuteOffset * 60 * 1000);

      // Simulate ride outcomes based on variant
      const outcome = simulateRide(variant, hour, hourlyDemandMultiplier);

      rides.push({
        timestamp,
        variant,
        requestId: `ride_${day}_${hour}_${i}`,
        ...outcome,
      });
    }
  }
}

console.log(`Generated ${rides.length.toLocaleString()} ride requests`);

/**
 * Get demand multiplier based on hour of day
 */
function getHourlyDemandMultiplier(hour: number): number {
  // Morning rush: 7-9 AM
  if (hour >= 7 && hour <= 9) return 1.8;
  // Evening rush: 5-7 PM
  if (hour >= 17 && hour <= 19) return 2.0;
  // Late night: 12 AM - 5 AM
  if (hour >= 0 && hour <= 5) return 0.4;
  // Daytime
  return 1.0;
}

/**
 * Simulate a ride outcome
 */
function simulateRide(variant: string, hour: number, demandMultiplier: number) {
  // Treatment algorithm is better at matching and pricing
  const matchRate = variant === 'control' ? 0.85 : 0.88;
  const matched = Math.random() < matchRate;

  if (!matched) {
    return {
      matched: false,
      rideCompleted: false,
    };
  }

  // Wait time (treatment reduces wait time slightly)
  const baseWaitTime = 5 + Math.random() * 10;
  const waitTimeReduction = variant === 'treatment' ? 0.8 : 1.0;
  const waitTimeMinutes = baseWaitTime * waitTimeReduction;

  // Surge multiplier calculation
  let surgeMultiplier = 1.0;
  if (demandMultiplier > 1.5) {
    // High demand - apply surge
    if (variant === 'control') {
      // Control: Fixed surge tiers (1.0, 1.5, 2.0, 2.5)
      surgeMultiplier = demandMultiplier > 1.8 ? 2.0 : 1.5;
    } else {
      // Treatment: Dynamic surge (smoother, more optimal)
      surgeMultiplier = 1.0 + (demandMultiplier - 1.0) * 0.6;
    }
  }

  // Base fare
  const baseFare = 10 + Math.random() * 20;
  const fare = baseFare * surgeMultiplier;
  const driverEarnings = fare * 0.75; // Driver gets 75%

  // Completion rate (high surge reduces completion)
  const completionRate = Math.max(0.7, 0.95 - (surgeMultiplier - 1.0) * 0.15);
  const rideCompleted = Math.random() < completionRate;

  if (!rideCompleted) {
    return {
      matched: true,
      waitTimeMinutes,
      surgeMultiplier,
      rideCompleted: false,
    };
  }

  // Ratings (treatment provides better experience)
  const riderRating = variant === 'treatment'
    ? 4.5 + Math.random() * 0.5
    : 4.3 + Math.random() * 0.7;

  const driverRating = 4.6 + Math.random() * 0.4;

  return {
    matched: true,
    waitTimeMinutes,
    surgeMultiplier,
    fare,
    driverEarnings,
    rideCompleted: true,
    riderRating,
    driverRating,
  };
}

// ============================================================================
// Step 4: Aggregate by Switchback Period
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('AGGREGATING BY SWITCHBACK PERIOD');
console.log('='.repeat(80));

interface PeriodMetrics {
  periodStart: Date;
  variant: string;
  hour: number;
  dayOfWeek: number;
  totalRequests: number;
  matchedRequests: number;
  completedRides: number;
  matchRate: number;
  completionRate: number;
  avgWaitTime: number;
  avgSurgeMultiplier: number;
  avgFare: number;
  totalRevenue: number;
  avgDriverEarnings: number;
  avgRiderRating: number;
}

// Group rides by switchback period
const periodGroups = new Map<string, RideRequest[]>();

rides.forEach(ride => {
  const periodKey = Math.floor(
    ride.timestamp.getTime() / (experiment.switchbackPeriodMinutes * 60 * 1000)
  ).toString();

  if (!periodGroups.has(periodKey)) {
    periodGroups.set(periodKey, []);
  }
  periodGroups.get(periodKey)!.push(ride);
});

const periodMetrics: PeriodMetrics[] = Array.from(periodGroups.entries()).map(
  ([periodKey, periodRides]) => {
    const periodStart = periodRides[0].timestamp;
    const variant = periodRides[0].variant;

    const matchedRides = periodRides.filter(r => r.matched);
    const completedRides = periodRides.filter(r => r.rideCompleted);

    const matchRate = matchedRides.length / periodRides.length;
    const completionRate = completedRides.length / matchedRides.length;

    const avgWaitTime =
      matchedRides.reduce((sum, r) => sum + (r.waitTimeMinutes || 0), 0) / matchedRides.length;

    const avgSurgeMultiplier =
      completedRides.reduce((sum, r) => sum + (r.surgeMultiplier || 1), 0) / completedRides.length;

    const avgFare =
      completedRides.reduce((sum, r) => sum + (r.fare || 0), 0) / completedRides.length;

    const totalRevenue = completedRides.reduce((sum, r) => sum + (r.fare || 0), 0);

    const avgDriverEarnings =
      completedRides.reduce((sum, r) => sum + (r.driverEarnings || 0), 0) / completedRides.length;

    const avgRiderRating =
      completedRides.reduce((sum, r) => sum + (r.riderRating || 0), 0) / completedRides.length;

    return {
      periodStart,
      variant,
      hour: periodStart.getUTCHours(),
      dayOfWeek: periodStart.getUTCDay(),
      totalRequests: periodRides.length,
      matchedRequests: matchedRides.length,
      completedRides: completedRides.length,
      matchRate,
      completionRate,
      avgWaitTime,
      avgSurgeMultiplier,
      avgFare,
      totalRevenue,
      avgDriverEarnings,
      avgRiderRating,
    };
  }
);

console.log(`\nAggregated into ${periodMetrics.length} switchback periods`);

// ============================================================================
// Step 5: Analyze Results - Paired Comparison
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SWITCHBACK ANALYSIS - Paired Comparison');
console.log('='.repeat(80));

console.log(`
Switchback experiments use PAIRED analysis because each time period serves
as its own control. We match periods by:
- Hour of day
- Day of week
to account for temporal patterns.
`);

// Create matched pairs by hour and day of week
interface MatchedPair {
  hour: number;
  dayOfWeek: number;
  controlMetrics: PeriodMetrics;
  treatmentMetrics: PeriodMetrics;
}

const matchedPairs: MatchedPair[] = [];

// Group by hour and day of week
const hourDayGroups = new Map<string, PeriodMetrics[]>();
periodMetrics.forEach(pm => {
  const key = `${pm.hour}_${pm.dayOfWeek}`;
  if (!hourDayGroups.has(key)) {
    hourDayGroups.set(key, []);
  }
  hourDayGroups.get(key)!.push(pm);
});

// Create pairs
hourDayGroups.forEach((periods, key) => {
  const controlPeriods = periods.filter(p => p.variant === 'control');
  const treatmentPeriods = periods.filter(p => p.variant === 'treatment');

  // Pair them up (take minimum to ensure balanced pairs)
  const numPairs = Math.min(controlPeriods.length, treatmentPeriods.length);

  for (let i = 0; i < numPairs; i++) {
    matchedPairs.push({
      hour: controlPeriods[i].hour,
      dayOfWeek: controlPeriods[i].dayOfWeek,
      controlMetrics: controlPeriods[i],
      treatmentMetrics: treatmentPeriods[i],
    });
  }
});

console.log(`Created ${matchedPairs.length} matched pairs`);

// ============================================================================
// Step 6: Paired T-Test on Key Metrics
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STATISTICAL TESTS - Paired Comparison');
console.log('='.repeat(80));

// Match Rate
const controlMatchRates = matchedPairs.map(p => p.controlMetrics.matchRate * 100);
const treatmentMatchRates = matchedPairs.map(p => p.treatmentMetrics.matchRate * 100);

const matchRateTest = pairedTTest(controlMatchRates, treatmentMatchRates, 0.05);

console.log('\n1. MATCH RATE');
console.log(`   Control: ${matchRateTest.mean1.toFixed(2)}%`);
console.log(`   Treatment: ${matchRateTest.mean2.toFixed(2)}%`);
console.log(`   Difference: ${(matchRateTest.mean2 - matchRateTest.mean1).toFixed(2)}%`);
console.log(`   P-value: ${matchRateTest.pValue.toFixed(6)}`);
console.log(`   Significant: ${matchRateTest.significant ? 'YES ✓' : 'NO ✗'}`);

// Wait Time
const controlWaitTimes = matchedPairs.map(p => p.controlMetrics.avgWaitTime);
const treatmentWaitTimes = matchedPairs.map(p => p.treatmentMetrics.avgWaitTime);

const waitTimeTest = pairedTTest(controlWaitTimes, treatmentWaitTimes, 0.05);

console.log('\n2. WAIT TIME (minutes)');
console.log(`   Control: ${waitTimeTest.mean1.toFixed(2)}`);
console.log(`   Treatment: ${waitTimeTest.mean2.toFixed(2)}`);
console.log(`   Difference: ${(waitTimeTest.mean2 - waitTimeTest.mean1).toFixed(2)} minutes`);
console.log(`   Improvement: ${(((waitTimeTest.mean1 - waitTimeTest.mean2) / waitTimeTest.mean1) * 100).toFixed(1)}%`);
console.log(`   P-value: ${waitTimeTest.pValue.toFixed(6)}`);
console.log(`   Significant: ${waitTimeTest.significant ? 'YES ✓' : 'NO ✗'}`);

// Revenue per Period
const controlRevenues = matchedPairs.map(p => p.controlMetrics.totalRevenue);
const treatmentRevenues = matchedPairs.map(p => p.treatmentMetrics.totalRevenue);

const revenueTest = pairedTTest(controlRevenues, treatmentRevenues, 0.05);

console.log('\n3. REVENUE PER PERIOD');
console.log(`   Control: $${revenueTest.mean1.toFixed(2)}`);
console.log(`   Treatment: $${revenueTest.mean2.toFixed(2)}`);
console.log(`   Difference: $${(revenueTest.mean2 - revenueTest.mean1).toFixed(2)}`);
console.log(`   Improvement: ${(((revenueTest.mean2 - revenueTest.mean1) / revenueTest.mean1) * 100).toFixed(1)}%`);
console.log(`   P-value: ${revenueTest.pValue.toFixed(6)}`);
console.log(`   Significant: ${revenueTest.significant ? 'YES ✓' : 'NO ✗'}`);

// Rider Rating
const controlRatings = matchedPairs.map(p => p.controlMetrics.avgRiderRating);
const treatmentRatings = matchedPairs.map(p => p.treatmentMetrics.avgRiderRating);

const ratingTest = pairedTTest(controlRatings, treatmentRatings, 0.05);

console.log('\n4. RIDER SATISFACTION (rating)');
console.log(`   Control: ${ratingTest.mean1.toFixed(3)}`);
console.log(`   Treatment: ${ratingTest.mean2.toFixed(3)}`);
console.log(`   Difference: ${(ratingTest.mean2 - ratingTest.mean1).toFixed(3)}`);
console.log(`   P-value: ${ratingTest.pValue.toFixed(6)}`);
console.log(`   Significant: ${ratingTest.significant ? 'YES ✓' : 'NO ✗'}`);

// ============================================================================
// Step 7: Temporal Pattern Analysis
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('TEMPORAL PATTERN ANALYSIS');
console.log('='.repeat(80));

// Analyze by hour of day
const hourlyResults = new Map<number, { control: PeriodMetrics[], treatment: PeriodMetrics[] }>();

for (let hour = 0; hour < 24; hour++) {
  hourlyResults.set(hour, {
    control: periodMetrics.filter(pm => pm.hour === hour && pm.variant === 'control'),
    treatment: periodMetrics.filter(pm => pm.hour === hour && pm.variant === 'treatment'),
  });
}

console.log('\nMatch Rate by Hour of Day:');
console.log('Hour | Control | Treatment | Lift');
console.log('-'.repeat(45));

for (let hour = 0; hour < 24; hour++) {
  const results = hourlyResults.get(hour)!;
  if (results.control.length === 0 || results.treatment.length === 0) continue;

  const controlAvg =
    results.control.reduce((sum, pm) => sum + pm.matchRate, 0) / results.control.length;
  const treatmentAvg =
    results.treatment.reduce((sum, pm) => sum + pm.matchRate, 0) / results.treatment.length;
  const lift = ((treatmentAvg - controlAvg) / controlAvg) * 100;

  console.log(
    `${hour.toString().padStart(4)}h | ${(controlAvg * 100).toFixed(1)}%  | ${(treatmentAvg * 100).toFixed(1)}%      | ${lift >= 0 ? '+' : ''}${lift.toFixed(1)}%`
  );
}

// ============================================================================
// Step 8: Recommendation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));

const significantImprovements = [
  { metric: 'Match Rate', significant: matchRateTest.significant, positive: matchRateTest.mean2 > matchRateTest.mean1 },
  { metric: 'Wait Time', significant: waitTimeTest.significant, positive: waitTimeTest.mean2 < waitTimeTest.mean1 },
  { metric: 'Revenue', significant: revenueTest.significant, positive: revenueTest.mean2 > revenueTest.mean1 },
  { metric: 'Satisfaction', significant: ratingTest.significant, positive: ratingTest.mean2 > ratingTest.mean1 },
];

const positiveSignificant = significantImprovements.filter(i => i.significant && i.positive);

console.log('\nSignificant Improvements:');
positiveSignificant.forEach(i => {
  console.log(`  ✓ ${i.metric}`);
});

if (positiveSignificant.length >= 3) {
  console.log('\n✓ RECOMMENDATION: ROLL OUT NEW ALGORITHM');
  console.log(`
  The new dynamic pricing algorithm shows significant improvements across
  ${positiveSignificant.length} out of 4 key metrics.

  Expected Impact:
  - ${((matchRateTest.mean2 - matchRateTest.mean1) / matchRateTest.mean1 * 100).toFixed(1)}% improvement in match rate
  - ${((waitTimeTest.mean1 - waitTimeTest.mean2) / waitTimeTest.mean1 * 100).toFixed(1)}% reduction in wait time
  - ${((revenueTest.mean2 - revenueTest.mean1) / revenueTest.mean1 * 100).toFixed(1)}% increase in revenue

  The improvements are consistent across different times of day, indicating
  the algorithm performs well under various demand conditions.
  `);
} else {
  console.log('\n⚠ RECOMMENDATION: FURTHER INVESTIGATION NEEDED');
  console.log('  Results are mixed. Consider running the experiment longer or analyzing specific use cases.');
}

// ============================================================================
// Step 9: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Switchback Experiments');
console.log('='.repeat(80));

console.log(`
1. When to Use Switchback:
   - Marketplace/network effects (Uber, Airbnb, Doordash)
   - Geographic spillover (one user affects another)
   - Infrastructure changes (server configs, algorithms)
   - Temporal clustering makes sense

2. Design Principles:
   - Switch period: Balance noise reduction vs. contamination
   - Too short: High variance, contamination between periods
   - Too long: Fewer observations, temporal confounding
   - Typical: 15 minutes to 4 hours depending on domain

3. Analysis Method:
   - Use PAIRED t-tests, not independent samples
   - Match periods by time-of-day, day-of-week
   - Account for temporal patterns and seasonality
   - Check for carryover effects between periods

4. Advantages:
   - Handles network effects and spillover
   - More statistical power than between-subjects
   - Can measure marketplace-level metrics
   - Natural for geographic or temporal clustering

5. Challenges:
   - Carryover effects (treatment affects next period)
   - Temporal confounding (trends over time)
   - Requires longer runtime than user-level randomization
   - More complex analysis

6. Best Practices:
   - Randomize which variant starts first
   - Run for multiple complete cycles (days/weeks)
   - Monitor for time trends
   - Consider washout periods if carryover is concern
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  getVariantForTime,
  periodMetrics,
  matchedPairs,
  matchRateTest,
  revenueTest,
};
