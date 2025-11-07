#!/bin/bash
# Comprehensive Test Suite for Plugin System
# Runs all tests in sequence and reports results

echo "=========================================="
echo "  Plugin System Comprehensive Test Suite"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0.32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_script=$2

    echo "Running: $test_name..."
    if python3 "$test_script" > /tmp/test_output.txt 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        cat /tmp/test_output.txt
    else
        echo -e "${RED}✗ FAILED${NC}: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        cat /tmp/test_output.txt
    fi
    echo ""
}

# Run all tests
run_test "Plugin Discovery" "tests/test_plugin_discovery.py"
run_test "Welch's T-Test Analysis" "tests/test_welch_analysis.py"
run_test "Statistical Correctness" "tests/test_statistical_correctness.py"
run_test "Factorial ANOVA" "tests/test_factorial_analysis.py"

# Summary
echo "=========================================="
echo "  Test Suite Summary"
echo "=========================================="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests PASSED! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests FAILED ✗${NC}"
    exit 1
fi
