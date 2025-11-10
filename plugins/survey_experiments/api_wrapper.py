#!/usr/bin/env python3
"""
API Wrapper for Survey Experiments Plugins

Provides a command-line interface for running survey experiments analysis
from Node.js backend. Accepts JSON configuration and returns JSON results.

Usage:
    python api_wrapper.py --type paired_comparison --data data.csv --config config.json
    python api_wrapper.py --type multi_item --data data.csv --config config.json
    python api_wrapper.py --type quality_checks --data data.csv --config config.json
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../python'))

import argparse
import json
import pandas as pd
import numpy as np
from typing import Dict, Any

from experimeh_plugins import (
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig,
    WithinSubjectsStructure,
    ClusterStructure
)

from survey_experiments import (
    PairedComparisonSurvey,
    MultiItemSurvey,
    SurveyQualityChecks,
    SurveyBiasDetection,
    SurveyBalanceChecks,
    run_comprehensive_survey_checks
)


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for numpy types"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        return super().default(obj)


def load_data(data_path: str) -> pd.DataFrame:
    """Load survey data from CSV or JSON"""
    if data_path.endswith('.csv'):
        return pd.read_csv(data_path)
    elif data_path.endswith('.json'):
        return pd.read_json(data_path)
    else:
        raise ValueError(f"Unsupported file format: {data_path}")


def run_paired_comparison(data: pd.DataFrame, config: Dict[str, Any]) -> Dict[str, Any]:
    """Run paired comparison analysis"""
    # Extract configuration
    subject_col = config.get('subject_column', 'respondent_id')
    condition_col = config.get('condition_column', 'condition')
    metric_col = config.get('metric_column', 'rating')
    control_value = config.get('control_value', 'control')
    treatment_value = config.get('treatment_value', 'treatment')
    order_col = config.get('order_column')
    alpha = config.get('alpha', 0.05)

    # Create experimental context
    within_subjects = WithinSubjectsStructure(
        subject_column=subject_col,
        condition_column=condition_col,
        order_column=order_col
    )

    # Count respondents
    n_respondents = data[subject_col].nunique()

    context = ExperimentalContext(
        design=ExperimentalDesign(
            design_type="within_subjects",
            treatment_column=condition_col,
            control_value=control_value,
            treatment_values=[treatment_value],
            randomization_unit=subject_col,
            within_subjects=within_subjects
        ),
        metrics=[MetricSpecification(
            name=metric_col,
            column=metric_col,
            metric_type="continuous"
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={
            control_value: n_respondents,
            treatment_value: n_respondents
        }
    )

    # Run analysis
    plugin = PairedComparisonSurvey()
    analysis_config = AnalysisConfig(alpha=alpha)
    result = plugin.analyze(context, analysis_config)

    # Convert to dict
    return {
        'method': result.method,
        'estimates': result.estimates,
        'confidence_intervals': {
            k: list(v) for k, v in result.confidence_intervals.items()
        },
        'p_values': result.p_values,
        'standard_errors': result.standard_errors,
        'sample_sizes': result.sample_sizes,
        'effect_sizes': result.effect_sizes,
        'assumptions_met': result.assumptions_met,
        'warnings': result.warnings,
        'residual_diagnostics': result.residual_diagnostics,
        'temporal_effects': result.temporal_effects
    }


def run_multi_item(data: pd.DataFrame, config: Dict[str, Any]) -> Dict[str, Any]:
    """Run multi-item survey analysis"""
    # Extract configuration
    respondent_col = config.get('respondent_column', 'respondent_id')
    item_col = config.get('item_column', 'item_id')
    treatment_col = config.get('treatment_column', 'treatment')
    metric_col = config.get('metric_column', 'rating')
    control_value = config.get('control_value', 'control')
    treatment_value = config.get('treatment_value', 'treatment')
    alpha = config.get('alpha', 0.05)

    # Create experimental context
    cluster = ClusterStructure(
        cluster_column=respondent_col,
        cluster_level='respondent'
    )

    context = ExperimentalContext(
        design=ExperimentalDesign(
            design_type="cluster_randomized",
            treatment_column=treatment_col,
            control_value=control_value,
            treatment_values=[treatment_value],
            randomization_unit=item_col,
            cluster=cluster
        ),
        metrics=[MetricSpecification(
            name=metric_col,
            column=metric_col,
            metric_type="continuous"
        )],
        data=data,
        n_total=len(data),
        n_per_treatment={
            control_value: len(data[data[treatment_col] == control_value]),
            treatment_value: len(data[data[treatment_col] == treatment_value])
        }
    )

    # Run analysis
    plugin = MultiItemSurvey()
    analysis_config = AnalysisConfig(alpha=alpha)
    result = plugin.analyze(context, analysis_config)

    # Convert to dict
    return {
        'method': result.method,
        'estimates': result.estimates,
        'confidence_intervals': {
            k: list(v) for k, v in result.confidence_intervals.items()
        },
        'p_values': result.p_values,
        'standard_errors': result.standard_errors,
        'sample_sizes': result.sample_sizes,
        'effective_sample_size': result.effective_sample_size,
        'effect_sizes': result.effect_sizes,
        'assumptions_met': result.assumptions_met,
        'warnings': result.warnings,
        'residual_diagnostics': result.residual_diagnostics,
        'random_effects': result.random_effects
    }


def run_quality_checks(data: pd.DataFrame, config: Dict[str, Any]) -> Dict[str, Any]:
    """Run quality checks on survey data"""
    qc = SurveyQualityChecks()
    bc = SurveyBiasDetection()
    bal = SurveyBalanceChecks()

    respondent_col = config.get('respondent_column', 'respondent_id')
    rating_cols = config.get('rating_columns', ['rating'])
    duration_col = config.get('duration_column')
    attention_col = config.get('attention_column')
    attention_answer = config.get('attention_correct_answer')
    order_col = config.get('order_column')
    treatment_col = config.get('treatment_column')

    results = {
        'quality_checks': {},
        'bias_checks': {},
        'balance_checks': {}
    }

    # Straightlining
    try:
        results['quality_checks']['straightlining'] = qc.check_straightlining(
            data, rating_cols, respondent_col
        )
    except Exception as e:
        results['quality_checks']['straightlining'] = {'error': str(e)}

    # Response variance
    try:
        results['quality_checks']['response_variance'] = qc.check_response_variance(
            data, rating_cols, respondent_col
        )
    except Exception as e:
        results['quality_checks']['response_variance'] = {'error': str(e)}

    # Speeding
    if duration_col and duration_col in data.columns:
        try:
            results['quality_checks']['speeding'] = qc.check_speeding(
                data, duration_col, respondent_col
            )
        except Exception as e:
            results['quality_checks']['speeding'] = {'error': str(e)}

    # Attention checks
    if attention_col and attention_col in data.columns and attention_answer:
        try:
            results['quality_checks']['attention'] = qc.validate_attention_checks(
                data, attention_col, attention_answer, respondent_col
            )
        except Exception as e:
            results['quality_checks']['attention'] = {'error': str(e)}

    # Order bias
    if order_col and order_col in data.columns:
        try:
            results['bias_checks']['order_bias'] = bc.check_order_bias(
                data, rating_cols[0], order_col, respondent_col
            )
        except Exception as e:
            results['bias_checks']['order_bias'] = {'error': str(e)}

    # Scale bias
    try:
        results['bias_checks']['scale_bias'] = bc.check_response_scale_bias(
            data, rating_cols[0]
        )
    except Exception as e:
        results['bias_checks']['scale_bias'] = {'error': str(e)}

    # Randomization balance
    if treatment_col and treatment_col in data.columns:
        covariate_cols = config.get('covariate_columns', [])
        if covariate_cols:
            try:
                # Get unique respondents
                respondent_data = data.groupby(respondent_col).first().reset_index()
                results['balance_checks']['randomization'] = bal.check_randomization_balance(
                    respondent_data, treatment_col, covariate_cols
                )
            except Exception as e:
                results['balance_checks']['randomization'] = {'error': str(e)}

    return results


def main():
    parser = argparse.ArgumentParser(description='Survey Experiments API Wrapper')
    parser.add_argument('--type', required=True,
                        choices=['paired_comparison', 'multi_item', 'quality_checks'],
                        help='Analysis type')
    parser.add_argument('--data', required=True, help='Path to data file (CSV or JSON)')
    parser.add_argument('--config', required=True, help='Configuration JSON string')

    args = parser.parse_args()

    try:
        # Load data
        data = load_data(args.data)

        # Parse config
        config = json.loads(args.config)

        # Run analysis
        if args.type == 'paired_comparison':
            results = run_paired_comparison(data, config)
        elif args.type == 'multi_item':
            results = run_multi_item(data, config)
        elif args.type == 'quality_checks':
            results = run_quality_checks(data, config)
        else:
            raise ValueError(f"Unknown analysis type: {args.type}")

        # Output results as JSON
        print(json.dumps({
            'success': True,
            'results': results
        }, cls=NumpyEncoder))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'type': type(e).__name__
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
