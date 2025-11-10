#!/usr/bin/env python3
"""
Survey Experiment Example 2: Marketing Message Testing

Scenario: Testing marketing message effectiveness
- Design: Multi-item survey with item-level randomization
- Each respondent rates 8 different messages
- Messages randomly assigned to Control vs Treatment format
- Measure: Persuasiveness rating (1-5 Likert scale)
- Sample: 50 respondents, 400 total ratings

Research Question:
Do messages in Treatment format receive higher persuasiveness ratings?
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
    ClusterStructure
)

# Import survey plugins and utilities
from survey_experiments import (
    MultiItemSurvey,
    SurveyQualityChecks,
    SurveyBalanceChecks,
    run_comprehensive_survey_checks
)

print("=" * 80)
print("SURVEY EXPERIMENT 2: Marketing Message Testing (Multi-Item)")
print("=" * 80)

# Simulate realistic survey data
np.random.seed(456)
n_respondents = 50
messages_per_respondent = 8
n_messages = n_respondents * messages_per_respondent

# Simulate respondent characteristics (individual differences)
# Some people are generally more/less persuaded
respondent_baseline = np.random.normal(3, 0.6, n_respondents)

# Generate message catalog
message_topics = [
    'Product Quality', 'Price Value', 'Customer Service', 'Innovation',
    'Sustainability', 'Reliability', 'Convenience', 'Brand Trust'
]

# Create data
data_list = []
message_id = 0

for resp_id in range(n_respondents):
    # Each respondent sees 8 messages (randomly sampled topics)
    respondent_messages = np.random.choice(
        message_topics,
        size=messages_per_respondent,
        replace=True
    )

    for msg_idx, topic in enumerate(respondent_messages):
        # Randomly assign message to control or treatment format
        format_type = np.random.choice(['control', 'treatment'])

        # Base rating from respondent tendency
        base_rating = respondent_baseline[resp_id]

        # Treatment effect: +0.3 points for treatment format
        treatment_effect = 0.3 if format_type == 'treatment' else 0

        # Message-specific quality (some topics naturally rate higher)
        topic_effect = {
            'Product Quality': 0.2,
            'Customer Service': 0.1,
            'Innovation': 0.15,
            'Sustainability': -0.1,
            'Reliability': 0.1,
            'Convenience': 0.05,
            'Brand Trust': 0.2,
            'Price Value': 0
        }.get(topic, 0)

        # Position effect (slight survey fatigue)
        fatigue_effect = -0.02 * msg_idx

        # Random noise
        noise = np.random.normal(0, 0.5)

        # Final rating
        rating = base_rating + treatment_effect + topic_effect + fatigue_effect + noise
        rating = np.clip(rating, 1, 5)

        # Response time (with some speeders)
        response_time = np.random.gamma(4, 3) if resp_id < 45 else np.random.gamma(2, 1.5)

        data_list.append({
            'respondent_id': f'resp_{resp_id}',
            'message_id': f'msg_{message_id}',
            'message_topic': topic,
            'format': format_type,
            'persuasiveness': rating,
            'position': msg_idx + 1,
            'response_time_sec': response_time,
            'respondent_age': np.random.choice(['18-29', '30-44', '45-60', '60+'], p=[0.25, 0.35, 0.25, 0.15]),
            'respondent_gender': np.random.choice(['Male', 'Female', 'Other'], p=[0.48, 0.50, 0.02])
        })

        message_id += 1

data = pd.DataFrame(data_list)

print("\n📊 Study Design:")
print(f"  Type: Multi-item survey with item-level randomization")
print(f"  Respondents: {n_respondents}")
print(f"  Messages per respondent: {messages_per_respondent}")
print(f"  Total ratings: {len(data)}")
print(f"  Scale: 1-5 Likert (persuasiveness)")

print("\n📈 Descriptive Statistics:")
print("\nBy Format:")
print(data.groupby('format')['persuasiveness'].describe().round(2))

print("\nSample Balance:")
format_counts = data.groupby('format').size()
print(f"  Control messages: {format_counts.get('control', 0)}")
print(f"  Treatment messages: {format_counts.get('treatment', 0)}")
print(f"  Ratio: {max(format_counts) / min(format_counts):.2f}")

print("\nMessages per Respondent:")
msgs_per_resp = data.groupby('respondent_id').size()
print(f"  Mean: {msgs_per_resp.mean():.1f}")
print(f"  Std: {msgs_per_resp.std():.1f}")
print(f"  Min: {msgs_per_resp.min()}, Max: {msgs_per_resp.max()}")

print("\n🔍 Running Quality and Balance Checks...")

# Quality checks
qc = SurveyQualityChecks()

# Check for straightlining
rating_cols = ['persuasiveness']
straightline_check = qc.check_straightlining(
    data,
    rating_columns=rating_cols,
    respondent_col='respondent_id',
    threshold=0.7
)
print(f"\nStraightlining Check:")
print(f"  Flagged: {straightline_check['n_straightliners']}/{n_respondents}")
print(f"  Average straightline rate: {straightline_check['avg_straightline_rate']:.1%}")

# Check for low variance
variance_check = qc.check_response_variance(
    data,
    rating_columns=rating_cols,
    respondent_col='respondent_id',
    min_variance=0.1
)
print(f"\nVariance Check:")
print(f"  Low variance respondents: {variance_check['n_low_variance']}/{n_respondents}")
print(f"  Average variance: {variance_check['avg_variance']:.3f}")

# Speed check
speed_check = qc.check_speeding(
    data,
    duration_col='response_time_sec',
    respondent_col='respondent_id',
    threshold_percentile=10
)
print(f"\nSpeeding Check:")
print(f"  Speeders: {speed_check['n_speeders']}/{n_respondents}")
print(f"  Threshold: {speed_check['threshold_seconds']:.1f} seconds")

# Balance checks
bal = SurveyBalanceChecks()

# Check randomization balance on demographics
balance_check = bal.check_randomization_balance(
    data.groupby('respondent_id').first().reset_index(),
    treatment_col='format',
    covariate_cols=['respondent_age', 'respondent_gender'],
    alpha=0.05
)
print(f"\nRandomization Balance:")
print(f"  All balanced: {balance_check['all_balanced']}")
if balance_check['imbalanced_variables']:
    print(f"  Imbalanced: {', '.join(balance_check['imbalanced_variables'])}")

# Check item randomization
item_balance = bal.check_item_randomization(
    data,
    treatment_col='format',
    item_col='message_id',
    respondent_col='respondent_id'
)
print(f"\nItem Randomization:")
print(f"  Properly randomized: {item_balance['all_items_randomized']}")
print(f"  Avg balance ratio: {item_balance['avg_respondent_balance_ratio']:.2f}")

# Create experimental context
context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="cluster_randomized",
        treatment_column="format",
        control_value="control",
        treatment_values=["treatment"],
        randomization_unit="message_id",
        cluster=ClusterStructure(
            cluster_column="respondent_id",
            cluster_level="respondent"
        )
    ),
    metrics=[MetricSpecification(
        name="persuasiveness",
        column="persuasiveness",
        metric_type="continuous",
        higher_is_better=True
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={
        "control": len(data[data['format'] == 'control']),
        "treatment": len(data[data['format'] == 'treatment'])
    }
)

# Run multi-item survey analysis
print("\n🔬 Running Multi-Item Survey Analysis...")
plugin = MultiItemSurvey()
config = AnalysisConfig(alpha=0.05)
result = plugin.analyze(context, config)

print(f"\n{'Statistical Results':=^80}")
print(f"\nMethod: {result.method}")
print(f"Model: {result.model_formula}")

print(f"\n📊 Sample Sizes:")
for key, val in result.sample_sizes.items():
    if isinstance(val, float):
        print(f"  {key}: {val:.1f}")
    else:
        print(f"  {key}: {val}")

print(f"\n📊 Treatment Effect:")
print(f"  Difference (Treatment - Control): {result.estimates['treatment_effect']:.3f}")
print(f"  Cluster-Robust SE: {result.standard_errors['treatment_effect']:.3f}")
print(f"  95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
      f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")
print(f"  P-value: {result.p_values['treatment_effect']:.4f}")

print(f"\n📏 Effect Size:")
print(f"  Cohen's d: {result.effect_sizes['cohens_d']:.3f}")

print(f"\n🔍 Clustering Effects:")
print(f"  ICC (Intraclass Correlation): {result.random_effects['icc']:.3f}")
print(f"  Design Effect: {result.random_effects['design_effect']:.2f}")
print(f"  Effective Sample Size: {result.effective_sample_size:.1f}")

print(f"\n🔍 Diagnostics:")
print(f"  Mean Control: {result.residual_diagnostics['mean_control']:.3f}")
print(f"  Mean Treatment: {result.residual_diagnostics['mean_treatment']:.3f}")
print(f"  Naive SE (ignoring clustering): {result.residual_diagnostics['naive_se']:.3f}")
print(f"  Cluster-Robust SE: {result.standard_errors['treatment_effect']:.3f}")
print(f"  SE Inflation: {(result.standard_errors['treatment_effect'] / result.residual_diagnostics['naive_se']):.2f}x")

# Interpretation
if result.p_values['treatment_effect'] < 0.05:
    print(f"\n✅ STATISTICALLY SIGNIFICANT RESULT")
    direction = "higher" if result.estimates['treatment_effect'] > 0 else "lower"
    print(f"   Treatment format has {direction} persuasiveness ratings.")

    # Practical significance
    mean_control = result.residual_diagnostics['mean_control']
    pct_change = (result.estimates['treatment_effect'] / mean_control) * 100
    print(f"   Effect size: {abs(result.estimates['treatment_effect']):.2f} points "
          f"({abs(pct_change):.1f}% change)")

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
    print(f"   Magnitude: {effect_mag} effect (d = {result.effect_sizes['cohens_d']:.2f})")
else:
    print(f"\n❌ NOT STATISTICALLY SIGNIFICANT")
    print(f"   No significant difference detected between formats.")
    print(f"   Observed difference: {result.estimates['treatment_effect']:.3f} "
          f"(95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
          f"{result.confidence_intervals['treatment_effect'][1]:.3f}])")

# ICC interpretation
icc = result.random_effects['icc']
if icc < 0.05:
    print(f"\n   ICC is low ({icc:.3f}) - little clustering by respondent")
elif icc < 0.15:
    print(f"\n   ICC is moderate ({icc:.3f}) - some respondent-level clustering")
else:
    print(f"\n   ICC is high ({icc:.3f}) - strong respondent-level clustering")

print(f"   Design effect = {result.random_effects['design_effect']:.2f} "
      f"(effective sample reduced by clustering)")

# Warnings
if result.warnings:
    print(f"\n⚠️  Warnings:")
    for i, warning in enumerate(result.warnings, 1):
        print(f"   {i}. {warning}")

# Power analysis
print(f"\n{'Power Analysis':=^80}")

# Current power
current_power = plugin.calculate_power(
    sample_size=n_respondents,
    effect_size=result.effect_sizes['cohens_d'],
    alpha=0.05,
    icc=result.random_effects['icc'],
    cluster_size=messages_per_respondent
)
print(f"Achieved Power: {current_power:.1%}")

# Sample size requirements
print(f"\nRequired Respondents for 80% Power:")
for effect in [0.2, 0.3, 0.5, 0.8]:
    required_n = plugin.calculate_required_sample_size(
        effect_size=effect,
        power=0.80,
        alpha=0.05,
        icc=0.1,  # Assume ICC = 0.1
        cluster_size=messages_per_respondent
    )
    print(f"  Cohen's d = {effect}: {required_n} respondents")

print("\n" + "=" * 80)
print("Business Recommendation:")
print("=" * 80)

if result.p_values['treatment_effect'] < 0.05 and result.estimates['treatment_effect'] > 0.2:
    print("✅ STRONG RECOMMENDATION: Use Treatment format")
    print(f"   - Significantly increases persuasiveness by {result.estimates['treatment_effect']:.2f} points")
    print(f"   - Effect is statistically reliable (p = {result.p_values['treatment_effect']:.4f})")
    print(f"   - Effect is practically meaningful (>{0.2} point difference)")
elif result.p_values['treatment_effect'] < 0.05 and result.estimates['treatment_effect'] > 0:
    print("⚠️  WEAK RECOMMENDATION: Treatment format shows benefit")
    print(f"   - Statistically significant but small effect ({result.estimates['treatment_effect']:.2f} points)")
    print(f"   - Consider cost-benefit analysis before implementation")
elif result.p_values['treatment_effect'] < 0.05:
    print("❌ RECOMMENDATION: Avoid Treatment format")
    print(f"   - Significantly decreases persuasiveness by {abs(result.estimates['treatment_effect']):.2f} points")
else:
    print("🔄 NO CLEAR RECOMMENDATION")
    print(f"   - No statistically significant difference detected")
    print(f"   - Consider testing with more respondents or refining treatment")
    # Calculate required sample for current effect
    if result.effect_sizes['cohens_d'] > 0:
        req_n = plugin.calculate_required_sample_size(
            effect_size=result.effect_sizes['cohens_d'],
            power=0.80,
            alpha=0.05,
            icc=result.random_effects['icc'],
            cluster_size=messages_per_respondent
        )
        print(f"   - Would need ~{req_n} respondents to detect this effect with 80% power")

print("\n" + "=" * 80)
print("Next Steps:")
print("=" * 80)
print("1. Review flagged respondents for data quality issues")
print("2. Consider stratified analysis by message topic")
print("3. Test additional format variations if needed")
print("4. Validate findings with production A/B test")
print("\n" + "=" * 80)
