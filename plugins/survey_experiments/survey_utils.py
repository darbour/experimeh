"""
Survey Experiment Utility Functions

Specialized utilities for analyzing survey experiments:
- Response quality checks
- Bias detection
- Attention check validation
- Balance verification
- Survey-specific diagnostics

References:
- Krosnick, J. A. (1999). "Survey research"
- Tourangeau, R., et al. (2000). "The Psychology of Survey Response"
- Oppenheimer, D. M., et al. (2009). "Instructional manipulation checks"
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, List, Tuple, Optional, Any
import warnings


class SurveyQualityChecks:
    """Quality checks for survey responses"""

    @staticmethod
    def check_straightlining(
        data: pd.DataFrame,
        rating_columns: List[str],
        respondent_col: str,
        threshold: float = 0.8
    ) -> Dict[str, Any]:
        """
        Detect straightlining (respondents giving same answer repeatedly)

        Straightlining indicates low engagement or satisficing behavior.

        Args:
            data: Survey data
            rating_columns: Columns containing ratings/responses
            respondent_col: Column identifying respondents
            threshold: Proportion of same responses to flag (default 0.8)

        Returns:
            Dictionary with straightlining analysis
        """
        straightline_flags = []
        straightline_rates = []

        for respondent_id in data[respondent_col].unique():
            respondent_data = data[data[respondent_col] == respondent_id]

            # Get responses across rating columns
            responses = respondent_data[rating_columns].values.flatten()
            responses = responses[~pd.isna(responses)]

            if len(responses) > 0:
                # Check if most responses are the same
                most_common = stats.mode(responses, keepdims=True)[0][0]
                rate = np.mean(responses == most_common)

                straightline_rates.append(rate)
                if rate >= threshold:
                    straightline_flags.append(respondent_id)

        return {
            'n_straightliners': len(straightline_flags),
            'pct_straightliners': len(straightline_flags) / len(data[respondent_col].unique()),
            'flagged_respondents': straightline_flags,
            'avg_straightline_rate': np.mean(straightline_rates) if straightline_rates else 0,
            'threshold': threshold
        }

    @staticmethod
    def check_speeding(
        data: pd.DataFrame,
        duration_col: str,
        respondent_col: str,
        threshold_percentile: float = 10
    ) -> Dict[str, Any]:
        """
        Detect speeders (respondents completing survey too quickly)

        Fast completion may indicate low quality responses.

        Args:
            data: Survey data
            duration_col: Column containing response time/duration
            respondent_col: Column identifying respondents
            threshold_percentile: Percentile below which to flag (default 10)

        Returns:
            Dictionary with speeding analysis
        """
        # Calculate duration per respondent
        durations = data.groupby(respondent_col)[duration_col].sum()

        # Calculate threshold
        threshold_value = np.percentile(durations, threshold_percentile)

        # Flag speeders
        speeders = durations[durations < threshold_value].index.tolist()

        return {
            'n_speeders': len(speeders),
            'pct_speeders': len(speeders) / len(durations),
            'flagged_respondents': speeders,
            'threshold_seconds': threshold_value,
            'median_duration': durations.median(),
            'mean_duration': durations.mean()
        }

    @staticmethod
    def validate_attention_checks(
        data: pd.DataFrame,
        attention_col: str,
        correct_answer: Any,
        respondent_col: str
    ) -> Dict[str, Any]:
        """
        Validate attention check questions

        Attention checks ensure respondents are paying attention.

        Args:
            data: Survey data
            attention_col: Column containing attention check response
            correct_answer: The correct answer to the attention check
            respondent_col: Column identifying respondents

        Returns:
            Dictionary with attention check validation
        """
        # Check attention by respondent
        attention_by_respondent = data.groupby(respondent_col)[attention_col].first()

        # Calculate pass rate
        passed = attention_by_respondent == correct_answer
        failed_respondents = attention_by_respondent[~passed].index.tolist()

        return {
            'n_failed': len(failed_respondents),
            'pct_failed': len(failed_respondents) / len(attention_by_respondent),
            'failed_respondents': failed_respondents,
            'pass_rate': passed.mean(),
            'correct_answer': correct_answer
        }

    @staticmethod
    def check_response_variance(
        data: pd.DataFrame,
        rating_columns: List[str],
        respondent_col: str,
        min_variance: float = 0.1
    ) -> Dict[str, Any]:
        """
        Check for low variance in responses (another satisficing indicator)

        Low variance suggests respondent is not differentiating items.

        Args:
            data: Survey data
            rating_columns: Columns containing ratings
            respondent_col: Column identifying respondents
            min_variance: Minimum acceptable variance

        Returns:
            Dictionary with variance analysis
        """
        low_variance_respondents = []
        variances = []

        for respondent_id in data[respondent_col].unique():
            respondent_data = data[data[respondent_col] == respondent_id]

            # Calculate variance across ratings
            responses = respondent_data[rating_columns].values.flatten()
            responses = responses[~pd.isna(responses)]

            if len(responses) > 1:
                variance = np.var(responses)
                variances.append(variance)

                if variance < min_variance:
                    low_variance_respondents.append(respondent_id)

        return {
            'n_low_variance': len(low_variance_respondents),
            'pct_low_variance': len(low_variance_respondents) / len(data[respondent_col].unique()),
            'flagged_respondents': low_variance_respondents,
            'avg_variance': np.mean(variances) if variances else 0,
            'min_variance_threshold': min_variance
        }


class SurveyBiasDetection:
    """Detect various biases in survey responses"""

    @staticmethod
    def check_order_bias(
        data: pd.DataFrame,
        rating_col: str,
        order_col: str,
        item_col: str
    ) -> Dict[str, Any]:
        """
        Check for order/position bias

        Tests whether items shown earlier/later receive different ratings.

        Args:
            data: Survey data
            rating_col: Column containing ratings
            order_col: Column containing presentation order
            item_col: Column identifying items

        Returns:
            Dictionary with order bias analysis
        """
        # Calculate average rating by position
        order_means = data.groupby(order_col)[rating_col].mean()

        # Test for linear trend in order
        orders = order_means.index.values
        ratings = order_means.values

        if len(orders) > 2:
            # Spearman correlation
            corr, p_value = stats.spearmanr(orders, ratings)

            # Linear regression
            slope, intercept, r_value, reg_p_value, std_err = stats.linregress(orders, ratings)

            return {
                'order_bias_detected': p_value < 0.05,
                'spearman_correlation': corr,
                'p_value': p_value,
                'linear_slope': slope,
                'linear_p_value': reg_p_value,
                'interpretation': (
                    'Ratings change with position' if p_value < 0.05
                    else 'No significant order bias'
                ),
                'direction': (
                    'Decrease over time' if slope < 0
                    else 'Increase over time' if slope > 0
                    else 'No trend'
                )
            }
        else:
            return {
                'order_bias_detected': False,
                'reason': 'Insufficient order variation'
            }

    @staticmethod
    def check_response_scale_bias(
        data: pd.DataFrame,
        rating_col: str,
        scale_min: int = 1,
        scale_max: int = 5
    ) -> Dict[str, Any]:
        """
        Check for response scale biases (e.g., tendency to avoid extremes)

        Args:
            data: Survey data
            rating_col: Column containing ratings
            scale_min: Minimum scale value
            scale_max: Maximum scale value

        Returns:
            Dictionary with scale bias analysis
        """
        ratings = data[rating_col].dropna()

        # Calculate usage of each scale point
        scale_usage = ratings.value_counts(normalize=True).sort_index()

        # Check for extreme avoidance
        extremes_usage = 0
        midpoint_usage = 0

        if scale_min in scale_usage.index:
            extremes_usage += scale_usage[scale_min]
        if scale_max in scale_usage.index:
            extremes_usage += scale_usage[scale_max]

        midpoint = (scale_min + scale_max) / 2
        for val in scale_usage.index:
            if abs(val - midpoint) <= 0.5:
                midpoint_usage += scale_usage[val]

        # Test if distribution is uniform
        expected_freq = 1 / (scale_max - scale_min + 1)
        observed_freq = scale_usage.values
        expected = [expected_freq] * len(observed_freq)

        if len(observed_freq) > 1:
            chi2, p_value = stats.chisquare(observed_freq, expected)
        else:
            chi2, p_value = 0, 1

        return {
            'extreme_usage': extremes_usage,
            'midpoint_usage': midpoint_usage,
            'extreme_avoidance': extremes_usage < 0.2,  # Less than 20% use extremes
            'midpoint_bias': midpoint_usage > 0.5,  # More than 50% use midpoint
            'chi_square': chi2,
            'p_value': p_value,
            'scale_usage': scale_usage.to_dict(),
            'interpretation': (
                'Non-uniform scale usage' if p_value < 0.05
                else 'Uniform scale usage'
            )
        }

    @staticmethod
    def check_acquiescence_bias(
        data: pd.DataFrame,
        positive_items: List[str],
        negative_items: List[str],
        respondent_col: str
    ) -> Dict[str, Any]:
        """
        Check for acquiescence bias (tendency to agree)

        Compares agreement rates on positive vs reversed items.

        Args:
            data: Survey data
            positive_items: Columns with positively worded items
            negative_items: Columns with negatively worded items (should be reverse-coded)
            respondent_col: Column identifying respondents

        Returns:
            Dictionary with acquiescence bias analysis
        """
        acquiescence_scores = []

        for respondent_id in data[respondent_col].unique():
            respondent_data = data[data[respondent_col] == respondent_id]

            # Calculate mean for positive items
            positive_mean = respondent_data[positive_items].mean().mean()

            # Calculate mean for negative items (higher = more disagreement expected)
            negative_mean = respondent_data[negative_items].mean().mean()

            # Acquiescence score: high on both positive and negative (should be inverse)
            # If someone agrees with both, that's acquiescence
            avg_score = (positive_mean + negative_mean) / 2
            acquiescence_scores.append(avg_score)

        avg_acquiescence = np.mean(acquiescence_scores)

        return {
            'avg_acquiescence_score': avg_acquiescence,
            'high_acquiescence_rate': np.mean([s > 4 for s in acquiescence_scores]),
            'interpretation': (
                'Potential acquiescence bias' if avg_acquiescence > 3.5
                else 'No strong acquiescence bias'
            )
        }


class SurveyBalanceChecks:
    """Balance checks for survey experiments"""

    @staticmethod
    def check_randomization_balance(
        data: pd.DataFrame,
        treatment_col: str,
        covariate_cols: List[str],
        alpha: float = 0.05
    ) -> Dict[str, Any]:
        """
        Check if covariates are balanced across treatment conditions

        Args:
            data: Survey data
            treatment_col: Column containing treatment assignment
            covariate_cols: Columns containing covariates to check
            alpha: Significance level for balance tests

        Returns:
            Dictionary with balance check results
        """
        balance_results = {}
        imbalanced_vars = []

        for covar in covariate_cols:
            # Get groups
            groups = []
            for treatment in data[treatment_col].unique():
                group_data = data[data[treatment_col] == treatment][covar].dropna()
                groups.append(group_data)

            # Perform F-test (ANOVA) for balance
            if len(groups) >= 2 and all(len(g) > 0 for g in groups):
                f_stat, p_value = stats.f_oneway(*groups)

                balanced = p_value > alpha

                # Calculate standardized mean difference for binary case
                if len(groups) == 2:
                    mean_diff = groups[0].mean() - groups[1].mean()
                    pooled_std = np.sqrt(
                        (groups[0].var() + groups[1].var()) / 2
                    )
                    smd = mean_diff / pooled_std if pooled_std > 0 else 0
                else:
                    smd = None

                balance_results[covar] = {
                    'balanced': balanced,
                    'p_value': p_value,
                    'f_statistic': f_stat,
                    'smd': smd
                }

                if not balanced:
                    imbalanced_vars.append(covar)
            else:
                balance_results[covar] = {
                    'balanced': None,
                    'reason': 'Insufficient data for test'
                }

        return {
            'all_balanced': len(imbalanced_vars) == 0,
            'imbalanced_variables': imbalanced_vars,
            'n_imbalanced': len(imbalanced_vars),
            'covariate_results': balance_results
        }

    @staticmethod
    def check_item_randomization(
        data: pd.DataFrame,
        treatment_col: str,
        item_col: str,
        respondent_col: str
    ) -> Dict[str, Any]:
        """
        Check if items are properly randomized across treatments

        Args:
            data: Survey data
            treatment_col: Column containing treatment assignment
            item_col: Column identifying items
            respondent_col: Column identifying respondents

        Returns:
            Dictionary with item randomization check
        """
        # Check if each item appears in both/all conditions
        item_treatment_counts = data.groupby([item_col, treatment_col]).size().unstack(fill_value=0)

        # Check balance for each item
        imbalanced_items = []
        for item in item_treatment_counts.index:
            counts = item_treatment_counts.loc[item]
            # Chi-square test for uniform distribution
            if counts.sum() > 0:
                chi2, p_value = stats.chisquare(counts)
                if p_value < 0.05:
                    imbalanced_items.append(item)

        # Check if each respondent sees balanced treatment distribution
        respondent_treatment_counts = data.groupby(
            [respondent_col, treatment_col]
        ).size().unstack(fill_value=0)

        respondent_balance = []
        for respondent in respondent_treatment_counts.index:
            counts = respondent_treatment_counts.loc[respondent]
            max_count = counts.max()
            min_count = counts.min()
            if min_count > 0:
                ratio = max_count / min_count
                respondent_balance.append(ratio)

        return {
            'all_items_randomized': len(imbalanced_items) == 0,
            'imbalanced_items': imbalanced_items,
            'n_imbalanced_items': len(imbalanced_items),
            'avg_respondent_balance_ratio': np.mean(respondent_balance) if respondent_balance else None,
            'interpretation': (
                'Items properly randomized' if len(imbalanced_items) == 0
                else 'Some items may not be properly randomized'
            )
        }


class SurveyMetrics:
    """Calculate survey-specific metrics"""

    @staticmethod
    def calculate_completion_rate(
        data: pd.DataFrame,
        respondent_col: str,
        expected_responses: int
    ) -> float:
        """
        Calculate survey completion rate

        Args:
            data: Survey data
            respondent_col: Column identifying respondents
            expected_responses: Expected number of responses per respondent

        Returns:
            Average completion rate
        """
        responses_per_respondent = data.groupby(respondent_col).size()
        completion_rates = responses_per_respondent / expected_responses
        return completion_rates.mean()

    @staticmethod
    def calculate_response_quality_score(
        data: pd.DataFrame,
        rating_columns: List[str],
        respondent_col: str,
        duration_col: Optional[str] = None,
        attention_col: Optional[str] = None,
        correct_attention_answer: Optional[Any] = None
    ) -> pd.Series:
        """
        Calculate composite quality score for each respondent

        Combines multiple quality indicators:
        - Response variance
        - Completion rate
        - Duration (if available)
        - Attention check (if available)

        Args:
            data: Survey data
            rating_columns: Columns containing ratings
            respondent_col: Column identifying respondents
            duration_col: Optional column with response duration
            attention_col: Optional column with attention check
            correct_attention_answer: Correct answer for attention check

        Returns:
            Series of quality scores (0-100) per respondent
        """
        quality_scores = {}

        for respondent_id in data[respondent_col].unique():
            respondent_data = data[data[respondent_col] == respondent_id]
            score = 0
            max_score = 0

            # Variance component (0-30 points)
            responses = respondent_data[rating_columns].values.flatten()
            responses = responses[~pd.isna(responses)]
            if len(responses) > 1:
                variance = np.var(responses)
                # Normalize to 0-30 (assuming variance of 2 is good)
                variance_score = min(30, variance * 15)
                score += variance_score
            max_score += 30

            # Completion component (0-30 points)
            expected = len(rating_columns)
            actual = len(responses)
            completion_score = (actual / expected) * 30 if expected > 0 else 0
            score += completion_score
            max_score += 30

            # Duration component (0-20 points) - if available
            if duration_col is not None:
                total_duration = respondent_data[duration_col].sum()
                # Assume 2-10 seconds per question is good
                median_duration = total_duration / max(len(responses), 1)
                if 2 <= median_duration <= 10:
                    duration_score = 20
                elif median_duration < 2:
                    # Too fast - penalize
                    duration_score = max(0, median_duration / 2 * 20)
                else:
                    # Too slow - slight penalty
                    duration_score = max(0, 20 - (median_duration - 10))
                score += duration_score
                max_score += 20

            # Attention check component (0-20 points) - if available
            if attention_col is not None and correct_attention_answer is not None:
                attention_response = respondent_data[attention_col].iloc[0]
                if attention_response == correct_attention_answer:
                    score += 20
                max_score += 20

            # Normalize to 0-100
            quality_scores[respondent_id] = (score / max_score * 100) if max_score > 0 else 0

        return pd.Series(quality_scores)


# Convenience function to run all checks
def run_comprehensive_survey_checks(
    data: pd.DataFrame,
    rating_columns: List[str],
    respondent_col: str,
    treatment_col: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Run comprehensive suite of survey quality and bias checks

    Args:
        data: Survey data
        rating_columns: Columns containing ratings
        respondent_col: Column identifying respondents
        treatment_col: Column containing treatment assignment
        **kwargs: Additional parameters for specific checks

    Returns:
        Dictionary with all check results
    """
    results = {
        'quality_checks': {},
        'bias_checks': {},
        'balance_checks': {}
    }

    # Quality checks
    qc = SurveyQualityChecks()

    results['quality_checks']['straightlining'] = qc.check_straightlining(
        data, rating_columns, respondent_col
    )

    results['quality_checks']['response_variance'] = qc.check_response_variance(
        data, rating_columns, respondent_col
    )

    # Bias checks
    bc = SurveyBiasDetection()

    if 'order_col' in kwargs:
        results['bias_checks']['order_bias'] = bc.check_order_bias(
            data, rating_columns[0], kwargs['order_col'], kwargs.get('item_col', 'item')
        )

    results['bias_checks']['scale_bias'] = bc.check_response_scale_bias(
        data, rating_columns[0]
    )

    # Balance checks
    bal = SurveyBalanceChecks()

    if 'covariate_cols' in kwargs:
        results['balance_checks']['randomization'] = bal.check_randomization_balance(
            data, treatment_col, kwargs['covariate_cols']
        )

    return results
