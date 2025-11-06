# Troubleshooting Guide

Comprehensive guide to diagnosing and fixing common issues in the experimentation system.

## Table of Contents

1. [Common Errors and Solutions](#common-errors-and-solutions)
2. [Assignment Debugging](#assignment-debugging)
3. [Data Quality Issues](#data-quality-issues)
4. [Performance Optimization](#performance-optimization)
5. [Scaling Considerations](#scaling-considerations)

---

## Common Errors and Solutions

### Error: Sample Ratio Mismatch (SRM)

#### Symptoms

```
Expected: 50/50 split between control and treatment
Observed: 48/52 split
Chi-square test: p < 0.001
```

#### Root Causes

**1. Bot Traffic**

Bot filters applied unevenly:
```typescript
// Problem: Bots filtered from one group more than other
if (variant === 'treatment' && isSuspiciousUserAgent(userAgent)) {
  return;  // Don't track treatment bots, but control bots tracked
}

// Fix: Apply filtering consistently
function shouldExclude(userId: string, userAgent: string): boolean {
  return isSuspiciousUserAgent(userAgent) || isKnownBot(userId);
}

// Exclude BEFORE assignment
if (shouldExclude(userId, userAgent)) {
  return;  // Don't assign or track
}
```

**2. Page Load Failures**

Treatment variant has more JavaScript errors:
```typescript
// Problem: Treatment has bug, users bounce before tracking
try {
  if (variant === 'treatment') {
    loadHeavyFeature();  // May crash and prevent tracking
  }
  trackExposure(variant);
} catch (e) {
  // Treatment crashes, never tracked
}

// Fix: Track exposure before risky code
trackExposure(variant);
try {
  if (variant === 'treatment') {
    loadHeavyFeature();
  }
} catch (e) {
  logError(e);
}
```

**3. Caching Issues**

Variant assignment cached, exposure not:
```typescript
// Problem: Assignment cached in CDN, but user switches devices
const variantFromCache = cache.get(`experiment:${userId}`);  // May be stale

// Fix: Include device/session in cache key
const cacheKey = `experiment:${experimentId}:${userId}:${deviceId}`;
const variant = cache.get(cacheKey) || assignVariant(userId);
cache.set(cacheKey, variant, ttl);
```

**4. Time-Based Filtering**

Different attrition rates:
```typescript
// Problem: Filter inactive users, but they're unequally distributed
const activeUsers = users.filter(u => u.lastActive > Date.now() - 7days);

// Check SRM before and after filtering
const srmBefore = checkSRM(allUsers);
const srmAfter = checkSRM(activeUsers);

if (srmBefore.passed && !srmAfter.passed) {
  console.error('Filtering introduced SRM!');
  // Different attrition rates by variant
}
```

#### Diagnosis

```typescript
async function diagnoseSRM(experimentId: string) {
  const data = await getExperimentData(experimentId);

  // 1. Overall SRM
  const overall = {
    control: data.filter(u => u.variant === 'control').length,
    treatment: data.filter(u => u.variant === 'treatment').length
  };

  console.log('Overall SRM:', checkSRM(overall.control, overall.treatment));

  // 2. By platform
  const platforms = ['web', 'ios', 'android'];
  for (const platform of platforms) {
    const subset = data.filter(u => u.platform === platform);
    const control = subset.filter(u => u.variant === 'control').length;
    const treatment = subset.filter(u => u.variant === 'treatment').length;

    console.log(`${platform} SRM:`, checkSRM(control, treatment));
  }

  // 3. By time period
  const dayBuckets = groupByDay(data);
  for (const [day, users] of dayBuckets) {
    const control = users.filter(u => u.variant === 'control').length;
    const treatment = users.filter(u => u.variant === 'treatment').length;

    console.log(`${day} SRM:`, checkSRM(control, treatment));
  }

  // 4. By user cohort
  const cohorts = ['new', 'returning', 'power'];
  for (const cohort of cohorts) {
    const subset = data.filter(u => u.cohort === cohort);
    const control = subset.filter(u => u.variant === 'control').length;
    const treatment = subset.filter(u => u.variant === 'treatment').length;

    console.log(`${cohort} SRM:`, checkSRM(control, treatment));
  }
}

function checkSRM(controlCount: number, treatmentCount: number): SRMResult {
  const total = controlCount + treatmentCount;
  const expected = total / 2;

  const chiSquare =
    Math.pow(controlCount - expected, 2) / expected +
    Math.pow(treatmentCount - expected, 2) / expected;

  const pValue = 1 - chiSquareCDF(chiSquare, 1);

  return {
    passed: pValue >= 0.001,  // Very conservative threshold
    pValue,
    controlCount,
    treatmentCount,
    expectedEach: expected,
    chiSquare
  };
}
```

#### Solution

```typescript
// If SRM detected:

// 1. Do NOT report results
if (!srmCheck.passed) {
  throw new Error(`SRM detected (p=${srmCheck.pValue}). Results invalid.`);
}

// 2. Investigate root cause
const investigation = await diagnoseSRM(experimentId);

// 3. Fix and re-run
// OR
// 4. If unfixable, use affected platform/cohort as covariate in analysis
const adjustedAnalysis = regressionAdjustment({
  outcome: data.outcome,
  treatment: data.variant,
  covariates: {
    platform: data.platform,  // Adjust for platform imbalance
    cohort: data.cohort
  }
});
```

### Error: Inconsistent Assignment

#### Symptoms

```
User A assigned to Control at T1
User A assigned to Treatment at T2
Same experiment, same user, different variant!
```

#### Root Causes

**1. Non-Deterministic Hashing**

```typescript
// Problem: Using timestamp in hash
function assignVariant(userId: string): string {
  const hash = hashFunction(userId, Date.now());  // ❌ Non-deterministic!
  return hash % 2 === 0 ? 'control' : 'treatment';
}

// Fix: Use only deterministic inputs
function assignVariant(userId: string, experimentId: string): string {
  const hash = hashFunction(userId, experimentId);  // ✅ Deterministic
  return hash % 2 === 0 ? 'control' : 'treatment';
}
```

**2. Experiment Configuration Changed Mid-Flight**

```typescript
// Problem: Traffic allocation changed
// Day 1: 50/50 split
// Day 3: Changed to 30/70 split
// Users originally in control now in treatment

// Fix: Version experiment config
interface ExperimentConfig {
  id: string;
  version: number;  // Increment on changes
  trafficAllocation: number;
}

function assignVariant(userId: string, config: ExperimentConfig): string {
  // Include version in hash
  const hash = hashFunction(userId, config.id, config.version);
  return hash % 2 === 0 ? 'control' : 'treatment';
}
```

**3. Multiple Assignment Calls**

```typescript
// Problem: Different code paths call assignment
function pageLoad() {
  const variant1 = assignVariant(userId);  // One hash
  // ... later
  const variant2 = assignVariant(userId);  // Should be same but using different seed
}

// Fix: Single source of truth
class ExperimentClient {
  private assignmentCache = new Map<string, string>();

  getAssignment(userId: string, experimentId: string): string {
    const cacheKey = `${userId}:${experimentId}`;

    if (!this.assignmentCache.has(cacheKey)) {
      const variant = this.computeAssignment(userId, experimentId);
      this.assignmentCache.set(cacheKey, variant);
    }

    return this.assignmentCache.get(cacheKey);
  }
}
```

#### Diagnosis

```typescript
async function detectInconsistentAssignment(experimentId: string) {
  const assignments = await getAssignmentLogs(experimentId);

  // Group by user
  const byUser = groupBy(assignments, 'userId');

  const inconsistencies = [];

  for (const [userId, userAssignments] of byUser) {
    const variants = new Set(userAssignments.map(a => a.variant));

    if (variants.size > 1) {
      inconsistencies.push({
        userId,
        variants: Array.from(variants),
        timestamps: userAssignments.map(a => a.timestamp),
        count: userAssignments.length
      });
    }
  }

  if (inconsistencies.length > 0) {
    console.error(`Found ${inconsistencies.length} users with inconsistent assignments`);
    console.log('Sample:', inconsistencies.slice(0, 5));

    // Check if systematic
    const affectedPercent = (inconsistencies.length / byUser.size) * 100;
    if (affectedPercent > 1) {
      console.error(`${affectedPercent}% of users affected - systematic issue!`);
    }
  }

  return inconsistencies;
}
```

#### Solution

```typescript
// 1. Stop experiment immediately
await pauseExperiment(experimentId);

// 2. Identify affected users
const affected = await detectInconsistentAssignment(experimentId);

// 3. Exclude from analysis OR use first assignment
const cleanData = data.map(user => ({
  ...user,
  variant: getFirstAssignment(user.userId, experimentId)  // Use first only
}));

// 4. Fix root cause
// 5. Create new experiment version
const newVersion = {
  ...oldExperiment,
  version: oldExperiment.version + 1,
  fixedIssue: 'deterministic-assignment'
};

// 6. Restart with new version
await createExperiment(newVersion);
```

### Error: No Statistical Significance

#### Symptoms

```
Ran experiment for 4 weeks
Collected 100,000 users
P-value: 0.42 (not significant)
But business believes there should be an effect
```

#### Root Causes

**1. Underpowered**

```typescript
// Diagnosis: Check achieved power
const powerAnalysis = calculateAchievedPower('proportion', {
  alpha: 0.05,
  sampleSize: 50000,  // per group
  baselineRate: 0.10,
  observedEffect: 0.001  // Only 0.1% lift observed
});

console.log(`Achieved power: ${powerAnalysis.power}%`);
// Output: "Achieved power: 12%"
// Way underpowered! Need 800K per group to detect 0.1% effect

// Solution: Was MDE realistic?
const mde = calculateMDE('proportion', {
  alpha: 0.05,
  power: 0.80,
  sampleSize: 50000,
  baselineRate: 0.10
});

console.log(`Can only detect effects >= ${mde}%`);
// Output: "Can only detect effects >= 1.2%"
// If true effect is 0.1%, we had no chance
```

**2. High Variance**

```typescript
// Diagnosis: Check metric variance
const controlValues = data.filter(u => u.variant === 'control').map(u => u.revenue);
const stats = {
  mean: mean(controlValues),
  sd: standardDeviation(controlValues),
  cv: standardDeviation(controlValues) / mean(controlValues)  // Coefficient of variation
};

console.log(`Mean: ${stats.mean}, SD: ${stats.sd}, CV: ${stats.cv}`);
// If CV > 2: Very high variance

// Solution: Use CUPED
const cupedResult = cupedABTest(
  control.post,
  control.pre,  // Pre-experiment revenue
  treatment.post,
  treatment.pre
);

console.log(`Variance reduced by: ${cupedResult.varianceReduction}%`);
// May now have enough power!
```

**3. Novelty Effect Faded**

```typescript
// Diagnosis: Check time trends
const weeklyEffects = groupByWeek(data).map(week => {
  const control = week.filter(u => u.variant === 'control');
  const treatment = week.filter(u => u.variant === 'treatment');

  return {
    week: week.weekNumber,
    effect: mean(treatment.map(u => u.outcome)) - mean(control.map(u => u.outcome))
  };
});

console.log('Weekly effects:', weeklyEffects);
// Week 1: +5% ⬆️
// Week 2: +3%
// Week 3: +1%
// Week 4: +0% ← Novelty faded!

// Solution: Use only first week or segment by new/returning
const newUserAnalysis = analyzeSegment(data.filter(u => u.isNewUser));
const existingUserAnalysis = analyzeSegment(data.filter(u => !u.isNewUser));
```

**4. Implementation Bug**

```typescript
// Diagnosis: Check if variant actually applied
const exposureRate = {
  control: data.filter(u => u.variant === 'control' && u.exposed).length /
           data.filter(u => u.variant === 'control').length,
  treatment: data.filter(u => u.variant === 'treatment' && u.exposed).length /
             data.filter(u => u.variant === 'treatment').length
};

console.log('Exposure rates:', exposureRate);
// Control: 95% exposed
// Treatment: 45% exposed ← Bug! Feature not showing

// Solution: Fix bug, re-run experiment
```

#### Solution Checklist

```typescript
async function diagnoseNonSignificance(experimentId: string) {
  const data = await getExperimentData(experimentId);

  const diagnostics = {
    // 1. Power check
    power: calculateAchievedPower({
      sampleSize: data.control.length,
      observedEffect: data.observedEffect,
      baselineRate: data.control.mean
    }),

    // 2. MDE check
    mde: calculateMDE({
      sampleSize: data.control.length,
      baselineRate: data.control.mean
    }),

    // 3. Variance check
    variance: {
      control: variance(data.control.values),
      treatment: variance(data.treatment.values),
      high: coefficientOfVariation(data.control.values) > 2
    },

    // 4. Time trend check
    timeTrend: analyzeTimeTrend(data),

    // 5. Exposure check
    exposure: {
      control: exposureRate(data.control),
      treatment: exposureRate(data.treatment)
    },

    // 6. SRM check
    srm: checkSRM(data.control.length, data.treatment.length)
  };

  // Generate recommendations
  const recommendations = [];

  if (diagnostics.power < 0.5) {
    recommendations.push({
      issue: 'Low power',
      solution: diagnostics.observedEffect < diagnostics.mde
        ? `Effect (${diagnostics.observedEffect}) below MDE (${diagnostics.mde}). Need ${calculateRequiredSample(diagnostics.observedEffect)} users.`
        : 'Run longer to accumulate more data'
    });
  }

  if (diagnostics.variance.high) {
    recommendations.push({
      issue: 'High variance',
      solution: 'Consider CUPED variance reduction or stratification'
    });
  }

  if (diagnostics.timeTrend.declining) {
    recommendations.push({
      issue: 'Novelty effect fade',
      solution: 'Analyze first week separately or segment by user cohort'
    });
  }

  if (Math.abs(diagnostics.exposure.control - diagnostics.exposure.treatment) > 0.1) {
    recommendations.push({
      issue: 'Exposure rate mismatch',
      solution: 'Check for implementation bug in treatment'
    });
  }

  if (!diagnostics.srm.passed) {
    recommendations.push({
      issue: 'SRM detected',
      solution: 'Do not interpret results. Investigate assignment mechanism.'
    });
  }

  return { diagnostics, recommendations };
}
```

---

## Assignment Debugging

### Debug Assignment Logic

```typescript
class AssignmentDebugger {
  async debugAssignment(userId: string, experimentId: string) {
    console.log(`\n=== Debugging Assignment ===`);
    console.log(`User: ${userId}`);
    console.log(`Experiment: ${experimentId}`);

    // 1. Check experiment status
    const experiment = await getExperiment(experimentId);
    console.log(`\nExperiment Status: ${experiment.status}`);

    if (experiment.status !== 'running') {
      console.warn(`⚠️  Experiment not running!`);
      return { assigned: false, reason: 'experiment_not_running' };
    }

    // 2. Check targeting rules
    const userContext = await getUserContext(userId);
    const targetsUser = evaluateTargeting(experiment.targetingRules, userContext);

    console.log(`\nTargeting Check: ${targetsUser ? '✅ Pass' : '❌ Fail'}`);
    console.log(`User context:`, userContext);
    console.log(`Targeting rules:`, experiment.targetingRules);

    if (!targetsUser) {
      return { assigned: false, reason: 'targeting_excluded' };
    }

    // 3. Check traffic allocation
    const hash = hashFunction(userId, experimentId);
    const hashPercent = (hash % 10000) / 100;  // 0-100
    const inTraffic = hashPercent < experiment.trafficAllocation;

    console.log(`\nTraffic Allocation: ${experiment.trafficAllocation}%`);
    console.log(`User hash: ${hash} (${hashPercent.toFixed(2)}%)`);
    console.log(`In traffic: ${inTraffic ? '✅ Yes' : '❌ No'}`);

    if (!inTraffic) {
      return { assigned: false, reason: 'traffic_excluded' };
    }

    // 4. Calculate variant
    const variantHash = hashFunction(userId, experimentId, 'variant');
    const variantIndex = variantHash % experiment.variants.length;
    const variant = experiment.variants[variantIndex];

    console.log(`\nVariant Assignment:`);
    console.log(`Variant hash: ${variantHash}`);
    console.log(`Variant index: ${variantIndex}`);
    console.log(`Assigned variant: ${variant.key}`);

    // 5. Check for overrides
    const override = await getOverride(userId, experimentId);
    if (override) {
      console.log(`\n⚠️  Override active: ${override.variant}`);
      console.log(`Reason: ${override.reason}`);
    }

    // 6. Verify consistency
    const previousAssignments = await getAssignmentHistory(userId, experimentId);
    if (previousAssignments.length > 0) {
      const firstAssignment = previousAssignments[0].variant;
      if (firstAssignment !== variant.key) {
        console.error(`\n❌ INCONSISTENCY DETECTED!`);
        console.error(`Previous: ${firstAssignment}`);
        console.error(`Current: ${variant.key}`);
        console.error(`This is a BUG!`);
      } else {
        console.log(`\n✅ Consistent with ${previousAssignments.length} previous assignments`);
      }
    }

    return {
      assigned: true,
      variant: override?.variant || variant.key,
      debug: {
        targeting: targetsUser,
        traffic: inTraffic,
        hash,
        variantHash,
        override: !!override
      }
    };
  }

  // Test assignment distribution
  async testAssignmentDistribution(experimentId: string, numUsers: number = 10000) {
    console.log(`\n=== Testing Assignment Distribution ===`);
    console.log(`Simulating ${numUsers} users...`);

    const experiment = await getExperiment(experimentId);
    const distribution = new Map(experiment.variants.map(v => [v.key, 0]));
    let excluded = 0;

    for (let i = 0; i < numUsers; i++) {
      const userId = `test_user_${i}`;
      const result = await this.debugAssignment(userId, experimentId);

      if (result.assigned) {
        distribution.set(result.variant, distribution.get(result.variant) + 1);
      } else {
        excluded++;
      }
    }

    console.log(`\nResults:`);
    console.log(`Excluded: ${excluded} (${(excluded / numUsers * 100).toFixed(1)}%)`);

    const assigned = numUsers - excluded;
    for (const [variant, count] of distribution) {
      const percent = (count / assigned * 100).toFixed(1);
      const expected = (100 / experiment.variants.length).toFixed(1);
      const diff = Math.abs(parseFloat(percent) - parseFloat(expected));

      console.log(`${variant}: ${count} (${percent}%) [expected: ${expected}%]`);

      if (diff > 2) {
        console.warn(`  ⚠️  Deviation > 2%!`);
      }
    }

    // Chi-square test
    const expectedPerVariant = assigned / experiment.variants.length;
    const chiSquare = Array.from(distribution.values())
      .reduce((sum, observed) =>
        sum + Math.pow(observed - expectedPerVariant, 2) / expectedPerVariant, 0);

    const pValue = 1 - chiSquareCDF(chiSquare, experiment.variants.length - 1);

    console.log(`\nChi-square test: χ²=${chiSquare.toFixed(2)}, p=${pValue.toFixed(4)}`);

    if (pValue < 0.05) {
      console.error(`❌ Distribution is NOT uniform (p=${pValue})`);
    } else {
      console.log(`✅ Distribution is uniform (p=${pValue})`);
    }
  }
}

// Usage:
const debugger = new AssignmentDebugger();
await debugger.debugAssignment('user_12345', 'checkout_v2');
await debugger.testAssignmentDistribution('checkout_v2', 100000);
```

### Common Assignment Issues

#### Issue: Some Users Never Assigned

```typescript
// Check what's filtering them out
async function debugNoAssignment(userId: string, experimentId: string) {
  const result = await debugger.debugAssignment(userId, experimentId);

  switch (result.reason) {
    case 'experiment_not_running':
      console.log('Fix: Start the experiment');
      break;

    case 'targeting_excluded':
      console.log('User doesn\'t match targeting criteria');
      console.log('Check: user attributes vs targeting rules');
      break;

    case 'traffic_excluded':
      console.log('User hash outside traffic allocation');
      console.log('This is expected - increase traffic allocation if needed');
      break;
  }
}
```

#### Issue: Assignment Varies by Platform

```typescript
// Check if hash implementation consistent
async function debugCrossPlatform(userId: string, experimentId: string) {
  const platforms = ['web', 'ios', 'android'];

  for (const platform of platforms) {
    const result = await getAssignment(userId, experimentId, { platform });
    console.log(`${platform}: ${result.variant}`);
  }

  // If different across platforms: hash implementation differs
  // Fix: Ensure consistent hash function across all platforms
}
```

---

## Data Quality Issues

### Missing Exposure Events

#### Symptoms

```
10,000 users assigned
Only 7,000 exposure events logged
30% of assignments never exposed
```

#### Diagnosis

```typescript
async function diagnoseExposureGap(experimentId: string) {
  const assignments = await getAssignments(experimentId);
  const exposures = await getExposures(experimentId);

  const exposureSet = new Set(exposures.map(e => e.userId));
  const assignedNotExposed = assignments.filter(a => !exposureSet.has(a.userId));

  console.log(`Total assigned: ${assignments.length}`);
  console.log(`Total exposed: ${exposures.length}`);
  console.log(`Never exposed: ${assignedNotExposed.length}`);

  // Segment analysis
  const byPlatform = groupBy(assignedNotExposed, 'platform');
  console.log('\nNever exposed by platform:');
  for (const [platform, users] of Object.entries(byPlatform)) {
    const percent = (users.length / assignments.filter(a => a.platform === platform).length * 100);
    console.log(`${platform}: ${users.length} (${percent.toFixed(1)}%)`);
  }

  // Check if it's a timing issue
  const assignExposeLags = exposures.map(e => {
    const assignment = assignments.find(a => a.userId === e.userId);
    return e.timestamp - assignment.timestamp;
  });

  console.log('\nTime from assignment to exposure:');
  console.log(`Median: ${median(assignExposeLags)}ms`);
  console.log(`p95: ${percentile(assignExposeLags, 0.95)}ms`);

  // If p95 > 1 hour: Users assigned but never see feature
}
```

#### Solutions

```typescript
// 1. Track assignment and exposure together
async function trackExperimentInteraction(userId: string, experimentId: string) {
  const assignment = await getAssignment(userId, experimentId);

  // Log assignment
  await logAssignment({
    userId,
    experimentId,
    variant: assignment.variant,
    timestamp: Date.now()
  });

  // IMMEDIATELY log exposure if user sees feature
  if (userViewedFeature()) {
    await logExposure({
      userId,
      experimentId,
      variant: assignment.variant,
      timestamp: Date.now()
    });
  }
}

// 2. Use intent-to-treat analysis
// Include all assigned users, not just exposed
const intentToTreat = analyzeExperiment({
  data: allAssignedUsers,  // Not just exposed
  method: 'intent_to_treat'
});

// 3. Analyze exposure rate as diagnostic
const exposureRate = {
  control: exposedControl / assignedControl,
  treatment: exposedTreatment / assignedTreatment
};

if (Math.abs(exposureRate.control - exposureRate.treatment) > 0.05) {
  console.warn('Different exposure rates - possible implementation bug');
}
```

### Metric Event Missing

#### Symptoms

```
10,000 exposures
Only 100 conversion events
1% conversion (expected: 10%)
```

#### Diagnosis

```typescript
async function diagnoseMetricEvents(experimentId: string, metricName: string) {
  const exposures = await getExposures(experimentId);
  const events = await getMetricEvents(experimentId, metricName);

  console.log(`Exposures: ${exposures.length}`);
  console.log(`Metric events: ${events.length}`);
  console.log(`Conversion rate: ${(events.length / exposures.length * 100).toFixed(1)}%`);

  // Check historical baseline
  const historicalRate = await getHistoricalConversionRate(metricName, days = 30);
  console.log(`Historical rate: ${(historicalRate * 100).toFixed(1)}%`);

  if (events.length / exposures.length < historicalRate * 0.5) {
    console.error('❌ Metric events way below historical baseline');
    console.log('Likely causes:');
    console.log('1. Metric event tracking broken');
    console.log('2. Experiment breaking conversion flow');
    console.log('3. Wrong metric name');
  }

  // Check sample events
  console.log('\nSample metric events:');
  console.log(events.slice(0, 5));

  // Check experiment attribution
  const eventsWithExperiment = events.filter(e =>
    e.experimentIds && e.experimentIds.includes(experimentId)
  );

  console.log(`\nEvents attributed to experiment: ${eventsWithExperiment.length}`);

  if (eventsWithExperiment.length < events.length * 0.5) {
    console.warn('⚠️  Many events not attributed to experiment');
    console.log('Check: Is experimentId propagated correctly?');
  }
}
```

### Data Pipeline Lag

#### Symptoms

```
Real-time dashboard shows 0 users
But experiment is running
Data appears 6 hours later
```

#### Diagnosis

```typescript
async function diagnosePipelineLag() {
  // Check event timestamps vs processing timestamps
  const recentEvents = await getEvents({
    experimentId,
    limit: 1000,
    orderBy: 'processed_time DESC'
  });

  const lags = recentEvents.map(e => e.processedTime - e.eventTime);

  console.log('Data lag statistics:');
  console.log(`p50: ${median(lags) / 1000}s`);
  console.log(`p95: ${percentile(lags, 0.95) / 1000}s`);
  console.log(`p99: ${percentile(lags, 0.99) / 1000}s`);
  console.log(`max: ${Math.max(...lags) / 1000}s`);

  if (median(lags) > 60000) {
    console.error('❌ High median lag (>1 minute)');
    console.log('Check: Kafka consumer lag, database write throughput');
  }

  // Check for specific slow events
  const slowEvents = recentEvents.filter(e => e.processedTime - e.eventTime > 300000);
  console.log(`\nSlow events (>5 min lag): ${slowEvents.length}`);

  if (slowEvents.length > 0) {
    console.log('Sample slow events:');
    console.log(slowEvents.slice(0, 5).map(e => ({
      type: e.eventType,
      lag: (e.processedTime - e.eventTime) / 1000 + 's',
      timestamp: new Date(e.eventTime)
    })));
  }
}
```

#### Solutions

```typescript
// 1. Monitoring alerts
const alerts = {
  highLag: {
    metric: 'event_processing_lag_p95',
    threshold: 60000,  // 60 seconds
    action: 'page_oncall'
  },
  lowThroughput: {
    metric: 'events_per_second',
    threshold: 100,  // Below 100/sec
    action: 'alert_team'
  }
};

// 2. Backfill missing data
async function backfillEvents(experimentId: string, startDate: Date, endDate: Date) {
  console.log('Starting backfill...');

  // Re-process raw events
  const rawEvents = await getRawEvents(startDate, endDate);

  for (const batch of chunk(rawEvents, 1000)) {
    await processEventBatch(batch);
  }

  console.log(`Backfilled ${rawEvents.length} events`);
}
```

---

## Performance Optimization

### Slow Assignment API

#### Symptoms

```
Assignment endpoint: p95 = 250ms
SLA: < 50ms
Users experiencing delays
```

#### Diagnosis

```typescript
async function profileAssignmentPerformance(userId: string, experimentId: string) {
  const startTime = performance.now();

  const timings = {
    fetchExperiment: 0,
    evaluateTargeting: 0,
    computeHash: 0,
    checkCache: 0,
    total: 0
  };

  // 1. Fetch experiment config
  const t1 = performance.now();
  const experiment = await getExperiment(experimentId);
  timings.fetchExperiment = performance.now() - t1;

  // 2. Evaluate targeting
  const t2 = performance.now();
  const userContext = await getUserContext(userId);
  const targets = evaluateTargeting(experiment.targetingRules, userContext);
  timings.evaluateTargeting = performance.now() - t2;

  // 3. Compute hash
  const t3 = performance.now();
  const variant = computeVariant(userId, experiment);
  timings.computeHash = performance.now() - t3;

  timings.total = performance.now() - startTime;

  console.log('Performance breakdown:');
  for (const [step, duration] of Object.entries(timings)) {
    const percent = (duration / timings.total * 100).toFixed(1);
    console.log(`${step}: ${duration.toFixed(2)}ms (${percent}%)`);
  }

  // Identify bottleneck
  const bottleneck = Object.entries(timings)
    .filter(([k]) => k !== 'total')
    .reduce((max, [k, v]) => v > max.duration ? {step: k, duration: v} : max, {step: '', duration: 0});

  console.log(`\nBottleneck: ${bottleneck.step} (${bottleneck.duration.toFixed(2)}ms)`);
}
```

#### Optimizations

**1. Cache Experiment Config**

```typescript
class ExperimentCache {
  private cache = new Map<string, {config: Experiment, expires: number}>();
  private ttl = 60000;  // 1 minute

  async getExperiment(experimentId: string): Promise<Experiment> {
    const cached = this.cache.get(experimentId);

    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    // Fetch from database
    const config = await db.experiments.findById(experimentId);

    // Cache it
    this.cache.set(experimentId, {
      config,
      expires: Date.now() + this.ttl
    });

    return config;
  }

  invalidate(experimentId: string) {
    this.cache.delete(experimentId);
  }
}

// Before: 150ms database query per assignment
// After: 150ms first request, 0.1ms subsequent requests
```

**2. Lazy Load User Context**

```typescript
// Before: Fetch all user attributes upfront
async function getAssignment(userId: string, experimentId: string) {
  const userContext = await getUserContext(userId);  // Expensive!
  const experiment = await getExperiment(experimentId);
  const targets = evaluateTargeting(experiment.targetingRules, userContext);
  // ...
}

// After: Only fetch needed attributes
async function getAssignment(userId: string, experimentId: string) {
  const experiment = await getExperiment(experimentId);

  // Extract required attributes from targeting rules
  const requiredAttributes = extractRequiredAttributes(experiment.targetingRules);

  // Fetch only those
  const userContext = await getUserContext(userId, requiredAttributes);

  const targets = evaluateTargeting(experiment.targetingRules, userContext);
  // ...
}

// Before: 50ms to fetch all attributes
// After: 10ms to fetch only needed attributes
```

**3. Precompute Targeting**

```typescript
// For simple targeting rules, precompute eligible users
async function precomputeTargeting(experiment: Experiment) {
  if (experiment.targetingRules.type === 'simple') {
    // Build bitmap of eligible users
    const eligibleUsers = await db.users.find(experiment.targetingRules.conditions);
    const bitmap = new Bitmap();

    for (const user of eligibleUsers) {
      bitmap.set(user.id);
    }

    await cache.set(`targeting:${experiment.id}`, bitmap);
  }
}

// Assignment now just checks bitmap
async function targetsUser(userId: string, experimentId: string): Promise<boolean> {
  const bitmap = await cache.get(`targeting:${experimentId}`);

  if (bitmap) {
    return bitmap.has(userId);  // O(1)!
  }

  // Fallback to dynamic evaluation
  return evaluateTargeting(experimentId, userId);
}
```

**4. Batch Assignment Calls**

```typescript
// Before: N individual calls
for (const experiment of experiments) {
  const assignment = await getAssignment(userId, experiment.id);
  assignments[experiment.id] = assignment;
}

// After: Single batch call
const assignments = await getAssignments(userId, experiments.map(e => e.id));

// Optimizations in batch:
// - Single user context fetch
// - Single cache round-trip
// - Parallel variant computation
```

### Slow Analysis Queries

#### Symptoms

```
Analysis dashboard times out
Simple experiment: 30 seconds to load
10,000 user experiment taking 5 minutes
```

#### Optimizations

**1. Pre-Aggregation**

```typescript
// Before: Aggregate on-demand
async function getExperimentResults(experimentId: string) {
  const events = await db.events.find({ experimentId });  // Millions of rows

  const results = {
    control: calculateMetrics(events.filter(e => e.variant === 'control')),
    treatment: calculateMetrics(events.filter(e => e.variant === 'treatment'))
  };

  return results;
}

// After: Incremental aggregation
class IncrementalAggregator {
  async onEvent(event: MetricEvent) {
    const key = `${event.experimentId}:${event.variant}:${event.metric}`;

    await db.aggregates.increment(key, {
      count: 1,
      sum: event.value,
      sumSquares: event.value * event.value
    });
  }

  async getResults(experimentId: string) {
    const aggregates = await db.aggregates.find({ experimentId });

    // Compute statistics from aggregates (fast!)
    return computeStatistics(aggregates);
  }
}

// Before: 30 seconds scanning millions of rows
// After: 100ms reading pre-aggregated data
```

**2. Materialized Views**

```sql
-- Create materialized view for common queries
CREATE MATERIALIZED VIEW experiment_daily_summary AS
SELECT
  experiment_id,
  variant,
  DATE(timestamp) as date,
  COUNT(*) as exposures,
  SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions,
  AVG(revenue) as avg_revenue
FROM events
GROUP BY experiment_id, variant, DATE(timestamp);

-- Refresh every hour
CREATE INDEX ON experiment_daily_summary (experiment_id, date);
```

**3. Time-Based Partitioning**

```typescript
// Partition events table by month
const getEvents = async (experimentId: string, startDate: Date, endDate: Date) => {
  const partitions = getPartitionsForDateRange(startDate, endDate);

  // Only scan relevant partitions
  const events = [];
  for (const partition of partitions) {
    const partitionEvents = await db[partition].find({ experimentId });
    events.push(...partitionEvents);
  }

  return events;
};

// Before: Full table scan (millions of rows)
// After: Scan only relevant partitions (thousands of rows)
```

---

## Scaling Considerations

### High Traffic Experiments

#### Challenge: 1M assignments/second

**Bottlenecks**:
1. Database reads
2. Hash computation
3. Network latency

**Solutions**:

**1. Edge Caching**

```typescript
// Deploy assignment logic to CDN edge
class EdgeAssignmentService {
  async getAssignment(userId: string, experimentId: string) {
    // Check edge cache first (local to user)
    const cached = await edgeCache.get(`${userId}:${experimentId}`);
    if (cached) return cached;

    // Compute locally at edge (no database call!)
    const experiment = await edgeCache.get(`experiment:${experimentId}`);
    const variant = computeVariant(userId, experiment);  // Pure function

    // Cache for 24 hours
    await edgeCache.set(`${userId}:${experimentId}`, variant, {ttl: 86400});

    return variant;
  }
}

// Before: 100ms (origin → database → origin → edge → user)
// After: 5ms (edge cache hit)
```

**2. Client-Side Assignment**

```typescript
// Push experiment config to client
// Client computes assignment locally

// Server sends experiment config once
const config = {
  experimentId: 'checkout_v2',
  variants: ['control', 'treatment'],
  trafficAllocation: 1.0,
  salt: 'experiment_salt_checkout_v2'
};

// Client computes assignment
function getAssignment(userId: string, config: ExperimentConfig): string {
  const hash = murmurhash(userId + config.salt);
  const bucket = hash % 100;

  if (bucket >= config.trafficAllocation * 100) {
    return null;  // Not in experiment
  }

  const variantIndex = hash % config.variants.length;
  return config.variants[variantIndex];
}

// No server call needed!
// Instant assignment
```

**3. Async Event Processing**

```typescript
// Don't wait for event logging
async function trackExposure(userId: string, experimentId: string, variant: string) {
  // Fire and forget
  eventQueue.push({
    type: 'exposure',
    userId,
    experimentId,
    variant,
    timestamp: Date.now()
  });

  // Don't await! Return immediately
}

// Batch process events
setInterval(async () => {
  const batch = eventQueue.splice(0, 1000);  // Take up to 1000 events

  if (batch.length > 0) {
    await db.events.insertMany(batch);  // Bulk insert
  }
}, 1000);  // Every second

// Before: 20ms per event (serial database writes)
// After: 0.1ms per event (batched inserts)
```

### Large Number of Experiments

#### Challenge: 1000 concurrent experiments

**Problem**: Can't fetch all configs per request

**Solutions**:

**1. Namespace Isolation**

```typescript
// Group experiments by namespace
const namespaces = {
  'checkout': ['checkout_button_color', 'checkout_flow_v2', ...],
  'homepage': ['hero_image_test', 'nav_redesign', ...],
  'search': ['ranking_algo_v3', 'filters_ui', ...]
};

// Only fetch relevant namespace
async function getAssignments(userId: string, page: string) {
  const namespace = getNamespaceForPage(page);  // 'checkout'
  const experiments = await getExperimentsByNamespace(namespace);  // 10 experiments, not 1000

  return computeAssignments(userId, experiments);
}
```

**2. Incremental Config Sync**

```typescript
// Client syncs experiment configs incrementally
class ExperimentConfigSync {
  private version = 0;

  async sync() {
    const { configs, version } = await api.getExperimentConfigs({
      since: this.version
    });

    // Server only sends changes since last version
    this.updateConfigs(configs);
    this.version = version;
  }
}

// Server tracks config versions
// Only sends diff since client's last sync
```

**3. Hierarchical Caching**

```
┌─────────────┐
│   Browser   │  Cache: 5 minutes
└──────┬──────┘
       │
┌──────▼──────┐
│  CDN Edge   │  Cache: 1 minute
└──────┬──────┘
       │
┌──────▼──────┐
│   Origin    │  Cache: 10 seconds
└──────┬──────┘
       │
┌──────▼──────┐
│  Database   │  Source of truth
└─────────────┘

Total: Most requests served from browser/edge cache
```

### Data Volume

#### Challenge: 1B events/day

**Storage Requirements**:
```
1B events/day
× 100 bytes/event
= 100 GB/day
= 3 TB/month
= 36 TB/year
```

**Solutions**:

**1. Sampling**

```typescript
// Sample events for high-volume experiments
function shouldSampleEvent(userId: string, experimentId: string): boolean {
  const experiment = getExperiment(experimentId);

  if (experiment.exposures > 1000000) {
    // Large experiment: sample at 10%
    const hash = hashFunction(userId, experimentId, 'sampling');
    return (hash % 100) < 10;
  }

  return true;  // Small experiments: no sampling
}

// Adjust analysis for sampling rate
function analyzeWithSampling(data: SampledData, samplingRate: number) {
  const results = analyze(data);

  return {
    ...results,
    sampleSize: results.sampleSize * samplingRate,  // Adjust sample size
    note: `Results based on ${samplingRate * 100}% sample`
  };
}
```

**2. Tiered Storage**

```typescript
// Hot: Recent events (last 7 days) in fast database
// Warm: Last 90 days in compressed storage
// Cold: >90 days in archival storage

class TieredEventStorage {
  async getEvents(experimentId: string, startDate: Date, endDate: Date) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    let events = [];

    // Query hot storage (fast!)
    if (endDate >= sevenDaysAgo) {
      events.push(...await hotStorage.find({ experimentId, startDate, endDate }));
    }

    // Query warm storage (slower)
    if (startDate < sevenDaysAgo && endDate >= ninetyDaysAgo) {
      events.push(...await warmStorage.find({ experimentId, startDate, endDate }));
    }

    // Query cold storage (slowest)
    if (startDate < ninetyDaysAgo) {
      events.push(...await coldStorage.find({ experimentId, startDate, endDate }));
    }

    return events;
  }
}
```

**3. Aggregation and Pruning**

```typescript
// Keep raw events for 30 days
// Keep daily aggregates for 1 year
// Keep monthly aggregates forever

async function pruneOldEvents() {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Aggregate before deleting
  const oldEvents = await db.events.find({ timestamp: { $lt: thirtyDaysAgo } });

  await aggregateEvents(oldEvents);  // Create daily/monthly summaries

  // Now safe to delete
  await db.events.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });

  console.log(`Pruned ${oldEvents.length} events, kept aggregates`);
}

// Run daily
```

---

## Quick Troubleshooting Checklist

### Experiment Not Getting Traffic

- [ ] Check experiment status (running?)
- [ ] Check traffic allocation (> 0%?)
- [ ] Check targeting rules (too restrictive?)
- [ ] Check assignment logic (hash working?)
- [ ] Check for overrides (force-assigned to excluded variant?)

### Results Look Wrong

- [ ] Check for SRM (sample ratio mismatch)
- [ ] Check exposure rates (both variants exposed?)
- [ ] Check time range (including all data?)
- [ ] Check for novelty effects (segment by time/cohort)
- [ ] Check for data quality issues (outliers, bots)

### Performance Issues

- [ ] Check cache hit rates
- [ ] Profile slow queries
- [ ] Review database indexes
- [ ] Consider pre-aggregation
- [ ] Check data pipeline lag

### Data Missing

- [ ] Check event tracking (instrumented?)
- [ ] Check data pipeline (processing?)
- [ ] Check retention policies (pruned?)
- [ ] Check attribution (experimentId propagated?)

---

## Additional Resources

**Monitoring Dashboards**:
- Assignment latency (p50, p95, p99)
- Event processing lag
- SRM detection alerts
- Data quality metrics

**Debugging Tools**:
- Assignment debugger
- Event inspector
- Performance profiler
- Data quality validator

**Documentation**:
- [Best Practices](./BEST_PRACTICES.md)
- [Statistical Guide](./STATISTICAL_GUIDE.md)
- [Design Patterns](./DESIGN_PATTERNS.md)
- [Architecture](./ARCHITECTURE.md)
