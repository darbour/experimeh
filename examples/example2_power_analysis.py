#!/usr/bin/env python3
"""
Real-World Example 2: Power Analysis for Experiment Planning

Scenario: Planning a pricing experiment
- Need to determine sample size before launching
- Multiple scenarios with different effect sizes
"""

import sys
sys.path.insert(0, '/home/user/experimeh/plugins')

import numpy as np
from experimeh_plugins import get_plugin

# Import plugin
import builtin.welch_ttest

print("=" * 70)
print("REAL-WORLD EXAMPLE 2: Power Analysis for Experiment Planning")
print("=" * 70)

WelchTTest = get_plugin('welch_ttest')
plugin = WelchTTest()

print("\n📋 Scenario: Planning a pricing experiment")
print("   Question: 'How many users do we need to detect a 10% increase in revenue?'")
print("\n   Baseline: $50 average revenue per user")
print("   Goal: Detect $5 increase (10% lift)")
print("   Desired Power: 80%")
print("   Significance Level: 5%")

# Calculate effect size
baseline_mean = 50
baseline_std = 25  # Assume standard deviation of $25
target_increase = 5
effect_size = target_increase / baseline_std

print(f"\n📊 Effect Size Calculation:")
print(f"   Baseline Mean: ${baseline_mean}")
print(f"   Baseline Std Dev: ${baseline_std}")
print(f"   Target Increase: ${target_increase}")
print(f"   Cohen's d: {effect_size:.3f}")

# Calculate required sample size
required_n = plugin.calculate_required_sample_size(
    effect_size=effect_size,
    power=0.80,
    alpha=0.05
)

print(f"\n✅ Required Sample Size:")
print(f"   {required_n:,} users per variant")
print(f"   {required_n * 2:,} users total")

# Calculate expected runtime
daily_traffic = 1000
days_needed = (required_n * 2) / daily_traffic

print(f"\n⏱️  Expected Runtime:")
print(f"   Assuming {daily_traffic:,} users/day")
print(f"   Experiment duration: {days_needed:.1f} days")

# Sensitivity analysis: different effect sizes
print(f"\n{'Sensitivity Analysis':=^70}")
print(f"\n{'Effect Size':<15} {'Required N':<15} {'Runtime (days)':<15} {'Feasibility':<15}")
print("-" * 70)

effect_sizes = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]
dollar_amounts = [es * baseline_std for es in effect_sizes]

for es, dollars in zip(effect_sizes, dollar_amounts):
    n = plugin.calculate_required_sample_size(es, 0.80, 0.05)
    days = (n * 2) / daily_traffic

    if days <= 14:
        feasibility = "Easy ✓"
    elif days <= 30:
        feasibility = "Feasible"
    elif days <= 60:
        feasibility = "Long"
    else:
        feasibility = "Too long ✗"

    print(f"${dollars:>5.1f} ({es:.2f}){'':<4} {n:>6,} per group   {days:>6.1f} days     {feasibility:<15}")

print(f"\n💡 Recommendations:")
print(f"   • For $5 increase (d={effect_size:.2f}): Need {required_n:,} users per group")
print(f"   • Smaller effects require much larger samples")
print(f"   • Consider increasing effect size (bigger pricing change)")
print(f"   • Or collect more daily traffic to reduce runtime")

# Power curves
print(f"\n{'Power Curves':=^70}")
print(f"\nPower vs Sample Size for d={effect_size:.2f}:")
print(f"\n{'N per group':<15} {'Power':<15} {'Confidence':<20}")
print("-" * 70)

sample_sizes = [100, 200, 400, 800, 1600, 3200]
for n in sample_sizes:
    power = plugin.calculate_power(n, effect_size, 0.05)

    if power >= 0.80:
        confidence = "Adequate ✓"
    elif power >= 0.50:
        confidence = "Underpowered"
    else:
        confidence = "Very underpowered ✗"

    print(f"{n:>6,}{'':<9} {power:>5.1%}{'':<10} {confidence:<20}")

print("\n" + "=" * 70)
print("EXAMPLE 2: Complete ✓")
print("=" * 70)
