# Statistical Methods Guide

A comprehensive guide to statistical methods for online experimentation, from foundational concepts to advanced techniques.

## Table of Contents

1. [Choosing the Right Statistical Test](#choosing-the-right-statistical-test)
2. [Understanding P-Values and Confidence Intervals](#understanding-p-values-and-confidence-intervals)
3. [Effect Sizes and Practical Significance](#effect-sizes-and-practical-significance)
4. [Power Analysis Explained](#power-analysis-explained)
5. [Multiple Testing Correction Explained](#multiple-testing-correction-explained)
6. [Bayesian vs Frequentist Approaches](#bayesian-vs-frequentist-approaches)
7. [When to Use Sequential Testing](#when-to-use-sequential-testing)
8. [CUPED Variance Reduction Guide](#cuped-variance-reduction-guide)
9. [Stepped Wedge Analysis](#stepped-wedge-analysis)

---

## Choosing the Right Statistical Test

### Decision Tree

```
What type of metric?

├─ BINARY (success/failure, conversion, click)
│   ├─ Two variants → Two-Proportion Z-Test
│   └─ 3+ variants → Chi-Square Test + Pairwise comparisons
│
├─ CONTINUOUS (revenue, time, count)
│   ├─ Two variants
│   │   ├─ Normal distribution → Two-Sample T-Test (Welch's)
│   │   └─ Non-normal → Mann-Whitney U Test (or transform)
│   │
│   └─ 3+ variants → One-Way ANOVA + post-hoc tests
│
├─ CATEGORICAL (multiple categories)
│   └─ Chi-Square Test of Independence
│
└─ FACTORIAL DESIGN (multiple factors)
    ├─ 2 factors → Two-Way ANOVA
    └─ 3+ factors → Multi-Way ANOVA or Regression
```

### Detailed Test Selection Guide

#### 1. Two-Proportion Z-Test

**Use When**:
- Binary metric (conversion, click-through, signup)
- Two variants (control vs. treatment)
- Independent observations
- Large sample (np ≥ 5 and n(1-p) ≥ 5)

**Example Scenarios**:
- A/B test of checkout conversion rate
- Button click rate comparison
- Email open rate test

**Implementation**:
```typescript
import { twoProportionZTest } from 'experimeh';

const result = twoProportionZTest(
  { successes: 245, trials: 2450 },  // Control: 10% conversion
  { successes: 306, trials: 2550 }   // Treatment: 12% conversion
);

console.log(`Z-statistic: ${result.zStatistic}`);
console.log(`P-value: ${result.pValue}`);
console.log(`Absolute difference: ${result.absoluteDifference}`);
console.log(`95% CI: [${result.ciLower}, ${result.ciUpper}]`);
```

**When NOT to Use**:
- Very small samples (use Fisher's exact test)
- Very rare events (p < 0.01, use Poisson approximation)
- Non-independent observations

**Assumptions**:
1. Independence of observations
2. Large enough sample for normal approximation
3. Fixed sample size (not peeking)

#### 2. Two-Sample T-Test (Welch's)

**Use When**:
- Continuous metric (revenue, time, count)
- Two variants
- Approximately normal distribution (or n > 30 per group)
- Unequal variances OK (Welch's correction handles this)

**Example Scenarios**:
- Revenue per user comparison
- Session duration test
- Page load time experiment

**Implementation**:
```typescript
import { twoSampleTTest } from 'experimeh';

const controlData = [45.2, 38.1, 52.3, ...];  // Revenue values
const treatmentData = [48.7, 55.2, 49.8, ...];

const result = twoSampleTTest(controlData, treatmentData);

console.log(`T-statistic: ${result.tStatistic}`);
console.log(`Degrees of freedom: ${result.degreesOfFreedom}`);
console.log(`P-value: ${result.pValue}`);
console.log(`Mean difference: ${result.meanDifference}`);
console.log(`95% CI: [${result.ciLower}, ${result.ciUpper}]`);
console.log(`Cohen's d: ${result.effectSize}`);
```

**When to Check Assumptions**:
```typescript
import { checkNormality, checkVarianceHomogeneity } from 'experimeh';

// Check normality (less important if n > 30)
const normalityTest = checkNormality(controlData);
if (normalityTest.pValue < 0.05) {
  console.warn("Non-normal distribution detected");
  // Consider: transformation, non-parametric test, or proceed if n is large
}

// Check variance equality (Welch's doesn't assume this, but good to know)
const varianceTest = checkVarianceHomogeneity(controlData, treatmentData);
console.log(`Variance ratio: ${varianceTest.ratio}`);
```

**Alternatives if Assumptions Violated**:
- **Non-normal, small sample**: Mann-Whitney U test
- **Severe outliers**: Trimmed mean test or robust regression
- **Heavy skew**: Log transformation then t-test

#### 3. Chi-Square Test

**Use When**:
- Categorical outcome (multiple categories)
- Testing independence between two categorical variables
- All expected cell counts ≥ 5

**Example Scenarios**:
- User preferences across multiple options
- Device type (mobile/tablet/desktop) vs. conversion
- Product category vs. purchase

**Implementation**:
```typescript
import { chiSquareTest } from 'experimeh';

const observed = [
  [100, 150, 50],   // Control: Category A, B, C
  [120, 130, 50]    // Treatment: Category A, B, C
];

const result = chiSquareTest(observed);

console.log(`Chi-square statistic: ${result.chiSquare}`);
console.log(`Degrees of freedom: ${result.df}`);
console.log(`P-value: ${result.pValue}`);
console.log(`Cramér's V: ${result.effectSize}`);
```

**When NOT to Use**:
- Expected cell count < 5 (use Fisher's exact test)
- Ordered categories (use trend test)
- Paired data (use McNemar's test)

#### 4. One-Way ANOVA

**Use When**:
- Continuous metric
- 3+ variants
- Testing if ANY means differ
- Approximately normal distribution in each group
- Similar variances across groups

**Example Scenarios**:
- Testing 5 different homepage designs
- Comparing 4 pricing points
- Evaluating multiple algorithm variants

**Implementation**:
```typescript
import { oneWayANOVA, tukeyHSD } from 'experimeh';

const data = {
  'Control': [45, 48, 42, ...],
  'Treatment A': [52, 55, 49, ...],
  'Treatment B': [48, 51, 47, ...],
  'Treatment C': [58, 62, 55, ...]
};

// Overall test
const anovaResult = oneWayANOVA(data);

console.log(`F-statistic: ${anovaResult.fStatistic}`);
console.log(`P-value: ${anovaResult.pValue}`);
console.log(`Effect size (η²): ${anovaResult.etaSquared}`);

if (anovaResult.pValue < 0.05) {
  // If significant, run pairwise comparisons
  const pairwise = tukeyHSD(data);

  pairwise.comparisons.forEach(comp => {
    console.log(`${comp.group1} vs ${comp.group2}:`);
    console.log(`  Difference: ${comp.meanDifference}`);
    console.log(`  Adjusted p-value: ${comp.adjustedPValue}`);
  });
}
```

**Post-Hoc Tests** (after significant ANOVA):
- **Tukey HSD**: All pairwise comparisons, balanced groups
- **Bonferroni**: Conservative, any group sizes
- **Dunnett**: All vs. control only

#### 5. Two-Way ANOVA (Factorial Design)

**Use When**:
- Testing multiple factors simultaneously
- Want to detect interaction effects
- Factorial experimental design
- Continuous outcome

**Example Scenarios**:
- Button color × Button text
- Price × Shipping speed
- Image type × Call-to-action

**Implementation**:
```typescript
import { twoWayANOVA } from 'experimeh';

const data = {
  factors: {
    buttonColor: ['Blue', 'Blue', 'Green', 'Green', ...],
    buttonText: ['Buy', 'Purchase', 'Buy', 'Purchase', ...]
  },
  outcome: [45, 48, 52, 49, ...]  // Revenue values
};

const result = twoWayANOVA(data);

console.log('Main effect of Button Color:');
console.log(`  F = ${result.mainEffects.buttonColor.fStatistic}`);
console.log(`  p = ${result.mainEffects.buttonColor.pValue}`);

console.log('Main effect of Button Text:');
console.log(`  F = ${result.mainEffects.buttonText.fStatistic}`);
console.log(`  p = ${result.mainEffects.buttonText.pValue}`);

console.log('Interaction (Color × Text):');
console.log(`  F = ${result.interaction.fStatistic}`);
console.log(`  p = ${result.interaction.pValue}`);

if (result.interaction.pValue < 0.05) {
  console.log('⚠️  Significant interaction detected!');
  console.log('Interpret main effects cautiously.');
}
```

**Interaction Interpretation**:
```
No Interaction: Effect of Color is same for both Text options
Interaction: Effect of Color depends on Text choice

Example:
- Blue + "Buy": 45
- Blue + "Purchase": 48
- Green + "Buy": 52
- Green + "Purchase": 49

Green is better than Blue for "Buy" (+7)
Green is worse than Blue for "Purchase" (+1)
→ This is an interaction!
```

### Quick Reference Table

| Metric Type | Variants | Test |
|-------------|----------|------|
| Binary | 2 | Two-Proportion Z-Test |
| Binary | 3+ | Chi-Square + Multiple Comparisons |
| Continuous | 2 | Two-Sample T-Test (Welch's) |
| Continuous | 3+ | One-Way ANOVA + Post-Hoc |
| Categorical | Any | Chi-Square Test |
| Factorial (2 factors) | 2×2, 2×3, etc. | Two-Way ANOVA |
| Factorial (3+ factors) | Any | Multi-Way ANOVA or Regression |

---

## Understanding P-Values and Confidence Intervals

### P-Values Demystified

#### What is a P-Value?

**Technical Definition**: The probability of observing data at least as extreme as what we observed, assuming the null hypothesis is true.

**Intuitive Explanation**:
```
Imagine:
1. There's actually NO difference between control and treatment (null hypothesis)
2. We run the experiment
3. We observe some difference
4. P-value asks: "How surprising is this difference if there's really no effect?"

Low p-value (< 0.05): Very surprising! Probably there IS an effect.
High p-value (> 0.05): Not surprising. Could just be random chance.
```

#### What P-Value Is NOT

**Common Misconceptions**:

❌ **WRONG**: "p = 0.05 means 5% probability the null hypothesis is true"
✅ **RIGHT**: "p = 0.05 means if null were true, we'd see data this extreme 5% of the time"

❌ **WRONG**: "p = 0.05 means 5% chance we made an error"
✅ **RIGHT**: "p = 0.05 means if we use α=0.05 threshold, we'll have 5% false positive rate across many experiments"

❌ **WRONG**: "p = 0.001 is much better than p = 0.04"
✅ **RIGHT**: "Both provide evidence against null; focus on effect size and CI"

❌ **WRONG**: "p > 0.05 means no effect exists"
✅ **RIGHT**: "p > 0.05 means insufficient evidence to conclude effect exists"

#### Interpreting P-Values

```
p < 0.001: Very strong evidence against null
p < 0.01:  Strong evidence
p < 0.05:  Moderate evidence (conventional threshold)
p < 0.10:  Weak evidence
p > 0.10:  Little to no evidence
```

**Context Matters**:
```typescript
// Scenario 1: Critical decision, large sample
if (pValue < 0.01 && sampleSize > 10000 && effectSize > minPractical) {
  decision = "Ship with high confidence";
}

// Scenario 2: Exploratory, small sample
if (pValue < 0.10 && sampleSize < 1000) {
  decision = "Promising, run larger test";
}

// Scenario 3: Multiple metrics
if (pValue < 0.05 && !multipleTestingCorrectionApplied) {
  decision = "Apply correction before concluding";
}
```

#### Example Walkthrough

```typescript
const result = twoProportionZTest(
  { successes: 500, trials: 5000 },   // Control: 10%
  { successes: 605, trials: 5000 }    // Treatment: 12.1%
);

// result.pValue = 0.0023

// Interpretation:
"If there were truly no difference between control and treatment,
the probability of observing a difference of 2.1% or more extreme
is 0.23%. This is strong evidence that there IS a real difference."
```

### Confidence Intervals

#### What is a Confidence Interval?

**Definition**: A range of plausible values for the true parameter.

**95% Confidence Interval Interpretation**:
```
"If we repeated this experiment 100 times, approximately 95 of the
resulting confidence intervals would contain the true parameter value."
```

**What it is NOT**:
❌ "95% probability the true value is in this interval" (Bayesian interpretation)
✅ "95% of such intervals contain the true value" (Frequentist interpretation)

#### Why CIs Are Better Than P-Values

**P-Value Alone**:
```
"Treatment is significantly better than control (p = 0.003)"

Questions left unanswered:
- How much better?
- What's the uncertainty?
- Is the effect practically meaningful?
```

**Confidence Interval**:
```
"Treatment increases conversion by 2.1% [95% CI: 0.8%, 3.4%]"

Immediately clear:
- Point estimate: 2.1%
- Lower bound: 0.8%
- Upper bound: 3.4%
- Statistical significance: Yes (CI excludes 0)
- Practical significance: Depends on threshold
```

#### Using CIs for Decision Making

```typescript
const minPracticalEffect = 1.5;  // 1.5% absolute increase

if (result.ciLower > minPracticalEffect) {
  decision = "SHIP - Effect definitely above threshold";
}
else if (result.ciUpper < minPracticalEffect) {
  decision = "DON'T SHIP - Effect definitely below threshold";
}
else if (result.ciLower < 0 && result.ciUpper > 0) {
  decision = "INCONCLUSIVE - CI includes zero";
}
else {
  decision = "UNCERTAIN - CI overlaps threshold, need more data or judgment";
}
```

#### Visualization

```
Confidence Interval Scenarios:

Scenario 1: Clear Win
Control ----●----
Treatment        -----●-----
                0%   2%   4%
CI entirely right of 0 → Ship

Scenario 2: Clear Loss
Control      ----●----
Treatment -----●-----
          -2%   0%   2%
CI entirely left of 0 → Don't ship

Scenario 3: Inconclusive
Control ----●----
Treatment  -----●-----
        -1%   0%   1%   2%
CI crosses 0 → Need more data

Scenario 4: Significant but Small
Control ----●----
Treatment    --●--
              0% 0.5% 1%
Significant but below threshold (1.5%) → Judgment call
```

### The Relationship Between P-Values and CIs

**For Two-Tailed Test at α = 0.05**:

```
If 95% CI excludes 0 → p < 0.05
If 95% CI includes 0 → p > 0.05

Example:
Difference: +2.1% [95% CI: 0.8%, 3.4%]
CI excludes 0 → p < 0.05

Difference: +1.2% [95% CI: -0.3%, 2.7%]
CI includes 0 → p > 0.05
```

**They Tell the Same Story, But**:
- P-value: Binary decision (significant or not)
- CI: Full picture of uncertainty and magnitude

---

## Effect Sizes and Practical Significance

### Why Effect Sizes Matter

**The Problem with P-Values Alone**:

```
Experiment A:
- n = 100,000 per group
- Difference: +0.01%
- p < 0.001 (highly significant!)
- Effect size: Tiny
- Decision: Don't ship (not worth it)

Experiment B:
- n = 500 per group
- Difference: +5%
- p = 0.08 (not significant)
- Effect size: Large
- Decision: Run larger test (promising!)
```

**Key Insight**: Statistical significance ≠ Practical significance

### Common Effect Size Measures

#### 1. Cohen's d (Standardized Mean Difference)

**Formula**: d = (μ₁ - μ₂) / σ_pooled

**Interpretation**:
```
Small:  d = 0.2   (means differ by 0.2 standard deviations)
Medium: d = 0.5
Large:  d = 0.8
Very Large: d > 1.2
```

**Example**:
```typescript
const controlRevenue = { mean: 50, sd: 30, n: 1000 };
const treatmentRevenue = { mean: 55, sd: 30, n: 1000 };

const cohensD = (55 - 50) / 30;  // 0.167 (small effect)

// Interpretation: Treatment increases revenue by 0.167 standard deviations
// In context: $5 increase with $30 typical variation
```

**When to Use**: Continuous metrics (revenue, time, counts)

#### 2. Cohen's h (Standardized Proportion Difference)

**Formula**: h = 2[arcsin(√p₁) - arcsin(√p₂)]

**Interpretation**:
```
Small:  h = 0.2
Medium: h = 0.5
Large:  h = 0.8
```

**Example**:
```typescript
const control = { rate: 0.10 };
const treatment = { rate: 0.12 };

const cohensH = 2 * (Math.asin(Math.sqrt(0.12)) - Math.asin(Math.sqrt(0.10)));
// h ≈ 0.063 (small effect)
```

**When to Use**: Binary metrics (conversion, click-through)

#### 3. Relative Lift

**Formula**: Relative Lift = (Treatment - Control) / Control

**Interpretation**:
```
+10%: Small to medium (depends on baseline)
+25%: Medium to large
+50%: Large
+100%: Very large (doubled!)
```

**Example**:
```typescript
const control = 0.10;    // 10% baseline
const treatment = 0.12;  // 12% result

const relativeLift = (0.12 - 0.10) / 0.10;  // 0.20 = 20% relative lift

// Context matters:
// 20% lift on 10% baseline = 2% absolute = meaningful
// 20% lift on 0.1% baseline = 0.02% absolute = tiny
```

**When to Use**: Business communication, easy to understand

#### 4. Absolute Difference

**Formula**: Absolute Difference = Treatment - Control

**Interpretation**: Direct, no standardization

**Example**:
```typescript
const control = 0.10;    // 10%
const treatment = 0.12;  // 12%

const absoluteDiff = 0.12 - 0.10;  // 0.02 = 2 percentage points

// Multiply by users for business impact:
// 2% × 100,000 users = 2,000 additional conversions
```

**When to Use**: Business impact, ROI calculations

#### 5. Number Needed to Treat (NNT)

**Formula**: NNT = 1 / (Treatment Rate - Control Rate)

**Interpretation**: How many users need treatment for one additional success

**Example**:
```typescript
const control = 0.10;
const treatment = 0.12;

const nnt = 1 / (0.12 - 0.10);  // 50

// "Need to show treatment to 50 users to get 1 additional conversion"
```

**When to Use**: Cost-benefit analysis, resource planning

### Practical Significance Thresholds

**Setting Your Threshold**:

```typescript
// Step 1: Calculate cost of implementation
const implementationCost = 50000;  // Engineering effort
const maintenanceCost = 5000;      // Annual maintenance

// Step 2: Calculate benefit per percentage point
const annualUsers = 1000000;
const avgOrderValue = 50;
const benefitPerPercentPoint = annualUsers * 0.01 * avgOrderValue;
// 1,000,000 × 0.01 × $50 = $500,000 per percentage point

// Step 3: Calculate minimum effect needed
const minEffect = implementationCost / benefitPerPercentPoint;
// $50,000 / $500,000 = 0.1 percentage points

// Step 4: Add buffer for uncertainty
const practicalThreshold = minEffect * 1.5;  // 0.15 percentage points

console.log(`Need at least ${practicalThreshold}% absolute lift to justify`);
```

**Rule of Thumb Thresholds**:

| Baseline Rate | Minimum Meaningful Relative Lift |
|---------------|----------------------------------|
| > 20% | 5-10% |
| 10-20% | 10-15% |
| 5-10% | 15-20% |
| 1-5% | 20-30% |
| < 1% | 30-50% |

**Rationale**: Harder to move high-frequency events; low-frequency events need larger relative changes to be detectable and meaningful.

### Reporting Effect Sizes

**Best Practice Report Format**:

```
Treatment increased checkout conversion by 2.0 percentage points
from 10.0% to 12.0% (20% relative lift).

Statistical:
- 95% CI: [1.2%, 2.8%]
- p < 0.001
- Cohen's h = 0.063 (small effect)
- n = 5,000 per group

Business Impact:
- 2,000 additional conversions per month
- $100,000 additional revenue per month
- ROI: 2400% (implementation cost: $50k)

Decision: Ship - Effect exceeds 1.5% minimum threshold
```

---

## Power Analysis Explained

### What is Statistical Power?

**Definition**: Probability of detecting an effect when it truly exists.

**Formula**: Power = 1 - β (where β is Type II error rate)

**Visual Representation**:

```
Truth about the world:

         No Real Effect         Real Effect Exists
         (H₀ true)              (H₁ true)
      ┌─────────────────┬──────────────────────┐
Test  │                 │                      │
Says  │  True Negative  │   False Negative     │
No    │  (Correct!)     │   (Type II Error)    │
Effect│     1 - α       │          β           │
      │                 │                      │
      ├─────────────────┼──────────────────────┤
      │                 │                      │
Test  │  False Positive │   True Positive      │
Says  │  (Type I Error) │   (Correct!)         │
Effect│       α         │      1 - β           │
      │                 │     (Power)          │
      └─────────────────┴──────────────────────┘

Standard values:
α (false positive rate) = 0.05 = 5%
β (false negative rate) = 0.20 = 20%
Power (1 - β) = 0.80 = 80%
```

### Why 80% Power?

**Convention**: 80% power is standard (4:1 ratio of Type II to Type I errors)

**Interpretation**:
```
If there IS a real effect of the size we specify:
- 80% chance we'll detect it (declare significant)
- 20% chance we'll miss it (false negative)
```

**When to Use Higher Power**:
- Critical decisions: Use 90% or 95% power
- Costly experiments: Can't afford to miss effects
- Follow-up studies: Validate previous findings

**When Lower Power is OK**:
- Exploratory research: Just looking for signals
- Very cheap to run: Can easily repeat
- Never: For production experiments (use at least 80%)

### The Four Parameters

**Power analysis involves four parameters**:

1. **Sample Size (n)**
2. **Effect Size (δ)**
3. **Significance Level (α)**
4. **Power (1 - β)**

**If you know any three, you can calculate the fourth.**

### Pre-Experiment: Calculate Sample Size

**Most Common Use Case**: "How many users do I need?"

```typescript
import { calculateSampleSize } from 'experimeh';

// Proportion test (conversion rate)
const result = calculateSampleSize('proportion', 0.02, {
  alpha: 0.05,
  power: 0.80,
  baselineRate: 0.10
});

console.log(`Need ${result.sampleSizePerGroup} users per variant`);
console.log(`Total: ${result.totalSampleSize} users`);
console.log(`At 5,000 users/day: ${result.estimatedDays} days`);

// Continuous metric (revenue)
const result2 = calculateSampleSize('continuous', 0.2, {  // Cohen's d
  alpha: 0.05,
  power: 0.80
});

console.log(`Need ${result2.sampleSizePerGroup} users per variant`);
```

**Factors Affecting Sample Size**:

```
Effect Size     α      Power    Sample/Group
Large (d=0.8)   0.05   0.80     26
Medium (d=0.5)  0.05   0.80     64
Small (d=0.2)   0.05   0.80     393

Effect Size     α      Power    Sample/Group
Medium (d=0.5)  0.05   0.80     64
Medium (d=0.5)  0.05   0.90     85    (+33% for 10% more power)
Medium (d=0.5)  0.01   0.80     102   (+59% for stricter α)
```

**Key Insights**:
- Detecting small effects requires large samples
- Higher power requires larger samples
- Lower α (more conservative) requires larger samples
- Doubling power doesn't double sample size

### Post-Experiment: Achieved Power

**After Experiment**: "How likely were we to detect the effect we observed?"

```typescript
import { calculateAchievedPower } from 'experimeh';

const power = calculateAchievedPower('proportion', {
  alpha: 0.05,
  sampleSize: 5000,
  baselineRate: 0.10,
  observedEffect: 0.02
});

console.log(`Achieved power: ${power}%`);

if (power < 80) {
  console.warn(`⚠️  Underpowered! Only ${power}% chance of detecting this effect`);
  console.log(`Should have collected ${power.recommendedSampleSize} per group`);
}
```

**Interpretation**:
- High achieved power (>80%): Good! Likely to detect effect if it exists
- Low achieved power (<50%): Underpowered, non-significant result inconclusive
- Very high power (>99%): May detect tiny, practically insignificant effects

### Minimum Detectable Effect (MDE)

**Question**: "What's the smallest effect I can detect with my sample size?"

```typescript
import { calculateMDE } from 'experimeh';

const mde = calculateMDE('proportion', {
  alpha: 0.05,
  power: 0.80,
  sampleSize: 5000,
  baselineRate: 0.10
});

console.log(`With 5,000 users per group, can detect effects ≥ ${mde}%`);

// Example output: "Can detect effects ≥ 1.7%"

// Reality check:
if (mde > minBusinessThreshold) {
  console.warn(`⚠️  Can only detect ${mde}%, but need ${minBusinessThreshold}%`);
  console.log(`Options: 1) Get more users, 2) Accept lower power, 3) Don't run`);
}
```

### Runtime Estimation

**Practical Planning**:

```typescript
function estimateRuntime(
  requiredSample: number,
  dailyTraffic: number,
  numVariants: number,
  allocationPercent: number = 1.0
): void {
  const totalSample = requiredSample * numVariants;
  const effectiveTraffic = dailyTraffic * allocationPercent;
  const days = Math.ceil(totalSample / effectiveTraffic);

  console.log(`Total sample needed: ${totalSample}`);
  console.log(`Daily traffic: ${dailyTraffic} (${allocationPercent * 100}% allocated)`);
  console.log(`Estimated runtime: ${days} days`);

  if (days > 21) {
    console.warn(`⚠️  Very long runtime (${days} days)`);
    console.log(`Consider:`);
    console.log(`  - Increase allocation to ${Math.ceil(21 / days * 100)}%`);
    console.log(`  - Accept higher MDE`);
    console.log(`  - Use variance reduction (CUPED)`);
  }

  if (days < 7) {
    console.warn(`⚠️  Very short runtime (${days} days)`);
    console.log(`Recommend running at least 7 days to capture weekly patterns`);
  }
}

// Example:
estimateRuntime(10000, 2000, 2);
// Total: 20,000 users needed
// Daily: 2,000 users available
// Runtime: 10 days
```

### Power Curve Visualization

**ASCII Visualization of Power vs. Sample Size**:

```
Power vs. Sample Size (for detecting 2% absolute effect at 10% baseline)

100% │                                    ──────────
 90% │                            ────────
 80% │                    ────────              ← Recommended
 70% │             ───────
 60% │       ──────
 50% │   ────
 40% │ ──
 30% │─
     └─────┴─────┴─────┴─────┴─────┴─────┴─────
      1k   2k   3k   4k   5k   6k   7k   8k
           Sample Size Per Group

Key Insight: Diminishing returns!
- Going from 50% to 80% power: Need +60% sample
- Going from 80% to 90% power: Need +30% sample
- Going from 90% to 95% power: Need +25% sample
```

---

## Multiple Testing Correction Explained

### The Multiple Comparisons Problem

**The Scenario**:

```
You test 20 metrics at α = 0.05 each.
Even if NONE have real effects:
Expected false positives = 20 × 0.05 = 1

Probability of at least 1 false positive:
P(at least 1 FP) = 1 - (1 - 0.05)²⁰ = 64%!
```

**The Problem**: Family-Wise Error Rate (FWER) inflates

```
Number of Tests    Individual α    FWER (at least 1 FP)
1                  0.05            5%
5                  0.05            23%
10                 0.05            40%
20                 0.05            64%
50                 0.05            92%
```

### Two Approaches to Multiple Testing

#### Approach 1: Control Family-Wise Error Rate (FWER)

**Goal**: Keep probability of ANY false positive ≤ α

**Methods**:
- Bonferroni correction
- Holm-Bonferroni (step-down)
- Šidák correction

**Use When**:
- Few comparisons (<10)
- Need strong error control
- Confirmatory analysis
- High cost of false positives

#### Approach 2: Control False Discovery Rate (FDR)

**Goal**: Keep expected PROPORTION of false discoveries ≤ α

**Methods**:
- Benjamini-Hochberg
- Benjamini-Yekutieli (for dependent tests)

**Use When**:
- Many comparisons (>10)
- Exploratory analysis
- Can tolerate some false positives
- Want more power than FWER methods

### Bonferroni Correction

**Method**: Divide α by number of tests

**Formula**: α_adjusted = α / m

**Implementation**:
```typescript
import { bonferroniCorrection } from 'experimeh';

const pValues = [0.001, 0.03, 0.04, 0.10, 0.50];
const result = bonferroniCorrection(pValues, 0.05);

console.log('Original α: 0.05');
console.log(`Adjusted α: ${0.05 / 5} = 0.01`);
console.log(`Rejected: ${result.rejected}`);  // [true, false, false, false, false]

// Only p=0.001 < 0.01, so only first test is significant
```

**Pros**:
- Simple to understand and implement
- Controls FWER exactly at α
- Valid for any dependency structure

**Cons**:
- Very conservative (low power)
- Power decreases linearly with m
- Too stringent for exploratory analysis

**Example**:
```
Testing 10 metrics, α = 0.05
Bonferroni: Need p < 0.005 to be significant
Effect: Much harder to declare significance
```

### Holm-Bonferroni (Step-Down)

**Method**: Sequential testing with decreasing α thresholds

**Algorithm**:
```
1. Sort p-values from smallest to largest
2. For i = 1 to m:
   Compare p(i) to α/(m - i + 1)
   If p(i) ≤ α/(m - i + 1): Reject and continue
   If p(i) > α/(m - i + 1): Stop, accept rest
```

**Implementation**:
```typescript
import { holmBonferroni } from 'experimeh';

const pValues = [0.001, 0.01, 0.03, 0.04, 0.10];
const result = holmBonferroni(pValues, 0.05);

// Step-by-step:
// 1. p=0.001 vs 0.05/5=0.010 ✓ reject, continue
// 2. p=0.01  vs 0.05/4=0.0125 ✓ reject, continue
// 3. p=0.03  vs 0.05/3=0.0167 ✗ stop here
// 4. p=0.04  → not tested
// 5. p=0.10  → not tested

console.log(result.rejected);  // [true, true, false, false, false]
```

**Pros**:
- More powerful than Bonferroni
- Still controls FWER at α
- Uniformly better than Bonferroni (always rejects at least as many)

**Cons**:
- Still conservative for many tests
- Sequential nature (order matters)

### Benjamini-Hochberg (FDR Control)

**Method**: Control expected proportion of false discoveries

**Algorithm**:
```
1. Sort p-values from smallest to largest: p(1) ≤ p(2) ≤ ... ≤ p(m)
2. Find largest i where p(i) ≤ (i/m) × α
3. Reject H(1), H(2), ..., H(i)
```

**Implementation**:
```typescript
import { benjaminiHochberg } from 'experimeh';

const pValues = [0.001, 0.01, 0.03, 0.04, 0.10];
const result = benjaminiHochberg(pValues, 0.05);

// Step-by-step with m=5, α=0.05:
// i=1: p=0.001 vs (1/5)*0.05=0.010 ✓
// i=2: p=0.01  vs (2/5)*0.05=0.020 ✓
// i=3: p=0.03  vs (3/5)*0.05=0.030 ✓ (exactly equal, still counts)
// i=4: p=0.04  vs (4/5)*0.05=0.040 ✓
// i=5: p=0.10  vs (5/5)*0.05=0.050 ✗

// Largest i = 4, so reject first 4 tests

console.log(result.rejected);  // [true, true, true, true, false]
```

**Pros**:
- Much more powerful than Bonferroni/Holm
- Appropriate for many tests
- Controls FDR (not FWER) - more permissive

**Cons**:
- Allows some false positives (but bounds the rate)
- Not appropriate when NO false positives acceptable

**FDR Interpretation**:
```
If BH rejects 10 tests at FDR=0.05:
Expected number of false positives: 10 × 0.05 = 0.5

Not guaranteed to be ≤0.5, but expected value is ≤0.5
```

### Choosing the Right Method

```
Decision Tree:

How many tests?
├─ 1-2: No correction needed (pre-specified)
│
├─ 3-10: Moderate number
│   ├─ Need zero false positives? → Holm-Bonferroni
│   └─ Can tolerate some? → Benjamini-Hochberg
│
└─ 10+: Many tests
    ├─ Confirmatory, critical → Holm-Bonferroni (conservative)
    ├─ Exploratory → Benjamini-Hochberg (powerful)
    └─ Genome-wide, thousands → Specialized methods

Type of analysis?
├─ Confirmatory (pre-registered) → FWER control (Holm)
└─ Exploratory (hypothesis generating) → FDR control (BH)

Cost of errors?
├─ False positives very costly → Bonferroni/Holm
├─ False negatives very costly → BH or no correction
└─ Balanced → Holm
```

### Practical Example

```typescript
// Experiment with 1 primary + 8 secondary metrics

const metrics = {
  // Primary metric (no correction applied)
  checkoutConversion: { pValue: 0.003, correctionNeeded: false },

  // Secondary metrics (need correction)
  secondary: {
    revenue: { pValue: 0.001 },
    sessionDuration: { pValue: 0.03 },
    bounceRate: { pValue: 0.045 },
    pagesPerSession: { pValue: 0.08 },
    addToCartRate: { pValue: 0.12 },
    wishlistAdds: { pValue: 0.25 },
    socialShares: { pValue: 0.40 },
    returnRate: { pValue: 0.60 }
  }
};

const secondaryPValues = Object.values(metrics.secondary).map(m => m.pValue);
const corrected = benjaminiHochberg(secondaryPValues, 0.05);

console.log('Primary Metric (no correction):');
console.log(`  Checkout Conversion: p=${metrics.checkoutConversion.pValue} ✅`);

console.log('\nSecondary Metrics (BH corrected at FDR=0.05):');
Object.keys(metrics.secondary).forEach((name, i) => {
  const sig = corrected.rejected[i] ? '✅' : '❌';
  console.log(`  ${name}: p=${secondaryPValues[i]} ${sig}`);
});

// Output:
//   revenue: p=0.001 ✅
//   sessionDuration: p=0.03 ✅
//   bounceRate: p=0.045 ✅
//   pagesPerSession: p=0.08 ❌
//   ... (rest not significant)
```

---

## Bayesian vs Frequentist Approaches

### Philosophical Differences

#### Frequentist Approach

**Core Idea**: Probability is long-run frequency

**Interpretation**:
```
"If we repeated this experiment infinite times,
95% of confidence intervals would contain the true value"
```

**Questions Answered**:
- Is there an effect? (p-value)
- What's the range of plausible values? (CI)
- How strong is the evidence? (p-value, CI width)

**Questions NOT Answered**:
- What's the probability treatment is better?
- What's the probability effect is > X%?

#### Bayesian Approach

**Core Idea**: Probability is degree of belief

**Interpretation**:
```
"Based on data and prior beliefs,
there's a 95% probability the true value is in this range"
```

**Questions Answered**:
- Probability treatment is better than control
- Probability effect exceeds threshold
- Expected value of shipping vs. not shipping
- Direct probability statements

**Questions NOT Answered** (without prior):
- Nothing! Can answer any probabilistic question

### When to Use Each

#### Use Frequentist When:

✅ Industry standard (easier to explain)
✅ No prior information available
✅ Fixed sample size, analyze once
✅ Binary decision (ship or don't)
✅ Regulatory requirements (FDA, etc.)
✅ Publication in academic journals

#### Use Bayesian When:

✅ Have prior information/beliefs
✅ Want to stop experiment early
✅ Need probability statements
✅ Continuously monitoring experiment
✅ Small sample sizes
✅ Explaining to non-statisticians
✅ Risk/reward decision making

### Bayesian Analysis for Proportions

**The Model**: Beta-Binomial

```
Prior: θ ~ Beta(α, β)
Likelihood: x | θ ~ Binomial(n, θ)
Posterior: θ | x ~ Beta(α + x, β + n - x)
```

**Implementation**:
```typescript
import { bayesianProportionTest } from 'experimeh';

const control = { successes: 500, trials: 5000 };     // 10% conversion
const treatment = { successes: 605, trials: 5000 };   // 12.1% conversion

const result = bayesianProportionTest(control, treatment, {
  prior: { alpha: 1, beta: 1 }  // Uniform prior (non-informative)
});

console.log(`P(Treatment > Control): ${result.probabilityTreatmentBetter}`);
// Output: 0.997 = 99.7% probability treatment is better

console.log(`Expected lift: ${result.expectedLift}%`);
console.log(`95% Credible Interval: [${result.liftCI.lower}, ${result.liftCI.upper}]`);

console.log(`Risk of choosing treatment if control is better: ${result.riskTreatment}`);
console.log(`Risk of choosing control if treatment is better: ${result.riskControl}`);
```

**Bayesian Output Advantages**:
```
Frequentist:
"p = 0.003" → Hard to interpret

Bayesian:
"99.7% probability treatment is better" → Intuitive!
"Expected lift is 2.1% [1.2%, 3.0%]" → Direct probability statement
"If we ship treatment and we're wrong, expected loss is 0.003%" → Risk quantification
```

### Choosing a Prior

#### Non-Informative Priors

**Uniform Prior** (Beta(1, 1)):
```typescript
const prior = { alpha: 1, beta: 1 };  // Flat, all values equally likely
```
**Use When**: No prior information, let data speak

**Jeffrey's Prior** (Beta(0.5, 0.5)):
```typescript
const prior = { alpha: 0.5, beta: 0.5 };  // Scale-invariant
```
**Use When**: Want truly non-informative prior

#### Informative Priors

**Weakly Informative** (Beta(10, 90)):
```typescript
const prior = { alpha: 10, beta: 90 };  // Centers around 10% with some uncertainty
```
**Use When**: Have historical data suggesting ~10% conversion

**Strong Prior** (Beta(100, 900)):
```typescript
const prior = { alpha: 100, beta: 900 };  // Strong belief in 10%
```
**Use When**: Lots of historical data, unlikely to deviate much

**Prior from Historical Data**:
```typescript
function priorFromHistorical(historicalData: {successes: number, trials: number}) {
  // Use historical data directly as prior
  return {
    alpha: historicalData.successes + 1,   // Add pseudocounts
    beta: historicalData.trials - historicalData.successes + 1
  };
}

const prior = priorFromHistorical({ successes: 1000, trials: 10000 });
// Beta(1001, 9001) - strong prior around 10%
```

### Early Stopping with Bayesian

**Frequentist Problem**:
```
Must pre-commit to sample size OR use sequential testing with α-spending
Peeking without correction inflates Type I error
```

**Bayesian Solution**:
```
Can stop anytime based on posterior probability
No inflation of error rate (from Bayesian perspective)
```

**Implementation**:
```typescript
async function monitorBayesianExperiment(experimentId: string) {
  const stopRule = {
    minSampleSize: 1000,  // Don't stop before this
    probabilityThreshold: 0.99,  // Stop if P(Treatment > Control) > 99%
    practicalThreshold: 0.01,  // And expected lift > 1%
    checkFrequency: 'daily'
  };

  while (true) {
    const data = await getExperimentData(experimentId);

    if (data.sampleSize < stopRule.minSampleSize) {
      continue;  // Too early
    }

    const result = bayesianProportionTest(data.control, data.treatment);

    if (result.probabilityTreatmentBetter > stopRule.probabilityThreshold &&
        result.expectedLift > stopRule.practicalThreshold) {
      console.log(`✅ Clear winner! Stopping early.`);
      console.log(`P(Treatment > Control) = ${result.probabilityTreatmentBetter}`);
      return 'STOP_SHIP_TREATMENT';
    }

    if (result.probabilityTreatmentBetter < (1 - stopRule.probabilityThreshold) &&
        result.expectedLift < -stopRule.practicalThreshold) {
      console.log(`❌ Clear loser! Stopping early.`);
      return 'STOP_DONT_SHIP';
    }

    await sleep(24 * 60 * 60 * 1000);  // Check daily
  }
}
```

### Comparison on Same Data

**Example Data**:
```
Control: 500/5000 = 10.0%
Treatment: 605/5000 = 12.1%
Absolute difference: 2.1%
```

**Frequentist Results**:
```typescript
const freq = twoProportionZTest(
  { successes: 500, trials: 5000 },
  { successes: 605, trials: 5000 }
);

console.log(`Z-statistic: ${freq.zStatistic}`);  // 3.04
console.log(`P-value: ${freq.pValue}`);          // 0.0024
console.log(`95% CI: [${freq.ciLower}%, ${freq.ciUpper}%]`);  // [0.8%, 3.4%]
console.log(`Conclusion: Significant at α=0.05`);
```

**Bayesian Results**:
```typescript
const bayes = bayesianProportionTest(
  { successes: 500, trials: 5000 },
  { successes: 605, trials: 5000 },
  { prior: { alpha: 1, beta: 1 }}
);

console.log(`P(Treatment > Control): ${bayes.probabilityTreatmentBetter}`);  // 99.8%
console.log(`Expected lift: ${bayes.expectedLift}%`);  // 2.1%
console.log(`95% Credible Interval: [${bayes.ciLower}%, ${bayes.ciUpper}%]`);  // [0.8%, 3.4%]
console.log(`Risk of wrong decision: ${bayes.riskTreatment}`);  // 0.002%
```

**Key Differences**:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Significance | p = 0.0024 | P(Better) = 99.8% |
| Interpretation | "If no effect, 0.24% chance of seeing this" | "99.8% chance treatment is better" |
| Interval | 95% CI [0.8%, 3.4%] | 95% CrI [0.8%, 3.4%] |
| Early Stopping | Requires α-spending | Can stop anytime |
| Priors | N/A | Can incorporate |

---

## When to Use Sequential Testing

### What is Sequential Testing?

**Traditional (Fixed Sample)**:
```
1. Calculate sample size
2. Collect all data
3. Analyze once
4. Make decision
```

**Sequential Testing**:
```
1. Calculate maximum sample size
2. Collect data and analyze at pre-planned times
3. Stop early if conclusive
4. Make decision
```

### Why Use Sequential Testing?

**Benefits**:
1. **Save Time**: Stop early if clear winner/loser
2. **Save Resources**: Don't waste traffic on inferior variant
3. **Faster Iteration**: Ship winning features sooner
4. **Ethical**: Stop harmful experiments early

**Example**:
```
Planned: 10,000 users per group, 10 days

Sequential result:
- Day 3: Strong evidence for treatment (p < adjusted threshold)
- Stop experiment
- Saved 7 days, 14,000 users
```

### When to Use Sequential Testing

**Good Use Cases**:

✅ Long-running experiments (weeks to months)
✅ High traffic (can reach significance early)
✅ Uncertain effect size
✅ Need to iterate quickly
✅ Ethical concerns about prolonged exposure to inferior variant

**Bad Use Cases**:

❌ Very short experiments (< 1 week)
❌ Low traffic (won't reach significance early anyway)
❌ Need to measure long-term effects
❌ Require exact sample size for other reasons

### Alpha Spending Functions

#### 1. O'Brien-Fleming

**Characteristics**:
- Very conservative early
- Liberal later
- "Wait and see" approach

**Use When**:
- Default choice for most experiments
- Want to avoid stopping on early noise
- Concerned about false positives

**Alpha Spending**:
```
Look 1 (25% info): α = 0.0001  (very strict)
Look 2 (50% info): α = 0.004
Look 3 (75% info): α = 0.019
Look 4 (100% info): α = 0.043  (close to 0.05)
```

**Implementation**:
```typescript
import { sequentialTest } from 'experimeh';

const seq = sequentialTest({
  alphaSpending: 'obrien-fleming',
  plannedLooks: 4,
  alpha: 0.05
});

// At each look:
const result = seq.analyze(data, lookNumber);
console.log(`Adjusted α for this look: ${result.adjustedAlpha}`);
console.log(`Can stop: ${result.canStop}`);
```

#### 2. Pocock

**Characteristics**:
- Constant spending
- Same threshold at each look
- "Aggressive" approach

**Use When**:
- Want equal power to stop at any point
- High cost of running longer
- Less concerned about early false positives

**Alpha Spending**:
```
Look 1 (25% info): α = 0.0158
Look 2 (50% info): α = 0.0158
Look 3 (75% info): α = 0.0158
Look 4 (100% info): α = 0.0158
```

**Note**: Total α still equals 0.05, but distributed evenly

#### 3. Linear

**Characteristics**:
- Alpha spent proportional to information
- Middle ground between O'Brien-Fleming and Pocock

**Alpha Spending**:
```
Look 1 (25% info): α = 0.0125  (25% of 0.05)
Look 2 (50% info): α = 0.025   (50% of 0.05)
Look 3 (75% info): α = 0.0375  (75% of 0.05)
Look 4 (100% info): α = 0.05   (100% of 0.05)
```

### Implementation Example

```typescript
import { SequentialTest } from 'experimeh';

// Setup
const experiment = new SequentialTest({
  alphaSpending: 'obrien-fleming',
  plannedLooks: 5,
  alpha: 0.05,
  plannedSampleSize: 10000  // per group
});

// Look 1 (20% of data collected)
const look1 = experiment.analyze({
  control: { successes: 200, trials: 2000 },
  treatment: { successes: 248, trials: 2000 }
}, 1);

console.log(`Look 1 - Information fraction: ${look1.informationFraction}`);
console.log(`Adjusted α: ${look1.adjustedAlpha}`);  // Very small (O'Brien-Fleming)
console.log(`P-value: ${look1.pValue}`);
console.log(`Can stop: ${look1.canStop}`);

if (look1.canStop) {
  console.log(`Decision: ${look1.decision}`);
} else {
  console.log(`Continue to next look`);
}

// Look 2 (40% of data)
// ... repeat for each look
```

### Practical Guidelines

**Planning**:
```typescript
// 1. Calculate fixed sample size first
const fixedN = calculateSampleSize('proportion', 0.02, {
  alpha: 0.05,
  power: 0.80,
  baselineRate: 0.10
});  // Say 5,000 per group

// 2. Increase for sequential testing (10-20% inflation)
const maxN = Math.ceil(fixedN * 1.15);  // 5,750 per group

// 3. Plan looks
const looks = [
  { fraction: 0.20, n: maxN * 0.20 },  // 1,150
  { fraction: 0.40, n: maxN * 0.40 },  // 2,300
  { fraction: 0.60, n: maxN * 0.60 },  // 3,450
  { fraction: 0.80, n: maxN * 0.80 },  // 4,600
  { fraction: 1.00, n: maxN * 1.00 }   // 5,750
];
```

**Monitoring**:
```typescript
async function runSequentialExperiment(experimentId: string) {
  const seq = new SequentialTest({
    alphaSpending: 'obrien-fleming',
    plannedLooks: 5,
    alpha: 0.05
  });

  for (let look = 1; look <= 5; look++) {
    // Wait for enough data
    await waitForSampleSize(looks[look-1].n);

    // Analyze
    const data = await getExperimentData(experimentId);
    const result = seq.analyze(data, look);

    // Log results
    console.log(`\n=== Look ${look} ===`);
    console.log(`Sample size: ${data.control.trials} per group`);
    console.log(`P-value: ${result.pValue}`);
    console.log(`Adjusted threshold: ${result.adjustedAlpha}`);

    // Decision
    if (result.canStop) {
      console.log(`\n🎉 Stopping early!`);
      console.log(`Decision: ${result.decision}`);
      break;
    } else {
      console.log(`Continue to next look...`);
    }
  }
}
```

### Expected Savings

**Simulation Results** (typical):

```
O'Brien-Fleming, 5 looks, medium effect (d=0.5):
- 20% stop at Look 1 (20% info) - Save 80% of time
- 35% stop at Look 2 (40% info) - Save 60% of time
- 30% stop at Look 3 (60% info) - Save 40% of time
- 10% stop at Look 4 (80% info) - Save 20% of time
- 5% reach Look 5 (100% info) - No savings

Average savings: ~55% of runtime
```

**Key Insight**: Sequential testing doesn't help if:
- Effect is very small (need full sample anyway)
- Effect is in opposite direction (need full sample to confirm)
- Only helps when effect is medium to large

---

## CUPED Variance Reduction Guide

### What is CUPED?

**CUPED**: Controlled-experiment Using Pre-Experiment Data

**Core Idea**: Use pre-experiment data to reduce variance, increasing statistical power.

**Intuition**:
```
User A: Pre-experiment revenue = $100, Post-experiment = $105
User B: Pre-experiment revenue = $10, Post-experiment = $15

Without CUPED:
"User A spent $105, User B spent $15" (high variance)

With CUPED:
"User A spent $5 more than expected, User B spent $5 more" (lower variance)
Both users increased by same amount relative to baseline!
```

### The Mathematics

**Formula**:
```
Y_adjusted = Y - θ(X - E[X])

where:
  Y = post-experiment metric
  X = pre-experiment metric (covariate)
  θ = Cov(Y,X) / Var(X)  (optimal coefficient)
  E[X] = expected value of X
```

**Variance Reduction**:
```
Var(Y_adjusted) = Var(Y) × (1 - ρ²)

where ρ = correlation between Y and X
```

**Example**:
```
ρ = 0.7 → Variance reduced by 49%
Equivalent to 2× sample size!

ρ = 0.5 → Variance reduced by 25%
Equivalent to 1.33× sample size

ρ = 0.9 → Variance reduced by 81%
Equivalent to 5× sample size!
```

### When to Use CUPED

**Good Candidates**:

✅ Have pre-experiment data for same metric
✅ Metric has high variance
✅ Pre/post correlation > 0.3
✅ Sample size limited
✅ Want to detect smaller effects

**Example Scenarios**:
- Revenue per user (high variance, good correlation)
- Session duration (moderate variance, good correlation)
- Purchase frequency (high variance, decent correlation)

**Bad Candidates**:

❌ No pre-experiment data available
❌ Metric not stable over time (ρ < 0.2)
❌ Binary metrics with low baseline (e.g., 1% conversion)
❌ New users (no pre-data)

### Implementation

#### Basic CUPED

```typescript
import { cupedABTest } from 'experimeh';

// Collect pre and post data
const control = {
  pre: [45, 52, 38, 42, 48, ...],   // Pre-experiment revenue
  post: [47, 54, 40, 43, 49, ...]   // Post-experiment revenue
};

const treatment = {
  pre: [43, 50, 39, 44, 46, ...],
  post: [48, 58, 44, 49, 52, ...]
};

const result = cupedABTest(control.post, control.pre, treatment.post, treatment.pre);

console.log(`Without CUPED:`);
console.log(`  Difference: ${result.unadjusted.meanDifference}`);
console.log(`  P-value: ${result.unadjusted.pValue}`);
console.log(`  95% CI: [${result.unadjusted.ciLower}, ${result.unadjusted.ciUpper}]`);

console.log(`\nWith CUPED:`);
console.log(`  Difference: ${result.adjusted.meanDifference}`);
console.log(`  P-value: ${result.adjusted.pValue}`);  // More significant!
console.log(`  95% CI: [${result.adjusted.ciLower}, ${result.adjusted.ciUpper}]`);  // Narrower!

console.log(`\nImprovements:`);
console.log(`  Variance reduced by: ${result.varianceReduction}%`);
console.log(`  Effective sample size: ${result.effectiveSampleSize}x`);
console.log(`  Correlation (pre/post): ${result.correlation}`);
```

#### Multi-Covariate CUPED

**Use Multiple Pre-Experiment Variables**:

```typescript
import { multivariateCUPED } from 'experimeh';

const data = {
  // Post-experiment outcome
  outcome: [45, 52, 38, ...],

  // Multiple covariates
  covariates: {
    priorRevenue: [43, 50, 39, ...],
    priorSessions: [12, 15, 8, ...],
    priorPurchases: [2, 3, 1, ...],
    daysSinceSignup: [30, 45, 90, ...]
  }
};

const result = multivariateCUPED(data);

console.log(`R² (variance explained): ${result.rSquared}`);
console.log(`Variance reduction: ${result.varianceReduction}%`);
console.log(`Effective n: ${result.effectiveSampleSize}x`);
```

### Choosing Pre-Experiment Window

**Trade-offs**:

```
Short Window (e.g., 7 days):
✅ More recent, more relevant
✅ Less affected by seasonality
❌ Higher variance (fewer observations)
❌ Lower correlation

Long Window (e.g., 90 days):
✅ Stable estimate
✅ Higher correlation
❌ May be less relevant
❌ Affected by long-term trends

Recommended: 14-30 days for most metrics
```

**Implementation**:
```typescript
function selectPreExperimentWindow(
  metric: string,
  experimentStart: Date
): { start: Date, end: Date } {
  const windowDays = {
    revenue: 30,        // Monthly patterns
    sessions: 14,       // Bi-weekly patterns
    purchases: 60,      // Longer window for rare events
    engagement: 14      // Recent behavior more relevant
  };

  const days = windowDays[metric] || 30;
  const end = new Date(experimentStart);
  end.setDate(end.getDate() - 1);  // Day before experiment

  const start = new Date(end);
  start.setDate(start.getDate() - days);

  return { start, end };
}
```

### Validating CUPED

**Checks to Perform**:

```typescript
function validateCUPED(cupedResult: CUPEDResult): ValidationResult {
  const checks = {
    correlation: {
      value: cupedResult.correlation,
      pass: cupedResult.correlation > 0.3,
      message: cupedResult.correlation > 0.3
        ? '✅ Good correlation'
        : '⚠️  Low correlation, CUPED may not help much'
    },

    varianceReduction: {
      value: cupedResult.varianceReduction,
      pass: cupedResult.varianceReduction > 10,
      message: cupedResult.varianceReduction > 10
        ? '✅ Meaningful variance reduction'
        : '⚠️  Small variance reduction'
    },

    thetaStability: {
      // Check if theta is reasonable (not too extreme)
      pass: Math.abs(cupedResult.theta) < 2,
      message: Math.abs(cupedResult.theta) < 2
        ? '✅ Theta is reasonable'
        : '⚠️  Extreme theta value, check for outliers'
    },

    balanceCheck: {
      // Pre-treatment covariate should be balanced
      pass: cupedResult.covariateBalancePValue > 0.05,
      message: cupedResult.covariateBalancePValue > 0.05
        ? '✅ Covariate balanced between groups'
        : '❌ Covariate imbalanced! CUPED invalid!'
    }
  };

  return checks;
}
```

### Common Pitfalls

#### 1. Using Post-Treatment Data as Covariate

**WRONG**:
```typescript
// DON'T: Using data from after treatment assignment
const covariate = getMetric(userId, experimentStart, experimentEnd);
```

**RIGHT**:
```typescript
// DO: Only use data from before experiment
const covariate = getMetric(userId, experimentStart - 30days, experimentStart);
```

#### 2. Imbalanced Covariates

**Problem**:
```
Control group: Average pre-revenue = $45
Treatment group: Average pre-revenue = $55

This imbalance will bias CUPED adjustment!
```

**Check**:
```typescript
const balanceTest = twoSampleTTest(controlPre, treatmentPre);
if (balanceTest.pValue < 0.05) {
  console.error('❌ Covariates not balanced! Randomization may have failed!');
  console.log('Do not use CUPED with imbalanced covariates.');
}
```

#### 3. Low Correlation

**Problem**:
```
ρ = 0.1 → Only 1% variance reduction
Not worth the complexity
```

**Recommendation**:
```typescript
if (cupedResult.correlation < 0.3) {
  console.warn('⚠️  Correlation too low, using standard analysis instead');
  return standardAnalysis(data);
}
```

### Reporting CUPED Results

**Best Practice**:

```markdown
## Results (with CUPED Variance Reduction)

### Standard Analysis
- Control: $48.20 ± $32.50 (mean ± SD)
- Treatment: $52.30 ± $33.10
- Difference: $4.10 [95% CI: -$1.20, $9.40]
- P-value: 0.13 (not significant)

### CUPED-Adjusted Analysis
**Pre-experiment covariate**: 30-day revenue prior to experiment
**Correlation (pre/post)**: 0.72

- Adjusted difference: $4.15 [95% CI: $0.85, $7.45]
- P-value: 0.014 (significant!)
- Variance reduction: 52%
- Effective sample size: 2.1x

**Validation**:
✅ Covariate balanced (p = 0.67)
✅ High correlation (0.72)
✅ Meaningful variance reduction (52%)

**Conclusion**: CUPED reveals treatment increased revenue by $4.15
(8.6% relative lift), which was not detectable without variance reduction.
```

---

## Stepped Wedge Analysis

### What is Stepped Wedge Design?

A **stepped wedge cluster-randomized trial** where:
- All clusters start in control
- Clusters progressively switch from control to treatment at randomized times
- Switching is unidirectional (once treated, stay treated)
- By study end, all clusters receive treatment

**Visual Example**:
```
Time →     Step 0   Step 1   Step 2   Step 3   Step 4
Cluster 1:   C        C        T        T        T
Cluster 2:   C        T        T        T        T
Cluster 3:   C        C        C        T        T
Cluster 4:   C        C        C        C        T

C = Control, T = Treatment
```

### Statistical Model

#### Basic Mixed Effects Model

```
Y_ij = β₀ + β₁(time) + β₂(treatment) + u_i + ε_ij

Where:
  Y_ij    = outcome for individual j in cluster i
  β₀      = baseline intercept
  β₁      = time trend coefficient (secular changes)
  β₂      = treatment effect coefficient (PRIMARY ESTIMAND)
  time    = step number (0, 1, 2, ...)
  treatment = 0 (control) or 1 (treatment)
  u_i     = random intercept for cluster i ~ N(0, τ²)
  ε_ij    = individual error ~ N(0, σ²)
```

**Key Parameters**:
- **β₂**: Treatment effect (what we care about!)
- **τ²**: Between-cluster variance
- **σ²**: Within-cluster variance
- **ICC**: Intracluster correlation = τ² / (τ² + σ²)

### Understanding Intracluster Correlation (ICC)

**Definition**: Correlation between outcomes of individuals in the same cluster.

**Formula**:
```
ICC = τ² / (τ² + σ²)

Where:
  τ² = between-cluster variance
  σ² = within-cluster variance
```

**Interpretation**:
```
ICC = 0.00: No clustering effect (individuals are independent)
ICC = 0.01: Small clustering (common in large populations)
ICC = 0.05: Moderate clustering (typical in healthcare)
ICC = 0.10: Substantial clustering (schools, communities)
ICC = 0.20: Very high clustering (families, households)
```

**Example Calculation**:
```typescript
// After fitting mixed model
const betweenClusterVar = 25;  // τ²
const withinClusterVar = 475;  // σ²

const icc = betweenClusterVar / (betweenClusterVar + withinClusterVar);
// ICC = 25 / 500 = 0.05 (5%)

console.log(`ICC: ${icc}`);
// Interpretation: 5% of total variance is due to cluster membership
```

**Why ICC Matters**:
- High ICC → Individuals in same cluster are more similar
- High ICC → Need more clusters (not just more individuals)
- High ICC → Effective sample size is reduced

### Cluster Random Effects

**Random Intercept Model**:

Each cluster has its own baseline level (u_i):

```
Cluster 1: u_1 = +5  (naturally higher outcomes)
Cluster 2: u_2 = -2  (naturally lower outcomes)
Cluster 3: u_3 = +1  (slightly above average)
Cluster 4: u_4 = -4  (much lower outcomes)
```

**Example**:
```typescript
interface ClusterEffect {
  clusterId: string;
  randomIntercept: number;  // u_i
  sampleSize: number;
}

// Example cluster effects from fitted model
const clusterEffects: ClusterEffect[] = [
  { clusterId: 'hospital-1', randomIntercept: 4.2, sampleSize: 150 },
  { clusterId: 'hospital-2', randomIntercept: -1.8, sampleSize: 165 },
  { clusterId: 'hospital-3', randomIntercept: 2.5, sampleSize: 142 },
  { clusterId: 'hospital-4', randomIntercept: -3.1, sampleSize: 158 }
];

// Hospital 1 has naturally higher compliance (u_i = 4.2%)
// Hospital 4 has naturally lower compliance (u_i = -3.1%)
// Treatment effect is estimated AFTER accounting for these differences
```

### Time Trend Adjustment

**Why Include Time?**

Without time adjustment, we might confuse:
- Treatment effect
- Secular trends (natural changes over time)

**Example**:
```
Scenario: Hand hygiene compliance naturally improving 1% per month

Without time adjustment:
- Treatment effect appears larger (includes natural trend)
- β₂ = 5% (inflated)

With time adjustment:
- Separates treatment from trend
- β₁ = 1% per step (time trend)
- β₂ = 3% (true treatment effect)
```

**Implementation**:
```typescript
// Model includes both time and treatment
const model = {
  formula: 'Y ~ time + treatment + (1 | cluster)',
  data: steppedWedgeData
};

// Results separate time from treatment
const results = {
  timeEffect: {
    coefficient: 1.2,  // β₁: 1.2% increase per step naturally
    pValue: 0.003
  },
  treatmentEffect: {
    coefficient: 3.1,  // β₂: 3.1% treatment effect after adjusting for time
    pValue: 0.001
  }
};
```

### Statistical Assumptions

#### 1. Normality of Residuals

**Check**:
```typescript
// After fitting model, examine residuals
const residuals = model.residuals;

// Visual check: Q-Q plot
plotQQ(residuals);

// Statistical test: Shapiro-Wilk
const normalityTest = shapiroWilk(residuals);
if (normalityTest.pValue < 0.05) {
  console.warn('⚠️  Residuals not normally distributed');
  // Consider: transformation, robust SE, or larger samples
}
```

**If Violated**:
- Large samples: Robust to violations (CLT)
- Small samples: Transform outcome or use robust methods
- Binary outcomes: Use logistic mixed model instead

#### 2. Homoscedasticity (Constant Variance)

**Check**:
```typescript
// Plot residuals vs. fitted values
plot(model.fitted, model.residuals);

// Look for fan shape (heteroscedasticity)
// Bresuch-Pagan test
const hetTest = breuschPagan(model);
if (hetTest.pValue < 0.05) {
  console.warn('⚠️  Heteroscedasticity detected');
}
```

**If Violated**:
- Use heteroscedasticity-consistent standard errors
- Transform outcome (log, sqrt)
- Use weighted regression

#### 3. Independent Clusters

**Assumption**: Clusters should be independent of each other

**Violations**:
- Geographic proximity (spillover effects)
- Shared resources
- Communication between clusters

**Solutions**:
- Model spatial correlation
- Increase buffer between clusters
- Account for cluster relationships

#### 4. Correct Cluster Membership

**Critical**: Individuals must be correctly assigned to clusters

**Check**:
```typescript
// Verify cluster assignments
function validateClusterAssignment(data: SteppedWedgeData[]): void {
  const clusterSizes = new Map<string, number>();

  data.forEach(row => {
    const count = clusterSizes.get(row.clusterId) || 0;
    clusterSizes.set(row.clusterId, count + 1);
  });

  clusterSizes.forEach((size, clusterId) => {
    if (size < 10) {
      console.warn(`⚠️  Cluster ${clusterId} has only ${size} observations`);
    }
  });
}
```

### Sample Size and Power

**Design Effect**:
```
DE = 1 + (m - 1) × ICC

Where:
  m = average cluster size
  ICC = intracluster correlation
```

**Effective Sample Size**:
```
n_effective = n_actual / DE
```

**Example**:
```typescript
const totalIndividuals = 2000;
const numClusters = 20;
const clusterSize = totalIndividuals / numClusters;  // 100
const icc = 0.05;

const designEffect = 1 + (clusterSize - 1) * icc;
// DE = 1 + 99 × 0.05 = 5.95

const effectiveSampleSize = totalIndividuals / designEffect;
// n_eff = 2000 / 5.95 = 336

console.log(`Actual n: ${totalIndividuals}`);
console.log(`Effective n: ${Math.round(effectiveSampleSize)}`);
console.log(`Power loss: ${(1 - effectiveSampleSize/totalIndividuals) * 100}%`);
// Power loss: 83% due to clustering!
```

**Implication**: Clustering dramatically reduces effective sample size!

**Power Calculation**:
```typescript
function calculateSteppedWedgePower(params: {
  numClusters: number;
  clusterSize: number;
  numSteps: number;
  icc: number;
  effectSize: number;
  alpha: number;
}): number {
  const { numClusters, clusterSize, icc, effectSize, alpha } = params;

  // Design effect
  const de = 1 + (clusterSize - 1) * icc;

  // Effective sample size per cluster
  const effClusterSize = clusterSize / de;

  // Total effective sample
  const effN = numClusters * effClusterSize;

  // Standard power calculation with effective n
  const power = calculatePowerTTest(
    effN / 2,  // Effective n per group (simplified)
    effectSize,
    alpha
  );

  return power;
}

// Example
const power = calculateSteppedWedgePower({
  numClusters: 20,
  clusterSize: 100,
  numSteps: 5,
  icc: 0.05,
  effectSize: 0.5,  // Cohen's d
  alpha: 0.05
});

console.log(`Power: ${(power * 100).toFixed(1)}%`);
```

### Comparison to Other Designs

#### vs. Parallel Cluster-Randomized Trial

**Parallel**:
```
Cluster 1: C C C C C
Cluster 2: C C C C C
Cluster 3: T T T T T
Cluster 4: T T T T T
```

**Stepped Wedge**:
```
Cluster 1: C C T T T
Cluster 2: C T T T T
Cluster 3: C C C T T
Cluster 4: C C C C T
```

**Comparison**:

| Aspect | Parallel | Stepped Wedge |
|--------|----------|---------------|
| All receive treatment? | No | Yes |
| Controls time trends? | No | Yes |
| Power | Higher | Lower |
| Ethical | Less acceptable | More acceptable |
| Analysis complexity | Simpler | More complex |
| Duration | Shorter | Longer |

#### vs. Crossover Design

**Crossover**:
```
Cluster 1: C T C T
Cluster 2: T C T C
```

**Stepped Wedge**:
```
Cluster 1: C C T T
Cluster 2: C T T T
```

**Key Differences**:
- Crossover: Bidirectional, requires washout
- Stepped wedge: Unidirectional, no washout needed
- Stepped wedge: Better for interventions that can't be withdrawn

### Practical Implementation

#### Data Structure

```typescript
interface SteppedWedgeDataPoint {
  clusterId: string;
  individualId: string;
  step: number;           // Time period (0, 1, 2, ...)
  treatment: 0 | 1;       // 0 = control, 1 = treatment
  outcome: number;        // Measured outcome
  covariates?: {          // Optional individual-level covariates
    age?: number;
    gender?: string;
    baseline?: number;
  };
}

// Example data
const data: SteppedWedgeDataPoint[] = [
  {
    clusterId: 'hospital-1',
    individualId: 'patient-001',
    step: 0,
    treatment: 0,  // In control at step 0
    outcome: 82.5,
    covariates: { age: 45, gender: 'F' }
  },
  {
    clusterId: 'hospital-1',
    individualId: 'patient-002',
    step: 2,
    treatment: 1,  // Switched to treatment at step 2
    outcome: 88.3,
    covariates: { age: 52, gender: 'M' }
  },
  // ... more data points
];
```

#### Analysis Workflow

```typescript
async function analyzeSteppedWedge(
  experimentId: string
): Promise<SteppedWedgeAnalysisResult> {
  // 1. Load and validate data
  const data = await loadExperimentData(experimentId);
  validateSteppedWedgeData(data);

  // 2. Fit mixed effects model
  const model = await fitMixedEffectsModel({
    formula: 'outcome ~ step + treatment + (1 | clusterId)',
    data,
    method: 'REML'  // Restricted Maximum Likelihood
  });

  // 3. Extract treatment effect
  const treatmentEffect = model.coefficients.treatment;

  // 4. Calculate ICC
  const betweenVar = model.randomEffects.variance;
  const withinVar = model.residualVariance;
  const icc = betweenVar / (betweenVar + withinVar);

  // 5. Check assumptions
  const assumptions = {
    normalityOfResiduals: checkNormality(model.residuals),
    homoscedasticity: checkHomoscedasticity(model),
    warnings: []
  };

  if (icc > 0.15) {
    assumptions.warnings.push('High ICC detected - clustering effect is substantial');
  }

  // 6. Return results
  return {
    treatmentEffect: {
      estimate: treatmentEffect.estimate,
      standardError: treatmentEffect.se,
      pValue: treatmentEffect.pValue,
      confidenceInterval: treatmentEffect.ci
    },
    timeEffect: {
      estimate: model.coefficients.step.estimate,
      standardError: model.coefficients.step.se,
      pValue: model.coefficients.step.pValue
    },
    intraclusterCorrelation: icc,
    clusterEffects: model.randomEffects.clusters,
    modelFit: {
      aic: model.aic,
      bic: model.bic,
      logLikelihood: model.logLikelihood
    },
    assumptions
  };
}
```

### Reporting Results

**Template**:

```markdown
## Stepped Wedge Analysis Results

### Design
- **Number of clusters**: 20 hospitals
- **Number of steps**: 5 (plus baseline)
- **Step duration**: 1 week
- **Total duration**: 6 weeks
- **Sample size**: 2,847 patients

### Model
Mixed effects model with cluster random intercepts and time adjustment:
Y_ij = β₀ + β₁(time) + β₂(treatment) + u_i + ε_ij

### Treatment Effect
**Primary finding**: Treatment increased hand hygiene compliance by 3.2 percentage points
- Point estimate: 3.2% [95% CI: 1.8%, 4.6%]
- P-value: < 0.001
- Effect size: Cohen's d = 0.42 (medium)

### Time Trend
Secular trend: 0.8% increase per week (p = 0.023)
This represents natural improvement independent of treatment.

### Clustering
- **ICC**: 0.048 (4.8%)
- **Interpretation**: 4.8% of variance due to hospital-level factors
- **Design effect**: 5.7
- **Effective sample size**: 500 (vs. 2,847 actual)

### Cluster-Specific Effects
Random intercepts (deviation from overall mean):
- Hospital 1: +4.2% (naturally high compliance)
- Hospital 2: -1.8%
- Hospital 3: +2.5%
- ... (remaining hospitals)

### Assumptions
✅ Residuals approximately normal (Shapiro-Wilk p = 0.18)
✅ Homoscedasticity acceptable (Breusch-Pagan p = 0.12)
✅ No extreme outliers detected
⚠️  Moderate ICC (5%) accounted for in model

### Conclusion
The treatment significantly improved hand hygiene compliance by 3.2% after
accounting for secular time trends and hospital-level clustering. The effect
is consistent across hospitals and time periods.
```

### Common Diagnostic Issues

#### Issue 1: Very High ICC

**Problem**:
```typescript
const icc = 0.25;  // 25% - very high!
```

**Implications**:
- Large clustering effect
- Much of variance is between clusters
- Need many more clusters for adequate power

**Solutions**:
- Recruit more clusters
- Use cluster-level covariates to explain variance
- Consider if stepped wedge is appropriate design

#### Issue 2: Imbalanced Clusters

**Problem**:
```
Cluster 1: n = 250
Cluster 2: n = 45   ← Small
Cluster 3: n = 180
Cluster 4: n = 320
```

**Solutions**:
- Weight analysis by cluster size
- Use mixed models (handles imbalance naturally)
- Investigate why imbalance occurred

#### Issue 3: Strong Time Trends

**Problem**:
```typescript
const timeEffect = 2.5;  // β₁ = 2.5% per step
const treatmentEffect = 1.2;  // β₂ = 1.2%

// Time trend is larger than treatment effect!
```

**Implications**:
- Hard to separate treatment from trend
- May need longer baseline period
- Consider if stepped wedge is confounded

**Solutions**:
- Extend baseline period (more pure control data)
- Model non-linear time trends
- Use more frequent measurements

---

## Summary

This guide covered:

1. ✅ **Test Selection**: Decision trees and detailed guidance for choosing statistical tests
2. ✅ **P-Values & CIs**: Proper interpretation and common misconceptions
3. ✅ **Effect Sizes**: Practical vs. statistical significance
4. ✅ **Power Analysis**: Sample size, MDE, and runtime planning
5. ✅ **Multiple Testing**: FWER vs. FDR, correction methods
6. ✅ **Bayesian Methods**: When and how to use Bayesian analysis
7. ✅ **Sequential Testing**: Early stopping with alpha spending
8. ✅ **CUPED**: Variance reduction for increased power
9. ✅ **Stepped Wedge**: Mixed effects models, ICC, cluster analysis, and time trends

## Additional Resources

**Books**:
- "Statistical Methods in Online A/B Testing" by Georgi Georgiev
- "Bayesian Data Analysis" by Gelman et al.
- "Testing Experiments in the field" by Gerber & Green

**Papers**:
- Deng et al. (2013): "Improving the Sensitivity of Online Controlled Experiments by Utilizing Pre-Experiment Data" (CUPED)
- Johari et al. (2017): "Peeking at A/B Tests"
- Lan & DeMets (1983): "Discrete Sequential Boundaries for Clinical Trials"

**Internal Documentation**:
- [Best Practices](./BEST_PRACTICES.md)
- [Design Patterns](./DESIGN_PATTERNS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
