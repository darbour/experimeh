#!/usr/bin/env python3
"""
Real-World Example 3: Multi-Metric Analysis with Guardrails

Scenario: Testing a new recommendation algorithm
- Primary metric: Click-through rate
- Secondary metrics: Session duration, revenue
- Guardrail metrics: Page load time (shouldn't degrade)
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
print("REAL-WORLD EXAMPLE 3: Multi-Metric Analysis with Guardrails")
print("=" * 70)

# Simulate realistic multi-metric experiment
np.random.seed(456)
n_per_group = 500

# Control group
control_data = pd.DataFrame({
    'user_id': [f'user_c_{i}' for i in range(n_per_group)],
    'variant': 'control',
    'ctr': np.random.binomial(1, 0.15, n_per_group),  # 15% CTR
    'session_duration_min': np.random.gamma(2, 5, n_per_group),  # ~10 min avg
    'revenue': np.random.gamma(2, 25, n_per_group),  # ~$50 avg
    'page_load_time_ms': np.random.gamma(4, 50, n_per_group),  # ~200ms avg
})

# Treatment group - improved recommendations
treatment_data = pd.DataFrame({
    'user_id': [f'user_t_{i}' for i in range(n_per_group)],
    'variant': 'treatment',
    'ctr': np.random.binomial(1, 0.18, n_per_group),  # 18% CTR (20% relative lift)
    'session_duration_min': np.random.gamma(2, 6, n_per_group),  # ~12 min (20% lift)
    'revenue': np.random.gamma(2, 27, n_per_group),  # ~$54 (8% lift)
    'page_load_time_ms': np.random.gamma(4, 52, n_per_group),  # ~208ms (slight degradation)
})

data = pd.concat([control_data, treatment_data], ignore_index=True)

print("\n🎯 Experiment Overview:")
print(f"  Feature: New recommendation algorithm")
print(f"  Primary Metric: Click-through rate (CTR)")
print(f"  Secondary Metrics: Session duration, Revenue")
print(f"  Guardrail: Page load time (must not degrade significantly)")
print(f"  Sample Size: {n_per_group:,} users per variant")

WelchTTest = get_plugin('welch_ttest')
plugin = WelchTTest()

# Define metrics to analyze
metrics_to_analyze = [
    ('ctr', 'Click-Through Rate', 'PRIMARY', True),
    ('session_duration_min', 'Session Duration (min)', 'SECONDARY', True),
    ('revenue', 'Revenue ($)', 'SECONDARY', True),
    ('page_load_time_ms', 'Page Load Time (ms)', 'GUARDRAIL', False),  # Lower is better
]

print(f"\n{'Results Summary':=^70}\n")

results_summary = []

for metric_col, metric_name, metric_type, higher_is_better in metrics_to_analyze:
    # Calculate observed statistics
    control_mean = data[data['variant'] == 'control'][metric_col].mean()
    treatment_mean = data[data['variant'] == 'treatment'][metric_col].mean()
    relative_change = (treatment_mean - control_mean) / control_mean

    # Create context and run analysis
    context = ExperimentalContext(
        design=ExperimentalDesign(
            design_type="ab",
            treatment_column="variant",
            control_value="control",
            treatment_values=["treatment"],
            randomization_unit="user_id"
        ),
        metrics=[MetricSpecification(
            name=metric_name,
            column=metric_col,
            metric_type="continuous",
            higher_is_better=higher_is_better
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={"control": n_per_group, "treatment": n_per_group}
    )

    config = AnalysisConfig(alpha=0.05)
    result = plugin.analyze(context, config)

    # Determine outcome
    is_significant = result.p_values['treatment_effect'] < 0.05

    if metric_type == 'GUARDRAIL':
        # For guardrails, we want NO DEGRADATION
        if higher_is_better:
            is_healthy = not (is_significant and treatment_mean < control_mean)
        else:
            is_healthy = not (is_significant and treatment_mean > control_mean)
        outcome = "HEALTHY ✓" if is_healthy else "DEGRADED ✗"
    else:
        # For primary/secondary, we want positive impact
        if higher_is_better:
            outcome = "IMPROVED ✓" if (is_significant and treatment_mean > control_mean) else "NO CHANGE"
        else:
            outcome = "IMPROVED ✓" if (is_significant and treatment_mean < control_mean) else "NO CHANGE"

    results_summary.append({
        'metric': metric_name,
        'type': metric_type,
        'control': control_mean,
        'treatment': treatment_mean,
        'change': relative_change,
        'p_value': result.p_values['treatment_effect'],
        'outcome': outcome
    })

    # Print details
    print(f"📊 {metric_name} [{metric_type}]")
    print(f"   Control:    {control_mean:.2f}")
    print(f"   Treatment:  {treatment_mean:.2f}")
    print(f"   Change:     {relative_change:+.1%}")
    print(f"   P-value:    {result.p_values['treatment_effect']:.4f}")
    print(f"   95% CI:     [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
          f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")
    print(f"   Outcome:    {outcome}")
    print()

# Final decision
print(f"{'Decision Framework':=^70}\n")

primary_passed = any(r['type'] == 'PRIMARY' and '✓' in r['outcome'] for r in results_summary)
guardrails_passed = all(r['type'] == 'GUARDRAIL' and '✓' in r['outcome'] for r in results_summary)
secondary_wins = sum(1 for r in results_summary if r['type'] == 'SECONDARY' and '✓' in r['outcome'])

print(f"Primary Metric: {'PASSED ✓' if primary_passed else 'FAILED ✗'}")
print(f"Guardrail Metrics: {'ALL HEALTHY ✓' if guardrails_passed else 'DEGRADED ✗'}")
print(f"Secondary Metrics: {secondary_wins}/2 showing improvement")

print(f"\n{'Final Recommendation':=^70}\n")

if primary_passed and guardrails_passed:
    print("✅ SHIP IT!")
    print("   • Primary metric shows significant improvement")
    print("   • Guardrails are healthy (no degradation)")
    print(f"   • {secondary_wins} secondary metrics also improved")
    print("\n   Expected Impact:")
    ctr_result = next(r for r in results_summary if 'CTR' in r['metric'])
    print(f"   • CTR improvement: {ctr_result['change']:+.1%}")
    print(f"   • For 10M monthly users: ~{10000000 * ctr_result['change']:.0f} additional clicks")
elif primary_passed and not guardrails_passed:
    print("⚠️  CAUTION - Investigate Guardrails")
    print("   • Primary metric improved, but guardrails degraded")
    print("   • Investigate page load time regression")
    print("   • Consider optimization before shipping")
else:
    print("❌ DO NOT SHIP")
    print("   • Primary metric did not show significant improvement")
    print("   • Need more data or different approach")

print("\n" + "=" * 70)
print("EXAMPLE 3: Complete ✓")
print("=" * 70)
