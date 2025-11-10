"""
Paired Comparison Survey Plugin

Analyzes paired comparison survey experiments where each respondent
evaluates both items/conditions and provides ratings or preferences.

Common use cases:
- Product preference testing (A vs B shown to same user)
- Marketing message testing (compare two messages)
- UI element testing (compare two designs)
- Feature preference surveys

Key features:
- Accounts for within-subject correlation
- Checks for order effects
- Handles missing responses
- Supports Likert scales and continuous ratings
- Validates counterbalancing

References:
- Bradburn, N., Sudman, S., & Wansink, B. (2004). "Asking Questions"
- Krosnick, J. A. (1999). "Survey research"
- Student (1908). "The probable error of a mean"
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
from scipy import stats
from typing import Dict, List, Tuple


@analysis_plugin(
    name="paired_comparison_survey",
    version="1.0.0",
    author="Survey Research Team",
    description="Paired comparison analysis for survey experiments with within-subject design",
    design_types=["within_subjects"],
    required_metrics=["rating"]
)
class PairedComparisonSurvey(AnalysisPlugin):
    """
    Paired comparison analysis for surveys

    Analyzes experiments where each respondent rates/evaluates both
    conditions (e.g., sees both product A and product B).

    Design structure:
    - Each respondent provides two ratings (one per condition)
    - Randomization of presentation order (counterbalancing)
    - Paired t-test accounts for within-subject correlation

    Advantages:
    - Higher statistical power (within-subject design)
    - Controls for individual differences
    - Requires fewer respondents than between-subjects

    Assumptions:
    - Paired observations (same respondent rates both)
    - Differences are approximately normally distributed
    - No strong carryover effects
    - Independent respondents
    """

    def _get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="paired_comparison_survey",
            version="1.0.0",
            author="Survey Research Team",
            description="Paired comparison survey analysis with within-subject design",
            supported_design_types=["within_subjects"],
            required_metrics=["rating"],
            min_sample_size=20,  # Minimum respondents for paired t-test
            assumptions=[
                "Paired observations from same respondent",
                "Differences approximately normally distributed",
                "No strong carryover/order effects",
                "Independent respondents"
            ],
            references=[
                "Bradburn et al. (2004). Asking Questions",
                "Student (1908). The probable error of a mean"
            ]
        )

    def _get_capabilities(self) -> PluginCapabilities:
        return PluginCapabilities(
            supported_design_types={"within_subjects"},
            supported_metric_types={"continuous"},
            handles_temporal_correlation=False,
            handles_spatial_correlation=False,
            handles_clustering=False,
            handles_repeated_measures=True,
            handles_interactions=False,
            handles_covariates=True,  # Can stratify by demographics
            requires_balanced_design=False,  # Can handle missing responses
            requires_equal_variance=False,
            requires_normality=False,  # Robust with n > 20
            supports_large_datasets=True
        )

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        """
        Perform paired comparison analysis

        Args:
            context: Experimental context with paired survey data
            config: Analysis configuration

        Returns:
            Analysis result with paired t-test, order effects, diagnostics
        """
        # Validate context
        errors = self.validate_context(context)
        if errors:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Extract data
        data = context.data
        metric_col = context.metrics[0].column
        subject_col = context.design.within_subjects.subject_column
        condition_col = context.design.within_subjects.condition_column

        # Get condition values
        control_value = context.design.control_value
        treatment_value = context.design.treatment_values[0]

        # Pivot to wide format for paired analysis
        paired_data = self._prepare_paired_data(
            data, subject_col, condition_col, metric_col,
            control_value, treatment_value
        )

        # Check for order effects if order information available
        order_effects = None
        if context.design.within_subjects.order_column:
            order_effects = self._check_order_effects(
                data,
                subject_col,
                condition_col,
                metric_col,
                context.design.within_subjects.order_column,
                control_value,
                treatment_value
            )

        # Check assumptions
        assumptions = self.check_assumptions(context)

        # Perform paired t-test
        control_ratings = paired_data['control'].values
        treatment_ratings = paired_data['treatment'].values

        differences = treatment_ratings - control_ratings

        # Calculate statistics
        mean_diff = np.mean(differences)
        std_diff = np.std(differences, ddof=1)
        n = len(differences)
        se_diff = std_diff / np.sqrt(n)

        # T-test
        t_stat = mean_diff / se_diff if se_diff > 0 else 0
        df = n - 1
        p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df))

        # Confidence interval
        t_critical = stats.t.ppf(1 - config.alpha/2, df)
        ci_lower = mean_diff - t_critical * se_diff
        ci_upper = mean_diff + t_critical * se_diff

        # Effect size (Cohen's d for paired data)
        cohens_d = mean_diff / std_diff if std_diff > 0 else 0

        # Correlation between conditions
        correlation = np.corrcoef(control_ratings, treatment_ratings)[0, 1]

        # Generate warnings
        warnings = []

        if not assumptions.get('normality_differences', True):
            warnings.append(
                "Differences may not be normally distributed. "
                f"Consider non-parametric Wilcoxon test if n < 30 (current n={n})."
            )

        if n < 20:
            warnings.append(
                f"Small sample size (n={n}). Results may be unreliable. "
                "Consider collecting more responses."
            )

        # Check missing data
        missing_pct = 1 - (len(paired_data) / context.n_total)
        if missing_pct > 0.1:
            warnings.append(
                f"High missing data rate ({missing_pct:.1%}). "
                "This may indicate survey fatigue or technical issues."
            )

        # Check for order effects
        if order_effects and order_effects['significant']:
            warnings.append(
                f"Significant order effect detected (p={order_effects['p_value']:.4f}). "
                "Results may be biased by presentation order."
            )

        # Check correlation
        if abs(correlation) < 0.1:
            warnings.append(
                f"Low correlation between conditions (r={correlation:.3f}). "
                "Paired design may not provide much benefit over independent groups."
            )

        # Check for outliers in differences
        outliers = np.sum(np.abs(differences - mean_diff) > 3 * std_diff)
        if outliers > 0:
            warnings.append(
                f"Potential outliers detected ({outliers} responses). "
                "Consider reviewing extreme differences."
            )

        # Prepare result
        result = AnalysisResult(
            estimates={'treatment_effect': mean_diff},
            confidence_intervals={
                'treatment_effect': (ci_lower, ci_upper)
            },
            p_values={'treatment_effect': p_value},
            standard_errors={'treatment_effect': se_diff},
            method="Paired t-test (within-subjects)",
            model_formula=f"{metric_col} ~ {condition_col} | {subject_col}",
            degrees_of_freedom={'t_test': df},
            sample_sizes={
                'respondents': n,
                'total_responses': len(data),
                'complete_pairs': len(paired_data)
            },
            effective_sample_size=n,  # Number of independent units (respondents)
            assumptions_met=assumptions,
            warnings=warnings,
            residual_diagnostics={
                't_statistic': t_stat,
                'mean_control': np.mean(control_ratings),
                'mean_treatment': np.mean(treatment_ratings),
                'mean_difference': mean_diff,
                'std_difference': std_diff,
                'correlation': correlation,
                'missing_rate': missing_pct
            },
            effect_sizes={
                'cohens_d': cohens_d,
                'correlation': correlation
            }
        )

        # Add order effects if available
        if order_effects:
            result.temporal_effects = {
                'order_effect': order_effects
            }

        return result

    def _prepare_paired_data(
        self,
        data: pd.DataFrame,
        subject_col: str,
        condition_col: str,
        metric_col: str,
        control_value: str,
        treatment_value: str
    ) -> pd.DataFrame:
        """
        Prepare data in wide format for paired analysis

        Converts long format (one row per rating) to wide format
        (one row per respondent with both ratings).

        Handles missing data by keeping only complete pairs.
        """
        # Filter to relevant conditions
        relevant_data = data[
            data[condition_col].isin([control_value, treatment_value])
        ].copy()

        # Pivot to wide format
        pivoted = relevant_data.pivot(
            index=subject_col,
            columns=condition_col,
            values=metric_col
        )

        # Rename columns
        pivoted = pivoted.rename(columns={
            control_value: 'control',
            treatment_value: 'treatment'
        })

        # Keep only complete pairs
        complete_pairs = pivoted.dropna()

        return complete_pairs

    def _check_order_effects(
        self,
        data: pd.DataFrame,
        subject_col: str,
        condition_col: str,
        metric_col: str,
        order_col: str,
        control_value: str,
        treatment_value: str
    ) -> Dict:
        """
        Check for order/position effects

        Tests whether the order of presentation (which item shown first)
        affects ratings.

        Returns:
            Dictionary with order effect test results
        """
        # Get order for each subject-condition pair
        subject_orders = data.groupby(subject_col)[order_col].first()

        # Check if we have both orders
        unique_orders = subject_orders.unique()
        if len(unique_orders) < 2:
            return {
                'tested': False,
                'reason': 'Insufficient order variation'
            }

        # Prepare paired data with order information
        paired = self._prepare_paired_data(
            data, subject_col, condition_col, metric_col,
            control_value, treatment_value
        )

        # Add order information
        paired['order'] = paired.index.map(subject_orders)
        paired = paired.dropna(subset=['order'])

        # Calculate differences
        paired['difference'] = paired['treatment'] - paired['control']

        # Test if differences vary by order
        # Split by order groups
        order_groups = paired.groupby('order')['difference'].apply(list)

        if len(order_groups) < 2:
            return {
                'tested': False,
                'reason': 'Insufficient order groups'
            }

        # Perform t-test on differences between order groups
        group1 = order_groups.iloc[0]
        group2 = order_groups.iloc[1]

        if len(group1) < 2 or len(group2) < 2:
            return {
                'tested': False,
                'reason': 'Insufficient sample in order groups'
            }

        t_stat, p_value = stats.ttest_ind(group1, group2)

        return {
            'tested': True,
            'significant': p_value < 0.05,
            'p_value': p_value,
            't_statistic': t_stat,
            'mean_diff_order1': np.mean(group1),
            'mean_diff_order2': np.mean(group2),
            'n_order1': len(group1),
            'n_order2': len(group2),
            'interpretation': (
                'Order affects ratings' if p_value < 0.05
                else 'No significant order effect'
            )
        }

    def check_assumptions(self, context: ExperimentalContext) -> Dict[str, bool]:
        """
        Check statistical assumptions

        Tests:
        1. Normality of differences
        2. No extreme outliers

        Args:
            context: Experimental context

        Returns:
            Dictionary of assumption_name: met (bool)
        """
        data = context.data
        metric_col = context.metrics[0].column
        subject_col = context.design.within_subjects.subject_column
        condition_col = context.design.within_subjects.condition_column

        control_value = context.design.control_value
        treatment_value = context.design.treatment_values[0]

        # Prepare paired data
        paired_data = self._prepare_paired_data(
            data, subject_col, condition_col, metric_col,
            control_value, treatment_value
        )

        # Calculate differences
        differences = (
            paired_data['treatment'].values - paired_data['control'].values
        )

        # Test normality of differences
        if len(differences) >= 3:
            normality, _ = StatisticalTests.check_normality(differences)
        else:
            normality = False

        # Check for pairing (correlation should be positive)
        correlation = np.corrcoef(
            paired_data['control'].values,
            paired_data['treatment'].values
        )[0, 1]

        return {
            'normality_differences': normality,
            'positive_correlation': correlation > 0,
            'adequate_sample': len(differences) >= 20
        }

    def calculate_power(
        self,
        sample_size: int,
        effect_size: float,
        alpha: float = 0.05,
        correlation: float = 0.5
    ) -> float:
        """
        Calculate statistical power for paired t-test

        Args:
            sample_size: Number of respondents (paired observations)
            effect_size: Cohen's d (standardized mean difference)
            alpha: Significance level
            correlation: Expected correlation between paired observations

        Returns:
            Statistical power (0-1)
        """
        # Effective sample size is just the number of pairs
        # Paired design has higher power than independent due to correlation

        # Adjusted effect size accounting for correlation
        # Variance of difference = var1 + var2 - 2*cor*sd1*sd2
        # For standardized, assuming equal variances: = 2(1 - correlation)
        adjusted_effect = effect_size / np.sqrt(2 * (1 - correlation))

        return PowerAnalysis.two_sample_ttest_power(
            n=sample_size,
            effect_size=adjusted_effect,
            alpha=alpha
        )

    def calculate_required_sample_size(
        self,
        effect_size: float,
        power: float = 0.8,
        alpha: float = 0.05,
        correlation: float = 0.5
    ) -> int:
        """
        Calculate required sample size for paired t-test

        Args:
            effect_size: Cohen's d (minimum detectable effect)
            power: Desired power
            alpha: Significance level
            correlation: Expected correlation between paired observations

        Returns:
            Required number of respondents (paired observations)
        """
        # Adjust effect size for correlation
        adjusted_effect = effect_size / np.sqrt(2 * (1 - correlation))

        # Calculate sample size for one-sample t-test (which is what paired becomes)
        # Use approximation with two-sample formula but adjusted effect size
        return PowerAnalysis.two_sample_ttest_sample_size(
            effect_size=adjusted_effect,
            power=power,
            alpha=alpha
        )


if __name__ == "__main__":
    # Example usage
    print("Paired Comparison Survey Plugin - Example")
    print("=" * 60)

    # Simulate survey data: respondents rate two products
    np.random.seed(42)
    n_respondents = 100

    # Generate correlated ratings (same person tends to rate similarly)
    respondent_baseline = np.random.normal(3, 0.8, n_respondents)

    # Product A ratings (baseline)
    product_a_ratings = respondent_baseline + np.random.normal(0, 0.5, n_respondents)

    # Product B ratings (baseline + treatment effect + noise)
    product_b_ratings = respondent_baseline + 0.5 + np.random.normal(0, 0.5, n_respondents)

    # Clip to 1-5 scale
    product_a_ratings = np.clip(product_a_ratings, 1, 5)
    product_b_ratings = np.clip(product_b_ratings, 1, 5)

    # Create long format data
    data = pd.DataFrame({
        'respondent_id': np.repeat(range(n_respondents), 2),
        'product': ['A', 'B'] * n_respondents,
        'rating': np.concatenate([product_a_ratings, product_b_ratings]),
        'order': np.tile([1, 2], n_respondents)  # Simple sequential order
    })

    # Randomize order for half the respondents
    swap_mask = np.repeat(np.random.rand(n_respondents) < 0.5, 2)
    data.loc[swap_mask, 'order'] = 3 - data.loc[swap_mask, 'order']

    print(f"Survey: {n_respondents} respondents rated 2 products")
    print(f"Total responses: {len(data)}")
    print(f"\nSample data:")
    print(data.head(10))

    # Create context
    from experimeh_plugins import (
        ExperimentalDesign,
        MetricSpecification,
        WithinSubjectsStructure
    )

    context = ExperimentalContext(
        design=ExperimentalDesign(
            design_type="within_subjects",
            treatment_column="product",
            control_value="A",
            treatment_values=["B"],
            randomization_unit="respondent_id",
            within_subjects=WithinSubjectsStructure(
                subject_column="respondent_id",
                condition_column="product",
                order_column="order"
            )
        ),
        metrics=[MetricSpecification(
            name="product_rating",
            column="rating",
            metric_type="continuous",
            higher_is_better=True
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={"A": n_respondents, "B": n_respondents}
    )

    # Run analysis
    plugin = PairedComparisonSurvey()
    config = AnalysisConfig(alpha=0.05)
    result = plugin.analyze(context, config)

    print(f"\n{'Results':=^60}")
    print(f"\nMethod: {result.method}")
    print(f"Treatment Effect: {result.estimates['treatment_effect']:.3f}")
    print(f"95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
          f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")
    print(f"P-value: {result.p_values['treatment_effect']:.4f}")
    print(f"Cohen's d: {result.effect_sizes['cohens_d']:.3f}")
    print(f"Correlation: {result.effect_sizes['correlation']:.3f}")

    print(f"\nSample Sizes:")
    for key, val in result.sample_sizes.items():
        print(f"  {key}: {val}")

    if result.warnings:
        print(f"\nWarnings:")
        for warning in result.warnings:
            print(f"  ⚠️  {warning}")

    print("\n" + "=" * 60)
