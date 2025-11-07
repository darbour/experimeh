"""
Welch's T-Test Plugin

Implements Welch's t-test for comparing means between two groups
with potentially unequal variances. More robust than Student's t-test.

References:
- Welch, B. L. (1947). "The generalization of Student's problem when
  several different population variances are involved"
- Ruxton, G. D. (2006). "The unequal variance t-test is an underused
  alternative to Student's t-test and the Mann–Whitney U test"
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../python'))

from experimeh_plugins import (
    AnalysisPlugin,
    analysis_plugin,
    PluginMetadata,
    PluginCapabilities,
    ExperimentalContext,
    AnalysisConfig,
    AnalysisResult
)
from experimeh_plugins.stats_utils import StatisticalTests, PowerAnalysis
import pandas as pd
import numpy as np


@analysis_plugin(
    name="welch_ttest",
    version="1.0.0",
    author="Statistics Team",
    description="Welch's t-test for comparing means with unequal variances",
    design_types=["ab"],
    required_metrics=["metric"]
)
class WelchTTest(AnalysisPlugin):
    """
    Welch's t-test implementation

    Suitable for:
    - Two-arm experiments (A/B tests)
    - Continuous outcomes
    - Unequal variances between groups (robust to this)
    - Independent observations

    Assumptions:
    - Independent observations
    - Approximately normal distributions (or large sample sizes via CLT)
    - Continuous outcome variable

    Not suitable for:
    - Binary outcomes (use z-test for proportions)
    - More than two groups (use ANOVA)
    - Clustered/hierarchical data (use mixed models)
    - Repeated measures (use within-subjects designs)
    """

    def _get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="welch_ttest",
            version="1.0.0",
            author="Statistics Team",
            description="Welch's t-test for unequal variances",
            supported_design_types=["ab"],
            required_metrics=["metric"],
            min_sample_size=30,  # For CLT to apply reasonably
            assumptions=[
                "Independent observations",
                "Approximately normal distributions (or n > 30)",
                "Continuous outcome variable"
            ],
            references=[
                "Welch, B. L. (1947). The generalization of 'Student's' problem",
                "Ruxton, G. D. (2006). The unequal variance t-test"
            ]
        )

    def _get_capabilities(self) -> PluginCapabilities:
        return PluginCapabilities(
            supported_design_types={"ab"},
            supported_metric_types={"continuous"},
            handles_temporal_correlation=False,
            handles_spatial_correlation=False,
            handles_clustering=False,
            handles_repeated_measures=False,
            handles_interactions=False,
            handles_covariates=False,
            requires_balanced_design=False,
            requires_equal_variance=False,  # Welch's test is robust to this
            requires_normality=False,  # Approximate with large samples
            supports_large_datasets=True
        )

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        """
        Perform Welch's t-test

        Args:
            context: Experimental context with data and design
            config: Analysis configuration

        Returns:
            Analysis result with estimates, p-values, CIs, diagnostics
        """
        # Validate context
        errors = self.validate_context(context)
        if errors:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Extract data
        data = context.data
        metric_col = context.metrics[0].column
        treatment_col = context.design.treatment_column

        # Split by variant
        control_mask = data[treatment_col] == context.design.control_value
        treatment_mask = data[treatment_col] == context.design.treatment_values[0]

        control = data.loc[control_mask, metric_col].values
        treatment = data.loc[treatment_mask, metric_col].values

        # Check assumptions
        assumptions = self.check_assumptions(context)

        # Run Welch's t-test
        test_result = StatisticalTests.welch_ttest(
            control,
            treatment,
            config.alpha
        )

        # Calculate effect size (Cohen's d)
        pooled_std = np.sqrt(
            (test_result['var_control'] + test_result['var_treatment']) / 2
        )
        cohens_d = test_result['estimate'] / pooled_std if pooled_std > 0 else 0.0

        # Generate warnings
        warnings = []
        if not assumptions.get('normality_control', True):
            warnings.append(
                "Control group may not be normally distributed. "
                "Results may be approximate (OK if n > 30)."
            )
        if not assumptions.get('normality_treatment', True):
            warnings.append(
                "Treatment group may not be normally distributed. "
                "Results may be approximate (OK if n > 30)."
            )

        # Check sample sizes
        if len(control) < 30 or len(treatment) < 30:
            warnings.append(
                f"Small sample size (control: {len(control)}, treatment: {len(treatment)}). "
                "Normality assumption becomes more important."
            )

        # Check for extreme outliers
        control_outliers = np.sum(
            np.abs(control - np.mean(control)) > 3 * np.std(control)
        )
        treatment_outliers = np.sum(
            np.abs(treatment - np.mean(treatment)) > 3 * np.std(treatment)
        )
        if control_outliers > 0 or treatment_outliers > 0:
            warnings.append(
                f"Potential outliers detected (control: {control_outliers}, "
                f"treatment: {treatment_outliers}). Consider winsorization."
            )

        return AnalysisResult(
            estimates={'treatment_effect': test_result['estimate']},
            confidence_intervals={
                'treatment_effect': test_result['confidence_interval']
            },
            p_values={'treatment_effect': test_result['p_value']},
            standard_errors={'treatment_effect': test_result['standard_error']},
            method="Welch's t-test (unequal variances)",
            model_formula=f"{metric_col} ~ {treatment_col}",
            degrees_of_freedom={'welch_df': test_result['degrees_of_freedom']},
            sample_sizes={
                'control': len(control),
                'treatment': len(treatment),
                'total': len(control) + len(treatment)
            },
            assumptions_met=assumptions,
            warnings=warnings,
            residual_diagnostics={
                't_statistic': test_result['t_statistic'],
                'control_mean': test_result['mean_control'],
                'treatment_mean': test_result['mean_treatment'],
                'control_std': np.sqrt(test_result['var_control']),
                'treatment_std': np.sqrt(test_result['var_treatment']),
                'variance_ratio': test_result['var_treatment'] / test_result['var_control']
                    if test_result['var_control'] > 0 else None
            },
            effect_sizes={'cohens_d': cohens_d}
        )

    def check_assumptions(self, context: ExperimentalContext) -> dict[str, bool]:
        """Check statistical assumptions

        Tests:
        1. Normality of each group (Shapiro-Wilk for n < 5000)
        2. Independence (assumed from experimental design)

        Args:
            context: Experimental context

        Returns:
            Dictionary of assumption_name: met (bool)
        """
        data = context.data
        metric_col = context.metrics[0].column
        treatment_col = context.design.treatment_column

        control = data[
            data[treatment_col] == context.design.control_value
        ][metric_col].values

        treatment = data[
            data[treatment_col] == context.design.treatment_values[0]
        ][metric_col].values

        # Test normality
        norm_control, _ = StatisticalTests.check_normality(control)
        norm_treatment, _ = StatisticalTests.check_normality(treatment)

        return {
            'normality_control': norm_control,
            'normality_treatment': norm_treatment,
            'independence': True  # Assumed from randomization
        }

    def calculate_power(
        self,
        sample_size: int,
        effect_size: float,
        alpha: float = 0.05
    ) -> float:
        """Calculate statistical power

        Args:
            sample_size: Sample size per group
            effect_size: Cohen's d
            alpha: Significance level

        Returns:
            Statistical power (0-1)
        """
        return PowerAnalysis.two_sample_ttest_power(
            n=sample_size,
            effect_size=effect_size,
            alpha=alpha
        )

    def calculate_required_sample_size(
        self,
        effect_size: float,
        power: float = 0.8,
        alpha: float = 0.05
    ) -> int:
        """Calculate required sample size

        Args:
            effect_size: Cohen's d (minimum detectable effect)
            power: Desired power
            alpha: Significance level

        Returns:
            Required sample size per group
        """
        return PowerAnalysis.two_sample_ttest_sample_size(
            effect_size=effect_size,
            power=power,
            alpha=alpha
        )


if __name__ == "__main__":
    # Example usage
    from experimeh_plugins.testing import DataGenerator

    # Generate test data
    data = DataGenerator.generate_ab_data(
        n_control=100,
        n_treatment=100,
        effect_size=0.5,
        seed=42
    )

    # Create context
    from experimeh_plugins import ExperimentalDesign, MetricSpecification

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
            metric_type="continuous"
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={"control": 100, "treatment": 100}
    )

    # Run analysis
    plugin = WelchTTest()
    config = AnalysisConfig(alpha=0.05)
    result = plugin.analyze(context, config)

    print(f"Estimate: {result.estimates['treatment_effect']:.4f}")
    print(f"P-value: {result.p_values['treatment_effect']:.4f}")
    print(f"95% CI: {result.confidence_intervals['treatment_effect']}")
    print(f"Cohen's d: {result.effect_sizes['cohens_d']:.4f}")
