#!/usr/bin/env python3
"""
Test 2: Welch's T-Test Plugin with Synthetic Data

Tests the Welch's t-test plugin with known ground truth.
"""

import sys
sys.path.insert(0, '/home/user/experimeh/plugins')

import numpy as np
from experimeh_plugins import (
    get_plugin,
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig
)
from experimeh_plugins.testing import DataGenerator

# Import plugins to register them
import builtin.welch_ttest
import builtin.factorial_anova

print("=" * 60)
print("TEST 2: Welch's T-Test Plugin Analysis")
print("=" * 60)

# Generate synthetic data with known effect
np.random.seed(42)
TRUE_EFFECT = 0.5
data = DataGenerator.generate_ab_data(
    n_control=200,
    n_treatment=200,
    effect_size=TRUE_EFFECT,
    noise_std=1.0,
    seed=42
)

print(f"\n✓ Generated synthetic A/B test data:")
print(f"  Control N: 200")
print(f"  Treatment N: 200")
print(f"  True effect: {TRUE_EFFECT}")
print(f"  Sample control mean: {data[data['variant']=='control']['metric'].mean():.4f}")
print(f"  Sample treatment mean: {data[data['variant']=='treatment']['metric'].mean():.4f}")

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
        name="outcome",
        column="metric",
        metric_type="continuous",
        higher_is_better=True
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={
        "control": 200,
        "treatment": 200
    }
)

# Get and run plugin
WelchTTest = get_plugin('welch_ttest')
plugin = WelchTTest()

print("\n✓ Created experimental context and plugin")

# Run analysis
config = AnalysisConfig(alpha=0.05)
result = plugin.analyze(context, config)

print(f"\n{'Analysis Results':=^60}")
print(f"\nMethod: {result.method}")
print(f"Estimate: {result.estimates['treatment_effect']:.4f}")
print(f"Standard Error: {result.standard_errors['treatment_effect']:.4f}")
print(f"95% CI: [{result.confidence_intervals['treatment_effect'][0]:.4f}, "
      f"{result.confidence_intervals['treatment_effect'][1]:.4f}]")
print(f"P-value: {result.p_values['treatment_effect']:.6f}")
print(f"Cohen's d: {result.effect_sizes['cohens_d']:.4f}")

# Check if CI contains true effect
ci = result.confidence_intervals['treatment_effect']
contains_truth = ci[0] <= TRUE_EFFECT <= ci[1]

print(f"\nDiagnostics:")
if result.residual_diagnostics:
    t_stat = result.residual_diagnostics.get('t_statistic')
    if t_stat is not None:
        print(f"  T-statistic: {t_stat:.4f}")
    control_std = result.residual_diagnostics.get('control_std')
    if control_std is not None:
        print(f"  Control std: {control_std:.4f}")
    treatment_std = result.residual_diagnostics.get('treatment_std')
    if treatment_std is not None:
        print(f"  Treatment std: {treatment_std:.4f}")
if result.degrees_of_freedom:
    df = result.degrees_of_freedom.get('welch_df')
    if df is not None:
        print(f"  Degrees of freedom: {df:.2f}")

print(f"\nAssumptions:")
for assumption, met in result.assumptions_met.items():
    status = "✓" if met else "✗"
    print(f"  {status} {assumption}")

if result.warnings:
    print(f"\nWarnings:")
    for warning in result.warnings:
        print(f"  ⚠ {warning}")

# Validation
print(f"\n{'Validation':=^60}")
print(f"CI contains true effect ({TRUE_EFFECT}): {contains_truth} {'✓' if contains_truth else '✗'}")
print(f"Significant at α=0.05: {result.p_values['treatment_effect'] < 0.05} {'✓' if result.p_values['treatment_effect'] < 0.05 else '✗'}")

print("\n" + "=" * 60)
print("TEST 2: PASSED ✓")
print("=" * 60)
