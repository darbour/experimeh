"""
Plugin Testing Framework

Provides comprehensive testing utilities for validating plugin implementations.
Ensures statistical correctness, type safety, and robustness.

Features:
- Type I error rate validation
- Statistical power validation
- Confidence interval coverage tests
- Assumption checking validation
- Data generation utilities

References:
- Robins, J. M., et al. (2000). "Sensitivity analysis for selection bias"
- Morris, T. P., et al. (2019). "Using simulation studies to evaluate statistical methods"
"""

import numpy as np
import pandas as pd
from typing import Type, Callable, Dict, List, Tuple, Optional
from .base import AnalysisPlugin, AnalysisConfig, AnalysisResult, PluginMetadata
from .experimental_context import (
    ExperimentalContext, ExperimentalDesign, MetricSpecification,
    FactorialStructure, SteppedWedgeStructure, TemporalStructure, ClusterStructure
)


class DataGenerator:
    """Generate synthetic experimental data for testing

    Provides methods to generate data for various experimental designs
    with known ground truth for validation.
    """

    @staticmethod
    def generate_ab_data(
        n_control: int,
        n_treatment: int,
        effect_size: float = 0.0,
        noise_std: float = 1.0,
        seed: Optional[int] = None
    ) -> pd.DataFrame:
        """Generate synthetic A/B test data

        Args:
            n_control: Control group sample size
            n_treatment: Treatment group sample size
            effect_size: True treatment effect (in standard deviation units)
            noise_std: Standard deviation of noise
            seed: Random seed for reproducibility

        Returns:
            DataFrame with columns: variant, metric, user_id
        """
        if seed is not None:
            np.random.seed(seed)

        # Control group
        control = pd.DataFrame({
            'variant': ['control'] * n_control,
            'metric': np.random.normal(0, noise_std, n_control),
            'user_id': [f'user_c_{i}' for i in range(n_control)]
        })

        # Treatment group with effect
        treatment = pd.DataFrame({
            'variant': ['treatment'] * n_treatment,
            'metric': np.random.normal(effect_size, noise_std, n_treatment),
            'user_id': [f'user_t_{i}' for i in range(n_treatment)]
        })

        return pd.concat([control, treatment], ignore_index=True)

    @staticmethod
    def generate_factorial_data(
        factors: Dict[str, List[str]],
        n_per_cell: int,
        main_effects: Dict[str, float],
        interaction_effect: Optional[float] = None,
        noise_std: float = 1.0,
        seed: Optional[int] = None
    ) -> pd.DataFrame:
        """Generate synthetic factorial design data

        Args:
            factors: Dictionary of factor_name -> [level1, level2, ...]
            n_per_cell: Observations per factorial cell
            main_effects: Dictionary of factor -> effect size
            interaction_effect: Two-way interaction effect
            noise_std: Standard deviation of noise
            seed: Random seed

        Returns:
            DataFrame with factor columns and metric
        """
        if seed is not None:
            np.random.seed(seed)

        # Generate all factorial combinations
        from itertools import product
        factor_names = list(factors.keys())
        factor_levels = [factors[name] for name in factor_names]
        combinations = list(product(*factor_levels))

        data = []
        for combo in combinations:
            # Calculate cell mean based on main effects and interactions
            cell_mean = 0.0

            for i, (factor_name, level) in enumerate(zip(factor_names, combo)):
                # Main effect (if not baseline level)
                if level != factor_levels[i][0]:  # Not baseline
                    cell_mean += main_effects.get(factor_name, 0.0)

            # Interaction effect (for 2-factor design)
            if (interaction_effect is not None and len(factor_names) == 2 and
                combo[0] != factor_levels[0][0] and combo[1] != factor_levels[1][0]):
                cell_mean += interaction_effect

            # Generate observations for this cell
            for _ in range(n_per_cell):
                row = dict(zip(factor_names, combo))
                row['metric'] = np.random.normal(cell_mean, noise_std)
                data.append(row)

        return pd.DataFrame(data)

    @staticmethod
    def generate_stepped_wedge_data(
        n_clusters: int,
        n_periods: int,
        rollout_waves: List[int],  # Number of clusters per wave
        treatment_effect: float,
        time_trend: float = 0.0,
        icc: float = 0.1,
        cluster_size: int = 50,
        seed: Optional[int] = None
    ) -> pd.DataFrame:
        """Generate synthetic stepped wedge data

        Args:
            n_clusters: Total number of clusters
            n_periods: Total number of time periods
            rollout_waves: List of cluster counts per wave
            treatment_effect: Treatment effect size
            time_trend: Secular time trend
            icc: Intraclass correlation coefficient
            cluster_size: Observations per cluster per period
            seed: Random seed

        Returns:
            DataFrame with cluster_id, period, treatment, metric
        """
        if seed is not None:
            np.random.seed(seed)

        # Calculate variance components from ICC
        total_var = 1.0
        between_cluster_var = icc * total_var
        within_cluster_var = (1 - icc) * total_var

        # Generate cluster random effects
        cluster_effects = np.random.normal(0, np.sqrt(between_cluster_var), n_clusters)

        # Assign clusters to waves
        cluster_to_wave = {}
        cluster_idx = 0
        for wave, n_in_wave in enumerate(rollout_waves):
            for _ in range(n_in_wave):
                cluster_to_wave[f'cluster_{cluster_idx}'] = wave + 1
                cluster_idx += 1

        data = []
        for cluster_id, wave in cluster_to_wave.items():
            cluster_idx = int(cluster_id.split('_')[1])
            cluster_effect = cluster_effects[cluster_idx]

            for period in range(n_periods):
                # Treatment starts at wave period
                treatment = 1 if period >= wave else 0

                # Base outcome with time trend
                base_mean = time_trend * period

                # Add treatment effect if treated
                if treatment:
                    base_mean += treatment_effect

                # Add cluster effect
                mean_with_cluster = base_mean + cluster_effect

                # Generate individual observations
                for i in range(cluster_size):
                    outcome = np.random.normal(
                        mean_with_cluster,
                        np.sqrt(within_cluster_var)
                    )

                    data.append({
                        'cluster_id': cluster_id,
                        'period': period,
                        'treatment': treatment,
                        'metric': outcome,
                        'obs_id': f'{cluster_id}_p{period}_i{i}'
                    })

        return pd.DataFrame(data)

    @staticmethod
    def generate_switchback_data(
        n_periods: int,
        period_length: int,  # Observations per period
        treatment_effect: float,
        autocorrelation: float = 0.0,
        noise_std: float = 1.0,
        seed: Optional[int] = None
    ) -> pd.DataFrame:
        """Generate synthetic switchback experiment data

        Args:
            n_periods: Number of switchback periods
            period_length: Observations per period
            treatment_effect: Treatment effect size
            autocorrelation: AR(1) autocorrelation coefficient
            noise_std: Standard deviation of noise
            seed: Random seed

        Returns:
            DataFrame with period, variant, metric, timestamp
        """
        if seed is not None:
            np.random.seed(seed)

        data = []
        prev_error = 0.0

        for period in range(n_periods):
            # Alternate treatment assignment
            variant = 'treatment' if period % 2 == 1 else 'control'
            base_mean = treatment_effect if variant == 'treatment' else 0.0

            for i in range(period_length):
                # AR(1) error term
                error = autocorrelation * prev_error + np.random.normal(0, noise_std)
                prev_error = error

                outcome = base_mean + error

                data.append({
                    'period': period,
                    'variant': variant,
                    'metric': outcome,
                    'timestamp': period * period_length + i
                })

        return pd.DataFrame(data)


class PluginTester:
    """Comprehensive plugin testing utilities

    Validates plugin statistical correctness through simulation.
    """

    @staticmethod
    def test_basic_functionality(
        plugin_class: Type[AnalysisPlugin],
        verbose: bool = False
    ) -> Dict[str, bool]:
        """Basic functionality tests

        Tests:
        1. Plugin instantiation
        2. Metadata completeness
        3. Capabilities declaration
        4. Analysis execution on synthetic data

        Args:
            plugin_class: Plugin class to test
            verbose: Print detailed output

        Returns:
            Dictionary of test_name: passed (bool)
        """
        results = {}

        # Test 1: Instantiation
        try:
            plugin = plugin_class()
            results['instantiation'] = True
            if verbose:
                print(f"✓ Plugin instantiated: {plugin.metadata.name}")
        except Exception as e:
            results['instantiation'] = False
            if verbose:
                print(f"✗ Instantiation failed: {e}")
            return results

        # Test 2: Metadata completeness
        try:
            assert plugin.metadata.name
            assert plugin.metadata.version
            assert plugin.metadata.author
            assert len(plugin.metadata.supported_design_types) > 0
            results['metadata'] = True
            if verbose:
                print(f"✓ Metadata complete")
        except Exception as e:
            results['metadata'] = False
            if verbose:
                print(f"✗ Metadata incomplete: {e}")

        # Test 3: Capabilities
        try:
            assert len(plugin.capabilities.supported_design_types) > 0
            assert len(plugin.capabilities.supported_metric_types) > 0
            results['capabilities'] = True
            if verbose:
                print(f"✓ Capabilities declared")
        except Exception as e:
            results['capabilities'] = False
            if verbose:
                print(f"✗ Capabilities missing: {e}")

        # Test 4: Analysis execution
        try:
            # Generate simple test data
            data = DataGenerator.generate_ab_data(100, 100, effect_size=0.5, seed=42)

            # Create context
            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type='ab',
                    treatment_column='variant',
                    control_value='control',
                    treatment_values=['treatment'],
                    randomization_unit='user_id'
                ),
                metrics=[MetricSpecification(
                    name='outcome',
                    column='metric',
                    metric_type='continuous'
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={'control': 100, 'treatment': 100}
            )

            # Run analysis
            config = AnalysisConfig(alpha=0.05)
            result = plugin.analyze(context, config)

            # Validate result
            assert isinstance(result, AnalysisResult)
            assert len(result.estimates) > 0
            assert len(result.confidence_intervals) > 0
            assert len(result.standard_errors) > 0

            results['analysis_execution'] = True
            if verbose:
                print(f"✓ Analysis executed successfully")
                print(f"  Estimate: {list(result.estimates.values())[0]:.4f}")
                print(f"  P-value: {list(result.p_values.values())[0] if result.p_values else 'N/A'}")
        except Exception as e:
            results['analysis_execution'] = False
            if verbose:
                print(f"✗ Analysis execution failed: {e}")

        return results

    @staticmethod
    def test_type1_error_rate(
        plugin_class: Type[AnalysisPlugin],
        n_simulations: int = 1000,
        alpha: float = 0.05,
        sample_size: int = 100,
        tolerance: float = 0.02,
        verbose: bool = False
    ) -> Dict[str, any]:
        """Test Type I error rate control

        Runs simulations under the null hypothesis (no effect) and
        checks that rejection rate is approximately alpha.

        Args:
            plugin_class: Plugin to test
            n_simulations: Number of simulations
            alpha: Nominal significance level
            sample_size: Sample size per group
            tolerance: Acceptable deviation from alpha
            verbose: Print progress

        Returns:
            Dictionary with results

        References:
            Bradley, J. V. (1978). Robustness?
        """
        plugin = plugin_class()
        config = AnalysisConfig(alpha=alpha)

        rejections = 0

        for i in range(n_simulations):
            if verbose and i % 100 == 0:
                print(f"Simulation {i}/{n_simulations}")

            # Generate data with NO effect (null hypothesis true)
            data = DataGenerator.generate_ab_data(
                sample_size,
                sample_size,
                effect_size=0.0,  # NULL
                seed=i
            )

            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type='ab',
                    treatment_column='variant',
                    control_value='control',
                    treatment_values=['treatment'],
                    randomization_unit='user_id'
                ),
                metrics=[MetricSpecification(
                    name='outcome',
                    column='metric',
                    metric_type='continuous'
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={'control': sample_size, 'treatment': sample_size}
            )

            try:
                result = plugin.analyze(context, config)

                # Check if null hypothesis rejected
                if result.p_values:
                    p_value = list(result.p_values.values())[0]
                    if p_value < alpha:
                        rejections += 1
            except Exception as e:
                if verbose:
                    print(f"Warning: Simulation {i} failed: {e}")
                continue

        observed_rate = rejections / n_simulations
        within_tolerance = abs(observed_rate - alpha) < tolerance

        return {
            'observed_type1_error_rate': observed_rate,
            'expected_rate': alpha,
            'n_simulations': n_simulations,
            'within_tolerance': within_tolerance,
            'tolerance': tolerance,
            'passed': within_tolerance
        }

    @staticmethod
    def test_statistical_power(
        plugin_class: Type[AnalysisPlugin],
        effect_size: float,
        sample_size: int,
        n_simulations: int = 1000,
        alpha: float = 0.05,
        expected_power: Optional[float] = None,
        verbose: bool = False
    ) -> Dict[str, any]:
        """Test statistical power

        Runs simulations with a true effect and measures detection rate.

        Args:
            plugin_class: Plugin to test
            effect_size: True effect size
            sample_size: Sample size per group
            n_simulations: Number of simulations
            alpha: Significance level
            expected_power: Expected power (for comparison)
            verbose: Print progress

        Returns:
            Dictionary with power results
        """
        plugin = plugin_class()
        config = AnalysisConfig(alpha=alpha)

        rejections = 0

        for i in range(n_simulations):
            if verbose and i % 100 == 0:
                print(f"Simulation {i}/{n_simulations}")

            # Generate data WITH effect
            data = DataGenerator.generate_ab_data(
                sample_size,
                sample_size,
                effect_size=effect_size,
                seed=i
            )

            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type='ab',
                    treatment_column='variant',
                    control_value='control',
                    treatment_values=['treatment'],
                    randomization_unit='user_id'
                ),
                metrics=[MetricSpecification(
                    name='outcome',
                    column='metric',
                    metric_type='continuous'
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={'control': sample_size, 'treatment': sample_size}
            )

            try:
                result = plugin.analyze(context, config)

                # Check if null hypothesis rejected
                if result.p_values:
                    p_value = list(result.p_values.values())[0]
                    if p_value < alpha:
                        rejections += 1
            except Exception:
                continue

        observed_power = rejections / n_simulations

        return {
            'observed_power': observed_power,
            'expected_power': expected_power,
            'effect_size': effect_size,
            'sample_size': sample_size,
            'n_simulations': n_simulations,
            'alpha': alpha
        }

    @staticmethod
    def test_confidence_interval_coverage(
        plugin_class: Type[AnalysisPlugin],
        true_effect: float,
        sample_size: int,
        n_simulations: int = 1000,
        alpha: float = 0.05,
        tolerance: float = 0.02,
        verbose: bool = False
    ) -> Dict[str, any]:
        """Test confidence interval coverage

        Checks that (1-alpha)% CIs contain the true effect approximately
        (1-alpha)% of the time.

        Args:
            plugin_class: Plugin to test
            true_effect: True effect size
            sample_size: Sample size per group
            n_simulations: Number of simulations
            alpha: Significance level
            tolerance: Acceptable deviation from nominal coverage
            verbose: Print progress

        Returns:
            Dictionary with coverage results
        """
        plugin = plugin_class()
        config = AnalysisConfig(alpha=alpha)

        coverage_count = 0

        for i in range(n_simulations):
            if verbose and i % 100 == 0:
                print(f"Simulation {i}/{n_simulations}")

            data = DataGenerator.generate_ab_data(
                sample_size,
                sample_size,
                effect_size=true_effect,
                seed=i
            )

            context = ExperimentalContext(
                design=ExperimentalDesign(
                    design_type='ab',
                    treatment_column='variant',
                    control_value='control',
                    treatment_values=['treatment'],
                    randomization_unit='user_id'
                ),
                metrics=[MetricSpecification(
                    name='outcome',
                    column='metric',
                    metric_type='continuous'
                )],
                data=data,
                n_total=len(data),
                n_per_treatment={'control': sample_size, 'treatment': sample_size}
            )

            try:
                result = plugin.analyze(context, config)

                # Check if CI contains true effect
                ci = list(result.confidence_intervals.values())[0]
                if ci[0] <= true_effect <= ci[1]:
                    coverage_count += 1
            except Exception:
                continue

        observed_coverage = coverage_count / n_simulations
        nominal_coverage = 1 - alpha
        within_tolerance = abs(observed_coverage - nominal_coverage) < tolerance

        return {
            'observed_coverage': observed_coverage,
            'nominal_coverage': nominal_coverage,
            'true_effect': true_effect,
            'n_simulations': n_simulations,
            'within_tolerance': within_tolerance,
            'tolerance': tolerance,
            'passed': within_tolerance
        }
