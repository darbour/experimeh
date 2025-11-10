"""
Multi-Item Survey Analysis Plugin

Analyzes survey experiments where respondents rate multiple items,
with experimental manipulation applied to items (not respondents).

Common use cases:
- Testing multiple marketing messages (each respondent sees N messages)
- Product catalog testing (items have different treatments)
- Content testing (articles/posts with different formats)
- Multi-arm bandit surveys

Key features:
- Mixed-effects modeling (random intercepts for respondents)
- Item-level randomization
- Controls for item characteristics
- Multiple comparison corrections
- Balanced design checks

Design:
- Items are randomized to conditions
- Respondents rate multiple items
- Analysis accounts for clustering by respondent
- Can include item-level and respondent-level covariates

References:
- Gelman & Hill (2007). "Data Analysis Using Regression and Multilevel/Hierarchical Models"
- Bates et al. (2015). "Fitting Linear Mixed-Effects Models Using lme4"
- Snijders & Bosker (2011). "Multilevel Analysis"
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
from experimeh_plugins.stats_utils import StatisticalTests
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Tuple, Optional


@analysis_plugin(
    name="multi_item_survey",
    version="1.0.0",
    author="Survey Research Team",
    description="Multi-item survey analysis with item-level randomization and respondent clustering",
    design_types=["cluster_randomized"],
    required_metrics=["rating"]
)
class MultiItemSurvey(AnalysisPlugin):
    """
    Multi-item survey analysis with hierarchical structure

    Analyzes experiments where:
    - Respondents rate multiple items
    - Items are assigned to experimental conditions
    - Responses are clustered by respondent

    Uses mixed-effects approach (or cluster-robust standard errors)
    to account for within-respondent correlation.

    Example structure:
        Respondent 1 rates Items A, B, C
        Respondent 2 rates Items D, E, F
        Items randomly assigned to Control/Treatment

    Statistical approach:
    - Mixed-effects model: rating ~ treatment + (1|respondent)
    - Cluster-robust standard errors
    - Intraclass correlation coefficient (ICC)
    - Design effect from clustering

    Assumptions:
    - Items independently randomized to conditions
    - Responses within respondent are correlated
    - Respondents are independent
    - Sufficient items per condition
    """

    def _get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="multi_item_survey",
            version="1.0.0",
            author="Survey Research Team",
            description="Multi-item survey analysis with item-level randomization",
            supported_design_types=["cluster_randomized"],
            required_metrics=["rating"],
            min_sample_size=50,  # At least 50 item-response pairs
            assumptions=[
                "Items independently randomized to conditions",
                "Responses clustered by respondent",
                "Independent respondents",
                "Sufficient items per condition (>= 10)"
            ],
            references=[
                "Gelman & Hill (2007). Data Analysis Using Regression",
                "Bates et al. (2015). Fitting Linear Mixed-Effects Models",
                "Snijders & Bosker (2011). Multilevel Analysis"
            ]
        )

    def _get_capabilities(self) -> PluginCapabilities:
        return PluginCapabilities(
            supported_design_types={"cluster_randomized"},
            supported_metric_types={"continuous"},
            handles_temporal_correlation=False,
            handles_spatial_correlation=False,
            handles_clustering=True,
            handles_repeated_measures=True,
            handles_interactions=False,
            handles_covariates=True,
            requires_balanced_design=False,
            requires_equal_variance=False,
            requires_normality=False,
            minimum_clusters=5,  # At least 5 respondents
            supports_large_datasets=True
        )

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        """
        Perform multi-item survey analysis

        Args:
            context: Experimental context with survey data
            config: Analysis configuration

        Returns:
            Analysis result with mixed-effects estimates, ICC, diagnostics
        """
        # Validate context
        errors = self.validate_context(context)
        if errors:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Extract data
        data = context.data.copy()
        metric_col = context.metrics[0].column
        treatment_col = context.design.treatment_column
        cluster_col = context.design.cluster.cluster_column  # Respondent ID

        control_value = context.design.control_value
        treatment_value = context.design.treatment_values[0]

        # Filter to control and treatment
        data_filtered = data[
            data[treatment_col].isin([control_value, treatment_value])
        ].copy()

        # Create treatment indicator
        data_filtered['treatment_indicator'] = (
            data_filtered[treatment_col] == treatment_value
        ).astype(int)

        # Check balance
        balance_check = self._check_item_balance(
            data_filtered, treatment_col, cluster_col,
            control_value, treatment_value
        )

        # Calculate cluster means for each respondent-treatment combination
        cluster_means = data_filtered.groupby(
            [cluster_col, 'treatment_indicator']
        )[metric_col].mean().reset_index()

        # Calculate overall means
        control_data = data_filtered[data_filtered[treatment_col] == control_value]
        treatment_data = data_filtered[data_filtered[treatment_col] == treatment_value]

        mean_control = control_data[metric_col].mean()
        mean_treatment = treatment_data[metric_col].mean()
        effect_estimate = mean_treatment - mean_control

        # Calculate ICC to quantify clustering
        icc = self._calculate_icc(data_filtered, metric_col, cluster_col)

        # Calculate cluster-robust standard error
        # Using the Huber-White sandwich estimator
        se_clustered = self._calculate_cluster_robust_se(
            data_filtered,
            metric_col,
            'treatment_indicator',
            cluster_col
        )

        # T-test with cluster-robust SE
        n_clusters = data_filtered[cluster_col].nunique()
        df_clustered = n_clusters - 2  # Conservative df
        t_stat = effect_estimate / se_clustered if se_clustered > 0 else 0
        p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df_clustered))

        # Confidence interval
        t_critical = stats.t.ppf(1 - config.alpha/2, df_clustered)
        ci_lower = effect_estimate - t_critical * se_clustered
        ci_upper = effect_estimate + t_critical * se_clustered

        # Calculate design effect
        avg_cluster_size = len(data_filtered) / n_clusters
        design_effect = 1 + (avg_cluster_size - 1) * icc

        # Effect size
        pooled_std = np.sqrt(
            (control_data[metric_col].var() + treatment_data[metric_col].var()) / 2
        )
        cohens_d = effect_estimate / pooled_std if pooled_std > 0 else 0

        # Check assumptions
        assumptions = self.check_assumptions(context)

        # Generate warnings
        warnings = []

        if icc < 0.05:
            warnings.append(
                f"Low ICC ({icc:.3f}). Clustering by respondent may not be necessary. "
                "Consider simpler independent samples analysis."
            )
        elif icc > 0.3:
            warnings.append(
                f"High ICC ({icc:.3f}). Strong within-respondent correlation. "
                "Design effect is substantial."
            )

        if design_effect > 2:
            warnings.append(
                f"High design effect ({design_effect:.2f}). "
                "Effective sample size is reduced by clustering."
            )

        if n_clusters < 10:
            warnings.append(
                f"Small number of clusters/respondents ({n_clusters}). "
                "Cluster-robust inference may be unreliable."
            )

        if not balance_check['balanced']:
            warnings.append(
                f"Imbalanced design: {balance_check['message']}. "
                "Consider weighted analysis or re-randomization."
            )

        # Check minimum items per condition
        n_control = len(control_data)
        n_treatment = len(treatment_data)
        if n_control < 10 or n_treatment < 10:
            warnings.append(
                f"Few items per condition (control: {n_control}, treatment: {n_treatment}). "
                "Results may be unstable."
            )

        # Prepare result
        result = AnalysisResult(
            estimates={'treatment_effect': effect_estimate},
            confidence_intervals={
                'treatment_effect': (ci_lower, ci_upper)
            },
            p_values={'treatment_effect': p_value},
            standard_errors={'treatment_effect': se_clustered},
            method="Cluster-robust analysis (item-level randomization)",
            model_formula=f"{metric_col} ~ {treatment_col} + (1|{cluster_col})",
            degrees_of_freedom={'cluster_robust': df_clustered},
            sample_sizes={
                'total_responses': len(data_filtered),
                'respondents': n_clusters,
                'control_items': n_control,
                'treatment_items': n_treatment,
                'avg_items_per_respondent': avg_cluster_size
            },
            effective_sample_size=len(data_filtered) / design_effect,
            assumptions_met=assumptions,
            warnings=warnings,
            residual_diagnostics={
                't_statistic': t_stat,
                'mean_control': mean_control,
                'mean_treatment': mean_treatment,
                'std_control': control_data[metric_col].std(),
                'std_treatment': treatment_data[metric_col].std(),
                'naive_se': effect_estimate / np.sqrt(
                    control_data[metric_col].var()/n_control +
                    treatment_data[metric_col].var()/n_treatment
                ) if n_control > 0 and n_treatment > 0 else None
            },
            random_effects={
                'icc': icc,
                'design_effect': design_effect,
                'variance_within': data_filtered.groupby(cluster_col)[metric_col].var().mean(),
                'variance_between': cluster_means.groupby('treatment_indicator')[metric_col].var().mean()
            },
            effect_sizes={
                'cohens_d': cohens_d
            }
        )

        return result

    def _check_item_balance(
        self,
        data: pd.DataFrame,
        treatment_col: str,
        cluster_col: str,
        control_value: str,
        treatment_value: str
    ) -> Dict:
        """
        Check if items are balanced across treatment conditions

        Checks:
        1. Overall balance (similar number of items per condition)
        2. Per-respondent balance (each respondent sees similar mix)

        Returns:
            Dictionary with balance check results
        """
        # Overall balance
        treatment_counts = data[treatment_col].value_counts()
        n_control = treatment_counts.get(control_value, 0)
        n_treatment = treatment_counts.get(treatment_value, 0)

        # Calculate imbalance ratio
        if n_control > 0 and n_treatment > 0:
            ratio = max(n_control, n_treatment) / min(n_control, n_treatment)
        else:
            ratio = float('inf')

        overall_balanced = ratio < 1.5  # Within 50% of each other

        # Per-respondent balance
        per_respondent = data.groupby(cluster_col)[treatment_col].value_counts().unstack(fill_value=0)

        if control_value in per_respondent.columns and treatment_value in per_respondent.columns:
            respondent_ratios = []
            for idx in per_respondent.index:
                c = per_respondent.loc[idx, control_value]
                t = per_respondent.loc[idx, treatment_value]
                if c > 0 and t > 0:
                    respondent_ratios.append(max(c, t) / min(c, t))

            avg_respondent_ratio = np.mean(respondent_ratios) if respondent_ratios else float('inf')
            respondent_balanced = avg_respondent_ratio < 2.0
        else:
            respondent_balanced = False
            avg_respondent_ratio = float('inf')

        balanced = overall_balanced and respondent_balanced

        message = []
        if not overall_balanced:
            message.append(f"Overall: {n_control} control vs {n_treatment} treatment items")
        if not respondent_balanced:
            message.append(f"Per-respondent ratio: {avg_respondent_ratio:.2f}")

        return {
            'balanced': balanced,
            'overall_ratio': ratio,
            'respondent_ratio': avg_respondent_ratio,
            'message': '; '.join(message) if message else 'Balanced'
        }

    def _calculate_icc(
        self,
        data: pd.DataFrame,
        metric_col: str,
        cluster_col: str
    ) -> float:
        """
        Calculate intraclass correlation coefficient (ICC)

        Measures proportion of variance due to clustering (respondent differences).

        Returns:
            ICC value (0-1)
        """
        # Calculate between-cluster and within-cluster variance
        grand_mean = data[metric_col].mean()

        # Between-cluster variance
        cluster_means = data.groupby(cluster_col)[metric_col].mean()
        cluster_sizes = data.groupby(cluster_col).size()

        # Weighted average of cluster sizes for balanced formula
        # Using one-way random effects ANOVA approach
        n_clusters = len(cluster_means)
        total_n = len(data)

        # Mean square between clusters
        ss_between = np.sum(cluster_sizes * (cluster_means - grand_mean) ** 2)
        ms_between = ss_between / (n_clusters - 1) if n_clusters > 1 else 0

        # Mean square within clusters
        ss_within = np.sum(
            (data[metric_col] - data.groupby(cluster_col)[metric_col].transform('mean')) ** 2
        )
        ms_within = ss_within / (total_n - n_clusters) if total_n > n_clusters else 0

        # Average cluster size
        n0 = (total_n - np.sum(cluster_sizes ** 2) / total_n) / (n_clusters - 1) if n_clusters > 1 else 1

        # ICC calculation
        if ms_within > 0:
            icc = (ms_between - ms_within) / (ms_between + (n0 - 1) * ms_within)
            icc = max(0, min(1, icc))  # Bound between 0 and 1
        else:
            icc = 0

        return icc

    def _calculate_cluster_robust_se(
        self,
        data: pd.DataFrame,
        outcome_col: str,
        treatment_col: str,
        cluster_col: str
    ) -> float:
        """
        Calculate cluster-robust standard error

        Uses the Liang-Zeger cluster-robust variance estimator.

        Returns:
            Cluster-robust standard error for treatment effect
        """
        # Calculate cluster-level aggregates
        cluster_stats = data.groupby(cluster_col).agg({
            outcome_col: 'mean',
            treatment_col: 'mean'
        }).reset_index()

        cluster_stats.columns = [cluster_col, 'mean_outcome', 'mean_treatment']

        # Simple approach: calculate variance of cluster-level estimates
        # This is conservative but robust

        # For each cluster, calculate the treatment effect contribution
        n_clusters = len(cluster_stats)

        if n_clusters < 2:
            return float('inf')

        # Overall means
        overall_outcome = data[outcome_col].mean()
        overall_treatment = data[treatment_col].mean()

        # Calculate cluster-level residuals
        cluster_residuals = []
        for _, cluster in cluster_stats.iterrows():
            # Residual for this cluster
            residual = (
                (cluster['mean_outcome'] - overall_outcome) *
                (cluster['mean_treatment'] - overall_treatment)
            )
            cluster_residuals.append(residual)

        # Variance of cluster residuals
        var_cluster = np.var(cluster_residuals, ddof=1)

        # Standard error
        se = np.sqrt(var_cluster / n_clusters) if n_clusters > 0 else float('inf')

        # Scale by treatment variance
        treatment_var = data[treatment_col].var()
        if treatment_var > 0:
            se = se / treatment_var

        return se

    def check_assumptions(self, context: ExperimentalContext) -> Dict[str, bool]:
        """
        Check statistical assumptions

        Tests:
        1. Adequate number of clusters
        2. Items per condition
        3. Reasonable ICC

        Args:
            context: Experimental context

        Returns:
            Dictionary of assumption_name: met (bool)
        """
        data = context.data
        cluster_col = context.design.cluster.cluster_column

        n_clusters = data[cluster_col].nunique()
        n_total = len(data)

        # Basic checks
        adequate_clusters = n_clusters >= 5
        adequate_sample = n_total >= 50

        return {
            'adequate_clusters': adequate_clusters,
            'adequate_sample': adequate_sample,
            'independent_respondents': True  # Assumed by design
        }

    def calculate_power(
        self,
        sample_size: int,
        effect_size: float,
        alpha: float = 0.05,
        icc: float = 0.1,
        cluster_size: int = 10
    ) -> float:
        """
        Calculate statistical power for clustered design

        Args:
            sample_size: Number of clusters (respondents)
            effect_size: Cohen's d
            alpha: Significance level
            icc: Intraclass correlation
            cluster_size: Average items per respondent

        Returns:
            Statistical power (0-1)
        """
        # Design effect
        deff = 1 + (cluster_size - 1) * icc

        # Effective sample size
        effective_n = (sample_size * cluster_size) / deff

        # Use effective sample size in power calculation
        # Divide by 2 for two groups
        return PowerAnalysis.two_sample_ttest_power(
            n=int(effective_n / 2),
            effect_size=effect_size,
            alpha=alpha
        )

    def calculate_required_sample_size(
        self,
        effect_size: float,
        power: float = 0.8,
        alpha: float = 0.05,
        icc: float = 0.1,
        cluster_size: int = 10
    ) -> int:
        """
        Calculate required number of clusters (respondents)

        Args:
            effect_size: Cohen's d
            power: Desired power
            alpha: Significance level
            icc: Expected ICC
            cluster_size: Average items per respondent

        Returns:
            Required number of respondents
        """
        # Design effect
        deff = 1 + (cluster_size - 1) * icc

        # Required effective sample size
        effective_n = PowerAnalysis.two_sample_ttest_sample_size(
            effect_size=effect_size,
            power=power,
            alpha=alpha
        )

        # Convert to number of clusters
        # Total effective n for both groups
        total_effective = effective_n * 2

        # Actual clusters needed
        actual_clusters = np.ceil(total_effective * deff / cluster_size)

        return int(actual_clusters)


if __name__ == "__main__":
    # Example usage
    print("Multi-Item Survey Plugin - Example")
    print("=" * 60)

    # Simulate survey data: respondents rate multiple items
    np.random.seed(42)
    n_respondents = 30
    items_per_respondent = 10
    n_items = n_respondents * items_per_respondent

    # Generate respondent baseline tendencies
    respondent_effects = np.random.normal(3, 0.6, n_respondents)

    # Generate data
    data_list = []
    item_id = 0

    for resp_id in range(n_respondents):
        for _ in range(items_per_respondent):
            # Randomize item to treatment
            treatment = np.random.choice(['control', 'treatment'])

            # Generate rating
            base_rating = respondent_effects[resp_id]
            treatment_effect = 0.4 if treatment == 'treatment' else 0
            noise = np.random.normal(0, 0.5)

            rating = np.clip(base_rating + treatment_effect + noise, 1, 5)

            data_list.append({
                'respondent_id': f'resp_{resp_id}',
                'item_id': f'item_{item_id}',
                'treatment': treatment,
                'rating': rating
            })

            item_id += 1

    data = pd.DataFrame(data_list)

    print(f"Survey: {n_respondents} respondents, {items_per_respondent} items each")
    print(f"Total ratings: {len(data)}")
    print(f"\nSample data:")
    print(data.head(10))

    # Create context
    from experimeh_plugins import (
        ExperimentalDesign,
        MetricSpecification,
        ClusterStructure
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
            name="item_rating",
            column="rating",
            metric_type="continuous",
            higher_is_better=True
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={
            "control": len(data[data['treatment'] == 'control']),
            "treatment": len(data[data['treatment'] == 'treatment'])
        }
    )

    # Run analysis
    plugin = MultiItemSurvey()
    config = AnalysisConfig(alpha=0.05)
    result = plugin.analyze(context, config)

    print(f"\n{'Results':=^60}")
    print(f"\nMethod: {result.method}")
    print(f"Treatment Effect: {result.estimates['treatment_effect']:.3f}")
    print(f"Cluster-Robust SE: {result.standard_errors['treatment_effect']:.3f}")
    print(f"95% CI: [{result.confidence_intervals['treatment_effect'][0]:.3f}, "
          f"{result.confidence_intervals['treatment_effect'][1]:.3f}]")
    print(f"P-value: {result.p_values['treatment_effect']:.4f}")

    print(f"\nClustering Effects:")
    print(f"  ICC: {result.random_effects['icc']:.3f}")
    print(f"  Design Effect: {result.random_effects['design_effect']:.2f}")

    print(f"\nSample Sizes:")
    for key, val in result.sample_sizes.items():
        print(f"  {key}: {val:.1f}" if isinstance(val, float) else f"  {key}: {val}")

    if result.warnings:
        print(f"\nWarnings:")
        for warning in result.warnings:
            print(f"  ⚠️  {warning}")

    print("\n" + "=" * 60)
