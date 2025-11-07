"""
Statistical Utilities

Provides common statistical methods and tests for plugin development.
Includes frequentist tests, power analysis, assumption checking, and more.

References:
- Welch, B. L. (1947). "The generalization of Student's problem"
- Levene, H. (1960). "Robust tests for equality of variances"
- Shapiro, S. S., & Wilk, M. B. (1965). "An analysis of variance test for normality"
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Tuple, Optional, List, Callable
import warnings


class StatisticalTests:
    """Common statistical test implementations

    Provides robust implementations of standard statistical tests
    used in experimental analysis.
    """

    @staticmethod
    def welch_ttest(
        control: np.ndarray,
        treatment: np.ndarray,
        alpha: float = 0.05
    ) -> Dict[str, any]:
        """Welch's t-test for unequal variances

        More robust than Student's t-test when variances are unequal.
        Uses Welch-Satterthwaite equation for degrees of freedom.

        Args:
            control: Control group observations
            treatment: Treatment group observations
            alpha: Significance level

        Returns:
            Dictionary with estimate, p-value, CI, SE, DF, t-statistic

        References:
            Welch, B. L. (1947). The generalization of "Student's" problem
        """
        # Sample statistics
        n1, n2 = len(control), len(treatment)
        mean1, mean2 = np.mean(control), np.mean(treatment)
        var1, var2 = np.var(control, ddof=1), np.var(treatment, ddof=1)

        # Mean difference
        mean_diff = mean2 - mean1

        # Standard error of difference
        se_diff = np.sqrt(var1 / n1 + var2 / n2)

        # Welch's t-statistic
        t_stat = mean_diff / se_diff

        # Welch-Satterthwaite degrees of freedom
        df = (var1 / n1 + var2 / n2) ** 2 / (
            (var1 / n1) ** 2 / (n1 - 1) +
            (var2 / n2) ** 2 / (n2 - 1)
        )

        # Two-sided p-value
        p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df))

        # Confidence interval
        t_crit = stats.t.ppf(1 - alpha / 2, df)
        ci_lower = mean_diff - t_crit * se_diff
        ci_upper = mean_diff + t_crit * se_diff

        return {
            'estimate': mean_diff,
            'p_value': p_value,
            'confidence_interval': (ci_lower, ci_upper),
            'standard_error': se_diff,
            'degrees_of_freedom': df,
            't_statistic': t_stat,
            'mean_control': mean1,
            'mean_treatment': mean2,
            'var_control': var1,
            'var_treatment': var2
        }

    @staticmethod
    def check_normality(
        data: np.ndarray,
        method: str = 'shapiro'
    ) -> Tuple[bool, float]:
        """Test for normality

        Uses Shapiro-Wilk test for small samples (<5000),
        Kolmogorov-Smirnov for large samples.

        Args:
            data: Data to test
            method: 'shapiro', 'ks', or 'anderson'

        Returns:
            (is_normal, p_value)

        References:
            Shapiro, S. S., & Wilk, M. B. (1965)
        """
        if len(data) < 3:
            return False, np.nan

        if method == 'shapiro' and len(data) <= 5000:
            stat, p_value = stats.shapiro(data)
            return p_value > 0.05, p_value
        elif method == 'ks':
            # Kolmogorov-Smirnov test
            stat, p_value = stats.kstest(
                data,
                'norm',
                args=(np.mean(data), np.std(data, ddof=1))
            )
            return p_value > 0.05, p_value
        elif method == 'anderson':
            result = stats.anderson(data, dist='norm')
            # Use 5% significance level (index 2)
            is_normal = result.statistic < result.critical_values[2]
            return is_normal, result.statistic  # Return statistic instead of p-value
        else:
            # Default to Shapiro-Wilk for small samples
            if len(data) <= 5000:
                stat, p_value = stats.shapiro(data)
            else:
                # Use KS test for large samples
                stat, p_value = stats.kstest(
                    data,
                    'norm',
                    args=(np.mean(data), np.std(data, ddof=1))
                )
            return p_value > 0.05, p_value

    @staticmethod
    def check_equal_variance(
        *groups: np.ndarray,
        method: str = 'levene'
    ) -> Tuple[bool, float]:
        """Test for equal variances across groups

        Args:
            *groups: Variable number of groups to compare
            method: 'levene', 'bartlett', or 'fligner'

        Returns:
            (equal_variances, p_value)

        References:
            Levene, H. (1960). Robust tests for equality of variances
        """
        if len(groups) < 2:
            raise ValueError("Need at least 2 groups")

        if method == 'levene':
            stat, p_value = stats.levene(*groups)
        elif method == 'bartlett':
            stat, p_value = stats.bartlett(*groups)
        elif method == 'fligner':
            stat, p_value = stats.fligner(*groups)
        else:
            raise ValueError(f"Unknown method: {method}")

        return p_value > 0.05, p_value

    @staticmethod
    def bootstrap_ci(
        data: np.ndarray,
        statistic: Callable[[np.ndarray], float],
        n_iterations: int = 10000,
        alpha: float = 0.05,
        method: str = 'percentile'
    ) -> Tuple[float, float]:
        """Bootstrap confidence interval

        Args:
            data: Original data
            statistic: Function to compute statistic (e.g., np.mean)
            n_iterations: Number of bootstrap samples
            alpha: Significance level
            method: 'percentile' or 'bca' (bias-corrected accelerated)

        Returns:
            (lower_bound, upper_bound)

        References:
            Efron, B., & Tibshirani, R. J. (1994). An Introduction to the Bootstrap
        """
        bootstrap_stats = []
        n = len(data)

        for _ in range(n_iterations):
            sample = np.random.choice(data, size=n, replace=True)
            bootstrap_stats.append(statistic(sample))

        bootstrap_stats = np.array(bootstrap_stats)

        if method == 'percentile':
            lower = np.percentile(bootstrap_stats, alpha / 2 * 100)
            upper = np.percentile(bootstrap_stats, (1 - alpha / 2) * 100)
        elif method == 'bca':
            # Bias-corrected and accelerated
            # This is a simplified version
            z0 = stats.norm.ppf(np.mean(bootstrap_stats < statistic(data)))

            # Jackknife for acceleration
            jack_stats = []
            for i in range(n):
                jack_sample = np.delete(data, i)
                jack_stats.append(statistic(jack_sample))

            jack_mean = np.mean(jack_stats)
            num = np.sum((jack_mean - jack_stats) ** 3)
            den = 6 * (np.sum((jack_mean - jack_stats) ** 2) ** 1.5)
            a = num / den if den != 0 else 0

            # Adjusted percentiles
            z_alpha = stats.norm.ppf(alpha / 2)
            z_1alpha = stats.norm.ppf(1 - alpha / 2)

            p_lower = stats.norm.cdf(z0 + (z0 + z_alpha) / (1 - a * (z0 + z_alpha)))
            p_upper = stats.norm.cdf(z0 + (z0 + z_1alpha) / (1 - a * (z0 + z_1alpha)))

            lower = np.percentile(bootstrap_stats, p_lower * 100)
            upper = np.percentile(bootstrap_stats, p_upper * 100)
        else:
            raise ValueError(f"Unknown method: {method}")

        return lower, upper


class PowerAnalysis:
    """Power analysis and sample size calculations

    Implements power analysis for common experimental designs.
    """

    @staticmethod
    def two_sample_ttest_power(
        n: int,
        effect_size: float,
        alpha: float = 0.05,
        alternative: str = 'two-sided'
    ) -> float:
        """Calculate power for two-sample t-test

        Args:
            n: Sample size per group
            effect_size: Cohen's d
            alpha: Significance level
            alternative: 'two-sided', 'less', or 'greater'

        Returns:
            Statistical power (0-1)
        """
        try:
            from statsmodels.stats.power import ttest_power
            return ttest_power(
                effect_size,
                nobs=n,
                alpha=alpha,
                alternative=alternative
            )
        except ImportError:
            # Fallback implementation
            warnings.warn("statsmodels not available, using approximation")
            return PowerAnalysis._approximate_ttest_power(n, effect_size, alpha)

    @staticmethod
    def _approximate_ttest_power(
        n: int,
        effect_size: float,
        alpha: float
    ) -> float:
        """Approximate power calculation (fallback)"""
        # Non-centrality parameter
        ncp = effect_size * np.sqrt(n / 2)

        # Critical value
        df = 2 * (n - 1)
        t_crit = stats.t.ppf(1 - alpha / 2, df)

        # Power approximation
        power = 1 - stats.nct.cdf(t_crit, df, ncp) + stats.nct.cdf(-t_crit, df, ncp)

        return power

    @staticmethod
    def two_sample_ttest_sample_size(
        effect_size: float,
        power: float = 0.8,
        alpha: float = 0.05,
        alternative: str = 'two-sided'
    ) -> int:
        """Calculate required sample size for two-sample t-test

        Args:
            effect_size: Cohen's d
            power: Desired power
            alpha: Significance level
            alternative: 'two-sided', 'less', or 'greater'

        Returns:
            Required sample size per group
        """
        try:
            from statsmodels.stats.power import tt_solve_power
            n = tt_solve_power(
                effect_size=effect_size,
                power=power,
                alpha=alpha,
                alternative=alternative
            )
            return int(np.ceil(n))
        except ImportError:
            # Fallback approximation
            warnings.warn("statsmodels not available, using approximation")
            return PowerAnalysis._approximate_ttest_n(effect_size, power, alpha)

    @staticmethod
    def _approximate_ttest_n(
        effect_size: float,
        power: float,
        alpha: float
    ) -> int:
        """Approximate sample size calculation (fallback)"""
        # Simplified formula
        z_alpha = stats.norm.ppf(1 - alpha / 2)
        z_beta = stats.norm.ppf(power)

        n = 2 * ((z_alpha + z_beta) / effect_size) ** 2

        return int(np.ceil(n))


class MixedEffectsUtils:
    """Utilities for mixed effects models

    Helper functions for cluster-randomized and longitudinal designs.
    """

    @staticmethod
    def calculate_icc(
        data: pd.DataFrame,
        cluster_col: str,
        outcome_col: str
    ) -> Dict[str, float]:
        """Calculate intraclass correlation coefficient

        Measures proportion of variance due to clustering.

        Args:
            data: DataFrame with observations
            cluster_col: Column identifying clusters
            outcome_col: Outcome variable column

        Returns:
            Dictionary with ICC, between/within variance

        References:
            Hedges, L. V. (2007). Correcting a significance test for clustering
        """
        # Group by cluster
        cluster_groups = data.groupby(cluster_col)[outcome_col]

        # Cluster means and sizes
        cluster_means = cluster_groups.mean()
        cluster_sizes = cluster_groups.size()

        # Grand mean
        grand_mean = data[outcome_col].mean()

        # Between-cluster sum of squares
        ss_between = sum(
            n * (mean - grand_mean) ** 2
            for mean, n in zip(cluster_means, cluster_sizes)
        )

        # Within-cluster sum of squares
        ss_within = sum(
            ((group - group.mean()) ** 2).sum()
            for _, group in cluster_groups
        )

        # Degrees of freedom
        k = len(cluster_means)  # Number of clusters
        N = len(data)  # Total observations

        # Mean squares
        ms_between = ss_between / (k - 1)
        ms_within = ss_within / (N - k)

        # Average cluster size
        n_bar = N / k

        # ICC formula
        icc = (ms_between - ms_within) / (ms_between + (n_bar - 1) * ms_within)

        # Bound between 0 and 1
        icc = max(0, min(1, icc))

        return {
            'icc': icc,
            'between_cluster_variance': ms_between,
            'within_cluster_variance': ms_within,
            'n_clusters': k,
            'total_n': N,
            'avg_cluster_size': n_bar
        }

    @staticmethod
    def calculate_design_effect(
        icc: float,
        avg_cluster_size: float
    ) -> float:
        """Calculate design effect for clustered data

        Design effect (DEFF) = 1 + (m - 1) * ICC
        where m is average cluster size

        Args:
            icc: Intraclass correlation
            avg_cluster_size: Average observations per cluster

        Returns:
            Design effect (multiplier for variance)

        References:
            Kish, L. (1965). Survey Sampling
        """
        return 1 + (avg_cluster_size - 1) * icc

    @staticmethod
    def effective_sample_size(
        total_n: int,
        design_effect: float
    ) -> float:
        """Calculate effective sample size

        Adjusts sample size for clustering/correlation.

        Args:
            total_n: Total number of observations
            design_effect: Design effect from calculate_design_effect

        Returns:
            Effective sample size
        """
        return total_n / design_effect


class DiagnosticTests:
    """Diagnostic tests for regression assumptions

    Tests for residual diagnostics in regression models.
    """

    @staticmethod
    def durbin_watson(residuals: np.ndarray) -> float:
        """Durbin-Watson test for autocorrelation

        Tests for first-order autocorrelation in residuals.
        Values near 2 indicate no autocorrelation.
        Values < 1 or > 3 indicate substantial autocorrelation.

        Args:
            residuals: Model residuals

        Returns:
            Durbin-Watson statistic (0-4)

        References:
            Durbin, J., & Watson, G. S. (1950)
        """
        diff = np.diff(residuals)
        dw = np.sum(diff ** 2) / np.sum(residuals ** 2)
        return dw

    @staticmethod
    def breusch_pagan_test(
        residuals: np.ndarray,
        exog: np.ndarray
    ) -> Tuple[float, float]:
        """Breusch-Pagan test for heteroscedasticity

        Tests whether variance of residuals depends on predictors.

        Args:
            residuals: Model residuals
            exog: Exogenous variables (design matrix)

        Returns:
            (test_statistic, p_value)

        References:
            Breusch, T. S., & Pagan, A. R. (1979)
        """
        # Squared residuals
        resid_sq = residuals ** 2

        # Regression of squared residuals on exog
        from scipy.linalg import lstsq
        coef, _, _, _ = lstsq(exog, resid_sq)

        fitted = exog @ coef
        ss_explained = np.sum((fitted - np.mean(resid_sq)) ** 2)
        ss_total = np.sum((resid_sq - np.mean(resid_sq)) ** 2)

        # Chi-square test
        lm_statistic = (len(residuals) * ss_explained) / ss_total
        df = exog.shape[1] - 1
        p_value = 1 - stats.chi2.cdf(lm_statistic, df)

        return lm_statistic, p_value
