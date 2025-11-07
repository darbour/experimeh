"""
Experimeh Plugin Framework

A flexible, production-ready plugin system for statistical analysis of experiments.
Enables data scientists to implement custom analysis methods in Python while
integrating seamlessly with the TypeScript experimentation platform.

Features:
- Support for complex experimental designs (factorial, stepped wedge, switchback, geo)
- Rich experimental context with temporal, spatial, and hierarchical structures
- Comprehensive statistical utilities and testing framework
- Security sandboxing and resource limits
- Automatic validation and assumption checking

Example:
    from experimeh_plugins import AnalysisPlugin, analysis_plugin
    from experimeh_plugins import ExperimentalContext, AnalysisConfig, AnalysisResult

    @analysis_plugin(
        name="my_test",
        version="1.0.0",
        author="Data Science Team",
        description="Custom t-test implementation",
        design_types=["ab"],
        required_metrics=["metric"]
    )
    class MyTTest(AnalysisPlugin):
        def analyze(self, context, config):
            # Implementation
            return AnalysisResult(...)
"""

__version__ = "1.0.0"

from .base import (
    PluginMetadata,
    PluginCapabilities,
    AnalysisConfig,
    AnalysisResult,
    AnalysisPlugin,
)

from .decorators import (
    analysis_plugin,
    get_plugin,
    list_plugins,
)

from .experimental_context import (
    ExperimentalContext,
    ExperimentalDesign,
    TemporalStructure,
    SpatialStructure,
    ClusterStructure,
    FactorialStructure,
    WithinSubjectsStructure,
    SteppedWedgeStructure,
    MetricSpecification,
)

__all__ = [
    # Core classes
    "AnalysisPlugin",
    "PluginMetadata",
    "PluginCapabilities",
    "AnalysisConfig",
    "AnalysisResult",

    # Context
    "ExperimentalContext",
    "ExperimentalDesign",
    "TemporalStructure",
    "SpatialStructure",
    "ClusterStructure",
    "FactorialStructure",
    "WithinSubjectsStructure",
    "SteppedWedgeStructure",
    "MetricSpecification",

    # Decorators
    "analysis_plugin",
    "get_plugin",
    "list_plugins",
]
