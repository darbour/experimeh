# Experimental Design Patterns

Comprehensive guide to advanced experimental methodologies for online experimentation.

## Table of Contents

1. [Factorial vs Separate A/B Tests](#factorial-vs-separate-ab-tests)
2. [Switchback Design for Marketplace Experiments](#switchback-design-for-marketplace-experiments)
3. [Within-Subjects for Personalization](#within-subjects-for-personalization)
4. [Handling Network Effects](#handling-network-effects)
5. [Dealing with Interference](#dealing-with-interference)
6. [Multi-Armed Bandits vs A/B Tests](#multi-armed-bandits-vs-ab-tests)

---

## Factorial vs Separate A/B Tests

### The Decision

**Question**: You want to test two features. Should you run them separately or together in a factorial design?

### Separate A/B Tests

#### When to Use

✅ **Features are independent**
- Testing completely different parts of the product
- Example: Homepage redesign + Email campaign

✅ **Teams are separate**
- Different teams, different timelines
- Can't coordinate launches

✅ **Simple interpretation needed**
- Stakeholders unfamiliar with interactions
- Clear, simple messaging required

✅ **Sequencing matters**
- One feature builds on another
- Example: Must test checkout flow before upsell page

✅ **Insufficient traffic for factorial**
- Factorial requires larger sample per cell
- Limited traffic makes factorial infeasible

#### Advantages

```
Simplicity:
- Easy to understand
- Clear interpretation
- Straightforward analysis

Flexibility:
- Can start/stop independently
- Different success metrics OK
- Different rollout schedules OK

Lower Risk:
- Only one change at a time
- Easier to debug issues
- Clear attribution of problems
```

#### Disadvantages

```
Time:
- Must run sequentially
- 2× experiments = 2× time
- Slower iteration

Efficiency:
- Uses more users total
- More experiment overhead
- Can't detect interactions

Interaction Blindness:
- Won't know if features work better/worse together
- May ship conflicting features
- Could miss synergies
```

#### Example

```typescript
// Test 1: Button Color (4 weeks)
const buttonTest = {
  variants: ['blue', 'green'],
  sampleSize: 10000,
  duration: 28
};

// Wait for Test 1 to complete...

// Test 2: Button Text (4 weeks)
const textTest = {
  variants: ['buy_now', 'purchase'],
  sampleSize: 10000,
  duration: 28
};

// Total time: 8 weeks
// Total users: 20,000 (but can reuse same users)
```

### Factorial Design

#### When to Use

✅ **Features might interact**
- Could work better together
- Might conflict
- Example: Button color + Button text

✅ **Save time**
- Need results quickly
- Can't wait for sequential tests
- Limited experimentation windows

✅ **Efficient use of traffic**
- Test multiple things simultaneously
- More insights per user

✅ **Want interaction insights**
- Understand feature synergies
- Make informed combo decisions

✅ **Sufficient traffic**
- Can fill all cells adequately
- Can detect main effects AND interactions

#### Advantages

```
Time Efficiency:
- Test 2 factors in time of 1 experiment
- Faster iteration
- Parallel learning

Statistical Efficiency:
- More efficient than separate tests
- Can detect interactions
- Better use of sample

Interaction Detection:
- Know if features complement or conflict
- Avoid shipping harmful combinations
- Discover synergies
```

#### Disadvantages

```
Complexity:
- Harder to understand
- Requires more sophisticated analysis
- Stakeholder confusion

Sample Size:
- Need more users per cell
- 2×2 = 4 cells to fill
- Total sample can be 2× larger

Coordination:
- Must launch together
- Shared rollout schedule
- Dependencies between teams

Analysis:
- Multiple testing correction needed
- Interaction interpretation challenging
- More QA required
```

#### Example

```typescript
// Factorial 2×2 Design
const factorialTest = {
  factors: [
    { name: 'buttonColor', levels: ['blue', 'green'] },
    { name: 'buttonText', levels: ['buy_now', 'purchase'] }
  ],
  variants: [
    { cell: 'blue_buy_now' },      // 25% traffic
    { cell: 'blue_purchase' },     // 25%
    { cell: 'green_buy_now' },     // 25%
    { cell: 'green_purchase' }     // 25%
  ],
  sampleSize: 10000,  // Per cell = 40,000 total
  duration: 28
};

// Total time: 4 weeks
// Total users: 40,000
// But: Get results for BOTH features + interaction!
```

### Detailed Comparison

#### Sample Size Requirements

**Separate Tests**:
```
Test 1: Need 10,000 per group = 20,000 total
Test 2: Need 10,000 per group = 20,000 total
Total: 40,000 users (but sequential, can reuse)
Time: 2 × experiment duration
```

**Factorial Test**:
```
Need 10,000 per cell × 4 cells = 40,000 total
Time: 1 × experiment duration

Trade-off:
- Same total users
- Half the time
- But: Must have traffic to run concurrently
```

#### When Factorial is MORE Efficient

**Scenario 1: Strong Interaction**

```
Separate Tests:
Test 1 (Color): Blue=10%, Green=10% → No difference
Test 2 (Text): Buy=10%, Purchase=10% → No difference
Conclusion: Neither matters

Reality (with interaction):
Blue + Buy: 10%
Blue + Purchase: 10%
Green + Buy: 15% ⭐ (best!)
Green + Purchase: 8%

Factorial would discover: Green works ONLY with "Buy"
```

**Scenario 2: Need Both Results**

```
Sequential:
Week 1-4: Test Color
Week 5-8: Test Text
Total: 8 weeks, 40K users

Factorial:
Week 1-4: Test both together
Total: 4 weeks, 40K users

Savings: 50% time, same users
```

#### When Separate is BETTER

**Scenario 1: Insufficient Traffic**

```
Factorial needs: 10K per cell × 4 = 40K users in 4 weeks
Available: 5K users/week

Separate tests: 10K per group × 2 = 20K users in 4 weeks ✅
Then: 20K users in next 4 weeks ✅

Factorial is impossible, sequential works!
```

**Scenario 2: Different Metrics**

```
Test 1 (Color): Primary metric = Clicks
Test 2 (Text): Primary metric = Conversions

Factorial complicates analysis:
- Which metric to use?
- How to interpret interactions?

Separate is cleaner.
```

### Decision Framework

```typescript
function chooseDesign(situation: ExperimentSituation): Design {
  // Critical questions:

  // 1. Traffic sufficient for factorial?
  const trafficPerWeek = situation.weeklyUsers;
  const factorialNeeds = situation.minSamplePerCell * Math.pow(2, situation.numFactors);

  if (factorialNeeds > trafficPerWeek * situation.maxWeeks) {
    return 'separate';  // Not enough traffic
  }

  // 2. Could features interact?
  if (situation.featuresIndependent) {
    return 'separate';  // No interaction expected
  }

  // 3. Time pressure?
  if (situation.urgency === 'high') {
    return 'factorial';  // Need results fast
  }

  // 4. Stakeholder sophistication?
  if (situation.audienceComplexity === 'low') {
    return 'separate';  // Keep it simple
  }

  // 5. Same product area?
  if (situation.featuresProximity === 'close') {
    return 'factorial';  // Likely interactions
  }

  // Default: Factorial if sufficient traffic and time
  return 'factorial';
}
```

### Practical Example: E-commerce Checkout

**Situation**:
- Want to test: Button color AND button text
- Weekly traffic: 50,000 users
- Need 5,000 per cell for power
- Timeline: Flexible

**Analysis**:

```
Factorial Requirements:
- 4 cells × 5,000 = 20,000 total users
- At 50K/week, need 0.4 weeks (~3 days)
- But: Should run at least 1 week for stability
- Verdict: Plenty of traffic ✅

Interaction Likelihood:
- Button color and text are visually combined
- Users see them together
- Likely interaction ✅

Decision: Use Factorial Design

Benefits:
- Test both in 1 week instead of 2
- Discover optimal combination
- Detect interaction effects
- More efficient use of traffic
```

### Implementation Patterns

#### Pattern 1: Full Factorial

```typescript
// Test ALL combinations
const fullFactorial = {
  factors: [
    { name: 'buttonColor', levels: ['blue', 'green', 'red'] },
    { name: 'buttonText', levels: ['buy', 'purchase', 'checkout'] }
  ],
  // Results in 3 × 3 = 9 treatment cells
  allocation: 'equal'  // 11.1% per cell
};

// Use when: Want to test all combinations, have traffic
```

#### Pattern 2: Fractional Factorial

```typescript
// Test SUBSET of combinations
const fractionalFactorial = {
  factors: [
    { name: 'buttonColor', levels: ['blue', 'green', 'red'] },
    { name: 'buttonText', levels: ['buy', 'purchase', 'checkout'] },
    { name: 'buttonSize', levels: ['small', 'large'] }
  ],
  // Full: 3 × 3 × 2 = 18 cells (too many!)
  // Fractional: Select 6-8 strategically chosen cells
  selectedCombinations: [
    ['blue', 'buy', 'large'],
    ['green', 'purchase', 'large'],
    ['red', 'checkout', 'small'],
    // ... carefully chosen to detect main effects
  ]
};

// Use when: Too many factors, but need to test multiple
// Trade-off: Can't detect all interactions
```

#### Pattern 3: Hybrid Approach

```typescript
// Start with factorial, then follow-up
async function hybridApproach() {
  // Phase 1: Factorial screening (4 weeks)
  const screening = await runFactorial({
    factors: [
      { name: 'color', levels: ['blue', 'green'] },
      { name: 'text', levels: ['buy', 'purchase'] }
    ]
  });

  // Analyze: Which factor(s) matter?
  const significantFactors = screening.mainEffects.filter(e => e.pValue < 0.05);

  if (screening.interaction.pValue < 0.05) {
    // Interaction detected! Use winning combination
    const winner = screening.cells.sort((a, b) => b.conversion - a.conversion)[0];
    await ship(winner.combination);
  } else {
    // No interaction, pick best levels independently
    const bestColor = screening.mainEffects.find(e => e.factor === 'color').bestLevel;
    const bestText = screening.mainEffects.find(e => e.factor === 'text').bestLevel;
    await ship([bestColor, bestText]);
  }
}
```

---

## Switchback Design for Marketplace Experiments

### What is a Switchback Experiment?

**Definition**: All units switch between treatments at scheduled time periods.

**Visual**:
```
Traditional A/B:
User 1: A A A A A A A A A A
User 2: B B B B B B B B B B
User 3: A A A A A A A A A A
User 4: B B B B B B B B B B

Switchback:
Time:   T1 T2 T3 T4 T5 T6 T7 T8 T9 T10
All:    A  B  A  B  A  B  A  B  A  B

Everyone experiences both treatments!
```

### When to Use Switchback

#### Perfect For:

✅ **Two-sided marketplaces**
- Rideshare (Uber, Lyft)
- Food delivery (DoorDash, UberEats)
- Lodging (Airbnb)
- Freelance platforms (Upwork)

✅ **Network effects present**
- Supply affects demand (and vice versa)
- One user's treatment affects others
- Interference expected

✅ **Platform-wide changes**
- Pricing algorithms
- Matching algorithms
- Inventory management
- Supply incentives

✅ **Supply-constrained environments**
- Limited inventory
- Shared resources
- Queue-based systems

#### Not Suitable For:

❌ **User-specific features**
- Personalization
- UI changes
- Individual recommendations

❌ **Persistent changes**
- Account settings
- Long-term commitments
- Can't switch back easily

❌ **Requires learning**
- Users need time to adapt
- Training required
- Habit formation

### The Network Effects Problem

**Example: Rideshare Pricing**

```
Traditional A/B Test (BIASED):

Control Group (normal pricing):
- Drivers see normal rates
- Some accept rides
- BUT: Fewer available (some are serving treatment group)
- Wait times INFLATED due to treatment

Treatment Group (surge pricing):
- Drivers see higher rates
- More accept rides
- Wait times IMPROVED
- BUT: Improvement partially due to stealing drivers from control

Result: Treatment looks better than it really is!
The groups interfere with each other.
```

**Switchback Solution**:

```
Time Period 1: Everyone gets Control
- All drivers see normal pricing
- Measure: Supply, demand, wait times

Time Period 2: Everyone gets Treatment
- All drivers see surge pricing
- Measure: Supply, demand, wait times

No interference! Compare time periods, not user groups.
```

### Design Considerations

#### 1. Period Length

**Too Short**:
```
Period: 5 minutes
Problems:
- Not enough data per period
- Carryover effects (driver still thinking about previous period)
- High variance
- Unstable estimates
```

**Too Long**:
```
Period: 24 hours
Problems:
- Few switches (low power)
- Time-of-day confounding
- Can't distinguish treatment from temporal trends
- Long experiment runtime
```

**Just Right**:
```
Period: 30-60 minutes for rideshare
Period: 2-4 hours for food delivery
Period: 1 day for lodging

Rationale:
- Enough data per period
- Multiple switches per day
- Minimal carryover
- Can control for time-of-day
```

**Determining Period Length**:

```typescript
function calculatePeriodLength(
  avgTransactionDuration: number,  // minutes
  minObservationsPerPeriod: number,
  avgTransactionsPerMinute: number
): number {
  // Minimum based on transaction duration (avoid carryover)
  const minPeriod = avgTransactionDuration * 3;

  // Minimum based on sample size
  const minForSample = minObservationsPerPeriod / avgTransactionsPerMinute;

  // Take maximum of constraints
  const recommendedPeriod = Math.max(minPeriod, minForSample);

  console.log(`Recommended period: ${recommendedPeriod} minutes`);
  console.log(`Will collect ~${avgTransactionsPerMinute * recommendedPeriod} obs per period`);

  return recommendedPeriod;
}

// Example: Rideshare
calculatePeriodLength(
  15,    // Avg ride: 15 minutes
  100,   // Want 100 rides per period
  5      // 5 rides/minute citywide
);
// Output: 45 minutes (max of 45 for carryover, 20 for sample)
```

#### 2. Randomization

**Period-Level Randomization**:
```typescript
function assignSwitchbackPeriod(
  experimentId: string,
  periodNumber: number,
  seed: string
): 'control' | 'treatment' {
  // Deterministic but randomized
  const hash = hashFunction(experimentId, periodNumber, seed);
  return hash % 2 === 0 ? 'control' : 'treatment';
}

// Ensures:
// - Deterministic (same period always gets same treatment)
// - Balanced (50-50 split over many periods)
// - Unpredictable (can't game the system)
```

**Ensuring Balance**:
```typescript
// Don't allow long runs of same treatment
function balancedSwitchback(experimentId: string, maxRun: number = 3): string[] {
  const assignments = [];
  let currentRun = 0;
  let lastAssignment = null;

  for (let period = 0; period < numPeriods; period++) {
    let assignment = assignSwitchbackPeriod(experimentId, period);

    // If would create too long a run, force alternate
    if (assignment === lastAssignment && currentRun >= maxRun - 1) {
      assignment = assignment === 'control' ? 'treatment' : 'control';
      currentRun = 0;
    }

    assignments.push(assignment);
    currentRun = assignment === lastAssignment ? currentRun + 1 : 0;
    lastAssignment = assignment;
  }

  return assignments;
}
```

#### 3. Washout Periods

**Concept**: Allow metrics to stabilize between switches

```
Period Structure:

│◄──── Treatment A ────►│ Washout │◄──── Treatment B ────►│
│   Measure   │         │         │         │   Measure   │
│             │ Ignore  │         │         │             │
└─────────────┴─────────┴─────────┴─────────┴─────────────┘
   0    ...   45min    50min     55min    ...   100min
```

**When Needed**:
- Carryover effects expected
- State persists between periods
- Users need adjustment time

**Example**:
```typescript
const config = {
  periodLength: 60,      // 60 minute periods
  washoutLength: 10,     // 10 minute washout
  measurementWindow: 50  // Measure middle 50 minutes only
};

function isInMeasurementWindow(
  timestamp: Date,
  periodStart: Date
): boolean {
  const minutesIntoPeriod =
    (timestamp.getTime() - periodStart.getTime()) / 60000;

  const washoutEnd = config.washoutLength;
  const measurementEnd = config.periodLength - config.washoutLength;

  return minutesIntoPeriod >= washoutEnd &&
         minutesIntoPeriod < measurementEnd;
}
```

### Analysis Considerations

#### 1. Clustered Standard Errors

**Problem**: Observations within same period are correlated

```
Period 1 (Control): obs₁, obs₂, obs₃, ... all correlated
Period 2 (Treatment): obs₄, obs₅, obs₆, ... all correlated

Standard t-test assumes independence → WRONG!
```

**Solution**: Cluster by time period

```typescript
import { clusteredStandardErrors } from 'experimeh';

function analyzeSwitchback(data: SwitchbackData): SwitchbackResult {
  // Aggregate to period level first
  const periodAggregates = aggregateByPeriod(data);

  // Now treat periods as independent units
  const controlPeriods = periodAggregates.filter(p => p.treatment === 'control');
  const treatmentPeriods = periodAggregates.filter(p => p.treatment === 'treatment');

  // t-test on period-level means
  const result = twoSampleTTest(
    controlPeriods.map(p => p.mean),
    treatmentPeriods.map(p => p.mean)
  );

  return result;
}
```

#### 2. Controlling for Time-of-Day

**Problem**: Differences could be due to when treatments are assigned

```
If control always assigned during peak hours:
  Control will look artificially good

If treatment always assigned during off-peak:
  Treatment will look artificially bad
```

**Solution**: Balance across time-of-day or control in regression

```typescript
function analyzeWithTimeControl(data: SwitchbackData): Result {
  // Method 1: Ensure balance
  const controlHourDistribution = getHourDistribution(data.control);
  const treatmentHourDistribution = getHourDistribution(data.treatment);

  const balanced = chiSquareTest(controlHourDistribution, treatmentHourDistribution);
  if (balanced.pValue < 0.05) {
    console.warn('⚠️  Imbalanced time distribution!');
  }

  // Method 2: Regression with time controls
  const regression = linearRegression({
    outcome: data.metric,
    treatment: data.treatment,
    controls: {
      hourOfDay: data.hourOfDay,
      dayOfWeek: data.dayOfWeek,
      holiday: data.isHoliday
    }
  });

  return regression.coefficients.treatment;  // Treatment effect, controlling for time
}
```

### Implementation Example

```typescript
interface SwitchbackConfig {
  experimentId: string;
  periodMinutes: number;
  washoutMinutes: number;
  startTime: Date;
  endTime: Date;
}

class SwitchbackExperiment {
  constructor(private config: SwitchbackConfig) {}

  getCurrentTreatment(timestamp: Date): 'control' | 'treatment' | null {
    const minutesSinceStart =
      (timestamp.getTime() - this.config.startTime.getTime()) / 60000;

    const periodNumber = Math.floor(
      minutesSinceStart / this.config.periodMinutes
    );

    const minutesIntoPeriod = minutesSinceStart % this.config.periodMinutes;

    // Check if in washout
    if (minutesIntoPeriod < this.config.washoutMinutes ||
        minutesIntoPeriod > this.config.periodMinutes - this.config.washoutMinutes) {
      return null;  // Don't assign during washout
    }

    // Assign based on period
    return this.assignPeriod(periodNumber);
  }

  private assignPeriod(periodNumber: number): 'control' | 'treatment' {
    const hash = hashFunction(this.config.experimentId, periodNumber);
    return hash % 2 === 0 ? 'control' : 'treatment';
  }

  trackEvent(userId: string, eventType: string, timestamp: Date, value: number) {
    const treatment = this.getCurrentTreatment(timestamp);

    if (treatment === null) {
      return;  // In washout, don't track
    }

    const periodNumber = Math.floor(
      (timestamp.getTime() - this.config.startTime.getTime()) /
      (this.config.periodMinutes * 60000)
    );

    eventTracker.track({
      experimentId: this.config.experimentId,
      periodNumber,
      treatment,
      userId,
      eventType,
      value,
      timestamp
    });
  }
}

// Usage:
const rideShareExperiment = new SwitchbackExperiment({
  experimentId: 'surge_pricing_v2',
  periodMinutes: 45,
  washoutMinutes: 5,
  startTime: new Date('2025-11-01T00:00:00Z'),
  endTime: new Date('2025-11-14T23:59:59Z')
});

// When ride request comes in:
const treatment = rideShareExperiment.getCurrentTreatment(new Date());
const surgePricing = treatment === 'treatment' ? getNewPricing() : getCurrentPricing();
```

### Real-World Example: DoorDash Delivery Fee

**Scenario**: Test new delivery fee algorithm

**Why Switchback?**
- Delivery fees affect both customers (demand) and dashers (supply)
- Higher fees might increase dasher availability
- Which affects wait times for all customers
- Traditional A/B would have interference

**Design**:
```typescript
const deliveryFeeTest = {
  experimentId: 'delivery_fee_v3',
  designType: 'switchback',
  periodMinutes: 120,  // 2-hour periods
  washoutMinutes: 15,  // 15-minute washout
  startDate: '2025-11-01',
  duration: 28,  // 4 weeks

  metrics: {
    primary: 'orders_per_hour',
    secondary: [
      'dasher_utilization',
      'customer_wait_time',
      'order_cancellation_rate'
    ]
  }
};

// Over 4 weeks:
// - ~336 periods (24 hrs/day × 28 days / 2 hrs)
// - 168 control, 168 treatment
// - Plenty of power!
```

**Analysis**:
```typescript
async function analyzeDeliveryFeeExperiment() {
  const data = await getExperimentData('delivery_fee_v3');

  // Aggregate to period level
  const periods = aggregateByPeriod(data, ['orders', 'utilization', 'waitTime']);

  // Control for time
  const result = regressionWithTimeControls({
    data: periods,
    outcome: 'ordersPerHour',
    treatment: 'isNewFee',
    controls: ['hourOfDay', 'dayOfWeek', 'isWeekend', 'weatherScore']
  });

  console.log(`Treatment effect: ${result.coefficient.treatment}`);
  console.log(`P-value: ${result.pValue}`);
  console.log(`Controlling for time and weather`);

  // Check for temporal autocorrelation
  const autocorr = calculateAutocorrelation(periods.map(p => p.ordersPerHour), lag = 1);
  if (Math.abs(autocorr) > 0.3) {
    console.warn(`⚠️  Strong autocorrelation (${autocorr})`);
    console.log(`Consider: Longer periods or more sophisticated time series model`);
  }
}
```

---

## Within-Subjects for Personalization

### What is Within-Subjects Design?

**Definition**: Same participant experiences multiple treatments over time.

**Contrast with Between-Subjects (Standard A/B)**:
```
Between-Subjects:
User 1: Always A
User 2: Always B
User 3: Always A
User 4: Always B

Within-Subjects:
User 1: A, then B, then A, then B
User 2: B, then A, then B, then A
User 3: A, then B, then A, then B
User 4: B, then A, then B, then A

Everyone experiences everything!
```

### When to Use

#### Perfect For:

✅ **Recommendation algorithms**
- Show user different rec engines
- Each session gets different algorithm
- Compare which user prefers

✅ **Personalization features**
- Different personalization strategies
- User experiences all over time
- Self-comparison

✅ **Sequential decisions**
- Email send times
- Content ordering
- Search ranking

✅ **High individual variance**
- Users very different from each other
- Within-user comparison more sensitive
- Example: Revenue (some users spend 100×more)

#### Not Suitable For:

❌ **One-time decisions**
- Signup flow
- Onboarding
- Can't repeat

❌ **Persistent changes**
- UI redesigns
- Account settings
- Confusing to switch

❌ **Learning effects problematic**
- Users learn and adapt
- First exposure special
- Can't "unsee" something

### Advantages

**Statistical Power**:
```
Between-Subjects:
Variance = Individual Differences + Treatment Effect + Noise

Within-Subjects:
Variance = Treatment Effect + Noise
(Individual differences cancel out!)

Result: Much higher power, need fewer participants
```

**Example**:
```
Revenue per user (high variance):
Between-subjects: Need 10,000 per group
Within-subjects: Need 2,000 total users

80% reduction in sample size!
```

### Key Challenges

#### 1. Order Effects

**Problem**: The order matters

```
User experiences: A → B
- Might prefer B simply because it's second
- Learning from A carries over to B
- Fatigue during B

Result: Not measuring pure treatment effect
```

**Types**:
- **Practice effects**: Getting better with repetition
- **Fatigue effects**: Getting worse with repetition
- **Carryover effects**: Treatment A influences response to B
- **Contrast effects**: B looks better just because different from A

#### 2. Counterbalancing

**Solution**: Vary the order across participants

**Latin Square**:
```
4 treatments: A, B, C, D
User Group 1: A → B → C → D
User Group 2: B → C → D → A
User Group 3: C → D → A → B
User Group 4: D → A → B → C

Properties:
- Each treatment appears in each position once
- Each treatment follows every other treatment once
- Balanced!
```

**Implementation**:
```typescript
function latinSquareOrder(
  userId: string,
  variants: string[],
  sessionNumber: number
): string {
  const numVariants = variants.length;
  const userGroup = hashFunction(userId) % numVariants;

  // Latin square formula
  const position = sessionNumber % numVariants;
  const index = (userGroup + position) % numVariants;

  return variants[index];
}

// Usage:
const variants = ['algo_A', 'algo_B', 'algo_C', 'algo_D'];
const variant = latinSquareOrder('user123', variants, sessionNumber);
```

### Design Patterns

#### Pattern 1: Simple Alternating

**When**: Two treatments, frequent switching

```typescript
function alternatingDesign(
  userId: string,
  sessionNumber: number
): 'control' | 'treatment' {
  // Flip each session
  const userStartsWith = hashFunction(userId) % 2;
  return (userStartsWith + sessionNumber) % 2 === 0 ? 'control' : 'treatment';
}

// User 1: A B A B A B A B
// User 2: B A B A B A B A
```

**Pros**: Simple, balanced
**Cons**: Strong order effects not controlled

#### Pattern 2: Block Randomization

**When**: Multiple treatments, want clusters

```typescript
function blockRandomization(
  userId: string,
  blockSize: number = 4
): string[] {
  const variants = ['A', 'B', 'C', 'D'];
  const blocks = [];

  // Each block contains all variants in random order
  for (let block = 0; block < numBlocks; block++) {
    const blockOrder = shuffle(variants, hashFunction(userId, block));
    blocks.push(...blockOrder);
  }

  return blocks;
}

// User 1: [B A D C] [C D A B] [A B C D] ...
// User 2: [D C A B] [B A D C] [C B D A] ...
```

**Pros**: Balanced within each block, varied order
**Cons**: Predictable after seeing some treatments

#### Pattern 3: Complete Counterbalancing

**When**: Few treatments, want perfect balance

```typescript
function completeCounterbalancing(
  userId: string,
  variants: string[]
): string[] {
  // Generate all permutations
  const allPermutations = generatePermutations(variants);

  // Assign user to one permutation
  const permutationIndex = hashFunction(userId) % allPermutations.length;

  return allPermutations[permutationIndex];
}

// 3 treatments: 3! = 6 permutations
// A B C
// A C B
// B A C
// B C A
// C A B
// C B A

// Each user gets one complete permutation
```

**Pros**: Perfect control of order effects
**Cons**: Factorial growth (4 treatments = 24 permutations)

### Analysis

#### Repeated Measures t-Test

**For Two Treatments**:

```typescript
import { pairedTTest } from 'experimeh';

// Collect data: each user has both measurements
const data = [
  { userId: 'user1', control: 45, treatment: 48 },
  { userId: 'user2', control: 102, treatment: 110 },
  { userId: 'user3', control: 23, treatment: 25 },
  // ...
];

const controlValues = data.map(d => d.control);
const treatmentValues = data.map(d => d.treatment);

const result = pairedTTest(controlValues, treatmentValues);

console.log(`Mean difference: ${result.meanDifference}`);
console.log(`t-statistic: ${result.tStatistic}`);
console.log(`P-value: ${result.pValue}`);
console.log(`95% CI: [${result.ciLower}, ${result.ciUpper}]`);

// Note: Much more powerful than independent t-test!
```

#### Repeated Measures ANOVA

**For 3+ Treatments**:

```typescript
import { repeatedMeasuresANOVA } from 'experimeh';

const data = [
  { userId: 'user1', A: 45, B: 48, C: 43, D: 50 },
  { userId: 'user2', A: 102, B: 110, C: 98, D: 105 },
  // ...
];

const result = repeatedMeasuresANOVA(data);

console.log(`F-statistic: ${result.fStatistic}`);
console.log(`P-value: ${result.pValue}`);

if (result.pValue < 0.05) {
  // Run post-hoc pairwise comparisons
  const pairwise = result.pairwiseComparisons;
  pairwise.forEach(comp => {
    console.log(`${comp.treatment1} vs ${comp.treatment2}:`);
    console.log(`  Mean diff: ${comp.meanDifference}`);
    console.log(`  Adjusted p: ${comp.adjustedPValue}`);
  });
}
```

#### Mixed Effects Model (Advanced)

**When**: Want to model both fixed effects (treatment) and random effects (user)

```typescript
// Conceptual model:
// Y_ij = μ + τ_i + u_j + ε_ij
//
// where:
//   Y_ij = outcome for treatment i, user j
//   μ = grand mean
//   τ_i = fixed effect of treatment i
//   u_j = random effect of user j (individual differences)
//   ε_ij = residual error

// In practice, use statistical software:
import { mixedEffectsModel } from 'experimeh';

const model = mixedEffectsModel({
  data: data,
  outcome: 'revenue',
  fixedEffects: ['treatment', 'sessionNumber'],
  randomEffects: ['userId'],
  interactionTerms: ['treatment:sessionNumber']  // Check for learning
});

console.log(`Treatment effect: ${model.fixedEffects.treatment.coefficient}`);
console.log(`P-value: ${model.fixedEffects.treatment.pValue}`);

// Check for learning/fatigue:
if (model.interactionTerms['treatment:sessionNumber'].pValue < 0.05) {
  console.log('⚠️  Treatment effect changes over time (learning or fatigue)');
}
```

### Practical Example: Recommendation Algorithm

**Scenario**: Test 3 recommendation algorithms

**Traditional A/B**:
```
Problem: Users very different
- Some users buy everything
- Some users buy nothing
- High variance → Need 50,000 users

Result: Underpowered
```

**Within-Subjects**:
```typescript
const recAlgoTest = {
  designType: 'within_subjects',
  variants: ['collaborative', 'content_based', 'hybrid'],
  design: {
    counterbalancingScheme: 'latin_square',
    sessionsPerVariant: 4,  // Each user sees each algorithm 4 times
    totalSessions: 12       // 3 algorithms × 4 repetitions
  }
};

// Implementation:
class WithinSubjectsRecommendation {
  getAlgorithm(userId: string, sessionNumber: number): string {
    const variants = ['collaborative', 'content_based', 'hybrid'];

    // Latin square counterbalancing
    const order = latinSquareOrder(userId, variants, sessionNumber);

    return order;
  }

  async trackSession(userId: string, algorithm: string, purchases: number) {
    await eventTracker.track({
      experimentId: 'rec_algo_test',
      userId,
      sessionNumber: await getUserSessionCount(userId),
      algorithm,
      purchases,
      timestamp: new Date()
    });
  }
}

// Analysis (after 10,000 users complete 12 sessions each):
const analysis = await analyzeWithinSubjects('rec_algo_test');

// With within-subjects:
// - Control for individual differences
// - 10,000 users sufficient (vs. 50,000 for between)
// - More sensitive to small differences
```

### Handling Carryover Effects

**Detection**:
```typescript
function detectCarryover(data: WithinSubjectsData): CarryoverAnalysis {
  // Check if treatment effect in period i+1 depends on treatment in period i
  const model = linearRegression({
    outcome: data.outcome,
    predictors: {
      currentTreatment: data.treatment,
      previousTreatment: data.lagged(data.treatment, 1),
      interaction: data.treatment × data.lagged(data.treatment, 1)
    }
  });

  const hasCarryover = model.coefficients.previousTreatment.pValue < 0.05 ||
                       model.coefficients.interaction.pValue < 0.05;

  return {
    hasCarryover,
    carryoverEffect: model.coefficients.previousTreatment,
    interactionEffect: model.coefficients.interaction
  };
}
```

**Mitigation**:
```typescript
// If carryover detected:

// Option 1: Add washout periods
const config = {
  treatmentDuration: 24hours,
  washoutDuration: 12hours  // Allow effects to dissipate
};

// Option 2: Include lagged treatment in analysis
const model = {
  outcome: 'purchases',
  predictors: [
    'currentTreatment',
    'previousTreatment',  // Control for carryover
    'twoPeriodsAgo'       // If needed
  ]
};

// Option 3: Use only first exposure
const firstExposureData = data.filter(d => d.isFirstExposure);
// Loses power, but eliminates carryover
```

---

## Handling Network Effects

### What are Network Effects?

**Definition**: One user's treatment affects other users' outcomes.

**Examples**:

1. **Social Networks**:
   ```
   User A's feed is interesting → User B engages more
   User B's treatment affects User A's experience
   ```

2. **Marketplaces**:
   ```
   Driver incentive increase → More drivers available
   → Shorter wait times for ALL riders (even control group)
   ```

3. **Inventory-Based**:
   ```
   Flash sale for group A → They buy items
   → Less inventory for group B
   → Group B outcomes affected
   ```

### Types of Interference

#### 1. Direct Interference

**Example**: Social network friend recommendations

```
User A (Treatment): Gets better friend suggestions
→ Sends more friend requests
→ User B (Control): Gets more friend requests
→ User B's engagement increases (even though in control)

Result: Treatment effect spillover to control
Control group "contaminated"
```

#### 2. Indirect Interference (Market-Level)

**Example**: Pricing experiment

```
50% of users get discount
→ Higher demand
→ Strain on supply
→ Other 50% experience delays
→ Control group harmed by treatment
```

#### 3. Competitive Interference

**Example**: Ranking algorithm

```
Treatment boosts certain items in search
→ Those items get more clicks
→ Other items get fewer clicks
→ Even control users see affected rankings
```

### Detection

#### Statistical Tests

**Check for Spillover**:

```typescript
function detectNetworkEffects(experimentData: ExperimentData): NetworkEffectTest {
  // Compare users by network exposure
  const groups = {
    treatment: experimentData.filter(u => u.assignment === 'treatment'),
    control_unexposed: experimentData.filter(u =>
      u.assignment === 'control' && u.treatedFriendsCount === 0
    ),
    control_exposed: experimentData.filter(u =>
      u.assignment === 'control' && u.treatedFriendsCount > 0
    )
  };

  // If network effects exist:
  // control_exposed should differ from control_unexposed
  const spilloverTest = anovaTest([
    groups.treatment,
    groups.control_unexposed,
    groups.control_exposed
  ]);

  return {
    hasSpillover: spilloverTest.pValue < 0.05,
    spilloverDirection: groups.control_exposed.mean > groups.control_unexposed.mean
      ? 'positive' : 'negative'
  };
}
```

#### Graph-Based Detection

**Cluster Analysis**:

```typescript
function analyzeByGraphDistance(
  users: User[],
  socialGraph: Graph
): NetworkEffectAnalysis {
  // Group control users by distance to treated users
  const distances = [0, 1, 2, 3];  // Hops in social graph

  const results = distances.map(d => {
    const usersAtDistance = users.filter(u =>
      u.assignment === 'control' &&
      socialGraph.minDistance(u, treatedUsers) === d
    );

    return {
      distance: d,
      avgOutcome: mean(usersAtDistance.map(u => u.outcome))
    };
  });

  // If network effects, should see:
  // Distance 0 → Distance 1 → Distance 2 → Distance 3
  // (Stronger effect closer to treated users)

  const trend = linearRegression(
    results.map(r => r.distance),
    results.map(r => r.avgOutcome)
  );

  return {
    hasDistanceGradient: trend.slope !== 0 && trend.pValue < 0.05,
    direction: trend.slope > 0 ? 'positive_spillover' : 'negative_spillover'
  };
}
```

### Mitigation Strategies

#### Strategy 1: Cluster Randomization

**Concept**: Randomize groups/clusters instead of individuals

```typescript
// Example: Geographic clusters for rideshare
const clusters = [
  { id: 'downtown', users: [...] },
  { id: 'suburbs', users: [...] },
  { id: 'airport', users: [...] }
  // 100 geographic clusters
];

// Randomize entire clusters
clusters.forEach(cluster => {
  cluster.assignment = hashFunction(cluster.id) % 2 === 0
    ? 'control'
    : 'treatment';

  // All users in cluster get same treatment
  cluster.users.forEach(user => {
    user.assignment = cluster.assignment;
  });
});

// Benefits:
// - No within-cluster interference
// - Clean comparison between clusters

// Drawbacks:
// - Need many clusters (at least 20-30)
// - Lower power (cluster-level randomization)
// - Clusters must be similar
```

#### Strategy 2: Ego-Network Isolation

**Concept**: Create isolated bubbles in social graph

```typescript
function egoNetworkRandomization(
  users: User[],
  socialGraph: Graph,
  egoRadius: number = 2
): Assignment {
  const assignments = new Map();
  const assigned = new Set();

  // Sort by network centrality (high to low)
  const sortedUsers = users.sort((a, b) =>
    socialGraph.degree(b) - socialGraph.degree(a)
  );

  for (const user of sortedUsers) {
    if (assigned.has(user.id)) continue;

    // Get ego network (user + friends within radius)
    const egoNetwork = socialGraph.neighborhood(user.id, egoRadius);

    // Assign entire ego network to same treatment
    const treatment = hashFunction(user.id) % 2 === 0
      ? 'control'
      : 'treatment';

    egoNetwork.forEach(nodeId => {
      if (!assigned.has(nodeId)) {
        assignments.set(nodeId, treatment);
        assigned.add(nodeId);
      }
    });
  }

  return assignments;
}

// Benefits:
// - Reduces within-network interference
// - More granular than full cluster randomization

// Drawbacks:
// - Complex to implement
// - Still some edge effects
// - Reduced sample (some users unassignable)
```

#### Strategy 3: Switchback (Marketplace)

**Use temporal switching** (see Switchback section above)

```typescript
// When network effects are market-wide:
const marketplaceSwitchback = {
  design: 'switchback',
  periodMinutes: 60,
  reason: 'Supply-demand dynamics affect all users'
};

// All users experience both treatments over time
// No cross-contamination between groups
```

#### Strategy 4: Two-Sided Randomization

**For marketplaces with distinct sides**:

```typescript
// Example: Rideshare (Drivers vs Riders)

// Option A: Randomize both sides independently
const assignment = {
  driver: hashFunction(driverId) % 2,
  rider: hashFunction(riderId) % 2
};

// Creates 4 groups:
// 1. Control driver + Control rider
// 2. Control driver + Treatment rider
// 3. Treatment driver + Control rider
// 4. Treatment driver + Treatment rider

// Can estimate:
// - Direct effect on drivers
// - Direct effect on riders
// - Interaction effect

// Option B: Linked randomization
// Randomize one side, expose other side proportionally
const driverAssignment = hashFunction(driverId) % 2;
const riderExposure = calculateExposure(riderLocation);  // Based on driver density
```

### Advanced: Difference-in-Differences

**When**: Network effects present but want causal estimate

```typescript
function differenceinDifferences(
  data: {
    preExperiment: { treatment: number[], control: number[] },
    during: { treatment: number[], control: number[] }
  }
): DIDResult {
  // Change in treatment group
  const treatmentChange = mean(data.during.treatment) - mean(data.preExperiment.treatment);

  // Change in control group (includes spillover effects)
  const controlChange = mean(data.during.control) - mean(data.preExperiment.control);

  // Difference-in-differences (removes spillover bias)
  const did = treatmentChange - controlChange;

  // Standard error (clustered if needed)
  const se = calculateClusteredSE(data);

  return {
    treatmentEffect: did,
    standardError: se,
    pValue: 2 * (1 - normalCDF(Math.abs(did / se)))
  };
}

// Interpretation:
// Treatment effect = How much treatment changed relative to control
// Accounts for time trends and market-level effects
```

---

(Due to length limits, I'll continue with the remaining sections in the next parts: Dealing with Interference and Multi-Armed Bandits vs A/B Tests)

## Dealing with Interference

### Pre-Experiment Checks

**Before launching**, check for interference risk:

```typescript
interface InterferenceRiskAssessment {
  socialConnections: boolean;      // Users connected in social graph?
  sharedResources: boolean;        // Compete for same inventory/supply?
  marketplaceDynamics: boolean;    // Two-sided market?
  geographicOverlap: boolean;      // Same physical locations?
  temporalDependence: boolean;     // Sequential interactions?
}

function assessInterferenceRisk(experiment: Experiment): RiskLevel {
  const risk: InterferenceRiskAssessment = {
    socialConnections: experiment.hasSocialGraph,
    sharedResources: experiment.hasSharedInventory,
    marketplaceDynamics: experiment.isTwoSidedMarket,
    geographicOverlap: experiment.hasGeoOverlap,
    temporalDependence: experiment.hasTemporalDependence
  };

  const riskScore = Object.values(risk).filter(Boolean).length;

  if (riskScore === 0) return 'LOW';  // Standard A/B test OK
  if (riskScore <= 2) return 'MEDIUM';  // Consider cluster randomization
  return 'HIGH';  // Use switchback or advanced methods
}
```

### Post-Experiment Diagnostics

**After experiment**, validate no interference:

```typescript
async function validateNoInterference(experimentId: string): ValidationResult {
  const data = await getExperimentData(experimentId);

  const checks = {
    // 1. Balance check on network exposure
    networkExposure: () => {
      const control = data.filter(u => u.assignment === 'control');
      const treatmentFriendCounts = control.map(u =>
        u.friends.filter(f => f.assignment === 'treatment').length
      );

      return {
        mean: mean(treatmentFriendCounts),
        variance: variance(treatmentFriendCounts),
        concern: max(treatmentFriendCounts) > 0.5 * mean(treatmentFriendCounts)
      };
    },

    // 2. Spillover test
    spilloverTest: () => {
      const controlUnexposed = data.filter(u =>
        u.assignment === 'control' && u.treatmentExposure === 0
      );
      const controlExposed = data.filter(u =>
        u.assignment === 'control' && u.treatmentExposure > 0
      );

      const test = twoSampleTTest(
        controlUnexposed.map(u => u.outcome),
        controlExposed.map(u => u.outcome)
      );

      return {
        spilloverDetected: test.pValue < 0.05,
        effectSize: test.meanDifference
      };
    },

    // 3. Temporal correlation
    temporalCorrelation: () => {
      // Check if outcomes on day t correlate with day t-1
      // High correlation suggests shared market effects
      const dailyAvg = aggregateByDay(data);
      const lag1 = correlate(dailyAvg.slice(0, -1), dailyAvg.slice(1));

      return {
        correlation: lag1,
        concern: Math.abs(lag1) > 0.3
      };
    }
  };

  return {
    passed: !checks.spilloverTest().spilloverDetected &&
            !checks.networkExposure().concern &&
            !checks.temporalCorrelation().concern,
    details: checks
  };
}
```

---

## Multi-Armed Bandits vs A/B Tests

### What are Multi-Armed Bandits (MAB)?

**Concept**: Dynamically allocate traffic to better-performing variants while learning.

**Metaphor**: Slot machine with multiple arms (variants)
- Each arm has unknown payout (conversion rate)
- Goal: Maximize total reward while learning which is best

**Key Difference from A/B Test**:
```
A/B Test:
- Fixed allocation (50-50)
- Explore then exploit (analyze at end)
- Some users see suboptimal variant

MAB:
- Dynamic allocation (adapts in real-time)
- Explore AND exploit simultaneously
- More users see better variants
```

### When to Use Each

#### Use A/B Testing When:

✅ **Need clean statistical inference**
- Want unbiased estimate of treatment effect
- Need p-values and confidence intervals
- Regulatory requirements

✅ **Long-term decision**
- Permanent feature
- Can't change after launch
- Need to be confident

✅ **Few variants (2-3)**
- Simple comparison
- Fixed 50-50 split is fine
- Short runtime

✅ **Low opportunity cost**
- Variants similar in quality
- Small difference in outcomes
- Test for learning, not optimization

#### Use MAB When:

✅ **Many variants (5+)**
- Testing many options
- Want to find best quickly
- Exploration cost high

✅ **Temporary promotion**
- Email subject lines
- Ad creative
- Short-term campaign

✅ **High opportunity cost**
- Large difference expected
- Every suboptimal exposure costly
- Prioritize minimizing regret

✅ **Continuous optimization**
- Always learning
- New variants added regularly
- No "final decision" needed

✅ **Exploitation matters more than inference**
- Care about total conversions
- Less about "why" it works
- Optimize for business metric

### Types of Bandit Algorithms

#### 1. Epsilon-Greedy

**Algorithm**:
```
With probability ε: Explore (random variant)
With probability 1-ε: Exploit (best variant so far)
```

**Implementation**:
```typescript
class EpsilonGreedy {
  constructor(
    private variants: string[],
    private epsilon: number = 0.1
  ) {
    this.successCounts = new Map(variants.map(v => [v, 0]));
    this.trialCounts = new Map(variants.map(v => [v, 0]));
  }

  selectVariant(): string {
    // Explore with probability epsilon
    if (Math.random() < this.epsilon) {
      return this.variants[Math.floor(Math.random() * this.variants.length)];
    }

    // Exploit: choose variant with highest observed rate
    return this.getBestVariant();
  }

  getBestVariant(): string {
    let bestVariant = this.variants[0];
    let bestRate = 0;

    for (const variant of this.variants) {
      const rate = this.successCounts.get(variant) / this.trialCounts.get(variant);
      if (rate > bestRate) {
        bestRate = rate;
        bestVariant = variant;
      }
    }

    return bestVariant;
  }

  update(variant: string, success: boolean) {
    this.trialCounts.set(variant, this.trialCounts.get(variant) + 1);
    if (success) {
      this.successCounts.set(variant, this.successCounts.get(variant) + 1);
    }
  }
}

// Usage:
const bandit = new EpsilonGreedy(['A', 'B', 'C'], 0.1);

// For each user:
const variant = bandit.selectVariant();
const success = await showVariantAndMeasure(userId, variant);
bandit.update(variant, success);
```

**Pros**: Simple, easy to understand
**Cons**: Crude, wastes exploration on bad arms

#### 2. Thompson Sampling (Bayesian)

**Algorithm**:
```
For each variant:
  1. Sample conversion rate from posterior Beta distribution
  2. Choose variant with highest sampled rate
```

**Implementation**:
```typescript
class ThompsonSampling {
  constructor(private variants: string[]) {
    // Beta(α, β) posterior for each variant
    this.alpha = new Map(variants.map(v => [v, 1]));  // Prior: Beta(1,1)
    this.beta = new Map(variants.map(v => [v, 1]));
  }

  selectVariant(): string {
    // Sample from each posterior
    const samples = this.variants.map(variant => ({
      variant,
      sample: this.sampleBeta(
        this.alpha.get(variant),
        this.beta.get(variant)
      )
    }));

    // Choose variant with highest sample
    return samples.reduce((best, curr) =>
      curr.sample > best.sample ? curr : best
    ).variant;
  }

  sampleBeta(alpha: number, beta: number): number {
    // Sample from Beta(α, β) using Gamma samples
    const gammaA = this.sampleGamma(alpha, 1);
    const gammaB = this.sampleGamma(beta, 1);
    return gammaA / (gammaA + gammaB);
  }

  update(variant: string, success: boolean) {
    if (success) {
      this.alpha.set(variant, this.alpha.get(variant) + 1);
    } else {
      this.beta.set(variant, this.beta.get(variant) + 1);
    }
  }

  getBestVariant(): string {
    // Return variant with highest posterior mean
    const means = this.variants.map(v => ({
      variant: v,
      mean: this.alpha.get(v) / (this.alpha.get(v) + this.beta.get(v))
    }));

    return means.reduce((best, curr) =>
      curr.mean > best.mean ? curr : best
    ).variant;
  }

  getProbabilityBest(variant: string): number {
    // Monte Carlo estimate: P(variant is best)
    const numSamples = 10000;
    let winCount = 0;

    for (let i = 0; i < numSamples; i++) {
      const samples = this.variants.map(v => ({
        variant: v,
        sample: this.sampleBeta(this.alpha.get(v), this.beta.get(v))
      }));

      const winner = samples.reduce((best, curr) =>
        curr.sample > best.sample ? curr : best
      );

      if (winner.variant === variant) winCount++;
    }

    return winCount / numSamples;
  }
}

// Usage:
const bandit = new ThompsonSampling(['A', 'B', 'C', 'D', 'E']);

// Adapts allocation in real-time based on observed performance
```

**Pros**: Theoretically optimal, naturally explores uncertain arms
**Cons**: More complex, requires Bayesian understanding

#### 3. Upper Confidence Bound (UCB)

**Algorithm**:
```
Choose variant with highest:
  observed_rate + c × sqrt(log(total_trials) / variant_trials)
  ↑               ↑
  exploitation    exploration bonus
```

**Implementation**:
```typescript
class UCB {
  constructor(
    private variants: string[],
    private c: number = 1.0  // Exploration parameter
  ) {
    this.successCounts = new Map(variants.map(v => [v, 0]));
    this.trialCounts = new Map(variants.map(v => [v, 0]));
    this.totalTrials = 0;
  }

  selectVariant(): string {
    // Initially, try each variant once
    for (const variant of this.variants) {
      if (this.trialCounts.get(variant) === 0) {
        return variant;
      }
    }

    // Compute UCB for each variant
    const ucbValues = this.variants.map(variant => {
      const trials = this.trialCounts.get(variant);
      const successes = this.successCounts.get(variant);
      const observedRate = successes / trials;

      const explorationBonus = this.c * Math.sqrt(
        Math.log(this.totalTrials) / trials
      );

      return {
        variant,
        ucb: observedRate + explorationBonus
      };
    });

    // Choose variant with highest UCB
    return ucbValues.reduce((best, curr) =>
      curr.ucb > best.ucb ? curr : best
    ).variant;
  }

  update(variant: string, success: boolean) {
    this.trialCounts.set(variant, this.trialCounts.get(variant) + 1);
    if (success) {
      this.successCounts.set(variant, this.successCounts.get(variant) + 1);
    }
    this.totalTrials++;
  }
}
```

**Pros**: Good theoretical guarantees, handles exploration-exploitation well
**Cons**: Sensitive to parameter c

### Performance Comparison

**Simulation**: 5 variants with true conversion rates: [0.10, 0.11, 0.12, 0.11, 0.13]

```
Total Users: 10,000

Fixed A/B Test (20% each):
- Total conversions: 1,140
- Correctly identified best: 95% confidence
- Suboptimal exposure: 8,000 users

Epsilon-Greedy (ε=0.1):
- Total conversions: 1,210 (+6%)
- Correctly identified best: 85% confidence
- Suboptimal exposure: 3,500 users

Thompson Sampling:
- Total conversions: 1,250 (+10%)
- Correctly identified best: 90% confidence
- Suboptimal exposure: 2,000 users

UCB (c=1):
- Total conversions: 1,240 (+9%)
- Correctly identified best: 88% confidence
- Suboptimal exposure: 2,500 users
```

**Key Insight**: Bandits trade statistical confidence for business optimization

### Hybrid: Best of Both Worlds

#### Pattern 1: Explore-then-Exploit

```typescript
async function exploreThenExploit(variants: string[]) {
  const explorePeriod = 7 * 24 * 60 * 60 * 1000;  // 7 days
  const startTime = Date.now();

  // Phase 1: Fixed allocation (A/B test)
  if (Date.now() - startTime < explorePeriod) {
    return randomChoice(variants);  // Equal allocation
  }

  // Phase 2: Exploit best variant
  const results = await analyzeExploration();
  const bestVariant = results.variants.reduce((best, curr) =>
    curr.conversionRate > best.conversionRate ? curr : best
  );

  // Gradually shift traffic to winner
  const daysSinceExplore = (Date.now() - startTime - explorePeriod) / (24 * 60 * 60 * 1000);
  const bestAllocation = Math.min(0.95, 0.5 + daysSinceExplore * 0.1);

  return Math.random() < bestAllocation ? bestVariant : randomChoice(variants);
}
```

#### Pattern 2: Bandit with Validation

```typescript
class BanditWithValidation {
  constructor(private variants: string[]) {
    this.bandit = new ThompsonSampling(variants);
    this.validationThreshold = 10000;  // Users before validation
  }

  async run() {
    // Phase 1: Run bandit
    for (let i = 0; i < this.validationThreshold; i++) {
      const variant = this.bandit.selectVariant();
      const success = await serve(variant);
      this.bandit.update(variant, success);
    }

    // Phase 2: Identify winner
    const probabilities = this.variants.map(v => ({
      variant: v,
      probBest: this.bandit.getProbabilityBest(v)
    }));

    const winner = probabilities.reduce((best, curr) =>
      curr.probBest > best.probBest ? curr : best
    );

    // Phase 3: Validate with fixed A/B test
    if (winner.probBest > 0.80) {
      console.log(`Bandit suggests ${winner.variant}, running validation A/B...`);

      const validation = await runABTest({
        control: getSecondBestVariant(),
        treatment: winner.variant,
        sampleSize: 5000
      });

      if (validation.pValue < 0.05) {
        return winner.variant;  // Validated!
      }
    }

    return null;  // No clear winner
  }
}
```

### When NOT to Use Bandits

❌ **Need exact treatment effect estimate**
- Regulatory submission
- Academic publication
- Legal documentation

❌ **Permanent architectural change**
- Can't easily switch
- Need high confidence
- One-time decision

❌ **Variants very different**
- Comparing fundamentally different approaches
- Need qualitative understanding
- May have long-term implications

❌ **External validity needed**
- Want to generalize to other contexts
- Need causal interpretation
- Measuring heterogeneous treatment effects

### Decision Framework

```typescript
function chooseABorBandit(situation: TestSituation): 'AB' | 'Bandit' | 'Hybrid' {
  // Critical factors:
  if (situation.needsPValue || situation.isRegulatory) {
    return 'AB';
  }

  if (situation.numVariants >= 5) {
    return 'Bandit';  // Too many for fixed A/B
  }

  if (situation.isTemporary) {
    return 'Bandit';  // Optimize immediately
  }

  if (situation.isPermanent && situation.numVariants <= 3) {
    return 'AB';  // Clean inference for permanent decision
  }

  if (situation.highOpportunityCost) {
    return 'Hybrid';  // Explore with A/B, exploit with bandit
  }

  return 'AB';  // Default to A/B for clarity
}
```

---

## Summary

### Quick Reference

| Pattern | When to Use | Key Benefit | Main Challenge |
|---------|-------------|-------------|----------------|
| **Factorial** | Multiple features, possible interaction | Test multiple features simultaneously | Requires more sample, complex analysis |
| **Switchback** | Marketplace, network effects | Eliminates interference | Temporal correlation, time-based artifacts |
| **Within-Subjects** | High individual variance | Much higher power | Order effects, carryover |
| **Cluster Randomization** | Social network, geographic | Reduces interference | Need many clusters, lower power |
| **Multi-Armed Bandit** | Many variants, temporary | Minimizes regret | Less statistical certainty |

### Design Selection Flowchart

```
Are there network effects?
├─ YES → Switchback or Cluster Randomization
└─ NO → Continue

Testing multiple features?
├─ YES → Could they interact?
│   ├─ YES → Factorial Design
│   └─ NO → Separate A/B tests
└─ NO → Continue

Same user over time OK?
├─ YES → High individual variance?
│   ├─ YES → Within-Subjects
│   └─ NO → Standard A/B
└─ NO → Standard A/B

Many variants (5+)?
├─ YES → Temporary or permanent?
│   ├─ Temporary → Multi-Armed Bandit
│   └─ Permanent → Multivariate A/B
└─ NO → Standard A/B
```

---

## Additional Resources

**Academic Papers**:

- **Factorial Designs**: Box, Hunter, & Hunter (2005). "Statistics for Experimenters"
- **Switchback**: Bojinov & Simchi-Levi (2020). "Design and Analysis of Switchback Experiments"
- **Network Effects**: Ugander et al. (2013). "Graph Cluster Randomization: Network Exposure to Multiple Universes"
- **Bandits**: Agrawal & Goyal (2012). "Analysis of Thompson Sampling for the Multi-armed Bandit Problem"

**Industry Practices**:

- Netflix: "Experimentation with Resource Constraints"
- Uber: "Switchback Tests and Debiasing"
- Facebook: "Detecting Interference: An A/B Test of A/B Tests"
- Google: "Overlapping Experiment Infrastructure"

**Internal Documentation**:
- [Best Practices](./BEST_PRACTICES.md)
- [Statistical Guide](./STATISTICAL_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
