#!/usr/bin/env python3
"""
Tests for Multi-Item Survey Plugin

Tests:
1. Basic multi-item analysis with clustering
2. ICC calculation
3. Design effect
4. Balance checking
5. Power calculations
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
    ClusterStructure
)
from survey_experiments import MultiItemSurvey


class TestMultiItemSurvey(unittest.TestCase):
    """Test cases for MultiItemSurvey plugin"""

    def setUp(self):
        """Set up test fixtures"""
        self.plugin = MultiItemSurvey()
        np.random.seed(42)

    def _generate_multi_item_data(
        self,
        n_respondents: int,
        items_per_respondent: int,
        effect_size: float,
        icc: float = 0.1
    ) -> pd.DataFrame:
        """Generate synthetic multi-item survey data"""
        # Generate respondent random effects
        respondent_effects = np.random.normal(0, np.sqrt(icc), n_respondents)

        data_list = []
        item_id = 0

        for resp_id in range(n_respondents):
            for _ in range(items_per_respondent):
                # Randomize to treatment
                treatment = np.random.choice(['control', 'treatment'])

                # Rating = grand mean + respondent effect + treatment effect + item noise
                grand_mean = 3.0
                treatment_effect = effect_size if treatment == 'treatment' else 0
                item_noise = np.random.normal(0, np.sqrt(1 - icc))

                rating = grand_mean + respondent_effects[resp_id] + treatment_effect + item_noise
                rating = np.clip(rating, 1, 5)

                data_list.append({
                    'respondent_id': f'resp_{resp_id}',
                    'item_id': f'item_{item_id}',
                    'treatment': treatment,
                    'rating': rating
                })

                item_id += 1

        return pd.DataFrame(data_list)

    def test_basic_analysis(self):
        """Test basic multi-item analysis"""
        print("\n" + "="*60)
        print("TEST: Basic Multi-Item Analysis")
        print("="*60)

        data = self._generate_multi_item_data(
            n_respondents=30,
            items_per_respondent=10,
            effect_size=0.4,
            icc=0.15
        )

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="cluster_randomized",
                treatment_column="treatment",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="item_id",
                cluster=ClusterStructure(
                    cluster_column="respondent_id",
                    cluster_level="respondent"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={
                "control": len(data[data['treatment'] == 'control']),
                "treatment": len(data[data['treatment'] == 'treatment'])
            }
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        print(f"\nResults:")
        print(f"  Estimate: {result.estimates['treatment_effect']:.3f}")
        print(f"  Cluster-Robust SE: {result.standard_errors['treatment_effect']:.3f}")
        print(f"  P-value: {result.p_values['treatment_effect']:.4f}")
        print(f"  ICC: {result.random_effects['icc']:.3f}")
        print(f"  Design Effect: {result.random_effects['design_effect']:.2f}")

        # Should detect effect
        self.assertGreater(result.estimates['treatment_effect'], 0)

        # Should have ICC and design effect
        self.assertIn('icc', result.random_effects)
        self.assertIn('design_effect', result.random_effects)
        self.assertGreater(result.random_effects['icc'], 0)
        self.assertGreater(result.random_effects['design_effect'], 1)

        print("✓ Basic analysis test passed")

    def test_icc_calculation(self):
        """Test ICC calculation accuracy"""
        print("\n" + "="*60)
        print("TEST: ICC Calculation")
        print("="*60)

        # Test different ICC values
        true_iccs = [0.05, 0.15, 0.30]

        for true_icc in true_iccs:
            data = self._generate_multi_item_data(
                n_respondents=50,
                items_per_respondent=10,
                effect_size=0,  # No treatment effect
                icc=true_icc
            )

            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type="cluster_randomized",
                    treatment_column="treatment",
                    control_value="control",
                    treatment_values=["treatment"],
                    randomization_unit="item_id",
                    cluster=ClusterStructure(
                        cluster_column="respondent_id",
                        cluster_level="respondent"
                    )
                ),
                metrics=[MetricSpecification(
                    name="rating",
                    column="rating",
                    metric_type="continuous"
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={
                    "control": len(data[data['treatment'] == 'control']),
                    "treatment": len(data[data['treatment'] == 'treatment'])
                }
            )

            config = AnalysisConfig(alpha=0.05)
            result = self.plugin.analyze(context, config)

            estimated_icc = result.random_effects['icc']
            print(f"\nTrue ICC: {true_icc:.3f}, Estimated ICC: {estimated_icc:.3f}")

            # Should be reasonably close (within 0.1)
            self.assertAlmostEqual(estimated_icc, true_icc, delta=0.15)

        print("✓ ICC calculation test passed")

    def test_design_effect(self):
        """Test design effect calculation"""
        print("\n" + "="*60)
        print("TEST: Design Effect")
        print("="*60)

        icc = 0.2
        cluster_size = 10

        data = self._generate_multi_item_data(
            n_respondents=40,
            items_per_respondent=cluster_size,
            effect_size=0.3,
            icc=icc
        )

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="cluster_randomized",
                treatment_column="treatment",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="item_id",
                cluster=ClusterStructure(
                    cluster_column="respondent_id",
                    cluster_level="respondent"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={
                "control": len(data[data['treatment'] == 'control']),
                "treatment": len(data[data['treatment'] == 'treatment'])
            }
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Expected design effect: 1 + (m - 1) * ICC
        expected_deff = 1 + (cluster_size - 1) * icc

        print(f"\nExpected Design Effect: {expected_deff:.2f}")
        print(f"Estimated Design Effect: {result.random_effects['design_effect']:.2f}")

        # Should be close to expected
        self.assertAlmostEqual(
            result.random_effects['design_effect'],
            expected_deff,
            delta=1.0  # Allow some variation
        )

        print("✓ Design effect test passed")

    def test_balance_checking(self):
        """Test balance checking functionality"""
        print("\n" + "="*60)
        print("TEST: Balance Checking")
        print("="*60)

        # Generate balanced data
        data = self._generate_multi_item_data(
            n_respondents=30,
            items_per_respondent=10,
            effect_size=0.3,
            icc=0.1
        )

        # Check balance
        balance = self.plugin._check_item_balance(
            data,
            treatment_col='treatment',
            cluster_col='respondent_id',
            control_value='control',
            treatment_value='treatment'
        )

        print(f"\nBalance Results:")
        print(f"  Balanced: {balance['balanced']}")
        print(f"  Overall ratio: {balance['overall_ratio']:.2f}")
        print(f"  Respondent ratio: {balance['respondent_ratio']:.2f}")

        # Should be reasonably balanced
        self.assertLess(balance['overall_ratio'], 2.0)

        print("✓ Balance checking test passed")

    def test_cluster_robust_se(self):
        """Test cluster-robust standard error"""
        print("\n" + "="*60)
        print("TEST: Cluster-Robust Standard Error")
        print("="*60)

        # Generate data with high ICC (strong clustering)
        data_high_icc = self._generate_multi_item_data(
            n_respondents=30,
            items_per_respondent=10,
            effect_size=0.3,
            icc=0.3  # High ICC
        )

        # Generate data with low ICC (weak clustering)
        data_low_icc = self._generate_multi_item_data(
            n_respondents=30,
            items_per_respondent=10,
            effect_size=0.3,
            icc=0.05  # Low ICC
        )

        results = {}
        for name, data, icc in [
            ('High ICC', data_high_icc, 0.3),
            ('Low ICC', data_low_icc, 0.05)
        ]:
            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type="cluster_randomized",
                    treatment_column="treatment",
                    control_value="control",
                    treatment_values=["treatment"],
                    randomization_unit="item_id",
                    cluster=ClusterStructure(
                        cluster_column="respondent_id",
                        cluster_level="respondent"
                    )
                ),
                metrics=[MetricSpecification(
                    name="rating",
                    column="rating",
                    metric_type="continuous"
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={
                    "control": len(data[data['treatment'] == 'control']),
                    "treatment": len(data[data['treatment'] == 'treatment'])
                }
            )

            config = AnalysisConfig(alpha=0.05)
            result = self.plugin.analyze(context, config)
            results[name] = result

        # High ICC should have larger SE than low ICC
        se_high = results['High ICC'].standard_errors['treatment_effect']
        se_low = results['Low ICC'].standard_errors['treatment_effect']

        print(f"\nHigh ICC SE: {se_high:.3f}")
        print(f"Low ICC SE: {se_low:.3f}")
        print(f"Ratio: {se_high/se_low:.2f}")

        # High ICC should inflate SE
        self.assertGreater(se_high, se_low)

        print("✓ Cluster-robust SE test passed")

    def test_power_calculation(self):
        """Test power calculations with clustering"""
        print("\n" + "="*60)
        print("TEST: Power Calculations with Clustering")
        print("="*60)

        effect_size = 0.5
        n_respondents = 50
        cluster_size = 10
        icc_values = [0.05, 0.15, 0.30]

        print("\nPower for different ICC values:")
        for icc in icc_values:
            power = self.plugin.calculate_power(
                sample_size=n_respondents,
                effect_size=effect_size,
                alpha=0.05,
                icc=icc,
                cluster_size=cluster_size
            )
            print(f"  ICC={icc}: power={power:.1%}")

            # Higher ICC should reduce power
            self.assertGreater(power, 0)
            self.assertLess(power, 1)

        # Power should decrease as ICC increases
        powers = [
            self.plugin.calculate_power(n_respondents, effect_size, 0.05, icc, cluster_size)
            for icc in icc_values
        ]
        self.assertGreater(powers[0], powers[1])
        self.assertGreater(powers[1], powers[2])

        print("✓ Power calculation test passed")

    def test_sample_size_calculation(self):
        """Test sample size calculations with clustering"""
        print("\n" + "="*60)
        print("TEST: Sample Size with Clustering")
        print("="*60)

        effect_size = 0.5
        icc_values = [0.05, 0.15, 0.30]
        cluster_size = 10

        print("\nRequired respondents for different ICC values:")
        for icc in icc_values:
            n = self.plugin.calculate_required_sample_size(
                effect_size=effect_size,
                power=0.8,
                alpha=0.05,
                icc=icc,
                cluster_size=cluster_size
            )
            print(f"  ICC={icc}: n={n}")
            self.assertGreater(n, 0)

        # Higher ICC should require more respondents
        ns = [
            self.plugin.calculate_required_sample_size(effect_size, 0.8, 0.05, icc, cluster_size)
            for icc in icc_values
        ]
        self.assertLess(ns[0], ns[1])
        self.assertLess(ns[1], ns[2])

        print("✓ Sample size calculation test passed")

    def test_low_icc_warning(self):
        """Test warning for low ICC"""
        print("\n" + "="*60)
        print("TEST: Low ICC Warning")
        print("="*60)

        data = self._generate_multi_item_data(
            n_respondents=30,
            items_per_respondent=10,
            effect_size=0.3,
            icc=0.02  # Very low ICC
        )

        context = ExperimentalContext(
            design=ExperimentalDesign(
                design_type="cluster_randomized",
                treatment_column="treatment",
                control_value="control",
                treatment_values=["treatment"],
                randomization_unit="item_id",
                cluster=ClusterStructure(
                    cluster_column="respondent_id",
                    cluster_level="respondent"
                )
            ),
            metrics=[MetricSpecification(
                name="rating",
                column="rating",
                metric_type="continuous"
            )],
            data=data,
            n_total=len(data),
            n_per_treatment={
                "control": len(data[data['treatment'] == 'control']),
                "treatment": len(data[data['treatment'] == 'treatment'])
            }
        )

        config = AnalysisConfig(alpha=0.05)
        result = self.plugin.analyze(context, config)

        # Should have low ICC warning
        has_low_icc_warning = any('low icc' in w.lower() for w in result.warnings)
        print(f"\nLow ICC warning present: {has_low_icc_warning}")

        self.assertTrue(has_low_icc_warning)
        print("✓ Low ICC warning test passed")


def run_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("MULTI-ITEM SURVEY PLUGIN - TEST SUITE")
    print("="*60)

    suite = unittest.TestLoader().loadTestsFromTestCase(TestMultiItemSurvey)
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
