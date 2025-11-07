#!/usr/bin/env python3
"""
Test 3: Statistical Correctness Validation

Validates Type I error rate, power, and CI coverage through simulation.
"""

import sys
sys.path.insert(0, '/home/user/experimeh/plugins')

from experimeh_plugins import get_plugin
from experimeh_plugins.testing import PluginTester

# Import plugins to register them
import builtin.welch_ttest

print("=" * 60)
print("TEST 3: Statistical Correctness Validation")
print("=" * 60)

WelchTTest = get_plugin('welch_ttest')

# Test 1: Basic functionality
print("\n[1/4] Testing basic functionality...")
results = PluginTester.test_basic_functionality(WelchTTest, verbose=False)

all_passed = all(results.values())
for test_name, passed in results.items():
    status = "✓" if passed else "✗"
    print(f"  {status} {test_name}")

if not all_passed:
    print("  ✗ Basic functionality test FAILED")
    sys.exit(1)
else:
    print("  ✓ All basic tests passed")

# Test 2: Type I error rate (abbreviated for speed)
print("\n[2/4] Testing Type I error rate control...")
print("  Running 200 simulations under null hypothesis...")
type1_results = PluginTester.test_type1_error_rate(
    WelchTTest,
    n_simulations=200,  # Reduced for speed
    alpha=0.05,
    sample_size=100,
    tolerance=0.03,
    verbose=False
)

print(f"  Observed rate: {type1_results['observed_type1_error_rate']:.4f}")
print(f"  Expected rate: {type1_results['expected_rate']:.4f}")
print(f"  Within tolerance: {type1_results['within_tolerance']} {'✓' if type1_results['within_tolerance'] else '✗'}")

# Test 3: Statistical power (abbreviated)
print("\n[3/4] Testing statistical power...")
print("  Running 200 simulations with effect size = 0.5...")
power_results = PluginTester.test_statistical_power(
    WelchTTest,
    effect_size=0.5,
    sample_size=100,
    n_simulations=200,  # Reduced for speed
    alpha=0.05,
    verbose=False
)

print(f"  Observed power: {power_results['observed_power']:.4f}")
print(f"  Power > 0.7: {power_results['observed_power'] > 0.7} {'✓' if power_results['observed_power'] > 0.7 else '✗'}")

# Test 4: Confidence interval coverage (abbreviated)
print("\n[4/4] Testing confidence interval coverage...")
print("  Running 200 simulations with true effect = 0.5...")
coverage_results = PluginTester.test_confidence_interval_coverage(
    WelchTTest,
    true_effect=0.5,
    sample_size=100,
    n_simulations=200,  # Reduced for speed
    alpha=0.05,
    tolerance=0.03,
    verbose=False
)

print(f"  Observed coverage: {coverage_results['observed_coverage']:.4f}")
print(f"  Nominal coverage: {coverage_results['nominal_coverage']:.4f}")
print(f"  Within tolerance: {coverage_results['within_tolerance']} {'✓' if coverage_results['within_tolerance'] else '✗'}")

# Summary
print(f"\n{'Summary':=^60}")
all_statistical_tests_passed = (
    type1_results['within_tolerance'] and
    power_results['observed_power'] > 0.7 and
    coverage_results['within_tolerance']
)

if all_statistical_tests_passed:
    print("✓ All statistical validation tests PASSED")
else:
    print("✗ Some statistical tests FAILED")
    if not type1_results['within_tolerance']:
        print("  - Type I error rate out of tolerance")
    if power_results['observed_power'] <= 0.7:
        print("  - Statistical power too low")
    if not coverage_results['within_tolerance']:
        print("  - CI coverage out of tolerance")

print("\n" + "=" * 60)
if all_statistical_tests_passed:
    print("TEST 3: PASSED ✓")
else:
    print("TEST 3: FAILED ✗")
print("=" * 60)
