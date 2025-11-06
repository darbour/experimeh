# Experimentation Best Practices

A comprehensive guide to designing, running, and analyzing experiments with statistical rigor and practical wisdom.

## Table of Contents

1. [Experiment Design Best Practices](#experiment-design-best-practices)
2. [When to Use Each Experimental Design](#when-to-use-each-experimental-design)
3. [Sample Size Determination](#sample-size-determination)
4. [Statistical Significance Guidelines](#statistical-significance-guidelines)
5. [Common Pitfalls and How to Avoid Them](#common-pitfalls-and-how-to-avoid-them)
6. [P-Hacking Prevention](#p-hacking-prevention)
7. [Multiple Testing Correction](#multiple-testing-correction)
8. [Guardrail Metrics Setup](#guardrail-metrics-setup)
9. [Ramp Strategies](#ramp-strategies)
10. [Documentation Requirements](#documentation-requirements)

---

## Experiment Design Best Practices

### 1. Start with a Clear Hypothesis

**Why It Matters**: A well-defined hypothesis guides your entire experiment and prevents post-hoc rationalization.

**Good Hypothesis Structure**:
```
If [we make this change],
Then [this will happen],
Because [this is our reasoning],
We'll measure this by [specific metric]
```

**Example - Good**:
```
If we change the checkout button from blue to green,
Then conversion rate will increase by at least 5%,
Because green signals "go" and creates urgency,
We'll measure this by checkout completion rate
```

**Example - Bad**:
```
"Let's test different button colors and see what happens"
(No hypothesis, no expected direction, no reasoning)
```

**Key Elements**:
- **Direction**: Specify if you expect an increase or decrease
- **Magnitude**: Estimate the expected effect size
- **Reasoning**: Explain WHY you expect this change
- **Primary Metric**: One clear success metric

### 2. Define Metrics Before Launch

**The Rule**: Choose metrics BEFORE looking at any data.

**Metric Categories**:

1. **Primary Metric** (ONE only)
   - The main success criterion
   - What you're optimizing for
   - Example: Purchase conversion rate

2. **Secondary Metrics** (2-5 recommended)
   - Additional outcomes of interest
   - Help understand mechanism
   - Example: Average order value, cart abandonment rate

3. **Guardrail Metrics** (as many as needed)
   - Metrics that shouldn't degrade
   - Safety checks
   - Example: Page load time, error rate, revenue per user

4. **Diagnostic Metrics**
   - Help debug issues
   - Not used for decision-making
   - Example: Button click rate, form field interactions

**Bad Practice**:
```javascript
// DON'T do this:
const results = analyzeAllMetrics(experiment);
const significantMetrics = results.filter(m => m.pValue < 0.05);
console.log(`We found improvements in: ${significantMetrics}`);
// This is p-hacking!
```

### 3. Calculate Sample Size Upfront

**The Process**:

```typescript
import { calculateSampleSize } from 'experimeh';

// BEFORE launching experiment:
const sampleSize = calculateSampleSize('proportion', 0.02, {
  alpha: 0.05,
  power: 0.8,
  baselineRate: 0.10
});

console.log(`Need ${sampleSize.sampleSizePerGroup} users per variant`);
console.log(`At 10,000 users/day, runtime: ${sampleSize.estimatedDays} days`);
```

**Critical Inputs**:
- **Baseline Rate**: Current metric value (from historical data)
- **Minimum Detectable Effect (MDE)**: Smallest change worth detecting
- **Power**: Typically 80% (20% chance of missing real effect)
- **Alpha**: Typically 5% (5% chance of false positive)

**Reality Check**:
- Don't launch if sample size requires >3 months
- Consider stratification or CUPED to reduce required n
- Be honest about MDE - detecting 0.1% changes requires massive samples

### 4. Choose the Right Experimental Design

See [When to Use Each Experimental Design](#when-to-use-each-experimental-design) section below.

### 5. Set Success Criteria

**Before Launch, Define**:
- Minimum improvement for statistical significance (e.g., p < 0.05)
- Minimum improvement for business significance (e.g., +2% conversion)
- Both must be met to declare "winner"
- What constitutes guardrail metric failure

**Example Success Criteria**:
```yaml
experiment: checkout_redesign
success_criteria:
  primary_metric: checkout_conversion_rate
    minimum_statistical_significance: 0.05
    minimum_practical_improvement: 2%  # absolute percentage points

  guardrail_metrics:
    - name: page_load_time
      maximum_degradation: 10%
    - name: error_rate
      maximum_degradation: 5%
    - name: revenue_per_user
      maximum_degradation: 0%

  decision_rule: |
    Ship if primary metric shows significant improvement above 2%
    AND no guardrail violations
    Otherwise, iterate or abandon
```

---

## When to Use Each Experimental Design

### Simple A/B Test

**Use When**:
- Testing a single change (one feature, one variation)
- Binary decision: ship or don't ship
- Straightforward interpretation needed
- Stakeholders unfamiliar with complex designs

**Advantages**:
- Simple to implement and explain
- Maximum statistical power for single comparison
- Clear interpretation

**Disadvantages**:
- Can only test one thing at a time
- Sequential tests take longer
- May miss interaction effects

**Example Scenarios**:
- New checkout flow vs. old
- Price change ($9.99 vs. $10.99)
- Email subject line A vs. B

### Multivariate Test (A/B/C/D/...)

**Use When**:
- Multiple variants of same feature
- Comparing 3+ options
- Want to find best among discrete alternatives

**Advantages**:
- Test multiple options in one experiment
- More efficient than sequential A/B tests
- Can rank order variants

**Disadvantages**:
- Requires larger sample size (splits traffic more ways)
- Multiple comparison corrections needed
- Power decreases with more variants

**Sample Size Impact**:
```
2 variants: Need 1,000/group = 2,000 total
4 variants: Need 1,000/group = 4,000 total
8 variants: Need 1,000/group = 8,000 total
```

**Example Scenarios**:
- Testing 5 different homepage hero images
- Comparing 3 pricing tiers
- Evaluating 4 different recommendation algorithms

### Factorial Design

**Use When**:
- Testing multiple features simultaneously
- Want to detect interaction effects
- Features might influence each other
- Limited traffic but multiple ideas to test

**Advantages**:
- Test multiple factors in time of one experiment
- Detect interactions (when effects depend on each other)
- More statistically efficient than separate tests
- Answer "Do these features work better together?"

**Disadvantages**:
- Complex to analyze and interpret
- Exponential growth in cells (2×2×2 = 8 cells)
- Requires understanding of interaction effects
- Multiple testing correction essential

**Real Example - E-commerce Checkout**:

```
Factor A: Button Color (Blue, Green)
Factor B: Button Text ("Buy Now", "Complete Purchase")
Factor C: Trust Badges (Show, Hide)

Results in 2×2×2 = 8 treatment combinations

Can answer:
1. Does button color matter? (Main effect A)
2. Does button text matter? (Main effect B)
3. Do trust badges matter? (Main effect C)
4. Does button color effect depend on text? (A×B interaction)
5. Do badges work better with certain colors? (A×C interaction)
6. Three-way interaction (A×B×C)
```

**When NOT to Use**:
- If you only care about individual features
- If traffic is very limited (can't fill all cells adequately)
- If interactions are unlikely or not of interest

### Switchback Experiments

**Use When**:
- Network effects or interference suspected
- Two-sided marketplaces (Uber, Airbnb, DoorDash)
- Supply-constrained environments
- Pricing experiments
- Platform-wide changes

**What Are Network Effects?**
```
Without interference:
Control Group: Sees old algorithm → Outcome A
Treatment Group: Sees new algorithm → Outcome B

With interference (bad):
Control Group: Sees old algorithm, but affected by treatment group's behavior → Outcome A'
Treatment Group: Sees new algorithm → Outcome B
Result: Biased estimates!
```

**Switchback Solution**:
```
Time Period 1 (30 min): Everyone gets Control
Time Period 2 (30 min): Everyone gets Treatment
Time Period 3 (30 min): Everyone gets Control
...
```

**Advantages**:
- Eliminates between-unit interference
- Natural for marketplace experiments
- Can use all traffic (no splitting)

**Disadvantages**:
- Requires time-based switching infrastructure
- Temporal correlation to handle
- May need washout periods
- Complex analysis (clustered errors)

**Example Scenarios**:
- Uber driver incentive changes (affects ride availability)
- DoorDash delivery fee experiments (affects supply)
- Pricing changes on two-sided marketplace
- Inventory algorithm changes

**Design Considerations**:
```typescript
{
  "designType": "switchback",
  "designConfig": {
    "switchbackPeriodMinutes": 30,  // Balance: too short = carryover, too long = fewer switches
    "washoutPeriodMinutes": 5,       // Allow metrics to stabilize
    "minimumSwitches": 50            // For adequate power
  }
}
```

### Within-Subjects Design

**Use When**:
- Personalization or recommendation tests
- Same user can experience multiple variants over time
- Individual differences are large source of variance
- Want to reduce sample size requirements

**Advantages**:
- Controls for individual differences
- Much higher statistical power
- Smaller sample size needed
- Natural for sequential decisions

**Disadvantages**:
- Order effects (learning, fatigue)
- Carryover effects
- Requires counterbalancing
- More complex analysis

**Example Scenarios**:
- Recommendation algorithm comparison (show different algorithms on different days)
- Email send time optimization (each user gets emails at different times)
- Search ranking experiments (users see different rankings)

**Counterbalancing**:
```
Latin Square for 4 variants:
User Group 1: A → B → C → D
User Group 2: B → C → D → A
User Group 3: C → D → A → B
User Group 4: D → A → B → C
```

### Stepped Wedge Design

**Use When**:
- All units must eventually receive treatment (ethical requirement)
- Rollout must be gradual (operational constraints)
- Testing at cluster level (hospitals, schools, regions)
- Cannot fully randomize or withhold treatment indefinitely
- Intervention cannot be withdrawn once implemented
- Want to control for time trends

**Advantages**:
- Ethically acceptable when denying treatment is problematic
- All clusters receive treatment by end
- Controls for secular time trends
- Natural for phased rollouts
- Provides before/after data for all clusters

**Disadvantages**:
- Requires cluster-level randomization (reduces power)
- More complex analysis (mixed effects models)
- Longer duration than parallel designs
- Requires sufficient clusters (typically 12+)
- Confounding if strong time trends exist
- Cannot easily stop early

**Example Scenarios**:
- Healthcare: Rolling out new clinical protocol across hospital units
- Education: Implementing new curriculum across school districts
- Public health: Deploying intervention where everyone should benefit
- Policy: Phased implementation of new regulations
- Infrastructure: System upgrades that can't be easily reversed

**Design Considerations**:
```typescript
{
  "designType": "stepped_wedge",
  "designConfig": {
    "numSteps": 5,              // Number of switching periods
    "stepDurationMinutes": 10080, // 1 week per step
    "clusterKey": "hospital_id",  // How to identify clusters
    "numClusters": 20            // Total clusters
  }
}
```

**Sample Size Considerations**:
- Need sufficient clusters (not just individuals)
- Account for ICC (intracluster correlation)
- Design effect: DE = 1 + (m - 1) × ICC
- Higher ICC requires more clusters
- Typical: 12-20 clusters minimum

**When NOT to Use**:
- Small number of clusters (< 12)
- Treatment can be easily randomized at individual level
- No ethical requirement for all to receive treatment
- Need quick results (stepped wedge takes longer)
- Very high ICC (> 0.20) makes design inefficient

### Quick Decision Tree

```
START: Do you have network effects or interference?
  ├─ YES → Use Switchback Design
  └─ NO → Continue

  Must all units eventually receive treatment?
  ├─ YES → Are you rolling out across clusters?
  │   ├─ YES → Use Stepped Wedge Design
  │   └─ NO → Continue
  └─ NO → Continue

  Is this the same user over time?
  ├─ YES → Use Within-Subjects Design
  └─ NO → Continue

  Testing multiple features?
  ├─ YES → Do you care about interactions?
  │   ├─ YES → Use Factorial Design
  │   └─ NO → Run separate A/B tests
  └─ NO → Continue

  Testing 3+ variants of same thing?
  ├─ YES → Use Multivariate Test
  └─ NO → Use Simple A/B Test
```

---

## Sample Size Determination

### Understanding the Key Parameters

**1. Alpha (α) - Significance Level**
- Probability of false positive (Type I error)
- Standard: 0.05 (5%)
- Interpretation: "5% chance we say there's an effect when there isn't"
- Use 0.01 for critical experiments (more conservative)

**2. Power (1 - β) - Statistical Power**
- Probability of detecting real effect (1 - Type II error)
- Standard: 0.80 (80%)
- Interpretation: "80% chance we detect effect if it exists"
- Use 0.90 for critical experiments (more sensitive)

**3. Effect Size**
- How big is the change you want to detect?
- Be realistic - overly optimistic = underpowered
- Look at historical data for similar changes

**4. Baseline Rate**
- Current value of your metric
- Must be accurate - use 30+ days of data
- Account for seasonality

### Practical Sample Size Examples

#### Conversion Rate Experiments

```typescript
// Scenario 1: Large conversion rate, moderate lift
const result1 = calculateSampleSize('proportion', 0.02, {
  alpha: 0.05,
  power: 0.80,
  baselineRate: 0.20  // 20% baseline
});
// Need ~2,400 per group (4,800 total)
// At 5,000 visitors/day → 2 days

// Scenario 2: Small conversion rate, moderate lift
const result2 = calculateSampleSize('proportion', 0.005, {
  alpha: 0.05,
  power: 0.80,
  baselineRate: 0.05  // 5% baseline
});
// Need ~15,000 per group (30,000 total)
// At 5,000 visitors/day → 6 days

// Scenario 3: Small effect, small baseline (HARD!)
const result3 = calculateSampleSize('proportion', 0.001, {
  alpha: 0.05,
  power: 0.80,
  baselineRate: 0.02  // 2% baseline
});
// Need ~100,000+ per group (200,000+ total)
// At 5,000 visitors/day → 40+ days
// Consider: Is this effect worth detecting?
```

#### Continuous Metrics (Revenue, Time, etc.)

```typescript
// Effect size = (expected difference) / standard deviation
const avgRevenue = 50;  // $50 average
const stdDev = 30;      // $30 standard deviation
const expectedIncrease = 2.5;  // $2.50 increase expected

const cohensD = expectedIncrease / stdDev;  // 0.083 (small!)

const result = calculateSampleSize('continuous', cohensD, {
  alpha: 0.05,
  power: 0.80
});
// Need ~23,000 per group
```

### The Hard Truth About Small Effects

**Reality Check**:

| Baseline | Absolute Change | Relative Lift | Sample/Group | Runtime @10k/day |
|----------|----------------|---------------|--------------|------------------|
| 10%      | +2%            | +20%          | ~2,000       | 4 days          |
| 10%      | +1%            | +10%          | ~8,000       | 16 days         |
| 10%      | +0.5%          | +5%           | ~32,000      | 64 days         |
| 10%      | +0.1%          | +1%           | ~800,000     | 160 days        |

**Lesson**: Detecting small effects requires massive samples. Be realistic about:
- Whether small effects matter to business
- Whether you have enough traffic
- Whether waiting months is acceptable

### Strategies to Reduce Required Sample Size

**1. CUPED (Variance Reduction)**
- Can reduce variance by 30-70%
- Equivalent to 2-5× sample size increase
- Requires pre-experiment data
- See STATISTICAL_GUIDE.md for details

**2. Increase Effect Size**
- Make bolder changes
- Trade statistical risk for business risk
- Iterate in larger steps

**3. Focus on High-Impact Segments**
- Test on segments with stronger expected effects
- Example: Test pricing on price-sensitive segment

**4. Use Sequential Testing**
- Can stop early if strong effect
- Saves time on average
- Requires proper alpha spending

**5. Accept Lower Power**
- Drop from 80% to 70% power
- Smaller sample but more false negatives
- Only for exploratory tests

---

## Statistical Significance Guidelines

### The Basics

**P-Value**: Probability of seeing results this extreme if null hypothesis is true.

**Statistical Significance**: p < α (usually 0.05)

**Confidence Interval**: Range likely to contain true effect

**Effect Size**: Magnitude of difference (independent of sample size)

### Standard Significance Levels

```
α = 0.05 (5% significance)
- Standard for most experiments
- 1 in 20 false positives expected
- Use when cost of false positive is moderate

α = 0.01 (1% significance)
- Conservative threshold
- Use for critical decisions
- More false negatives (need larger samples)

α = 0.10 (10% significance)
- Liberal threshold
- Only for exploratory research
- Not recommended for production decisions
```

### Two-Tailed vs. One-Tailed Tests

**Two-Tailed** (Default, Recommended):
```
H0: Treatment = Control
H1: Treatment ≠ Control
Tests for any difference (better OR worse)
```

**One-Tailed** (Rarely Appropriate):
```
H0: Treatment ≤ Control
H1: Treatment > Control
Only tests for improvement
```

**When to Use One-Tailed**:
- Only if you truly don't care about harm
- Only if you'll abandon if trend is opposite
- Generally: Don't use one-tailed tests

### Understanding Confidence Intervals

**95% Confidence Interval Interpretation**:

```
Conversion Rate Lift: +2.5% [95% CI: +1.2%, +3.8%]

Correct Interpretation:
✅ "We're 95% confident the true lift is between 1.2% and 3.8%"
✅ "The data are consistent with lifts from 1.2% to 3.8%"
✅ "If we repeated this experiment 100 times, ~95 CIs would contain true value"

Wrong Interpretation:
❌ "There's a 95% probability the true lift is in this range"
❌ "95% of users will experience lift between 1.2% and 3.8%"
```

**Using CI for Decision Making**:
```
If lower bound of CI > minimum practical significance:
  → Ship with high confidence

If CI includes both positive and negative:
  → Inconclusive, need more data or abandon

If CI entirely below minimum practical significance:
  → Effect too small to matter, don't ship
```

### Statistical vs. Practical Significance

**The Scenario**:
```
Experiment Results:
- Sample: 1,000,000 users per group
- Control: 10.00% conversion
- Treatment: 10.05% conversion
- P-value: 0.0001 (highly significant!)
- 95% CI: [+0.03%, +0.07%]
```

**Statistical Significance**: YES (p < 0.05)
**Practical Significance**: Probably NO

**Questions to Ask**:
1. Is 0.05% absolute lift worth engineering effort?
2. What's the implementation and maintenance cost?
3. Are there opportunity costs (other features to build)?
4. Could this small effect be:
   - Novelty effect
   - Seasonal variation
   - Instrumentation artifact

**Decision Framework**:
```
           Statistically Significant
           YES            NO

Practically YES  | Ship      | Promising
Significant      |           | Run longer
                 |           |
           NO    | Don't ship| Don't ship
                 | (Too small)| (No evidence)
```

---

## Common Pitfalls and How to Avoid Them

### 1. Peeking Without Correction

**The Problem**:
```javascript
// DAY 1
if (pValue < 0.05) {
  console.log("Winner! Ship it!");
}
// DAY 2 - wait, let me check again...
if (pValue < 0.05) {
  console.log("Still winning! Definitely ship!");
}
// This inflates false positive rate!
```

**Why It's Wrong**:
- Each peek is a "test"
- Multiple tests without correction → inflated Type I error
- α = 0.05 per test, but family-wise error rate much higher

**The Fix**:
```typescript
// Option 1: Pre-commit to sample size, look once
const targetSample = calculateSampleSize(...);
// Wait for full sample, then analyze ONCE

// Option 2: Use sequential testing with alpha spending
const monitor = new SequentialTest({
  alphaSpending: 'obrien-fleming',
  plannedLooks: 5
});

// Can look 5 times with corrected thresholds
```

**Appropriate Monitoring**:
- ✅ Monitor for bugs and data quality issues
- ✅ Check guardrail metrics for safety
- ✅ Look at directional trends (not p-values)
- ❌ Don't repeatedly test significance without correction

### 2. Sample Ratio Mismatch (SRM)

**The Problem**:
```
Expected: 50% control, 50% treatment
Observed: 48% control, 52% treatment
Chi-square test: p < 0.001 (significant!)
```

**What It Means**:
- Assignment is not random
- Results are likely biased
- Could be:
  - Instrumentation bug
  - Bot traffic
  - Filtering applied unevenly
  - Caching issues

**How to Detect**:
```typescript
function detectSRM(controlCount: number, treatmentCount: number): boolean {
  const total = controlCount + treatmentCount;
  const expected = total / 2;

  const chiSquare =
    Math.pow(controlCount - expected, 2) / expected +
    Math.pow(treatmentCount - expected, 2) / expected;

  const pValue = chiSquareCDF(chiSquare, 1);

  return pValue < 0.001;  // Very conservative threshold
}
```

**How to Fix**:
- Investigate assignment mechanism
- Check filtering and exclusion criteria
- Look for different attrition rates
- Never report results with SRM!

### 3. Not Accounting for Multiple Comparisons

**The Problem**:
```javascript
// Testing 20 different metrics
const results = metrics.map(m => runTest(control[m], treatment[m]));
const significant = results.filter(r => r.pValue < 0.05);

console.log(`Found ${significant.length} improvements!`);
// Expected: ~1 false positive even if no real effects
```

**Why It's Wrong**:
- Test 20 metrics at α = 0.05
- Expected false positives: 20 × 0.05 = 1
- Probability of at least 1 false positive: 64%!

**The Fix**:
```typescript
import { benjaminiHochberg } from 'experimeh';

const pValues = metrics.map(m => runTest(control[m], treatment[m]).pValue);
const adjusted = benjaminiHochberg(pValues, 0.05);

metrics.forEach((m, i) => {
  if (adjusted.rejected[i]) {
    console.log(`${m}: Significant after correction`);
  }
});
```

**When to Apply**:
- Testing multiple metrics
- Multiple pairwise comparisons (A/B/C/D test)
- Subgroup analysis
- Factorial designs

**When NOT to Apply**:
- Pre-specified primary metric (no correction needed)
- Independent experiments
- Confirmatory analysis of single hypothesis

### 4. Misinterpreting P-Values

**Common Mistakes**:

❌ **Wrong**: "p = 0.05 means 5% chance the null hypothesis is true"
✅ **Right**: "p = 0.05 means if null hypothesis were true, we'd see data this extreme 5% of the time"

❌ **Wrong**: "p = 0.04 is much better than p = 0.06"
✅ **Right**: "Both suggest modest evidence; don't over-interpret small differences"

❌ **Wrong**: "Non-significant means no effect"
✅ **Right**: "Non-significant means insufficient evidence for effect"

❌ **Wrong**: "Lower p-value means bigger effect"
✅ **Right**: "Lower p-value means more evidence, but effect size is separate"

**Better Practice**:
```
Always report:
1. P-value
2. Effect size with confidence interval
3. Sample size
4. Power analysis

Example:
"Treatment increased conversion by 2.5% (95% CI: [1.2%, 3.8%],
p = 0.003, n = 10,000, post-hoc power = 95%)"
```

### 5. Novelty and Primacy Effects

**The Problem**:
```
Week 1: Treatment +15% better (wow!)
Week 2: Treatment +8% better (still good)
Week 3: Treatment +2% better (hmm...)
Week 4: Treatment -1% worse (uh oh)
```

**Why It Happens**:
- **Novelty Effect**: Users respond to newness, not actual improvement
- **Primacy Effect**: Existing users prefer familiar interface
- **Selection Bias**: Early users different from later users

**How to Detect**:
```typescript
// Analyze by user cohort
const newUsersEffect = analyzeSegment(data, 'new_users');
const existingUsersEffect = analyzeSegment(data, 'existing_users');

if (newUsersEffect.lift > 2 * existingUsersEffect.lift) {
  console.warn("Possible novelty effect detected");
}

// Analyze by week
const weeklyEffects = analyzeByWeek(data);
const trend = calculateTrend(weeklyEffects);
if (trend < -0.5) {
  console.warn("Effect degrading over time");
}
```

**How to Mitigate**:
- Run experiments longer (2-4 weeks minimum)
- Segment by new vs. existing users
- Look for time trends
- Consider learning effects

### 6. Ignoring Guardrail Metrics

**The Problem**:
```
Primary Metric: +10% conversion ✅
Revenue per user: -15% ❌
Error rate: +50% ❌

"But conversion is up, so let's ship!"
```

**Why It's Wrong**:
- Pyrrhic victory: winning battle, losing war
- Downstream effects matter
- User trust and experience matter
- Technical health matters

**Proper Guardrail Setup**:
```typescript
const guardrails = [
  {
    metric: 'revenue_per_user',
    threshold: -5%,  // Max acceptable degradation
    type: 'absolute'
  },
  {
    metric: 'error_rate',
    threshold: +10%,  // Max acceptable increase
    type: 'relative'
  },
  {
    metric: 'page_load_time',
    threshold: +200,  // Max 200ms increase
    type: 'absolute'
  }
];

function checkGuardrails(results) {
  const violations = guardrails.filter(g =>
    results[g.metric].change > g.threshold
  );

  if (violations.length > 0) {
    return {
      approved: false,
      reason: `Guardrail violations: ${violations}`
    };
  }
  return { approved: true };
}
```

---

## P-Hacking Prevention

### What is P-Hacking?

**Definition**: Manipulating data or analysis to achieve significant p-values.

**Why It's Bad**:
- Inflates false positive rate far above nominal α
- Produces non-replicable results
- Undermines scientific integrity

### Common P-Hacking Tactics (DON'T DO THESE!)

#### 1. Optional Stopping

**The Hack**:
```
Check p-value every day
Stop as soon as p < 0.05
If never significant, run longer and hope
```

**Why It's Wrong**: Each check is a hypothesis test

**The Fix**: Pre-commit to sample size OR use sequential testing

#### 2. Selective Outcome Reporting

**The Hack**:
```javascript
const allMetrics = [
  'conversion', 'revenue', 'engagement', 'retention',
  'time_on_site', 'bounce_rate', 'pages_per_session',
  // ... 20 more metrics
];

const significantMetrics = allMetrics.filter(m =>
  test(m).pValue < 0.05
);

// Report only these!
```

**Why It's Wrong**: Multiple testing without correction

**The Fix**:
- Pre-specify primary metric
- Apply multiple testing correction to secondary metrics
- Report ALL pre-specified metrics, significant or not

#### 3. Post-Hoc Subgroup Analysis

**The Hack**:
```
Overall: Not significant
Men: Not significant
Women: Not significant
Users 18-24: Not significant
Users 25-34: Not significant
Users 35-44: Significant! ✨

"Our treatment works for 35-44 year olds!"
```

**Why It's Wrong**:
- Testing many subgroups without correction
- Cherry-picking after seeing data

**The Fix**:
```typescript
// Pre-specify subgroups of interest
const prespecifiedSubgroups = [
  'new_users',
  'power_users',
  'mobile_users'
];

// Apply multiple testing correction
const results = analyzeSubgroups(prespecifiedSubgroups);
const corrected = benjaminiHochberg(results.map(r => r.pValue));

// Report all results, note correction
```

#### 4. Flexible Data Exclusion

**The Hack**:
```
// Try excluding different things until p < 0.05
excludeOutliers();  // p = 0.08
excludeBots();      // p = 0.06
excludeWeekends();  // p = 0.049  ← Stop here!
```

**Why It's Wrong**: Multiple analyses, reporting only "best" one

**The Fix**: Pre-specify exclusion criteria in analysis plan

#### 5. Flexible Statistical Tests

**The Hack**:
```
tTest();         // p = 0.07
mannWhitney();   // p = 0.06
permutation();   // p = 0.048  ← Report this one!
```

**Why It's Wrong**: Shopping for significant result

**The Fix**: Pre-specify test based on data type and assumptions

### P-Hacking Prevention Checklist

**Before Experiment Launches**:

- [ ] Primary metric defined
- [ ] Secondary metrics defined (max 5)
- [ ] Guardrail metrics defined
- [ ] Success criteria specified
- [ ] Sample size calculated
- [ ] Statistical test chosen
- [ ] Analysis plan documented
- [ ] Subgroups pre-specified (if any)

**During Experiment**:

- [ ] Don't repeatedly test significance
- [ ] Monitor for data quality only
- [ ] Check guardrails for safety
- [ ] Don't stop early without sequential testing correction

**After Experiment**:

- [ ] Report all pre-specified metrics
- [ ] Apply multiple testing correction if needed
- [ ] Report actual p-values, not just "< 0.05"
- [ ] Include confidence intervals
- [ ] Note any deviations from analysis plan

### Pre-Registration

**Best Practice**: Document analysis plan before seeing results

```yaml
# analysis-plan.yaml
experiment_id: checkout_redesign_v2
date: 2025-11-01
primary_metric: checkout_completion_rate
success_threshold: +2% absolute
significance_level: 0.05
planned_sample_size: 10000
runtime: 7 days

secondary_metrics:
  - average_order_value
  - cart_abandonment_rate

guardrails:
  - metric: error_rate
    max_increase: 10%
  - metric: page_load_time
    max_increase: 200ms

subgroups:
  - new_users
  - returning_users
  note: "Will apply Benjamini-Hochberg correction"

exclusions:
  - bots: "User-agent based filtering"
  - employees: "Internal user list"
  - outliers: "Orders > $10,000"

statistical_test: "Two-proportion z-test, two-tailed"
```

---

## Multiple Testing Correction

### When to Apply Multiple Testing Correction

**Apply Correction When**:
- Testing multiple secondary metrics
- Multiple pairwise comparisons (A/B/C/D)
- Subgroup analysis
- Factorial designs (multiple main effects and interactions)

**Don't Apply Correction When**:
- Single pre-specified primary metric
- Independent experiments
- Guardrail metrics (already pre-specified thresholds)

### Correction Methods

#### 1. Bonferroni Correction

**How It Works**: Divide α by number of tests

**Formula**: α_adjusted = α / m

**Use When**:
- Few tests (<5)
- Need strong FWER control
- Confirmatory analysis

**Example**:
```typescript
import { bonferroniCorrection } from 'experimeh';

const pValues = [0.01, 0.04, 0.03, 0.20];
const adjusted = bonferroniCorrection(pValues, 0.05);

// Original thresholds: 0.05, 0.05, 0.05, 0.05
// Adjusted thresholds: 0.0125, 0.0125, 0.0125, 0.0125
// Results: significant, not significant, not significant, not significant
```

**Pros**: Simple, controls FWER exactly
**Cons**: Very conservative, loses power quickly

#### 2. Benjamini-Hochberg (FDR Control)

**How It Works**: Controls false discovery rate (proportion of false positives)

**Use When**:
- Many tests (>5)
- Exploratory analysis
- Factorial designs
- Can tolerate some false positives

**Example**:
```typescript
import { benjaminiHochberg } from 'experimeh';

const pValues = [0.001, 0.01, 0.03, 0.04, 0.10, 0.50];
const result = benjaminiHochberg(pValues, 0.05);

console.log(result.rejected);  // [true, true, true, false, false, false]
console.log(result.adjustedPValues);  // [0.006, 0.03, 0.06, 0.06, 0.15, 0.50]
```

**Pros**: More powerful than Bonferroni, appropriate for many tests
**Cons**: Allows some false positives (but controls rate)

#### 3. Holm-Bonferroni (Step-Down)

**How It Works**: Sequential testing with adjusted thresholds

**Use When**:
- Want more power than Bonferroni
- Need FWER control (not just FDR)

**Example**:
```typescript
import { holmBonferroni } from 'experimeh';

const pValues = [0.001, 0.01, 0.03, 0.04];
const result = holmBonferroni(pValues, 0.05);

// Tests in order:
// 1. p=0.001 vs 0.05/4=0.0125 → significant, continue
// 2. p=0.01 vs 0.05/3=0.0167 → significant, continue
// 3. p=0.03 vs 0.05/2=0.025 → NOT significant, stop
// 4. p=0.04 → not tested (stopped earlier)
```

**Pros**: More powerful than Bonferroni, still controls FWER
**Cons**: More complex than Bonferroni

### Choosing the Right Method

```
Decision Tree:

How many comparisons?
├─ 1-2: No correction needed (if pre-specified)
├─ 3-5: Use Bonferroni or Holm-Bonferroni
└─ 6+: Use Benjamini-Hochberg

What type of error control?
├─ Need to control FWER (no false positives): Bonferroni or Holm
└─ Can tolerate controlled FDR: Benjamini-Hochberg

Confirmatory or exploratory?
├─ Confirmatory: Bonferroni
└─ Exploratory: Benjamini-Hochberg
```

### Practical Example

```typescript
// Scenario: Testing 10 secondary metrics

const secondaryMetrics = {
  revenue_per_user: { pValue: 0.001, significant: true },
  session_duration: { pValue: 0.03, significant: true },
  bounce_rate: { pValue: 0.045, significant: true },
  pages_per_session: { pValue: 0.08, significant: false },
  // ... 6 more metrics
};

const pValues = Object.values(secondaryMetrics).map(m => m.pValue);

// Without correction: 3 significant
// Expected false positives: 10 × 0.05 = 0.5

// With Benjamini-Hochberg:
const corrected = benjaminiHochberg(pValues, 0.05);
// Maybe 2 significant after correction

// Report both:
console.log("Secondary metrics (uncorrected):");
// ... list all results

console.log("\nSecondary metrics (BH corrected at FDR=0.05):");
// ... list corrected results
```

---

## Guardrail Metrics Setup

### What Are Guardrail Metrics?

**Definition**: Metrics that shouldn't degrade, even if primary metric improves.

**Purpose**:
- Prevent shipping harmful changes
- Catch unintended consequences
- Ensure technical health
- Protect long-term value

### Categories of Guardrail Metrics

#### 1. Technical Performance

```yaml
guardrails_technical:
  - name: page_load_time
    threshold_ms: +200
    description: "Max 200ms increase in p95 load time"

  - name: error_rate
    threshold_pct: +10%
    description: "Max 10% relative increase in errors"

  - name: crash_rate
    threshold_pct: +5%
    description: "Max 5% increase in app crashes"

  - name: api_latency_p99
    threshold_ms: +500
    description: "Max 500ms increase in p99 API latency"
```

#### 2. User Experience

```yaml
guardrails_ux:
  - name: bounce_rate
    threshold_pct: +5%
    description: "Max 5% relative increase"

  - name: task_completion_rate
    threshold_pct: -3%
    description: "Max 3% decrease in completion"

  - name: feature_usage_rate
    threshold_pct: -10%
    description: "Key features shouldn't break"
```

#### 3. Business Metrics

```yaml
guardrails_business:
  - name: revenue_per_user
    threshold_pct: -2%
    description: "Max 2% decrease in RPU"

  - name: ltv_estimate
    threshold_pct: -5%
    description: "Don't hurt long-term value"

  - name: retention_day_7
    threshold_pct: -3%
    description: "Protect retention"
```

#### 4. Ecosystem Health

```yaml
guardrails_ecosystem:
  - name: seller_earnings
    threshold_pct: -5%
    description: "For marketplace experiments"

  - name: supply_availability
    threshold_pct: -10%
    description: "Don't break supply"

  - name: organic_traffic
    threshold_pct: -5%
    description: "Don't hurt SEO"
```

### Setting Appropriate Thresholds

**Too Strict**:
```yaml
# This will block everything:
guardrails:
  - name: bounce_rate
    threshold_pct: +0%  # Too strict! Natural variance will violate
```

**Too Loose**:
```yaml
# This won't catch real problems:
guardrails:
  - name: error_rate
    threshold_pct: +100%  # Too loose! Errors doubled!
```

**Just Right**:
```yaml
# Based on historical variance and business judgment:
guardrails:
  - name: error_rate
    threshold_pct: +10%
    rationale: "Error rate has ±5% natural variance, +10% allows detection of real issues"
    historical_cv: 0.05
```

### Implementation

```typescript
interface GuardrailMetric {
  name: string;
  threshold: number;
  thresholdType: 'absolute' | 'relative';
  direction: 'positive' | 'negative';  // Which direction is bad
  confidence: number;  // CI confidence level
}

function checkGuardrails(
  experimentResults: ExperimentResult,
  guardrails: GuardrailMetric[]
): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];

  for (const guardrail of guardrails) {
    const metric = experimentResults.metrics[guardrail.name];

    // Check if confidence interval excludes acceptable range
    const isViolation = guardrail.direction === 'negative'
      ? metric.ciLower > guardrail.threshold  // Definitely above threshold
      : metric.ciUpper < guardrail.threshold; // Definitely below threshold

    if (isViolation) {
      violations.push({
        metric: guardrail.name,
        observed: metric.pointEstimate,
        threshold: guardrail.threshold,
        ciLower: metric.ciLower,
        ciUpper: metric.ciUpper,
        severity: calculateSeverity(metric, guardrail)
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    decision: violations.length === 0 ? 'APPROVE' : 'BLOCK'
  };
}
```

### Alerting Strategy

**Tiered Alerts**:

```typescript
enum Severity {
  WARNING = 'warning',   // Close to threshold
  CRITICAL = 'critical', // Violated threshold
  EMERGENCY = 'emergency' // Severe violation
}

function calculateSeverity(
  metric: MetricResult,
  guardrail: GuardrailMetric
): Severity {
  const deviation = Math.abs(
    (metric.pointEstimate - guardrail.threshold) / guardrail.threshold
  );

  if (deviation < 0.5) return Severity.WARNING;   // Within 50% of threshold
  if (deviation < 1.0) return Severity.CRITICAL;  // 1-2× threshold
  return Severity.EMERGENCY;                       // >2× threshold
}
```

### Example Guardrail Report

```
Experiment: checkout_redesign_v2
Primary Metric: ✅ Checkout conversion +3.2% (p=0.001)

Guardrail Metrics:
✅ Page load time: +45ms [-20ms, +110ms] (threshold: +200ms)
✅ Error rate: +2.3% [-1%, +5.6%] (threshold: +10%)
❌ Revenue per user: -4.1% [-6.2%, -2.0%] (threshold: -2%)
⚠️  Session duration: -8.5% [-15%, -2%] (threshold: -10%)

Decision: BLOCK - Guardrail violation detected
Violated metric: revenue_per_user
  Observed: -4.1% (CI: -6.2% to -2.0%)
  Threshold: -2%
  Severity: CRITICAL

Recommendation: Investigate revenue impact before shipping
```

---

## Ramp Strategies

### Why Ramp Gradually?

**Benefits**:
- Limit blast radius of bugs
- Catch issues early
- Build confidence incrementally
- Easy rollback if needed
- Time to prepare infrastructure

**Risks of Full Launch**:
- If something breaks, affects all users
- Harder to attribute issues
- May miss rare bugs that appear at scale
- No safety net

### Standard Ramp Schedule

```
┌──────────────────────────────────────────────────┐
│                  Ramp Schedule                    │
├──────────────────────────────────────────────────┤
│ Day 1-2:   5% traffic  → Monitor closely         │
│ Day 3-4:   10% traffic → Check all metrics       │
│ Day 5-7:   25% traffic → Assess guardrails       │
│ Day 8-10:  50% traffic → Statistical power       │
│ Day 11-14: 100% traffic → Full launch            │
└──────────────────────────────────────────────────┘

At each stage:
- Check for SRM
- Review guardrail metrics
- Monitor for anomalies
- Assess early results
```

### Traffic Allocation Patterns

#### Pattern 1: Conservative Ramp (High Risk Changes)

```
Week 1: 1% → 2% → 5%
Week 2: 10% → 20%
Week 3: 30% → 50%
Week 4: 75% → 100%
```

**Use For**:
- Payment system changes
- Core infrastructure changes
- Changes affecting revenue
- New, untested code

#### Pattern 2: Standard Ramp (Normal Changes)

```
Week 1: 5% → 10% → 25%
Week 2: 50% → 100%
```

**Use For**:
- UI changes
- Feature additions
- Algorithm improvements
- Most experiments

#### Pattern 3: Fast Ramp (Low Risk Changes)

```
Day 1-2: 25%
Day 3-4: 50%
Day 5+: 100%
```

**Use For**:
- Copy changes
- Styling tweaks
- Non-critical features
- Well-tested changes

#### Pattern 4: Canary Deployment

```
Canary: 1% for 24 hours
If healthy: 100%
If issues: Rollback
```

**Use For**:
- Backend service deployments
- Performance optimizations
- Refactors with identical behavior

### Hold-out Groups

**Long-term Validation**:

```typescript
// Keep 5% of users in control permanently
const assignment = {
  control_permanent: 5%,   // Never gets new features
  control_experiment: 47.5%, // Gets new features after validation
  treatment: 47.5%          // Gets new features immediately
};

// After experiment ends:
// - Ship to control_experiment
// - Keep control_permanent for long-term measurement
// - Measure long-term effects, novelty decay, etc.
```

**Benefits**:
- Detect long-term effects
- Measure novelty decay
- Assess cumulative impact of all changes

### Automated Ramp Rules

```typescript
interface RampRule {
  stage: number;
  traffic: number;
  holdDays: number;
  advanceCriteria: AdvanceCriteria;
}

interface AdvanceCriteria {
  noSRM: boolean;
  guardrailsPass: boolean;
  minSampleSize: number;
  errorRate: { max: number };
  customChecks?: () => boolean;
}

const rampPlan: RampRule[] = [
  {
    stage: 1,
    traffic: 0.05,
    holdDays: 2,
    advanceCriteria: {
      noSRM: true,
      guardrailsPass: true,
      minSampleSize: 1000,
      errorRate: { max: 0.02 }
    }
  },
  {
    stage: 2,
    traffic: 0.25,
    holdDays: 3,
    advanceCriteria: {
      noSRM: true,
      guardrailsPass: true,
      minSampleSize: 5000,
      errorRate: { max: 0.015 }
    }
  },
  // ... more stages
];

async function executeRampPlan(experimentId: string) {
  for (const stage of rampPlan) {
    // Set traffic
    await setTrafficAllocation(experimentId, stage.traffic);

    // Wait minimum hold period
    await sleep(stage.holdDays * 24 * 60 * 60 * 1000);

    // Check criteria
    const results = await analyzeExperiment(experimentId);
    const meetsC criteria = checkAdvanceCriteria(results, stage.advanceCriteria);

    if (!meetsCriteria) {
      await alert(`Stage ${stage.stage} criteria not met. Holding.`);
      return;
    }

    console.log(`✅ Stage ${stage.stage} passed, advancing to ${stage.traffic * 100}%`);
  }

  console.log(`🎉 Full ramp complete`);
}
```

### Emergency Rollback

**Automatic Triggers**:

```typescript
const rollbackTriggers = {
  errorRate: {
    threshold: 2.0,  // 2× baseline
    window: '5m'
  },
  crashRate: {
    threshold: 1.5,
    window: '10m'
  },
  guardrailViolation: {
    severity: 'EMERGENCY',
    immediate: true
  },
  customAlert: {
    source: 'on-call engineer',
    immediate: true
  }
};

async function monitorForRollback(experimentId: string) {
  while (true) {
    const health = await checkExperimentHealth(experimentId);

    if (shouldRollback(health, rollbackTriggers)) {
      await emergencyRollback(experimentId);
      await alert('EMERGENCY ROLLBACK EXECUTED');
      break;
    }

    await sleep(60 * 1000);  // Check every minute
  }
}
```

---

## Documentation Requirements

### Why Document Experiments?

**Benefits**:
- Institutional knowledge
- Avoid repeating failed experiments
- Learn from past decisions
- Onboard new team members
- Meta-analysis of multiple experiments

### Experiment Documentation Template

```markdown
# Experiment: [Name]

## Metadata
- **ID**: checkout_redesign_v2
- **Owner**: jane.doe@company.com
- **Team**: Growth
- **Start Date**: 2025-11-01
- **End Date**: 2025-11-14
- **Status**: Completed
- **Decision**: Shipped

## Hypothesis
If we simplify the checkout flow by reducing steps from 3 to 2,
Then checkout conversion rate will increase by at least 3%,
Because fewer steps reduce friction and cognitive load,
We'll measure this by checkout completion rate.

**Supporting Evidence**:
- User research showed confusion with current 3-step flow
- Competitor analysis: Most use 2-step checkout
- Previous experiment (checkout_v1) showed step count matters

## Design

**Type**: Simple A/B test

**Variants**:
- Control: Existing 3-step checkout
- Treatment: New 2-step checkout

**Randomization Unit**: User ID

**Traffic Allocation**: 50/50

**Sample Size Calculation**:
- Baseline conversion: 10%
- Expected lift: 3% absolute (30% relative)
- Power: 80%, Alpha: 0.05
- Required: 1,863 per group
- Expected runtime: 4 days at 1,000 users/day

## Metrics

**Primary**:
- Checkout completion rate (proportion of users who start checkout and complete)

**Secondary**:
- Average order value
- Time to complete checkout
- Cart abandonment rate

**Guardrails**:
- Error rate: Max +10%
- Page load time: Max +200ms
- Revenue per user: Max -2%

## Results

**Primary Metric**: ✅
- Control: 10.2% (n=5,234)
- Treatment: 13.5% (n=5,189)
- Absolute lift: +3.3% [95% CI: +2.1%, +4.5%]
- Relative lift: +32.4%
- P-value: <0.001
- **Significant and above threshold**

**Secondary Metrics**:
- Average order value: $52.30 vs $51.80 (NS, p=0.43)
- Time to complete: 156s vs 142s (-9%, p=0.02)
- Cart abandonment: 28% vs 23% (-5% absolute, p<0.001)

**Guardrails**: ✅ All passed
- Error rate: +1.2% (p=0.23)
- Page load time: +34ms (p=0.15)
- Revenue per user: +0.3% (p=0.41)

**Data Quality**:
- Sample Ratio Mismatch: χ²=0.19, p=0.66 ✅
- Bot traffic: <0.1% in both groups
- Outliers removed: 12 orders > $10,000

## Analysis

**Statistical Method**: Two-proportion z-test, two-tailed

**Power Analysis**: Achieved power: 99.8%

**Segmentation** (exploratory, BH corrected):
- New users: +4.1% (p<0.001) ✅
- Returning users: +2.8% (p=0.003) ✅
- Mobile: +3.8% (p<0.001) ✅
- Desktop: +2.9% (p=0.005) ✅

**Time Trends**: Effect stable across 14 days, no novelty decay detected

## Interpretation

**Summary**: The 2-step checkout flow increased conversion by 3.3%, exceeding our 3% threshold. Effects were consistent across segments and time. No guardrail violations. Clear win.

**Surprising Findings**:
- Effect size larger than expected (3.3% vs 3.0% hypothesis)
- Time to complete decreased more than expected
- Effect equally strong for returning users (no primacy effect)

**Hypothesized Mechanism**:
- Reduced cognitive load from fewer steps
- Less friction in payment information entry
- Progress bar more motivating with 2 steps vs 3

## Decision

**Action**: Ship to 100%

**Rationale**:
- Clear improvement in primary metric
- No guardrail violations
- Effect stable across segments
- Benefits outweigh implementation costs

**Rollout Plan**:
1. Week 1: 25% traffic
2. Week 2: 50% traffic
3. Week 3: 100% traffic
4. Keep 5% permanent holdout for long-term measurement

**Success Metrics** (Post-ship):
- Maintain >12% checkout conversion
- No increase in support tickets
- No technical issues

## Learnings

**What Worked**:
- Pre-experiment user research provided confidence
- Conservative sample size calculation prevented false positives
- Guardrail metrics caught no issues

**What Didn't Work**:
- Initial design had form validation issues (caught in 5% ramp)

**For Future Experiments**:
- Consider testing payment method order next
- Explore one-click checkout for returning users
- Investigate mobile-specific optimizations

## Artifacts

- **Design Doc**: [Link to Figma]
- **Implementation**: [Link to PR #1234]
- **Analysis Code**: [Link to notebook]
- **Presentation**: [Link to slides]
- **Discussion**: [Link to Slack thread]

## Changelog

- 2025-11-01: Experiment launched at 5%
- 2025-11-03: Ramped to 25% after passing checks
- 2025-11-07: Ramped to 50%
- 2025-11-10: Reached sample size, analysis complete
- 2025-11-14: Decision to ship, 100% rollout begins

## Appendix

### Technical Implementation Details
[Code changes, infrastructure updates, etc.]

### Extended Analysis
[Additional statistical tests, robustness checks, etc.]

### User Feedback
[Qualitative data, support tickets, etc.]
```

### Experiment Registry

**Maintain a Searchable Database**:

```typescript
interface ExperimentRegistry {
  id: string;
  name: string;
  owner: string;
  team: string;
  status: 'draft' | 'running' | 'completed' | 'abandoned';
  startDate: Date;
  endDate: Date;
  hypothesis: string;
  designType: ExperimentDesign;
  primaryMetric: string;
  decision: 'ship' | 'iterate' | 'abandon';
  impact: number;  // Measured impact on primary metric
  tags: string[];  // ['checkout', 'mobile', 'conversion']
  learnings: string;
  documentUrl: string;
}

// Enables:
// - "Have we tested this before?"
// - "What did we learn about pricing experiments?"
// - "Show me all experiments by Growth team"
// - Meta-analysis of experiment effects
```

### Retrospective Template

**After Experiment Completes**:

```markdown
# Experiment Retrospective: [Name]

## What went well?
-
-

## What didn't go well?
-
-

## What did we learn?
-
-

## What will we do differently next time?
-
-

## Follow-up experiments to run:
-
-

## Action items:
- [ ] Update documentation
- [ ] Share learnings in team meeting
- [ ] Add to experiment registry
```

---

## Summary

**Key Takeaways**:

1. **Design Well**: Clear hypothesis, pre-specified metrics, proper sample size
2. **Choose Wisely**: Pick the right experimental design for your question
3. **Calculate Honestly**: Don't underestimate sample size needs
4. **Interpret Carefully**: Statistical + practical significance matter
5. **Avoid Pitfalls**: No peeking, no p-hacking, check guardrails
6. **Correct Properly**: Apply multiple testing correction when needed
7. **Protect Users**: Guardrail metrics and gradual ramps
8. **Document Everything**: Learn from history, build institutional knowledge

**The Golden Rule**:

> Define your hypothesis, metrics, and analysis plan BEFORE looking at any results. Your future self (and your colleagues) will thank you.

---

## Additional Resources

**Books**:
- "Trustworthy Online Controlled Experiments" by Kohavi, Tang, & Xu
- "The Design of Experiments" by Ronald A. Fisher
- "Statistical Rules of Thumb" by Gerald van Belle

**Papers**:
- "Seven Rules of Thumb for Web Site Experimenters" (Microsoft, 2014)
- "Top Challenges from the First Practical Online Controlled Experiments Summit" (KDD 2019)

**Internal Resources**:
- [Statistical Guide](./STATISTICAL_GUIDE.md)
- [Design Patterns](./DESIGN_PATTERNS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
