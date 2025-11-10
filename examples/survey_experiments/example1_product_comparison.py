#!/usr/bin/env python3
"""
Survey Experiment Example 1: Product Feature Comparison

Scenario: Testing two product feature descriptions
- Design: Within-subjects (paired comparison)
- Each user rates both Feature A and Feature B
- Measure: Appeal rating (1-7 scale)
- Sample: 150 respondents
- Counterbalanced presentation order

Research Question:
Does Feature B description lead to higher appeal ratings than Feature A?
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../python'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../plugins'))

import numpy as np
import pandas as pd
from experimeh_plugins import (
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig,
    WithinSubjectsStructure
)

# Import survey plugin
from survey_experiments import PairedComparisonSurvey, SurveyQualityChecks, SurveyBiasDetection

print("=" * 80)
print("SURVEY EXPERIMENT 1: Product Feature Comparison (Paired)")
print("=" * 80)

# Simulate realistic survey data
np.random.seed(123)
n_respondents = 150

# Simulate respondent characteristics
# Some respondents have baseline higher ratings (individual differences)
respondent_baseline = np.random.normal(4, 1, n_respondents)

# Feature A: Baseline ratings
feature_a_ratings = respondent_baseline + np.random.normal(0, 0.8, n_respondents)

# Feature B: Slightly higher appeal (effect = +0.4 points)
feature_b_ratings = respondent_baseline + 0.4 + np.random.normal(0, 0.8, n_respondents)

# Clip to 1-7 scale
feature_a_ratings = np.clip(feature_a_ratings, 1, 7)
feature_b_ratings = np.clip(feature_b_ratings, 1, 7)

# Create long format with counterbalanced order
data_list = []
for i in range(n_respondents):
    # Randomize order (50% see A first, 50% see B first)
    if np.random.rand() < 0.5:
        order_a, order_b = 1, 2
    else:
        order_a, order_b = 2, 1

    # Add small order effect (primacy bias - first item rated slightly higher)
    order_boost_a = 0.1 if order_a == 1 else 0
    order_boost_b = 0.1 if order_b == 1 else 0

    data_list.append({
        'respondent_id': f'user_{i}',
        'feature': 'Feature_A',
        'appeal_rating': np.clip(feature_a_ratings[i] + order_boost_a, 1, 7),
        'order': order_a,
        'age_group': np.random.choice(['18-25', '26-35', '36-45', '46+'], p=[0.3, 0.4, 0.2, 0.1]),
        'response_time_sec': np.random.gamma(3, 5)
    })

    data_list.append({
        'respondent_id': f'user_{i}',
        'feature': 'Feature_B',
        'appeal_rating': np.clip(feature_b_ratings[i] + order_boost_b, 1, 7),
        'order': order_b,
        'age_group': data_list[-1]['age_group'],  # Same respondent
        'response_time_sec': np.random.gamma(3, 5)
    })

data = pd.DataFrame(data_list)

print("\n📊 Study Design:")
print(f"  Type: Within-subjects paired comparison")
print(f"  Sample: {n_respondents} respondents")
print(f"  Total ratings: {len(data)}")
print(f"  Counterbalancing: Yes (randomized order)")
print(f"  Scale: 1-7 (appeal rating)")

print("\n📈 Descriptive Statistics:")
print("\nBy Feature:")
print(data.groupby('feature')['appeal_rating'].describe().round(2))

print("\nOrder Distribution:")
print(data.groupby(['feature', 'order']).size().unstack())

print("\n🔍 Running Quality Checks...")

# Quality checks
qc = SurveyQualityChecks()

# Check for straightlining
straightline_check = qc.check_straightlining(
    data,
    rating_columns=['appeal_rating'],
    respondent_col='respondent_id',
    threshold=0.9
)
print(f"\nStraightlining Check:")
print(f"  Flagged respondents: {straightline_check['n_straightliners']}/{n_respondents}")
print(f"  Rate: {straightline_check['pct_straightliners']:.1%}")

# Check for speeding
speed_check = qc.check_speeding(
    data,
    duration_col='response_time_sec',
    respondent_col='respondent_id',
    threshold_percentile=10
)
print(f"\nSpeeding Check:")
print(f"  Flagged speeders: {speed_check['n_speeders']}/{n_respondents}")
print(f"  Median duration: {speed_check['median_duration']:.1f} seconds")

# Bias checks
bc = SurveyBiasDetection()

# Check for order bias
order_bias = bc.check_order_bias(
    data,
    rating_col='appeal_rating',
    order_col='order',
    item_col='feature'
)
print(f"\nOrder Bias Check:")
print(f"  Detected: {order_bias.get('order_bias_detected', 'N/A')}")
if 'spearman_correlation' in order_bias:
    print(f"  Correlation: {order_bias['spearman_correlation']:.3f}")
    print(f"  P-value: {order_bias['p_value']:.4f}")
    print(f"  Interpretation: {order_bias['interpretation']}")

# Create experimental context
context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="within_subjects",
        treatment_column="feature",
        control_value="Feature_A",
        treatment_values=["Feature_B"],
        randomization_unit="respondent_id",
        within_subjects=WithinSubjectsStructure(
            subject_column="respondent_id",
            condition_column="feature",
            order_column="order"
        )
    ),
    metrics=[MetricSpecification(
        name="appeal",
        column="appeal_rating",
        metric_type="continuous",
        higher_is_better=True
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={
        "Feature_A": n_respondents,
        "Feature_B": n_respondents
    }
)

# Run paired comparison analysis
print("\n🔬 Running Paired Comparison Analysis...")
plugin = PairedComparisonSurvey()
config = AnalysisConfig(alpha=0.05)
result = plugin.analyze(context, config)

print(f"\n{'Statistical Results':=^80}")
print(f"\nMethod: {result.method}")
print(f"Sample Size: {result.sample_sizes['respondents']} respondents")
print(f"Complete Pairs: {result.sample_sizes['complete_pairs']}")

print(f"\n📊 Treatment Effect:")
print(f"  Difference (B - A): {result.estimates['treatment_effect']:.3f}")
print(f"  Standard Error: {result.standard_errors['treatment_effect']:.3f}")
print(f"  95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
      f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")
print(f"  P-value: {result.p_values['treatment_effect']:.4f}")

print(f"\n📏 Effect Size:")
print(f"  Cohen's d: {result.effect_sizes['cohens_d']:.3f}")
print(f"  Correlation: {result.effect_sizes['correlation']:.3f}")

print(f"\n🔍 Diagnostics:")
print(f"  Mean Control (Feature A): {result.residual_diagnostics['mean_control']:.2f}")
print(f"  Mean Treatment (Feature B): {result.residual_diagnostics['mean_treatment']:.2f}")
print(f"  Mean Difference: {result.residual_diagnostics['mean_difference']:.3f}")
print(f"  Correlation: {result.residual_diagnostics['correlation']:.3f}")

# Interpretation
if result.p_values['treatment_effect'] < 0.05:
    print(f"\n✅ STATISTICALLY SIGNIFICANT RESULT")
    direction = "higher" if result.estimates['treatment_effect'] > 0 else "lower"
    print(f"   Feature B has {direction} appeal ratings than Feature A.")

    # Calculate percentage difference
    mean_a = result.residual_diagnostics['mean_control']
    mean_b = result.residual_diagnostics['mean_treatment']
    pct_diff = ((mean_b - mean_a) / mean_a) * 100
    print(f"   Feature B rated {abs(pct_diff):.1f}% {direction} than Feature A.")

    # Effect size interpretation
    d = abs(result.effect_sizes['cohens_d'])
    if d < 0.2:
        effect_mag = "very small"
    elif d < 0.5:
        effect_mag = "small"
    elif d < 0.8:
        effect_mag = "medium"
    else:
        effect_mag = "large"
    print(f"   Effect size is {effect_mag} (Cohen's d = {result.effect_sizes['cohens_d']:.2f}).")
else:
    print(f"\n❌ NOT STATISTICALLY SIGNIFICANT")
    print(f"   No significant difference detected between features.")

# Order effects
if 'order_effect' in result.temporal_effects:
    order_effect = result.temporal_effects['order_effect']
    if order_effect.get('significant', False):
        print(f"\n⚠️  ORDER EFFECT DETECTED")
        print(f"   P-value: {order_effect['p_value']:.4f}")
        print(f"   This suggests presentation order affected ratings.")

# Warnings
if result.warnings:
    print(f"\n⚠️  Warnings:")
    for i, warning in enumerate(result.warnings, 1):
        print(f"   {i}. {warning}")

# Power analysis
print(f"\n{'Power Analysis':=^80}")
achieved_power = plugin.calculate_power(
    sample_size=n_respondents,
    effect_size=result.effect_sizes['cohens_d'],
    alpha=0.05,
    correlation=result.effect_sizes['correlation']
)
print(f"Achieved Power: {achieved_power:.1%}")

# Sample size for different effect sizes
print(f"\nRequired Sample Size (80% power):")
for effect in [0.2, 0.3, 0.5, 0.8]:
    required_n = plugin.calculate_required_sample_size(
        effect_size=effect,
        power=0.80,
        alpha=0.05,
        correlation=0.3  # Assume moderate correlation
    )
    print(f"  Cohen's d = {effect}: {required_n} respondents")

print("\n" + "=" * 80)
print("Business Recommendation:")
print("=" * 80)

if result.p_values['treatment_effect'] < 0.05 and result.estimates['treatment_effect'] > 0:
    print("✅ RECOMMEND: Deploy Feature B description")
    print(f"   - Significantly increases appeal ratings by {result.estimates['treatment_effect']:.2f} points")
    print(f"   - Effect is reliable (p < 0.05) with {result.sample_sizes['respondents']} respondents")
    print(f"   - Consider A/B testing in production to validate")
elif result.p_values['treatment_effect'] < 0.05 and result.estimates['treatment_effect'] < 0:
    print("⚠️  CAUTION: Feature B performs worse")
    print(f"   - Significantly decreases appeal by {abs(result.estimates['treatment_effect']):.2f} points")
    print(f"   - Recommend staying with Feature A")
else:
    print("🔄 INCONCLUSIVE: No clear winner")
    print(f"   - No significant difference detected")
    print(f"   - Consider testing with larger sample or different variations")

print("\n" + "=" * 80)
