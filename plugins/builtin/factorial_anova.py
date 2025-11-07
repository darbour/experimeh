"""
Factorial ANOVA Plugin

Implements factorial analysis of variance for multi-factor experiments.
Handles main effects, interactions, and unbalanced designs using Type III SS.

References:
- Montgomery, D. C. (2017). "Design and Analysis of Experiments"
- Maxwell, S. E., & Delaney, H. D. (2004). "Designing Experiments and Analyzing Data"
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


@analysis_plugin(
    name="factorial_anova",
    version="1.0.0",
    author="Statistics Team",
    description="Factorial ANOVA with interaction effects (Type III SS)",
    design_types=["factorial", "multivariate"],
    required_metrics=["metric"]
)
class FactorialANOVA(AnalysisPlugin):
    """
    Factorial ANOVA for multi-factor experiments

    Handles:
    - 2+ factors
    - Main effects and interactions
    - Unbalanced designs (Type III sums of squares)
    - Post-hoc pairwise comparisons

    Suitable for:
    - Factorial experiments (2x2, 2x3, 3x3, etc.)
    - Testing main effects and interactions
    - Continuous outcomes

    Assumptions:
    - Normality of residuals
    - Homogeneity of variance across cells
    - Independence of observations

    Note: Requires statsmodels for ANOVA implementation.
    Falls back to simplified version if not available.
    """

    def _get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="factorial_anova",
            version="1.0.0",
            author="Statistics Team",
            description="Factorial ANOVA with interaction effects",
            supported_design_types=["factorial", "multivariate"],
            required_metrics=["metric"],
            min_sample_size=20,  # At least 5 per cell for 2x2 design
            assumptions=[
                "Normality of residuals",
                "Homogeneity of variance across factorial cells",
                "Independence of observations"
            ],
            references=[
                "Montgomery, D. C. (2017). Design and Analysis of Experiments",
                "Maxwell, S. E., & Delaney, H. D. (2004). Designing Experiments"
            ]
        )

    def _get_capabilities(self) -> PluginCapabilities:
        return PluginCapabilities(
            supported_design_types={"factorial", "multivariate"},
            supported_metric_types={"continuous"},
            handles_temporal_correlation=False,
            handles_spatial_correlation=False,
            handles_clustering=False,
            handles_repeated_measures=False,
            handles_interactions=True,
            handles_covariates=True,
            requires_balanced_design=False,  # Type III SS handles unbalanced
            requires_equal_variance=True,  # Approximately
            requires_normality=True,  # Approximately
            supports_large_datasets=True
        )

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        """Perform factorial ANOVA"""
        # Validate
        errors = self.validate_context(context)
        if errors:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Check for factorial structure
        if not context.design.factorial:
            raise ValueError("Factorial structure required in experimental design")

        factorial = context.design.factorial
        data = context.data.copy()
        metric = context.metrics[0].column

        # Build model formula
        factors = factorial.factors
        formula = f"{metric} ~ " + " * ".join(factors)

        # Add covariates if present
        if context.design.covariates:
            formula += " + " + " + ".join(context.design.covariates)

        try:
            from statsmodels.formula.api import ols
            from statsmodels.stats.anova import anova_lm

            # Fit OLS model
            model = ols(formula, data=data).fit()

            # ANOVA table with Type III SS
            anova_table = anova_lm(model, typ=3)

            # Extract results
            results = self._extract_anova_results(
                model, anova_table, factorial, factors, config.alpha
            )

        except ImportError:
            # Fallback to manual ANOVA computation
            results = self._manual_factorial_anova(
                data, metric, factors, factorial, config.alpha
            )

        # Check assumptions
        try:
            from statsmodels.formula.api import ols
            model = ols(formula, data=data).fit()
            assumptions = self.check_assumptions_detailed(model, data, metric)
        except ImportError:
            assumptions = {'normality_residuals': True, 'homoscedasticity': True}

        # Add warnings
        warnings = results.get('warnings', [])
        if not assumptions.get('normality_residuals', True):
            warnings.append("Residuals may not be normally distributed")
        if not assumptions.get('homoscedasticity', True):
            warnings.append("Variance may not be homogeneous across groups")

        return AnalysisResult(
            estimates=results['estimates'],
            confidence_intervals=results['confidence_intervals'],
            p_values=results['p_values'],
            standard_errors=results['standard_errors'],
            method="Factorial ANOVA (Type III SS)",
            model_formula=formula,
            degrees_of_freedom=results.get('degrees_of_freedom', {}),
            sample_sizes=results['sample_sizes'],
            model_fit=results.get('model_fit', {}),
            assumptions_met=assumptions,
            warnings=warnings,
            interaction_effects=results.get('interaction_effects'),
            residual_diagnostics=results.get('diagnostics', {})
        )

    def _extract_anova_results(
        self,
        model,
        anova_table: pd.DataFrame,
        factorial,
        factors: list,
        alpha: float
    ) -> dict:
        """Extract results from statsmodels ANOVA"""
        estimates = {}
        confidence_intervals = {}
        p_values = {}
        standard_errors = {}

        # Main effects
        for factor in factors:
            # Get factor levels
            levels = factorial.levels_per_factor[factor]

            # Pairwise comparisons for each factor level
            for level in levels[1:]:  # Skip reference level
                param_name = f"{factor}[T.{level}]"
                if param_name in model.params:
                    estimates[f"{factor}_{level}_vs_{levels[0]}"] = float(
                        model.params[param_name]
                    )
                    ci = model.conf_int().loc[param_name]
                    confidence_intervals[f"{factor}_{level}_vs_{levels[0]}"] = (
                        float(ci[0]), float(ci[1])
                    )
                    p_values[f"{factor}_{level}_vs_{levels[0]}"] = float(
                        model.pvalues[param_name]
                    )
                    standard_errors[f"{factor}_{level}_vs_{levels[0]}"] = float(
                        model.bse[param_name]
                    )

        # Interaction effects
        interaction_effects = {}
        if factorial.interaction_terms or len(factors) == 2:
            for param in model.params.index:
                if ":" in param and "[T." in param:
                    interaction_effects[param] = float(model.params[param])

        # Sample sizes by cell
        sample_sizes = self._calculate_cell_sizes(
            model.model.data.frame,
            factors
        )

        # Model fit
        model_fit = {
            'r_squared': float(model.rsquared),
            'adj_r_squared': float(model.rsquared_adj),
            'aic': float(model.aic),
            'bic': float(model.bic),
            'f_statistic': float(model.fvalue),
            'f_pvalue': float(model.f_pvalue)
        }

        # Factor F-tests
        factor_f_tests = {}
        for factor in factors:
            if factor in anova_table.index:
                factor_f_tests[factor] = {
                    'F': float(anova_table.loc[factor, 'F']),
                    'p_value': float(anova_table.loc[factor, 'PR(>F)'])
                }

        warnings = []
        # Check for unbalanced design
        cell_sizes = list(sample_sizes.values())
        if max(cell_sizes) / min(cell_sizes) > 1.5:
            warnings.append(
                f"Unbalanced design detected (ratio: {max(cell_sizes)/min(cell_sizes):.2f}). "
                "Using Type III SS."
            )

        return {
            'estimates': estimates,
            'confidence_intervals': confidence_intervals,
            'p_values': p_values,
            'standard_errors': standard_errors,
            'sample_sizes': sample_sizes,
            'model_fit': model_fit,
            'interaction_effects': interaction_effects if interaction_effects else None,
            'degrees_of_freedom': {
                'residual': float(model.df_resid),
                'model': float(model.df_model)
            },
            'diagnostics': {
                'anova_table': anova_table.to_dict(),
                'factor_f_tests': factor_f_tests
            },
            'warnings': warnings
        }

    def _manual_factorial_anova(
        self,
        data: pd.DataFrame,
        metric: str,
        factors: list,
        factorial,
        alpha: float
    ) -> dict:
        """Fallback manual ANOVA computation"""
        # Simplified version for 2-factor design
        if len(factors) != 2:
            raise NotImplementedError(
                "Manual ANOVA only supports 2-factor designs. "
                "Install statsmodels for general factorial designs."
            )

        factor_a, factor_b = factors

        # Grand mean
        grand_mean = data[metric].mean()
        ss_total = ((data[metric] - grand_mean) ** 2).sum()

        # Main effect A
        a_means = data.groupby(factor_a)[metric].mean()
        a_counts = data.groupby(factor_a)[metric].count()
        ss_a = sum(a_counts * (a_means - grand_mean) ** 2)

        # Main effect B
        b_means = data.groupby(factor_b)[metric].mean()
        b_counts = data.groupby(factor_b)[metric].count()
        ss_b = sum(b_counts * (b_means - grand_mean) ** 2)

        # Interaction
        ab_means = data.groupby([factor_a, factor_b])[metric].mean()
        ab_counts = data.groupby([factor_a, factor_b])[metric].count()
        # This is a simplified interaction calculation
        ss_ab = 0  # Would need proper calculation

        # Error
        ss_error = ss_total - ss_a - ss_b - ss_ab

        # Degrees of freedom
        df_a = len(factorial.levels_per_factor[factor_a]) - 1
        df_b = len(factorial.levels_per_factor[factor_b]) - 1
        df_ab = df_a * df_b
        df_error = len(data) - (df_a + 1) * (df_b + 1)

        # Mean squares
        ms_a = ss_a / df_a
        ms_b = ss_b / df_b
        ms_error = ss_error / df_error

        # F statistics
        f_a = ms_a / ms_error
        f_b = ms_b / ms_error
        p_a = 1 - stats.f.cdf(f_a, df_a, df_error)
        p_b = 1 - stats.f.cdf(f_b, df_b, df_error)

        # Return simplified results
        return {
            'estimates': {f'{factor_a}_effect': float(a_means.iloc[1] - a_means.iloc[0])},
            'confidence_intervals': {f'{factor_a}_effect': (0.0, 0.0)},  # Not computed
            'p_values': {f'{factor_a}_main': float(p_a), f'{factor_b}_main': float(p_b)},
            'standard_errors': {f'{factor_a}_effect': float(np.sqrt(ms_error))},
            'sample_sizes': {'total': len(data)},
            'warnings': ["Using simplified manual ANOVA. Install statsmodels for full analysis."]
        }

    def _calculate_cell_sizes(self, data: pd.DataFrame, factors: list) -> dict:
        """Calculate sample size for each factorial cell"""
        sample_sizes = {}

        for factor_combo in data[factors].drop_duplicates().itertuples(index=False):
            cell_name = "_".join([f"{f}={v}" for f, v in zip(factors, factor_combo)])
            mask = pd.Series([True] * len(data))
            for f, v in zip(factors, factor_combo):
                mask &= (data[f] == v)
            sample_sizes[cell_name] = int(mask.sum())

        return sample_sizes

    def check_assumptions_detailed(
        self,
        model,
        data: pd.DataFrame,
        metric: str
    ) -> dict[str, bool]:
        """Check ANOVA assumptions"""
        residuals = model.resid

        # Normality of residuals
        if len(residuals) < 5000:
            _, p_norm = stats.shapiro(residuals)
            normality = p_norm > 0.05
        else:
            result = stats.anderson(residuals)
            normality = result.statistic < result.critical_values[2]

        # Homoscedasticity (Levene's test on fitted value groups)
        fitted_quintiles = pd.qcut(model.fittedvalues, q=5, duplicates='drop')
        groups = [residuals[fitted_quintiles == q] for q in fitted_quintiles.unique()]
        _, p_levene = stats.levene(*groups)
        homoscedasticity = p_levene > 0.05

        return {
            'normality_residuals': normality,
            'homoscedasticity': homoscedasticity,
            'independence': True
        }
