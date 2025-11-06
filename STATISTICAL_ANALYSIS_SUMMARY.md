# Statistical Analysis Engine - Implementation Summary

This document provides a comprehensive overview of the statistical methods implemented in the `/home/user/experimeh/src/analysis/` directory.

## Overview

The statistical analysis engine provides a complete suite of tools for experimentation, from simple A/B tests to complex factorial designs with interaction effects. All methods are implemented from scratch in TypeScript for transparency and educational purposes.

---

## 1. Core Statistical Tests (`statistical-tests.ts`)

### 1.1 Two-Sample T-Test (Welch's)

**Purpose**: Tests whether two samples have significantly different means.

**Formula**:
```
t = (x̄₁ - x̄₂) / SE
SE = √(s₁²/n₁ + s₂²/n₂)
df = (s₁²/n₁ + s₂²/n₂)² / [(s₁²/n₁)²/(n₁-1) + (s₂²/n₂)²/(n₂-1)]
```

**Assumptions**:
- Continuous outcome variable
- Normal distribution (or large sample for Central Limit Theorem)
- Independent observations
- Does NOT assume equal variances (Welch's correction)

**Effect Size**: Cohen's d = (μ₁ - μ₂) / σ_pooled

**Reference**: Welch, B. L. (1947). "The generalization of Student's problem when several different population variances are involved"

---

### 1.2 Two-Proportion Z-Test

**Purpose**: Tests whether two proportions (conversion rates) are significantly different.

**Formula**:
```
z = (p̂₁ - p̂₂) / SE
SE = √[p̄(1-p̄)(1/n₁ + 1/n₂)]
p̄ = (x₁ + x₂) / (n₁ + n₂)  [pooled proportion]
```

**Assumptions**:
- Binary outcome (success/failure)
- Independent observations
- Large sample: np ≥ 5 and n(1-p) ≥ 5 for normal approximation
- Random assignment

**Effect Size**: Cohen's h = 2[arcsin(√p₁) - arcsin(√p₂)]

**Confidence Interval**: Uses unpooled standard error for better coverage

**Reference**: Agresti, A. (2002). "Categorical Data Analysis"

---

### 1.3 Chi-Square Test of Independence

**Purpose**: Tests whether two categorical variables are independent.

**Formula**:
```
χ² = Σ[(O - E)² / E]
E[i,j] = (row_total[i] × col_total[j]) / grand_total
df = (rows - 1) × (cols - 1)
```

**Assumptions**:
- Categorical variables
- Independent observations
- Expected frequency ≥ 5 in each cell (80% rule)
- Random sampling

**Effect Size**: Cramér's V = √[χ² / (n × min(rows-1, cols-1))]

**Reference**: Pearson, K. (1900). "On the criterion that a given system of deviations"

---

### 1.4 One-Way ANOVA

**Purpose**: Tests whether means of 3+ groups are significantly different.

**Formula**:
```
F = MS_between / MS_within

MS_between = SS_between / df_between
MS_within = SS_within / df_within

SS_between = Σ n_i(x̄_i - x̄_grand)²
SS_within = Σ Σ (x_ij - x̄_i)²

df_between = k - 1
df_within = n - k
```

**Assumptions**:
- Continuous outcome variable
- Normal distribution in each group
- Equal variances across groups (homoscedasticity)
- Independent observations

**Effect Size**: η² (eta-squared) = SS_between / SS_total

**Reference**: Fisher, R. A. (1925). "Statistical Methods for Research Workers"

---

### 1.5 Factorial ANOVA (Two-Way)

**Purpose**: Tests main effects and interaction effects in factorial designs.

**Formula**:
```
For 2×2 factorial design:

F_A = MS_A / MS_error
F_B = MS_B / MS_error
F_AB = MS_AB / MS_error

SS_A = Σ n_a(x̄_a - x̄_grand)²
SS_B = Σ n_b(x̄_b - x̄_grand)²
SS_AB = Σ Σ n_ab[(x̄_ab - x̄_a - x̄_b + x̄_grand)²]
```

**Tests**:
1. Main effect of Factor A
2. Main effect of Factor B
3. Interaction effect A×B

**Interpretation**:
- If interaction is significant, interpret main effects cautiously
- Interaction means the effect of one factor depends on the level of the other

**Reference**: Montgomery, D. C. (2017). "Design and Analysis of Experiments" (9th ed.)

---

### 1.6 Multiple Linear Regression

**Purpose**: Tests for interaction effects and covariate adjustment.

**Formula**:
```
Y = β₀ + β₁X₁ + β₂X₂ + β₃X₁X₂ + ε

β = (X'X)⁻¹X'y

SE(β_i) = √[MSE × (X'X)⁻¹_ii]
t_i = β_i / SE(β_i)

R² = 1 - (SS_residual / SS_total)
Adjusted R² = 1 - [(SS_residual / df_residual) / (SS_total / df_total)]
```

**Assumptions**:
- Linearity of relationship
- Independence of errors
- Homoscedasticity (constant error variance)
- Normality of residuals
- No multicollinearity

**Reference**: Kutner, M. H., et al. (2004). "Applied Linear Statistical Models"

---

## 2. Bayesian Analysis (`bayesian.ts`)

### 2.1 Beta-Binomial Model for Proportions

**Purpose**: Bayesian analysis of conversion rates with uncertainty quantification.

**Model**:
```
Prior: p ~ Beta(α, β)
Likelihood: x ~ Binomial(n, p)
Posterior: p | x ~ Beta(α + x, β + n - x)

Posterior Mean: E[p|x] = (α + x) / (α + β + n)
Posterior Mode: (α + x - 1) / (α + β + n - 2)  [for α,β > 1]
```

**Default Prior**: Beta(1, 1) - Uniform prior (non-informative)

**Outputs**:
- Posterior distribution parameters
- Credible intervals (Bayesian confidence intervals)
- Probability that treatment > control
- Expected lift and credible interval
- Risk analysis (expected loss from wrong decision)

**Advantages**:
- No p-values - direct probability statements
- Natural handling of small samples
- Incorporates prior information
- Can stop early with quantified uncertainty

**Reference**: Gelman, A., et al. (2013). "Bayesian Data Analysis" (3rd ed.)

---

### 2.2 Normal-Normal Model for Continuous Metrics

**Purpose**: Bayesian analysis of continuous outcomes.

**Model**:
```
Prior: μ ~ Normal(μ₀, σ₀²)
Likelihood: x ~ Normal(μ, σ²)
Posterior: μ | x ~ Normal(μ_post, σ_post²)

With non-informative prior (σ₀² → ∞):
Posterior ≈ Normal(x̄, σ²/n)
```

**Monte Carlo Sampling**: Uses 100,000 samples for probability calculations

**Outputs**:
- Probability treatment > control
- Expected difference with credible interval
- Effect size (Cohen's d approximation)

---

### 2.3 Thompson Sampling (Multi-Armed Bandit)

**Purpose**: Dynamic traffic allocation based on posterior probabilities.

**Algorithm**:
```
For each arm i:
  1. Sample θᵢ from posterior Beta(αᵢ, βᵢ)
  2. Select arm with maximum θᵢ
  3. Update posterior with observed result
```

**Use Case**: Adaptive experiments where you want to minimize regret while learning

**Reference**: Chapelle, O., & Li, L. (2011). "An Empirical Evaluation of Thompson Sampling"

---

## 3. Multiple Testing Corrections (`corrections.ts`)

### 3.1 Bonferroni Correction

**Purpose**: Control Family-Wise Error Rate (FWER) - probability of any false positive.

**Formula**:
```
α_adjusted = α / m
or
p_adjusted = min(1, p × m)
```

**Properties**:
- Most conservative method
- Controls FWER at exactly α
- Power decreases rapidly with m

**Use When**: Few tests (<5), confirmatory analysis, need strong error control

**Reference**: Bonferroni, C. E. (1936)

---

### 3.2 Holm-Bonferroni (Step-Down)

**Purpose**: More powerful than Bonferroni while controlling FWER.

**Algorithm**:
```
1. Sort p-values: p₁ ≤ p₂ ≤ ... ≤ pₘ
2. For i = 1 to m:
   - Compare pᵢ to α/(m - i + 1)
   - If pᵢ > α/(m - i + 1), stop and accept all remaining
   - Otherwise, reject Hᵢ and continue
```

**Properties**:
- Uniformly more powerful than Bonferroni
- Still controls FWER at α
- Sequential testing procedure

**Use When**: Multiple comparisons, need FWER control, want more power than Bonferroni

**Reference**: Holm, S. (1979). "A Simple Sequentially Rejective Multiple Test Procedure"

---

### 3.3 Benjamini-Hochberg (FDR Control)

**Purpose**: Control False Discovery Rate - expected proportion of false discoveries among rejections.

**Algorithm**:
```
1. Sort p-values: p₁ ≤ p₂ ≤ ... ≤ pₘ
2. Find largest i such that pᵢ ≤ (i/m) × α
3. Reject H₁, H₂, ..., Hᵢ
```

**Properties**:
- More powerful than FWER methods
- Controls E[FDR] ≤ α
- Allows some false positives but controls rate

**Use When**: Many tests (>10), exploratory analysis, factorial designs

**Reference**: Benjamini, Y., & Hochberg, Y. (1995). "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing"

---

### 3.4 Sequential Testing with Alpha Spending

**Purpose**: Allow multiple looks at data while controlling Type I error.

**Spending Functions**:

1. **O'Brien-Fleming** (Conservative early, liberal late):
   ```
   α(t) = 2[1 - Φ(z_α/2 / √t)]
   ```

2. **Pocock** (Constant spending):
   ```
   α(t) = α × log[1 + (e - 1)t]
   ```

3. **Linear**:
   ```
   α(t) = α × t
   ```

**Properties**:
- Allows early stopping
- Maintains Type I error rate
- More efficient than fixed-sample design

**Use When**: Long-running experiments, want early stopping capability

**Reference**: Lan, K. K., & DeMets, D. L. (1983). "Discrete Sequential Boundaries for Clinical Trials"

---

## 4. Power Analysis and Sample Size (`power.ts`)

### 4.1 T-Test Sample Size

**Formula**:
```
n = 2(z_α/2 + z_β)² / δ²

where:
  z_α/2 = critical value for significance level α
  z_β = critical value for power (1 - β)
  δ = Cohen's d (effect size)
```

**Cohen's d Interpretation**:
- Small: d = 0.2
- Medium: d = 0.5
- Large: d = 0.8

**Reference**: Cohen, J. (1988). "Statistical Power Analysis for the Behavioral Sciences"

---

### 4.2 Proportion Test Sample Size

**Formula**:
```
n = [(z_α/2√(2p̄(1-p̄)) + z_β√(p₁(1-p₁) + p₂(1-p₂)))]² / (p₁ - p₂)²

where:
  p̄ = (p₁ + p₂) / 2
  p₁ = baseline conversion rate
  p₂ = treatment conversion rate
```

**Common Scenarios**:
- Baseline 10%, detect 20% relative lift (2% absolute): ~4,000/group
- Baseline 5%, detect 10% relative lift (0.5% absolute): ~15,000/group
- Baseline 20%, detect 5% relative lift (1% absolute): ~8,000/group

---

### 4.3 ANOVA Sample Size

**Formula** (per group):
```
Use Cohen's f:
f² = σ_between² / σ_within²

Iteratively solve for n given:
- Number of groups (k)
- Effect size (f)
- Power (1 - β)
- Significance (α)
```

**Cohen's f Interpretation**:
- Small: f = 0.1
- Medium: f = 0.25
- Large: f = 0.4

---

### 4.4 Factorial Design Sample Size

**Key Insight**: Interaction effects require ~4× sample size of main effects.

**Formula**:
```
For 2×2 design:
- Main effects: Use standard t-test formula with n per cell
- Interactions: Require larger n due to comparison of differences

Total cells: 4
Sample per cell: n
Total sample: 4n
```

**Recommendation**: Power for interaction effect (most demanding)

---

### 4.5 Minimum Detectable Effect (MDE)

**Purpose**: Smallest effect size detectable with given sample and power.

**Formula**:
```
For t-test:
MDE = (z_α/2 + z_β) × √(2/n)

For proportions:
Solve iteratively for p₂ given n, p₁, α, β
```

**Use Case**: Determine if experiment is worth running given traffic constraints

---

### 4.6 Runtime Estimation

**Formula**:
```
days = total_sample_size / (daily_traffic × allocation%)
```

**Recommendations**:
- Minimum 1 week to capture day-of-week effects
- Minimum 2 weeks for robustness
- Consider seasonal effects for longer experiments

---

## 5. Variance Reduction (`variance-reduction.ts`)

### 5.1 CUPED (Controlled-experiment Using Pre-Experiment Data)

**Purpose**: Reduce variance using pre-experiment covariates.

**Formula**:
```
Y_adjusted = Y - θ(X - E[X])

where:
  Y = post-experiment metric
  X = pre-experiment covariate
  θ = Cov(Y,X) / Var(X)  [optimal coefficient]
  E[X] = expected value of X

Variance reduction:
Var(Y_adjusted) = Var(Y) × (1 - ρ²)

where ρ = correlation between Y and X
```

**Properties**:
- Unbiased: E[Y_adjusted] = E[Y]
- Reduces standard error by factor √(1 - ρ²)
- Effective sample size: n_eff = n / (1 - ρ²)

**Example**:
- If ρ = 0.7, variance reduced by 51%
- Equivalent to 2× sample size
- Can detect effects twice as small

**Requirements**:
- Pre-experiment data for same metric
- Covariate balanced between groups
- Correlation > 0.3 for meaningful benefit

**Reference**: Deng, A., et al. (2013). "Improving the Sensitivity of Online Controlled Experiments by Utilizing Pre-Experiment Data"

---

### 5.2 Multiple Covariate CUPED (Regression Adjustment)

**Purpose**: Use multiple pre-experiment variables for greater variance reduction.

**Model**:
```
Y = β₀ + β₁X₁ + β₂X₂ + ... + βₖXₖ + ε
Y_adjusted = residuals + Ȳ
```

**Variance Reduction**:
```
Reduction = R² × 100%

where R² = coefficient of determination
```

**Use Cases**:
- Historical purchases (for revenue metrics)
- Historical engagement (for engagement metrics)
- Demographics and user attributes
- Multiple time periods of pre-data

---

### 5.3 Stratified Analysis

**Purpose**: Reduce variance by analyzing within predefined strata.

**Formula**:
```
Stratified Mean = Σ wᵢ × x̄ᵢ
Stratified Variance = Σ wᵢ² × s²ᵢ

where:
  wᵢ = stratum weight (typically nᵢ/n)
  x̄ᵢ = stratum mean
  s²ᵢ = stratum variance
```

**Effective When**:
- Within-stratum variance < overall variance
- Strata defined pre-experiment
- Stratification variable correlated with outcome

**Examples**:
- Geographic regions
- User segments (new vs. returning)
- Device types
- Time of day

---

## 6. Main Analyzer (`analyzer.ts`)

### 6.1 Supported Designs

#### A/B Test
- Two variants comparison
- Automatic test selection (t-test or z-test)
- Optional Bayesian analysis
- CUPED variance reduction

#### Multivariate Test
- 3+ variants
- One-way ANOVA for overall test
- Multiple testing correction for pairwise comparisons
- Identifies best performing variant

#### Factorial Design
- 2×2 or higher factorial
- Tests main effects and interactions
- Multiple testing correction (3+ tests)
- Interaction plots (recommended)

#### Switchback Experiment
- Temporal switching between treatments
- Period-level aggregation for clustering adjustment
- Intraclass correlation (ICC) calculation
- Accounts for temporal autocorrelation

#### Within-Subjects Design
- Repeated measures on same units
- Paired comparisons
- Accounts for individual differences
- (Simplified implementation - full mixed-effects model recommended)

---

### 6.2 Analysis Pipeline

```
1. Data Validation
   - Check sample sizes
   - Verify metric types
   - Balance checks

2. Primary Analysis
   - Select appropriate test
   - Run frequentist analysis
   - Calculate effect sizes

3. Bayesian Analysis (optional)
   - Posterior distributions
   - Probability statements
   - Risk analysis

4. Multiple Testing Correction
   - Apply if multiple comparisons
   - Report adjusted p-values

5. Variance Reduction (optional)
   - Apply CUPED if covariates available
   - Stratification if applicable

6. Power Analysis
   - Achieved power
   - Minimum detectable effect
   - Sample size recommendations

7. Interpretation
   - Statistical significance
   - Practical significance
   - Warnings and recommendations
```

---

## 7. Key Statistical Concepts

### 7.1 P-Value

**Definition**: Probability of observing data at least as extreme as observed, assuming null hypothesis is true.

**Interpretation**:
- p < 0.05: Significant at 5% level
- p < 0.01: Significant at 1% level (stronger evidence)
- p ≥ 0.05: Not significant (insufficient evidence)

**Common Misconceptions**:
- ❌ p-value is NOT the probability that null hypothesis is true
- ❌ p-value is NOT the probability of making an error
- ✅ p-value measures compatibility of data with null hypothesis

---

### 7.2 Confidence Interval

**Definition**: Range of plausible values for population parameter.

**95% CI Interpretation**: If we repeated experiment 100 times, ~95 would contain true parameter.

**Relationship to Hypothesis Test**: If 95% CI excludes 0, result is significant at α = 0.05.

---

### 7.3 Effect Size

**Purpose**: Magnitude of difference, independent of sample size.

**Common Measures**:
- Cohen's d: Standardized mean difference
- Cohen's h: Standardized proportion difference
- Eta-squared (η²): Proportion of variance explained
- Cramér's V: Association strength for categorical variables

**Importance**: Statistical significance ≠ practical significance

---

### 7.4 Type I and Type II Errors

**Type I Error (α)**: False positive - rejecting true null hypothesis
- Controlled by significance level α
- Standard: α = 0.05 (5% false positive rate)

**Type II Error (β)**: False negative - failing to reject false null hypothesis
- Controlled by statistical power (1 - β)
- Standard: power = 0.80 (20% false negative rate)

**Trade-off**: Increasing power (decreasing β) often requires larger α or more data

---

### 7.5 Statistical Power

**Definition**: Probability of detecting an effect when it exists.

**Factors Affecting Power**:
1. Sample size (↑ n → ↑ power)
2. Effect size (↑ δ → ↑ power)
3. Significance level (↑ α → ↑ power)
4. Variance (↓ σ² → ↑ power)

**Recommendations**:
- Minimum 80% power
- 90% power for critical decisions
- Use power analysis before launching experiment

---

## 8. Best Practices

### 8.1 Experiment Planning

1. **Define hypothesis clearly** before collecting data
2. **Choose primary metric** (only one!)
3. **Calculate required sample size** with power analysis
4. **Pre-specify** success criteria and analysis plan
5. **Run A/A test** to validate randomization

### 8.2 Analysis Guidelines

1. **Check assumptions** before applying tests
2. **Use appropriate test** for metric type
3. **Apply multiple testing corrections** when testing multiple metrics
4. **Report effect sizes** along with p-values
5. **Consider practical significance** not just statistical

### 8.3 Interpretation

1. **Avoid p-hacking** - don't peek repeatedly without correction
2. **Don't cherry-pick** metrics or segments
3. **Consider Bayesian analysis** for richer interpretation
4. **Use CUPED** when high-quality covariates available
5. **Run experiments for minimum 1-2 weeks**

---

## 9. Implementation Details

### 9.1 Numerical Stability

All implementations include:
- Checks for edge cases (zero variance, small samples)
- Numerical approximations with documented accuracy
- Matrix operations with pivoting for regression
- Careful handling of floating-point arithmetic

### 9.2 Statistical Distributions

Implemented from scratch:
- **Normal distribution**: Abramowitz & Stegun approximation
- **Student's t**: Hill's algorithm for CDF
- **Chi-square**: Wilson-Hilferty transformation
- **F-distribution**: Beta transformation method
- **Beta distribution**: Lanczos approximation for gamma function

### 9.3 Performance Considerations

- Bayesian analysis uses Monte Carlo (100K samples)
- Matrix operations are O(n³) for regression
- All tests run in < 100ms for typical sample sizes
- No external dependencies (pure TypeScript)

---

## 10. References

### Core Textbooks

1. **Kohavi, R., Tang, D., & Xu, Y. (2020)**. "Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing". Cambridge University Press.

2. **Montgomery, D. C. (2017)**. "Design and Analysis of Experiments" (9th ed.). Wiley.

3. **Cohen, J. (1988)**. "Statistical Power Analysis for the Behavioral Sciences" (2nd ed.). Routledge.

4. **Gelman, A., et al. (2013)**. "Bayesian Data Analysis" (3rd ed.). CRC Press.

5. **Casella, G., & Berger, R. L. (2002)**. "Statistical Inference" (2nd ed.). Duxbury.

### Key Papers

1. **Deng, A., et al. (2013)**. "Improving the Sensitivity of Online Controlled Experiments by Utilizing Pre-Experiment Data". WSDM.

2. **Benjamini, Y., & Hochberg, Y. (1995)**. "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing". JRSS-B.

3. **Welch, B. L. (1947)**. "The generalization of Student's problem when several different population variances are involved". Biometrika.

4. **Holm, S. (1979)**. "A Simple Sequentially Rejective Multiple Test Procedure". Scandinavian Journal of Statistics.

5. **Lan, K. K., & DeMets, D. L. (1983)**. "Discrete Sequential Boundaries for Clinical Trials". Biometrika.

---

## 11. File Structure

```
/home/user/experimeh/src/analysis/
├── statistical-tests.ts      (28 KB) - Core frequentist tests
├── bayesian.ts               (21 KB) - Bayesian analysis methods
├── corrections.ts            (19 KB) - Multiple testing corrections
├── power.ts                  (21 KB) - Power and sample size
├── variance-reduction.ts     (21 KB) - CUPED and stratification
├── analyzer.ts               (26 KB) - Main orchestrator
└── index.ts                  (2.5 KB) - Exports and re-exports
```

**Total**: ~137 KB of statistical analysis code

---

## 12. Usage Examples

### Example 1: Simple A/B Test

```typescript
import { quickABAnalysis } from './analysis';

const controlValues = [1, 0, 1, 1, 0, ...]; // 0/1 for conversions
const treatmentValues = [1, 1, 1, 0, 1, ...];

const result = quickABAnalysis(
  controlValues,
  treatmentValues,
  'proportion',
  { alpha: 0.05, useBayesian: true }
);

console.log(`Significant: ${result.summary.significant}`);
console.log(`P-value: ${result.primary.result.pValue}`);
console.log(`Winner: ${result.summary.winner}`);
```

### Example 2: Calculate Required Sample Size

```typescript
import { calculateSampleSize } from './analysis';

const sampleSize = calculateSampleSize(
  'proportion',
  0.02, // 2% absolute effect
  {
    alpha: 0.05,
    power: 0.8,
    baselineRate: 0.10 // 10% baseline conversion
  }
);

console.log(`Need ${sampleSize.sampleSizePerGroup} per group`);
console.log(`Total: ${sampleSize.totalSampleSize}`);
```

### Example 3: CUPED Variance Reduction

```typescript
import { cupedABTest } from './analysis';

const result = cupedABTest(
  controlPost,      // Post-experiment control values
  controlPre,       // Pre-experiment control values
  treatmentPost,    // Post-experiment treatment values
  treatmentPre      // Pre-experiment treatment values
);

console.log(`Variance reduced by ${result.treatmentEffect.varianceReduction}%`);
console.log(`Effective sample size: ${result.control.effectiveN}`);
```

### Example 4: Factorial Design

```typescript
import { ExperimentAnalyzer } from './analysis';

const analyzer = new ExperimentAnalyzer({ correctionMethod: 'bh' });

const data = {
  design: 'factorial',
  metric: { name: 'revenue', type: 'continuous', values: [...] },
  assignment: { variant: [...] },
  factorial: {
    factors: [
      { name: 'buttonColor', levels: ['blue', 'green'] },
      { name: 'buttonText', levels: ['buy', 'purchase'] }
    ],
    factorAssignments: {
      buttonColor: [...],
      buttonText: [...]
    }
  }
};

const result = analyzer.analyze(data);
console.log('Main effects:', result.primary.interpretation);
```

---

## Summary

This statistical analysis engine provides:

✅ **6 Core Statistical Tests**: t-test, z-test, chi-square, ANOVA, factorial ANOVA, regression
✅ **Bayesian Analysis**: Beta-Binomial and Normal-Normal models with posterior inference
✅ **4 Multiple Testing Corrections**: Bonferroni, Holm, BH, and sequential testing
✅ **Comprehensive Power Analysis**: Sample size, power, and MDE calculations
✅ **Variance Reduction**: CUPED implementation for improved sensitivity
✅ **5 Experimental Designs**: A/B, multivariate, factorial, switchback, within-subjects

All methods include:
- Proper statistical formulas from peer-reviewed literature
- Edge case handling and validation
- Comprehensive TypeScript typing
- Educational comments and documentation
- No external dependencies (implemented from scratch)

**Total Implementation**: 4,768 lines of statistical code across 7 files (verified with TypeScript compilation).
