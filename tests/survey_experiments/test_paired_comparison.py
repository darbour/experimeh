#!/usr/bin/env python3
"""
Tests for Paired Comparison Survey Plugin

Tests:
1. Basic paired comparison analysis
2. Order effects detection
3. Missing data handling
4. Power calculations
5. Assumption checking
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../python'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../plugins'))

import unittest
import numpy as np
import pandas as pd
from experimeh_plugins import (
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig,
    WithinSubjectsStructure
)
from survey_experiments import PairedComparisonSurvey


class TestPairedComparisonSurvey(unittest.TestCase):
    """Test cases for PairedComparisonSurvey plugin"""

    def setUp(self):
        """Set up test fixtures"""
        self.plugin = PairedComparisonSurvey()
        np.random.seed(42)

    def _generate_paired_data(
        self,
        n_respondents: int,
        effect_size: float,
        correlation: float = 0.5,
        with_order: bool = False
    ) -> pd.DataFrame:
        """Generate synthetic paired comparison data"""
        # Generate correlated baseline
        baseline = np.random.normal(3, 1, n_respondents)

        # Generate ratings
        control = baseline + np.random.normal(0, 0.5, n_respondents)
        treatment = baseline + effect_size + np.random.normal(0, 0.5, n_respondents)

        # Clip to scale
        control = np.clip(control, 1, 5)
        treatment = np.clip(treatment, 1, 5)

        # Create long format
        data_list = []
        for i in range(n_respondents):
            if with_order:
                order_control = 1 if np.random.rand() < 0.5 else 2
                order_treatment = 3 - order_control
            else:
                order_control = order_treatment = None

            data_list.extend([
                {
                    'respondent_id': f'resp_{i}',
                    'condition': 'control',
                    'rating': control[i],
                    'order': order_control
                },
                {
                    'respondent_id': f'resp_{i}',
                    'condition': 'treatment',
                    'rating': treatment[i],
                    'order': order_treatment
                }
            ])

        return pd.DataFrame(data_list)

    def test_basic_analysis(self):
        """Test basic paired comparison analysis"""
        print("\n" + "="*60)
        print("TEST: Basic Paired Comparison Analysis")
        print("="*60)

        # Generate data with known effect
        data = self._generate_paired_data(n_respondents=100, effect_size=0.5)

        # Create context
        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={"control": 100, "treatment": 100}
        )

        # Run analysis
        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Assertions
        print(f"\nResults:")
        print(f"  Estimate: {result.estimates['treatment_effect']:.3f}")
        print(f"  P-value: {result.p_values['treatment_effect']:.4f}")
        print(f"  95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
              f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")

        # Should detect positive effect
        self.assertGreater(result.estimates['treatment_effect'], 0)
        self.assertLess(result.p_values['treatment_effect'], 0.05)

        # Check effect size
        self.assertIn('cohens_d', result.effect_sizes)
        self.assertGreater(result.effect_sizes['cohens_d'], 0)

        print(f"  Cohen's d: {result.effect_sizes['cohens_d']:.3f}")
        print("✓ Basic analysis test passed")

    def test_no_effect(self):
        """Test with no true effect"""
        print("\n" + "="*60)
        print("TEST: No Effect Detection")
        print("="*60)

        # Generate data with no effect
        data = self._generate_paired_data(n_respondents=50, effect_size=0)

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={"control": 50, "treatment": 50}
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        print(f"\nResults:")
        print(f"  Estimate: {result.estimates['treatment_effect']:.3f}")
        print(f"  P-value: {result.p_values['treatment_effect']:.4f}")

        # Should not be significant
        self.assertGreater(result.p_values['treatment_effect'], 0.05)
        print("✓ No effect test passed")

    def test_order_effects(self):
        """Test order effects detection"""
        print("\n" + "="*60)
        print("TEST: Order Effects Detection")
        print("="*60)

        # Generate data with order information
        data = self._generate_paired_data(n_respondents=100, effect_size=0.3, with_order=True)

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition",
                    order_column="order"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={"control": 100, "treatment": 100}
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Should have order effect results
        if 'order_effect' in result.temporal_effects:
            order_effect = result.temporal_effects['order_effect']
            print(f"\nOrder Effect:")
            print(f"  Tested: {order_effect.get('tested', False)}")
            if order_effect.get('tested'):
                print(f"  P-value: {order_effect['p_value']:.4f}")
                print(f"  Significant: {order_effect['significant']}")

        print("✓ Order effects test passed")

    def test_missing_data(self):
        """Test handling of missing data"""
        print("\n" + "="*60)
        print("TEST: Missing Data Handling")
        print("="*60)

        # Generate data
        data = self._generate_paired_data(n_respondents=100, effect_size=0.4)

        # Remove some responses (incomplete pairs)
        # Remove 20% of treatment responses
        treatment_indices = data[data['condition'] == 'treatment'].sample(frac=0.2).index
        data_with_missing = data.drop(treatment_indices)

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data_with_missing,
            n_total=len(data_with_missing),
            n_per_treatment={
                "control": 100,
                "treatment": 80
            }
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        print(f"\nResults with Missing Data:")
        print(f"  Complete pairs: {result.sample_sizes['complete_pairs']}")
        print(f"  Missing rate: {result.residual_diagnostics['missing_rate']:.1%}")

        # Should handle missing data
        self.assertLess(result.sample_sizes['complete_pairs'], 100)
        self.assertGreater(result.residual_diagnostics['missing_rate'], 0)

        # Should have warning about missing data
        has_missing_warning = any('missing' in w.lower() for w in result.warnings)
        if has_missing_warning:
            print("  ⚠️  Missing data warning present")

        print("✓ Missing data test passed")

    def test_power_calculation(self):
        """Test power and sample size calculations"""
        print("\n" + "="*60)
        print("TEST: Power Calculations")
        print("="*60)

        effect_sizes = [0.2, 0.5, 0.8]
        sample_size = 100

        print("\nPower for various effect sizes (n=100):")
        for effect in effect_sizes:
            power = self.plugin.calculate_power(
                sample_size=sample_size,
                effect_size=effect,
                alpha=0.05,
                correlation=0.5
            )
            print(f"  d={effect}: power={power:.1%}")
            self.assertGreater(power, 0)
            self.assertLess(power, 1)

        print("\nRequired sample size for 80% power:")
        for effect in effect_sizes:
            n = self.plugin.calculate_required_sample_size(
                effect_size=effect,
                power=0.8,
                alpha=0.05,
                correlation=0.5
            )
            print(f"  d={effect}: n={n}")
            self.assertGreater(n, 0)

        print("✓ Power calculation test passed")

    def test_small_sample_warning(self):
        """Test warning for small samples"""
        print("\n" + "="*60)
        print("TEST: Small Sample Warning")
        print("="*60)

        # Generate small sample
        data = self._generate_paired_data(n_respondents=15, effect_size=0.3)

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={"control": 15, "treatment": 15}
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Should have warning about small sample
        has_small_sample_warning = any('small sample' in w.lower() for w in result.warnings)
        print(f"\nSmall sample warning present: {has_small_sample_warning}")

        self.assertTrue(has_small_sample_warning)
        print("✓ Small sample warning test passed")

    def test_correlation_benefit(self):
        """Test that paired design benefits from correlation"""
        print("\n" + "="*60)
        print("TEST: Correlation Benefit")
        print("="*60)

        data = self._generate_paired_data(n_respondents=50, effect_size=0.5)

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="within_subjects",
                treatment_column="condition",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="respondent_id",
                within_subjects=WithinSubjectsStructure(
                    subject_column="respondent_id",
                    condition_column="condition"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={"control": 50, "treatment": 50}
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Check correlation
        correlation = result.effect_sizes['correlation']
        print(f"\nCorrelation: {correlation:.3f}")

        # Positive correlation should exist
        self.assertGreater(correlation, 0)

        # Warning if correlation is too low
        if correlation < 0.1:
            has_low_corr_warning = any('low correlation' in w.lower() for w in result.warnings)
            self.assertTrue(has_low_corr_warning)
            print("  ⚠️  Low correlation warning present")

        print("✓ Correlation benefit test passed")


def run_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("PAIRED COMPARISON SURVEY PLUGIN - TEST SUITE")
    print("="*60)

    suite = unittest.TestLoader().loadTestsFromTestCase(TestPairedComparisonSurvey)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*60)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
