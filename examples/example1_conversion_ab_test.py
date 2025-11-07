#!/usr/bin/env python3
"""
Real-World Example 1: Website Conversion Rate A/B Test

Scenario: Testing a new checkout button design
- Metric: Conversion rate (binary outcome)
- Sample size: 1000 users per variant
- Expected lift: 5% relative improvement
"""

import sys
sys.path.insert(0, '/home/user/experimeh/plugins')

import numpy as np
import pandas as pd
from experimeh_plugins import (
    get_plugin,
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig
)

# Import plugin
import builtin.welch_ttest

print("=" * 70)
print("REAL-WORLD EXAMPLE 1: Website Conversion Rate A/B Test")
print("=" * 70)

# Simulate realistic conversion data
np.random.seed(123)

# Control: 10% baseline conversion rate
control_conversions = np.random.binomial(1, 0.10, 1000)

# Treatment: 10.5% conversion rate (5% relative lift)
treatment_conversions = np.random.binomial(1, 0.105, 1000)

# Create realistic dataset
data = pd.DataFrame({
    'user_id': [f'user_{i}' for i in range(2000)],
    'variant': ['control'] * 1000 + ['treatment'] * 1000,
    'converted': np.concatenate([control_conversions, treatment_conversions]),
    'session_duration_sec': np.random.gamma(2, 30, 2000),  # Covariate
})

print("\n📊 Experiment Overview:")
print(f"  Business Goal: Test new checkout button design")
print(f"  Primary Metric: Conversion rate")
print(f"  Sample Size: 1,000 users per variant")
print(f"  Baseline Rate: 10%")
print(f"  Expected Lift: 5% relative (0.5pp absolute)")

print("\n📈 Observed Data:")
control_rate = data[data['variant'] == 'control']['converted'].mean()
treatment_rate = data[data['variant'] == 'treatment']['converted'].mean()
observed_lift = (treatment_rate - control_rate) / control_rate

print(f"  Control Conversion: {control_rate:.2%}")
print(f"  Treatment Conversion: {treatment_rate:.2%}")
print(f"  Observed Lift: {observed_lift:.1%} relative")
print(f"  Absolute Difference: {(treatment_rate - control_rate):.2%}")

# Create experimental context
context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="ab",
        treatment_column="variant",
        control_value="control",
        treatment_values=["treatment"],
        randomization_unit="user_id"
    ),
    metrics=[MetricSpecification(
        name="conversion_rate",
        column="converted",
        metric_type="continuous",  # Binary can be treated as continuous for t-test
        higher_is_better=True
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={
        "control": 1000,
        "treatment": 1000
    }
)

# Run analysis
WelchTTest = get_plugin('welch_ttest')
plugin = WelchTTest()

print("\n🔬 Running Statistical Analysis...")
config = AnalysisConfig(alpha=0.05)
result = plugin.analyze(context, config)

print(f"\n{'Results':=^70}")
print(f"\nMethod: {result.method}")
print(f"Estimated Effect: {result.estimates['treatment_effect']:.4f} ({result.estimates['treatment_effect']*100:.2f}pp)")
print(f"Standard Error: {result.standard_errors['treatment_effect']:.4f}")
print(f"95% Confidence Interval: [{result.confidence_intervals['treatment_effect'][0]:.4f}, "
      f"{result.confidence_intervals['treatment_effect'][1]:.4f}]")
print(f"P-value: {result.p_values['treatment_effect']:.4f}")

# Business interpretation
if result.p_values['treatment_effect'] < 0.05:
    print(f"\n✅ STATISTICALLY SIGNIFICANT")
    print(f"   The new checkout button design shows a significant impact on conversion rate.")
    relative_lift = result.estimates['treatment_effect'] / control_rate
    print(f"   Estimated lift: {relative_lift:.1%} relative")

    # Business impact calculation
    if treatment_rate > control_rate:
        print(f"\n💰 Business Impact:")
        print(f"   If we ship to 100,000 users/month:")
        monthly_conversions_control = 100000 * control_rate
        monthly_conversions_treatment = 100000 * treatment_rate
        additional_conversions = monthly_conversions_treatment - monthly_conversions_control
        print(f"   Additional conversions: {additional_conversions:.0f}/month")
        print(f"   Assuming $50 revenue per conversion: ${additional_conversions * 50:,.0f}/month")
else:
    print(f"\n❌ NOT STATISTICALLY SIGNIFICANT")
    print(f"   Cannot conclude the new design has an effect.")
    print(f"   Consider running longer or increasing sample size.")

print(f"\n{'Power Analysis':=^70}")
# Calculate achieved power
actual_effect_size = result.effect_sizes['cohens_d']
achieved_power = plugin.calculate_power(1000, actual_effect_size, 0.05)
print(f"Achieved Power: {achieved_power:.2%}")
print(f"Effect Size (Cohen's d): {actual_effect_size:.3f}")

# Required sample size for 80% power
if actual_effect_size > 0:
    required_n = plugin.calculate_required_sample_size(actual_effect_size, 0.80, 0.05)
    print(f"Required N for 80% power: {required_n} per group")

print("\n" + "=" * 70)
print("EXAMPLE 1: Complete ✓")
print("=" * 70)
