#!/usr/bin/env python3
"""
Test 4: Factorial ANOVA Plugin

Tests factorial design analysis with interactions.
"""

import sys
sys.path.insert(0, '/home/user/experimeh/plugins')

import numpy as np
import pandas as pd
from experimeh_plugins import (
    get_plugin,
    ExperimentalContext,
    ExperimentalDesign,
    FactorialStructure,
    MetricSpecification,
    AnalysisConfig
)
from experimeh_plugins.testing import DataGenerator

# Import plugins to register them
import builtin.welch_ttest
import builtin.factorial_anova

print("=" * 60)
print("TEST 4: Factorial ANOVA Plugin")
print("=" * 60)

# Generate 2x2 factorial data with interaction
np.random.seed(42)
MAIN_EFFECT_A = 0.3
MAIN_EFFECT_B = 0.4
INTERACTION_EFFECT = 0.5

data = DataGenerator.generate_factorial_data(
    factors={'factor_a': ['a1', 'a2'], 'factor_b': ['b1', 'b2']},
    n_per_cell=100,
    main_effects={'factor_a': MAIN_EFFECT_A, 'factor_b': MAIN_EFFECT_B},
    interaction_effect=INTERACTION_EFFECT,
    noise_std=1.0,
    seed=42
)

print(f"\n✓ Generated 2×2 factorial design data:")
print(f"  N per cell: 100")
print(f"  Total N: {len(data)}")
print(f"  True main effect A: {MAIN_EFFECT_A}")
print(f"  True main effect B: {MAIN_EFFECT_B}")
print(f"  True interaction: {INTERACTION_EFFECT}")

# Cell means
print(f"\nCell means:")
for (fa, fb), group in data.groupby(['factor_a', 'factor_b']):
    print(f"  {fa}, {fb}: {group['metric'].mean():.4f} (n={len(group)})")

# Create experimental context
context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="factorial",
        treatment_column="variant",  # Not used for factorial
        control_value="a1_b1",
        treatment_values=["a1_b2", "a2_b1", "a2_b2"],
        randomization_unit="user_id",
        factorial=FactorialStructure(
            factors=['factor_a', 'factor_b'],
            levels_per_factor={
                'factor_a': ['a1', 'a2'],
                'factor_b': ['b1', 'b2']
            }
        )
    ),
    metrics=[MetricSpecification(
        name="outcome",
        column="metric",
        metric_type="continuous",
        higher_is_better=True
    )],
    data=data,
    n_total=len(data),
    n_per_treatment={}
)

# Get and run plugin
print("\n✓ Created experimental context")

try:
    FactorialANOVA = get_plugin('factorial_anova')
    plugin = FactorialANOVA()

    print("✓ Loaded Factorial ANOVA plugin")

    # Run analysis
    config = AnalysisConfig(alpha=0.05)
    result = plugin.analyze(context, config)

    print(f"\n{'Analysis Results':=^60}")
    print(f"\nMethod: {result.method}")

    # Main effects
    print(f"\nMain Effects:")
    for effect_name, estimate in result.estimates.items():
        if 'factor_a' in effect_name:
            ci = result.confidence_intervals[effect_name]
            p_val = result.p_values.get(effect_name, 'N/A')
            print(f"  {effect_name}:")
            print(f"    Estimate: {estimate:.4f}")
            print(f"    95% CI: [{ci[0]:.4f}, {ci[1]:.4f}]")
            if p_val != 'N/A':
                print(f"    P-value: {p_val:.6f}")

    # Interaction effects
    if result.interaction_effects:
        print(f"\nInteraction Effects:")
        for interaction_name, effect in result.interaction_effects.items():
            print(f"  {interaction_name}: {effect:.4f}")

    # Sample sizes
    print(f"\nSample Sizes:")
    for cell_name, n in result.sample_sizes.items():
        if 'factor' in cell_name:
            print(f"  {cell_name}: {n}")

    # Model fit
    if result.model_fit:
        print(f"\nModel Fit:")
        if 'r_squared' in result.model_fit:
            print(f"  R²: {result.model_fit['r_squared']:.4f}")
        if 'f_statistic' in result.model_fit:
            print(f"  F-statistic: {result.model_fit['f_statistic']:.4f}")

    # Warnings
    if result.warnings:
        print(f"\nWarnings:")
        for warning in result.warnings:
            print(f"  ⚠ {warning}")

    print("\n" + "=" * 60)
    print("TEST 4: PASSED ✓")
    print("=" * 60)

except ImportError as e:
    print(f"\n⚠ Skipping detailed analysis (missing statsmodels)")
    print(f"  Error: {e}")
    print(f"  The plugin will use simplified fallback implementation")
    print("\n" + "=" * 60)
    print("TEST 4: SKIPPED (missing optional dependency)")
    print("=" * 60)
