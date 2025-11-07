#!/usr/bin/env python3
"""
Test 1: Plugin Discovery and Registration

Tests that plugins are properly discovered and registered.
"""

import sys
import os

# Ensure plugins are discoverable
sys.path.insert(0, '/home/user/experimeh/plugins')

from experimeh_plugins import list_plugins, get_plugin

print("=" * 60)
print("TEST 1: Plugin Discovery and Registration")
print("=" * 60)

# Import builtin plugins
import builtin.welch_ttest
import builtin.factorial_anova

# List all plugins
plugins = list_plugins()

print(f"\n✓ Found {len(plugins)} plugins:\n")

for plugin_info in plugins:
    metadata = plugin_info['metadata']
    print(f"  • {metadata['name']} v{metadata['version']}")
    print(f"    Author: {metadata['author']}")
    print(f"    Designs: {', '.join(metadata['design_types'])}")
    print(f"    Metrics: {', '.join(metadata['required_metrics'])}")
    print()

# Test retrieval
print("Testing plugin retrieval...")
welch_plugin = get_plugin('welch_ttest')
print(f"✓ Successfully retrieved 'welch_ttest' plugin")

factorial_plugin = get_plugin('factorial_anova')
print(f"✓ Successfully retrieved 'factorial_anova' plugin")

# Test instantiation
print("\nTesting plugin instantiation...")
welch = welch_plugin()
print(f"✓ Instantiated Welch's t-test plugin")
print(f"  Capabilities: {welch.capabilities.supported_design_types}")

factorial = factorial_plugin()
print(f"✓ Instantiated Factorial ANOVA plugin")
print(f"  Handles interactions: {factorial.capabilities.handles_interactions}")

print("\n" + "=" * 60)
print("TEST 1: PASSED ✓")
print("=" * 60)
