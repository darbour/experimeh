# Survey Experiments Module

Comprehensive toolkit for analyzing survey-based experiments with specialized statistical methods, quality checks, and bias detection.

## Overview

The Survey Experiments Module extends the experimeh plugin system with specialized tools for survey research:

- **Paired Comparison Analysis**: Within-subjects designs where respondents evaluate multiple items
- **Multi-Item Surveys**: Item-level randomization with respondent clustering
- **Quality Checks**: Detect low-quality responses (straightlining, speeding, inattention)
- **Bias Detection**: Identify order effects, response scale biases, and acquiescence
- **Balance Verification**: Ensure proper randomization

## Installation

The module is located in `/plugins/survey_experiments/` and requires the base experimeh plugin system:

```python
import sys
sys.path.insert(0, 'path/to/experimeh/python')
sys.path.insert(0, 'path/to/experimeh/plugins')

from survey_experiments import PairedComparisonSurvey, MultiItemSurvey
```

## Plugins

### 1. PairedComparisonSurvey

**Use Case**: Testing two items/messages/designs where each respondent evaluates both.

**Design**:
- Within-subjects (paired comparison)
- Each respondent provides ratings for both conditions
- Accounts for within-subject correlation
- Higher statistical power than between-subjects

**Example**:
```python
from survey_experiments import PairedComparisonSurvey
from experimeh_plugins import (
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig,
    WithinSubjectsStructure
)

# Your paired data: each respondent rates both Product A and Product B
data = pd.DataFrame({
    'respondent_id': ['user_1', 'user_1', 'user_2', 'user_2', ...],
    'product': ['A', 'B', 'A', 'B', ...],
    'rating': [4, 5, 3, 4, ...],
    'order': [1, 2, 1, 2, ...]  # Presentation order
})

context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="within_subjects",
        treatment_column="product",
        control_value="A",
        treatment_values=["B"],
        randomization_unit="respondent_id",
        within_subjects=WithinSubjectsStructure(
            subject_column="respondent_id",
            condition_column="product",
            order_column="order"  # Optional but recommended
        )
    ),
    metrics=[MetricSpecification(
        name="product_preference",
        column="rating",
        metric_type="continuous"
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={"A": n_respondents, "B": n_respondents}
)

plugin = PairedComparisonSurvey()
config = AnalysisConfig(alpha=0.05)
result = plugin.analyze(context, config)

print(f"Treatment Effect: {result.estimates['treatment_effect']:.3f}")
print(f"P-value: {result.p_values['treatment_effect']:.4f}")
print(f"Cohen's d: {result.effect_sizes['cohens_d']:.3f}")
```

**Features**:
- Paired t-test with within-subject correlation
- Order effect detection (checks if presentation order biases results)
- Missing data handling (keeps only complete pairs)
- Power/sample size calculations accounting for correlation

**When to Use**:
- ✅ Same respondent evaluates both conditions
- ✅ Want higher statistical power
- ✅ Individual differences are important to control
- ❌ Carryover effects are strong
- ❌ Need more than 2 conditions per respondent

---

### 2. MultiItemSurvey

**Use Case**: Respondents rate multiple items, items are randomized to treatment conditions.

**Design**:
- Item-level randomization
- Respondents rate multiple items
- Mixed-effects/hierarchical structure (items nested in respondents)
- Accounts for clustering (responses from same respondent are correlated)

**Example**:
```python
from survey_experiments import MultiItemSurvey
from experimeh_plugins import ClusterStructure

# Your multi-item data
data = pd.DataFrame({
    'respondent_id': ['resp_1', 'resp_1', 'resp_1', 'resp_2', ...],
    'item_id': ['item_1', 'item_2', 'item_3', 'item_4', ...],
    'treatment': ['control', 'treatment', 'control', 'treatment', ...],
    'rating': [3, 4, 3, 5, ...]
})

context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="cluster_randomized",
        treatment_column="treatment",
        control_value="control",
        treatment_values=["treatment"],
        randomization_unit="item_id",  # Items are randomized
        cluster=ClusterStructure(
            cluster_column="respondent_id",  # Responses clustered by respondent
            cluster_level="respondent"
        )
    ),
    metrics=[MetricSpecification(
        name="persuasiveness",
        column="rating",
        metric_type="continuous"
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={
        "control": n_control_items,
        "treatment": n_treatment_items
    }
)

plugin = MultiItemSurvey()
result = plugin.analyze(context, config)

print(f"Treatment Effect: {result.estimates['treatment_effect']:.3f}")
print(f"Cluster-Robust SE: {result.standard_errors['treatment_effect']:.3f}")
print(f"ICC: {result.random_effects['icc']:.3f}")
print(f"Design Effect: {result.random_effects['design_effect']:.2f}")
```

**Features**:
- Cluster-robust standard errors (accounts for within-respondent correlation)
- ICC (Intraclass Correlation Coefficient) calculation
- Design effect quantification
- Balance checks (items distributed evenly across treatments)
- Power/sample size calculations accounting for clustering

**When to Use**:
- ✅ Testing many items (e.g., 10+ messages, products, articles)
- ✅ Each respondent sees subset of items
- ✅ Items are randomized to treatment
- ✅ Want to account for respondent-level differences
- ❌ Each item only shown to 1-2 respondents (too few observations per item)

---

## Utility Functions

### Quality Checks

Detect low-quality survey responses:

```python
from survey_experiments import SurveyQualityChecks

qc = SurveyQualityChecks()

# 1. Straightlining (same response repeatedly)
straightline_check = qc.check_straightlining(
    data,
    rating_columns=['q1', 'q2', 'q3', 'q4'],
    respondent_col='respondent_id',
    threshold=0.8  # 80% same responses
)
print(f"Straightliners: {straightline_check['n_straightliners']}")

# 2. Speeding (too fast completion)
speed_check = qc.check_speeding(
    data,
    duration_col='response_time_sec',
    respondent_col='respondent_id',
    threshold_percentile=10  # Bottom 10%
)
print(f"Speeders: {speed_check['n_speeders']}")

# 3. Attention checks
attention_check = qc.validate_attention_checks(
    data,
    attention_col='attention_question',
    correct_answer='correct_value',
    respondent_col='respondent_id'
)
print(f"Failed attention: {attention_check['n_failed']}")

# 4. Low variance (not differentiating items)
variance_check = qc.check_response_variance(
    data,
    rating_columns=['rating'],
    respondent_col='respondent_id',
    min_variance=0.1
)
print(f"Low variance: {variance_check['n_low_variance']}")
```

### Bias Detection

Identify response biases:

```python
from survey_experiments import SurveyBiasDetection

bc = SurveyBiasDetection()

# 1. Order/position bias
order_bias = bc.check_order_bias(
    data,
    rating_col='rating',
    order_col='position',
    item_col='item_id'
)
print(f"Order bias detected: {order_bias['order_bias_detected']}")

# 2. Response scale bias (extreme avoidance, midpoint bias)
scale_bias = bc.check_response_scale_bias(
    data,
    rating_col='rating',
    scale_min=1,
    scale_max=5
)
print(f"Extreme usage: {scale_bias['extreme_usage']:.1%}")
print(f"Midpoint bias: {scale_bias['midpoint_bias']}")

# 3. Acquiescence bias (tendency to agree)
acquiescence = bc.check_acquiescence_bias(
    data,
    positive_items=['q1', 'q3', 'q5'],
    negative_items=['q2', 'q4', 'q6'],  # Reverse-coded
    respondent_col='respondent_id'
)
print(f"Acquiescence score: {acquiescence['avg_acquiescence_score']:.2f}")
```

### Balance Checks

Verify randomization:

```python
from survey_experiments import SurveyBalanceChecks

bal = SurveyBalanceChecks()

# 1. Covariate balance
balance_check = bal.check_randomization_balance(
    data,
    treatment_col='treatment',
    covariate_cols=['age', 'gender', 'education'],
    alpha=0.05
)
print(f"All balanced: {balance_check['all_balanced']}")
print(f"Imbalanced: {balance_check['imbalanced_variables']}")

# 2. Item randomization
item_balance = bal.check_item_randomization(
    data,
    treatment_col='treatment',
    item_col='item_id',
    respondent_col='respondent_id'
)
print(f"Items randomized: {item_balance['all_items_randomized']}")
```

### Metrics

Calculate survey-specific metrics:

```python
from survey_experiments import SurveyMetrics

sm = SurveyMetrics()

# Composite quality score
quality_scores = sm.calculate_response_quality_score(
    data,
    rating_columns=['q1', 'q2', 'q3'],
    respondent_col='respondent_id',
    duration_col='response_time_sec',
    attention_col='attention_check',
    correct_attention_answer=True
)

print(f"Mean quality: {quality_scores.mean():.1f}/100")
low_quality = quality_scores[quality_scores < 50].index.tolist()
print(f"Low quality respondents: {len(low_quality)}")
```

---

## Examples

See `/examples/survey_experiments/` for complete examples:

1. **`example1_product_comparison.py`**: Paired comparison of product features
   - Within-subjects design
   - 150 respondents
   - Order effect detection
   - Quality diagnostics

2. **`example2_marketing_messages.py`**: Multi-item message testing
   - 50 respondents rating 8 messages each
   - Item-level randomization
   - Cluster-robust analysis
   - ICC and design effect

3. **`example3_quality_diagnostics.py`**: Comprehensive quality checks
   - Demonstrates all quality check functions
   - Shows detection accuracy
   - Data cleaning recommendations

Run examples:
```bash
cd /path/to/experimeh/examples/survey_experiments
python example1_product_comparison.py
python example2_marketing_messages.py
python example3_quality_diagnostics.py
```

---

## Tests

Comprehensive test suite in `/tests/survey_experiments/`:

```bash
# Run paired comparison tests
python tests/survey_experiments/test_paired_comparison.py

# Run multi-item tests
python tests/survey_experiments/test_multi_item.py
```

Tests cover:
- Statistical accuracy
- ICC calculation
- Power analysis
- Edge cases (small samples, missing data)
- Quality check detection accuracy

---

## Design Patterns

### Pattern 1: Within-Subjects A/B Test

**Scenario**: Compare two designs/messages where each user sees both.

```
Respondent 1: Rates Design A (score: 4), Rates Design B (score: 5)
Respondent 2: Rates Design A (score: 3), Rates Design B (score: 4)
...
```

**Plugin**: `PairedComparisonSurvey`

**Benefits**:
- Higher power (fewer respondents needed)
- Controls for individual differences
- Natural for within-platform comparisons

**Cautions**:
- Watch for order effects (counterbalance!)
- Carryover effects may bias results
- Respondents may compare items directly

---

### Pattern 2: Multi-Arm Item Testing

**Scenario**: Test multiple items (e.g., 20 headlines) across treatments.

```
Respondent 1: Sees Headlines 1,5,8,12 (mix of Control/Treatment)
Respondent 2: Sees Headlines 2,6,9,13 (mix of Control/Treatment)
...
```

**Plugin**: `MultiItemSurvey`

**Benefits**:
- Test many items efficiently
- Item-level randomization reduces bias
- Accounts for respondent heterogeneity

**Cautions**:
- Need sufficient items per treatment (≥10)
- ICC can inflate standard errors
- Balance items across respondents

---

## Statistical Considerations

### Paired vs Independent Samples

**Paired (Within-Subjects)**:
- Power: Higher (controls individual differences)
- Sample size: Smaller
- SE formula: SE = SD(differences) / √n
- Assumption: Differences are normal
- Risk: Order effects, carryover

**Independent (Between-Subjects)**:
- Power: Lower
- Sample size: Larger
- SE formula: SE = √(SD₁²/n₁ + SD₂²/n₂)
- Assumption: Each group normal
- Risk: Imbalance, confounding

**Use paired when**:
- Correlation between conditions > 0.3
- Sufficient counterbalancing possible
- No strong carryover effects

### Clustering and ICC

**ICC (Intraclass Correlation)**:
- Measures: % of variance due to respondents
- Range: 0 (no clustering) to 1 (perfect clustering)
- Typical survey ICCs: 0.05 - 0.20

**Design Effect**:
```
DEFF = 1 + (m - 1) × ICC
where m = average cluster size
```

**Impact**:
- High ICC → inflated standard errors
- Need to account for clustering or lose power
- Effective sample size = n / DEFF

**Example**:
```
ICC = 0.15, m = 10 items per respondent
DEFF = 1 + (10 - 1) × 0.15 = 2.35
Effective n = 500 / 2.35 = 213
```

---

## Best Practices

### 1. Survey Design

✅ **DO**:
- Randomize presentation order (counterbalancing)
- Include attention checks
- Keep surveys reasonably short
- Pilot test questions
- Pre-register analysis plans

❌ **DON'T**:
- Show all items in same order to everyone
- Use leading questions
- Mix too many topics in one survey
- Forget to record response times
- P-hack by trying multiple analyses

### 2. Quality Control

✅ **DO**:
- Run quality checks BEFORE analysis
- Document exclusion criteria
- Report results with and without exclusions
- Calculate response quality scores
- Monitor completion rates

❌ **DON'T**:
- Exclude data post-hoc to get significance
- Ignore straightliners/speeders
- Keep all responses regardless of quality
- Fail to check attention
- Ignore order effects

### 3. Analysis

✅ **DO**:
- Use paired designs when appropriate (higher power)
- Account for clustering (ICC, cluster-robust SE)
- Check assumptions (normality of differences)
- Report effect sizes (not just p-values)
- Conduct power analysis

❌ **DON'T**:
- Treat paired data as independent
- Ignore ICC in multi-item surveys
- Report only p-values
- Cherry-pick significant results
- Forget about multiple comparisons

---

## Troubleshooting

### Problem: Low statistical power

**Solutions**:
1. Use within-subjects design (paired comparison)
2. Increase sample size
3. Reduce noise (better questions, clear instructions)
4. Stratify by key variables

### Problem: High ICC inflating standard errors

**Solutions**:
1. Reduce items per respondent (if possible)
2. Increase number of respondents
3. Use covariates to reduce respondent-level variance
4. Consider alternative analysis (respondent-level aggregation)

### Problem: Significant order effects

**Solutions**:
1. Ensure proper counterbalancing
2. Include order as covariate in model
3. Analyze first-position items only
4. Consider between-subjects design instead

### Problem: Many low-quality responses

**Solutions**:
1. Improve survey platform/UX
2. Add more attention checks
3. Screen respondents better
4. Make questions clearer
5. Shorten survey length

---

## References

### Survey Methodology
- Bradburn, N., Sudman, S., & Wansink, B. (2004). *Asking Questions*
- Krosnick, J. A. (1999). *Survey research*
- Tourangeau, R., et al. (2000). *The Psychology of Survey Response*

### Statistical Methods
- Gelman & Hill (2007). *Data Analysis Using Regression and Multilevel Models*
- Student (1908). *The probable error of a mean*
- Snijders & Bosker (2011). *Multilevel Analysis*

### Quality Control
- Oppenheimer, D. M., et al. (2009). *Instructional manipulation checks*
- Meade & Craig (2012). *Identifying careless responses in survey data*

---

## Support

For questions or issues:
1. Check examples in `/examples/survey_experiments/`
2. Review tests in `/tests/survey_experiments/`
3. See main plugin documentation in `/python/experimeh_plugins/`

---

## Version

Version: 1.0.0
Last Updated: 2025
Author: Survey Research Team
