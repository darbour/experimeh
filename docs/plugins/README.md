# Plugin System Architecture

## Overview

The Experimeh plugin system enables flexible, production-ready statistical analysis through Python plugins that integrate seamlessly with the TypeScript experimentation platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Backend                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           PluginManager                               │  │
│  │  - Discovery  - Validation  - Execution              │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                              │
│  ┌────────────▼─────────────┐  ┌─────────────────────────┐ │
│  │   ContextBuilder          │  │   API Routes            │ │
│  │  - Design mapping         │  │  - /api/plugins         │ │
│  │  - Data transformation    │  │  - Execute, validate    │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
└───────────────┼──────────────────────────────────────────────┘
                │ (IPC: stdio with JSON)
┌───────────────▼──────────────────────────────────────────────┐
│                    Python Runtime                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Plugin Framework (experimeh-plugins)        │  │
│  │  - Base Classes  - Decorators  - Validation          │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                              │
│  ┌────────────▼─────────────┐  ┌─────────────────────────┐ │
│  │   Statistical Utilities   │  │   Testing Framework     │ │
│  │  - Tests, power analysis  │  │  - Validation tools     │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              User Plugin Implementations              │  │
│  │  welch_ttest.py  factorial_anova.py  custom_*.py     │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### Python Side

#### 1. Base Plugin System (`experimeh_plugins/base.py`)
- `AnalysisPlugin`: Abstract base class for all plugins
- `PluginMetadata`: Plugin discovery and documentation
- `PluginCapabilities`: Declarative capabilities system
- `AnalysisConfig`: Standard configuration interface
- `AnalysisResult`: Standardized result format

#### 2. Experimental Context (`experimeh_plugins/experimental_context.py`)
- `ExperimentalContext`: Rich context with design, data, metrics
- `ExperimentalDesign`: Design type and structure
- Design-specific structures:
  - `FactorialStructure`: Multi-factor experiments
  - `SteppedWedgeStructure`: Cluster-randomized stepped wedge
  - `TemporalStructure`: Time-based designs (switchback)
  - `SpatialStructure`: Geographic experiments
  - `ClusterStructure`: Cluster-randomized trials
  - `WithinSubjectsStructure`: Repeated measures

#### 3. Statistical Utilities (`experimeh_plugins/stats_utils.py`)
- `StatisticalTests`: Common tests (t-test, normality, etc.)
- `PowerAnalysis`: Power and sample size calculations
- `MixedEffectsUtils`: ICC, design effects, cluster analysis
- `DiagnosticTests`: Assumption checking, diagnostics

#### 4. Testing Framework (`experimeh_plugins/testing.py`)
- `DataGenerator`: Synthetic data for testing
- `PluginTester`: Comprehensive validation:
  - Type I error rate validation
  - Statistical power validation
  - Confidence interval coverage
  - Basic functionality tests

#### 5. Decorators (`experimeh_plugins/decorators.py`)
- `@analysis_plugin`: Register plugins
- `get_plugin()`: Retrieve plugins by name
- `list_plugins()`: Discover all plugins

### TypeScript Side

#### 1. Plugin Manager (`src/plugins/PluginManager.ts`)
- Plugin discovery and registration
- Validation against experimental design
- Execution with timeout and resource limits
- Performance monitoring and metrics
- Event-driven architecture

#### 2. Context Builder (`src/plugins/ContextBuilder.ts`)
- Transforms TypeScript experiment config to Python context
- Handles design-specific mapping
- Calculates sample sizes and metadata

#### 3. API Routes (`src/api/routes/plugins.ts`)
- `GET /api/plugins`: List all plugins
- `GET /api/plugins/:name`: Get plugin details
- `POST /api/plugins/:name/validate`: Validate compatibility
- `POST /api/plugins/:name/execute`: Execute analysis
- `GET /api/plugins/:name/metrics`: Performance metrics

## Plugin Development Workflow

### 1. Create Plugin

```python
# plugins/custom/my_plugin.py

from experimeh_plugins import (
    AnalysisPlugin, analysis_plugin,
    PluginMetadata, PluginCapabilities,
    ExperimentalContext, AnalysisConfig, AnalysisResult
)

@analysis_plugin(
    name="my_plugin",
    version="1.0.0",
    author="Your Name",
    description="Description",
    design_types=["ab"],
    required_metrics=["metric"]
)
class MyPlugin(AnalysisPlugin):
    def _get_metadata(self) -> PluginMetadata:
        # Return metadata

    def _get_capabilities(self) -> PluginCapabilities:
        # Declare capabilities

    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        # Implement analysis
```

### 2. Test Plugin

```python
from experimeh_plugins.testing import PluginTester

# Basic tests
PluginTester.test_basic_functionality(MyPlugin, verbose=True)

# Statistical validation
PluginTester.test_type1_error_rate(MyPlugin, n_simulations=1000)
PluginTester.test_statistical_power(MyPlugin, effect_size=0.5, sample_size=100)
PluginTester.test_confidence_interval_coverage(MyPlugin, true_effect=0.5, sample_size=100)
```

### 3. Register and Use

The plugin is automatically discovered via the `@analysis_plugin` decorator.

TypeScript usage:
```typescript
import { PluginManager } from './plugins';

const pluginManager = new PluginManager(config, logger);
await pluginManager.discoverPlugins();

// Validate
const validation = pluginManager.validatePluginForExperiment(
    'my_plugin',
    'ab',
    ['metric']
);

// Execute
const result = await pluginManager.executePlugin({
    pluginName: 'my_plugin',
    data: experimentData,
    config: { alpha: 0.05 }
});
```

## Design Patterns

### 1. Decorator-Based Registration
Plugins register themselves automatically when imported, enabling zero-configuration discovery.

### 2. Rich Context Objects
Comprehensive experimental context eliminates ambiguity and enables proper statistical methods.

### 3. Declarative Capabilities
Plugins declare what they support upfront, enabling validation before execution.

### 4. Standardized Results
All plugins return results in the same format, ensuring interoperability.

### 5. Comprehensive Testing
Built-in testing framework validates statistical correctness through simulation.

## Security Considerations

### 1. Sandboxing
- Resource limits (memory, CPU, timeout)
- No network access by default
- Restricted file system access

### 2. Validation
- Input validation via Pydantic
- Plugin code scanning for dangerous operations
- Metadata validation

### 3. Monitoring
- Execution metrics tracking
- Performance monitoring
- Error logging

## Performance Optimization

### 1. Caching
- Plugin discovery results cached
- Pre-computed statistics passed in context

### 2. Parallel Execution
- Multiple plugins can run concurrently
- Parallelizable plugins declare capability

### 3. Streaming Support
- Plugins can declare streaming support
- Incremental analysis for large datasets

## Extension Points

### 1. New Design Types
Add new experimental designs by:
1. Creating design structure in `experimental_context.py`
2. Updating `ContextBuilder` to map from Experiment config
3. Implementing plugin for the design

### 2. New Statistical Methods
Add new tests to `stats_utils.py` or create custom utilities in plugins.

### 3. New Validation Tests
Extend `PluginTester` with new validation methods.

## Best Practices

### For Plugin Authors

1. **Validate rigorously**: Check all assumptions and edge cases
2. **Test thoroughly**: Use PluginTester for statistical validation
3. **Document completely**: Include references, assumptions, limitations
4. **Handle errors gracefully**: Provide clear error messages
5. **Warn appropriately**: Alert users to potential issues

### For Platform Developers

1. **Validate before execution**: Always validate plugin compatibility
2. **Set resource limits**: Prevent runaway processes
3. **Monitor performance**: Track execution metrics
4. **Cache results**: Avoid redundant computation
5. **Handle failures**: Graceful degradation and error recovery

## Troubleshooting

### Plugin Not Discovered
- Check plugin is in configured path
- Verify `@analysis_plugin` decorator used
- Check Python path configuration

### Validation Fails
- Review design type compatibility
- Check required metrics present
- Verify sample size requirements

### Execution Timeout
- Increase timeout configuration
- Check for infinite loops
- Optimize plugin performance

### Statistical Test Failures
- Review Type I error rate (should be ~ alpha)
- Check confidence interval coverage (should be ~ 1-alpha)
- Verify power calculations

## Future Enhancements

1. **Docker Integration**: Full containerization for stronger isolation
2. **Distributed Execution**: Scale across multiple workers
3. **Real-time Streaming**: Live analysis updates
4. **Auto-documentation**: Generate docs from plugin metadata
5. **Version Management**: Support multiple plugin versions simultaneously
6. **Dependency Management**: Automatic dependency resolution

## References

- Montgomery, D. C. (2017). "Design and Analysis of Experiments"
- Kohavi, R., Tang, D., & Xu, Y. (2020). "Trustworthy Online Controlled Experiments"
- Gelman, A., et al. (2013). "Bayesian Data Analysis"
- Hemming, K., et al. (2015). "Stepped-wedge cluster randomised trials"
