# Experimeh Plugin Framework

A flexible, production-ready plugin system for statistical analysis of experiments. Enables data scientists to implement custom analysis methods in Python while integrating seamlessly with the TypeScript experimentation platform.

## Features

- **Support for Complex Designs**: Factorial, stepped wedge, switchback, geo, within-subjects, and more
- **Rich Experimental Context**: Temporal, spatial, and hierarchical experimental structures
- **Comprehensive Statistical Utilities**: Power analysis, assumption checking, diagnostic tests
- **Rigorous Testing Framework**: Type I error validation, power analysis, CI coverage tests
- **Production Ready**: Security sandboxing, resource limits, performance monitoring
- **Easy to Use**: Simple decorators and base classes for quick plugin development

## Installation

```bash
cd python
pip install -e .

# With optional dependencies
pip install -e ".[stats,dev]"
```

## Quick Start

### Creating a Simple Plugin

```python
from experimeh_plugins import (
    AnalysisPlugin,
    analysis_plugin,
    PluginMetadata,
    PluginCapabilities,
    ExperimentalContext,
    AnalysisConfig,
    AnalysisResult
)

@analysis_plugin(
    name="my_ttest",
    version="1.0.0",
    author="Data Science Team",
    description="Custom t-test implementation",
    design_types=["ab"],
    required_metrics=["metric"]
)
class MyTTest(AnalysisPlugin):
    def _get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="my_ttest",
            version="1.0.0",
            author="Data Science Team",
            description="Custom t-test",
            supported_design_types=["ab"],
            required_metrics=["metric"]
        )

    def _get_capabilities(self) -> PluginCapabilities:
        return PluginCapabilities(
            supported_design_types={"ab"},
            supported_metric_types={"continuous"}
        )

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        # Your analysis implementation
        from experimeh_plugins.stats_utils import StatisticalTests

        data = context.data
        metric_col = context.metrics[0].column
        treatment_col = context.design.treatment_column

        control = data[data[treatment_col] == context.design.control_value][metric_col]
        treatment = data[data[treatment_col] == context.design.treatment_values[0]][metric_col]

        result = StatisticalTests.welch_ttest(
            control.values,
            treatment.values,
            config.alpha
        )

        return AnalysisResult(
            estimates={'treatment_effect': result['estimate']},
            confidence_intervals={'treatment_effect': result['confidence_interval']},
            p_values={'treatment_effect': result['p_value']},
            standard_errors={'treatment_effect': result['standard_error']},
            method="Welch's t-test",
            sample_sizes={'control': len(control), 'treatment': len(treatment)},
            assumptions_met={},
            warnings=[]
        )
```

### Testing Your Plugin

```python
from experimeh_plugins.testing import PluginTester, DataGenerator

# Basic functionality test
results = PluginTester.test_basic_functionality(MyTTest, verbose=True)
print(results)  # {'instantiation': True, 'metadata': True, ...}

# Type I error rate test
type1_results = PluginTester.test_type1_error_rate(
    MyTTest,
    n_simulations=1000,
    alpha=0.05
)
print(f"Type I error rate: {type1_results['observed_type1_error_rate']:.3f}")

# Statistical power test
power_results = PluginTester.test_statistical_power(
    MyTTest,
    effect_size=0.5,
    sample_size=100,
    n_simulations=1000
)
print(f"Observed power: {power_results['observed_power']:.3f}")
```

## Advanced Usage

### Complex Experimental Designs

#### Factorial Design

```python
from experimeh_plugins import ExperimentalContext, ExperimentalDesign
from experimeh_plugins import FactorialStructure, MetricSpecification

context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="factorial",
        treatment_column="variant",
        control_value="control",
        treatment_values=["treatment"],
        randomization_unit="user_id",
        factorial=FactorialStructure(
            factors=["factor_a", "factor_b"],
            levels_per_factor={
                "factor_a": ["a1", "a2"],
                "factor_b": ["b1", "b2"]
            }
        )
    ),
    metrics=[MetricSpecification(
        name="outcome",
        column="metric",
        metric_type="continuous"
    )],
    data=your_data,
    n_total=len(your_data),
    n_per_treatment={}
)
```

#### Stepped Wedge Design

```python
from experimeh_plugins import SteppedWedgeStructure

context = ExperimentalContext(
    design=ExperimentalDesign(
        design_type="stepped_wedge",
        treatment_column="treatment",
        control_value="0",
        treatment_values=["1"],
        randomization_unit="cluster_id",
        stepped_wedge=SteppedWedgeStructure(
            cluster_column="cluster_id",
            time_period_column="period",
            rollout_sequence=[
                ["cluster_1", "cluster_2"],  # Wave 1
                ["cluster_3", "cluster_4"],  # Wave 2
                ["cluster_5", "cluster_6"],  # Wave 3
            ],
            n_periods_pre=3,
            n_periods_post=3
        )
    ),
    metrics=[...],
    data=your_data,
    n_total=len(your_data),
    n_per_treatment={}
)
```

### Statistical Utilities

```python
from experimeh_plugins.stats_utils import (
    StatisticalTests,
    PowerAnalysis,
    MixedEffectsUtils
)

# Welch's t-test
result = StatisticalTests.welch_ttest(control, treatment, alpha=0.05)

# Check normality
is_normal, p_value = StatisticalTests.check_normality(data)

# Bootstrap confidence interval
ci = StatisticalTests.bootstrap_ci(
    data,
    statistic=np.mean,
    n_iterations=10000
)

# Power analysis
power = PowerAnalysis.two_sample_ttest_power(
    n=100,
    effect_size=0.5,
    alpha=0.05
)

# Sample size calculation
n_required = PowerAnalysis.two_sample_ttest_sample_size(
    effect_size=0.5,
    power=0.8,
    alpha=0.05
)

# Calculate ICC for clustered data
icc_result = MixedEffectsUtils.calculate_icc(
    data=df,
    cluster_col='cluster_id',
    outcome_col='outcome'
)
print(f"ICC: {icc_result['icc']:.3f}")
```

## Built-in Plugins

### welch_ttest
Welch's t-test for comparing means with unequal variances. Robust alternative to Student's t-test.

- **Designs**: A/B tests
- **Metrics**: Continuous
- **Assumptions**: Independent observations, approximately normal (or large n)

### factorial_anova
Factorial ANOVA with interaction effects using Type III sums of squares.

- **Designs**: Factorial, multivariate
- **Metrics**: Continuous
- **Assumptions**: Normality, homoscedasticity, independence

## API Reference

See [API Documentation](docs/plugins/api/) for complete API reference.

## Best Practices

1. **Always validate context**: Call `self.validate_context()` at the start of `analyze()`
2. **Check assumptions**: Implement `check_assumptions()` to verify statistical requirements
3. **Provide warnings**: Alert users to potential issues with data or results
4. **Test rigorously**: Use `PluginTester` to validate statistical properties
5. **Document thoroughly**: Include references, assumptions, and limitations
6. **Handle edge cases**: Check for small samples, missing data, outliers

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=experimeh_plugins --cov-report=html

# Run specific test
pytest tests/test_welch_ttest.py -v
```

## Contributing

1. Create a new plugin in `plugins/custom/`
2. Implement required methods (`_get_metadata`, `_get_capabilities`, `analyze`)
3. Add comprehensive tests
4. Document assumptions and references
5. Submit a pull request

## License

MIT

## References

- Kohavi, R., Tang, D., & Xu, Y. (2020). "Trustworthy Online Controlled Experiments"
- Montgomery, D. C. (2017). "Design and Analysis of Experiments"
- Gelman, A., et al. (2013). "Bayesian Data Analysis"
