"""
Base Plugin Classes

Defines the core plugin interface and result structures for the
experimeh plugin system. All analysis plugins must inherit from
AnalysisPlugin and implement the required methods.

Design Principles:
1. Type safety with Pydantic validation
2. Clear separation of concerns
3. Comprehensive metadata for discoverability
4. Extensive validation and assumption checking
5. Standardized result format for interoperability

References:
- Kohavi, R., Tang, D., & Xu, Y. (2020). "Trustworthy Online Controlled Experiments"
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Set, Literal
from pydantic import BaseModel, Field
import pandas as pd

from .experimental_context import ExperimentalContext, ExperimentalDesign


class PluginMetadata(BaseModel):
    """Plugin metadata for discovery and documentation"""

    name: str = Field(..., pattern=r'^[a-z0-9_]+$', description="Plugin identifier")
    version: str = Field(..., pattern=r'^\d+\.\d+\.\d+$', description="Semantic version")
    author: str = Field(..., description="Author or team name")
    description: str = Field(..., description="Short description of plugin")
    supported_design_types: List[str] = Field(..., description="Supported experiment designs")
    required_metrics: List[str] = Field(..., description="Required metric columns")
    optional_metrics: List[str] = Field(default_factory=list, description="Optional metric columns")
    min_sample_size: Optional[int] = Field(None, ge=1, description="Minimum required sample size")
    assumptions: List[str] = Field(default_factory=list, description="Statistical assumptions")
    references: List[str] = Field(default_factory=list, description="Academic references")

    class Config:
        frozen = True


class PluginCapabilities(BaseModel):
    """Detailed capabilities and requirements of the plugin

    Used for validation and to help users select appropriate plugins.
    """

    # Design types
    supported_design_types: Set[str] = Field(..., description="Experimental designs this plugin handles")
    supported_metric_types: Set[str] = Field(..., description="Metric types this plugin handles")

    # Design features
    handles_temporal_correlation: bool = Field(
        default=False,
        description="Can handle temporal autocorrelation"
    )
    handles_spatial_correlation: bool = Field(
        default=False,
        description="Can handle spatial correlation"
    )
    handles_clustering: bool = Field(
        default=False,
        description="Can handle cluster-randomized designs"
    )
    handles_repeated_measures: bool = Field(
        default=False,
        description="Can handle repeated measures/within-subjects"
    )
    handles_interactions: bool = Field(
        default=False,
        description="Can test interaction effects"
    )
    handles_covariates: bool = Field(
        default=False,
        description="Can adjust for covariates"
    )

    # Data requirements
    requires_balanced_design: bool = Field(
        default=False,
        description="Requires equal sample sizes across groups"
    )
    requires_equal_variance: bool = Field(
        default=False,
        description="Requires homoscedasticity"
    )
    requires_normality: bool = Field(
        default=False,
        description="Requires normally distributed residuals"
    )
    minimum_clusters: Optional[int] = Field(
        None,
        ge=2,
        description="Minimum number of clusters required"
    )
    minimum_time_periods: Optional[int] = Field(
        None,
        ge=2,
        description="Minimum number of time periods required"
    )

    # Computational
    supports_large_datasets: bool = Field(
        default=True,
        description="Can handle >1M observations efficiently"
    )
    supports_streaming: bool = Field(
        default=False,
        description="Supports streaming/online analysis"
    )
    parallelizable: bool = Field(
        default=False,
        description="Can be parallelized across cores"
    )

    class Config:
        frozen = True


class AnalysisConfig(BaseModel):
    """Configuration for analysis execution

    Standard parameters that all plugins should support.
    Plugin-specific parameters go in custom_params.
    """

    # Statistical parameters
    alpha: float = Field(default=0.05, ge=0, le=1, description="Significance level")
    power: float = Field(default=0.8, ge=0, le=1, description="Statistical power target")
    min_detectable_effect: Optional[float] = Field(
        None,
        description="Minimum effect size of interest"
    )

    # Multiple testing correction
    correction_method: Optional[Literal[
        "bonferroni", "holm", "bh", "by", "sidak", "none"
    ]] = Field(
        None,
        description="Multiple testing correction method"
    )

    # Bootstrap parameters
    bootstrap_iterations: Optional[int] = Field(
        None,
        ge=100,
        le=100000,
        description="Number of bootstrap iterations"
    )

    # Plugin-specific parameters
    custom_params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Plugin-specific configuration"
    )

    class Config:
        frozen = True


class AnalysisResult(BaseModel):
    """Standardized analysis result structure

    Provides comprehensive results in a standardized format,
    enabling consistent interpretation and visualization across plugins.
    """

    # Primary estimates (can be multiple for factorial designs)
    estimates: Dict[str, float] = Field(..., description="Effect estimates")
    confidence_intervals: Dict[str, tuple[float, float]] = Field(
        ...,
        description="Confidence/credible intervals"
    )
    p_values: Optional[Dict[str, float]] = Field(
        None,
        description="P-values for hypothesis tests"
    )
    standard_errors: Dict[str, float] = Field(..., description="Standard errors")

    # Model information
    method: str = Field(..., description="Statistical method used")
    model_formula: Optional[str] = Field(None, description="Model specification (R-style)")
    degrees_of_freedom: Optional[Dict[str, float]] = Field(
        None,
        description="Degrees of freedom for tests"
    )

    # Sample information
    sample_sizes: Dict[str, int] = Field(..., description="Sample sizes by group/cluster/period")
    effective_sample_size: Optional[float] = Field(
        None,
        description="Effective N accounting for correlation/clustering"
    )

    # Model diagnostics
    model_fit: Optional[Dict[str, Any]] = Field(
        None,
        description="Model fit statistics (R², AIC, BIC, etc.)"
    )
    residual_diagnostics: Optional[Dict[str, Any]] = Field(
        None,
        description="Residual diagnostics and tests"
    )
    assumptions_met: Dict[str, bool] = Field(
        default_factory=dict,
        description="Whether statistical assumptions are satisfied"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Warnings about data quality or assumptions"
    )

    # Design-specific results
    interaction_effects: Optional[Dict[str, float]] = Field(
        None,
        description="Interaction effects (factorial designs)"
    )
    temporal_effects: Optional[Dict[str, float]] = Field(
        None,
        description="Time/period effects"
    )
    spatial_effects: Optional[Dict[str, Any]] = Field(
        None,
        description="Spatial autocorrelation, Moran's I, etc."
    )
    random_effects: Optional[Dict[str, Any]] = Field(
        None,
        description="Random effects variance components, ICC"
    )

    # Visualization data
    plots: Optional[Dict[str, Any]] = Field(
        None,
        description="Plot data for visualization"
    )

    # Additional outputs
    effect_sizes: Optional[Dict[str, float]] = Field(
        None,
        description="Standardized effect sizes (Cohen's d, eta², etc.)"
    )
    bayesian_posterior: Optional[Dict[str, Any]] = Field(
        None,
        description="Bayesian posterior distributions"
    )
    sensitivity_analysis: Optional[Dict[str, Any]] = Field(
        None,
        description="Sensitivity analysis results"
    )

    class Config:
        arbitrary_types_allowed = True


class AnalysisPlugin(ABC):
    """Base class for analysis plugins

    All plugins must inherit from this class and implement:
    1. _get_metadata() - Return plugin metadata
    2. _get_capabilities() - Return plugin capabilities
    3. analyze() - Perform the statistical analysis

    Optional methods to override:
    - validate_context() - Additional validation logic
    - prepare_data() - Data preprocessing
    - check_assumptions() - Assumption checking
    - calculate_power() - Power analysis
    - calculate_required_sample_size() - Sample size calculation

    Example:
        @analysis_plugin(name="my_test", ...)
        class MyTest(AnalysisPlugin):
            def _get_metadata(self):
                return PluginMetadata(...)

            def _get_capabilities(self):
                return PluginCapabilities(...)

            def analyze(self, context, config):
                # Implementation
                return AnalysisResult(...)
    """

    def __init__(self):
        self.metadata = self._get_metadata()
        self.capabilities = self._get_capabilities()
        self._validate_plugin()

    @abstractmethod
    def _get_metadata(self) -> PluginMetadata:
        """Return plugin metadata

        Provides information about the plugin for discovery and documentation.
        """
        pass

    @abstractmethod
    def _get_capabilities(self) -> PluginCapabilities:
        """Return plugin capabilities

        Declares what experimental designs and features this plugin supports.
        """
        pass

    @abstractmethod
    def analyze(
        self,
        context: ExperimentalContext,
        config: AnalysisConfig
    ) -> AnalysisResult:
        """Perform statistical analysis

        Args:
            context: Complete experimental context with design, data, metrics
            config: Analysis configuration

        Returns:
            Comprehensive analysis result

        Raises:
            ValueError: If context validation fails
            RuntimeError: If analysis fails
        """
        pass

    def validate_context(self, context: ExperimentalContext) -> List[str]:
        """Validate experimental context for this plugin

        Args:
            context: Experimental context to validate

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Check design type support
        if context.design.design_type not in self.capabilities.supported_design_types:
            errors.append(
                f"Design type '{context.design.design_type}' not supported. "
                f"Supported: {self.capabilities.supported_design_types}"
            )

        # Check metric types
        for metric in context.metrics:
            if metric.metric_type not in self.capabilities.supported_metric_types:
                errors.append(
                    f"Metric type '{metric.metric_type}' not supported for {metric.name}"
                )

        # Check temporal correlation
        if context.design.temporal and not self.capabilities.handles_temporal_correlation:
            errors.append("Plugin does not handle temporal correlation")

        # Check spatial correlation
        if context.design.spatial and not self.capabilities.handles_spatial_correlation:
            errors.append("Plugin does not handle spatial correlation")

        # Check clustering
        if context.design.cluster and not self.capabilities.handles_clustering:
            errors.append("Plugin does not handle clustering")

        # Check minimum clusters
        if self.capabilities.minimum_clusters and context.design.cluster:
            n_clusters = len(context.data[context.design.cluster.cluster_column].unique())
            if n_clusters < self.capabilities.minimum_clusters:
                errors.append(
                    f"Requires at least {self.capabilities.minimum_clusters} clusters, "
                    f"found {n_clusters}"
                )

        # Check minimum time periods
        if self.capabilities.minimum_time_periods and context.design.temporal:
            if context.design.temporal.period_column:
                n_periods = len(
                    context.data[context.design.temporal.period_column].unique()
                )
                if n_periods < self.capabilities.minimum_time_periods:
                    errors.append(
                        f"Requires at least {self.capabilities.minimum_time_periods} time periods, "
                        f"found {n_periods}"
                    )

        # Check sample size
        if self.metadata.min_sample_size:
            if context.n_total < self.metadata.min_sample_size:
                errors.append(
                    f"Sample size {context.n_total} below minimum "
                    f"{self.metadata.min_sample_size}"
                )

        return errors

    def prepare_data(self, context: ExperimentalContext) -> pd.DataFrame:
        """Prepare data for analysis (optional override)

        Can be used for:
        - Data transformations
        - Aggregation to appropriate unit
        - Outlier removal
        - Missing data handling

        Args:
            context: Experimental context

        Returns:
            Prepared DataFrame
        """
        return context.data

    def check_assumptions(self, context: ExperimentalContext) -> Dict[str, bool]:
        """Check statistical assumptions (optional override)

        Args:
            context: Experimental context

        Returns:
            Dictionary of assumption_name: met (bool)
        """
        return {}

    def calculate_power(
        self,
        sample_size: int,
        effect_size: float,
        alpha: float = 0.05
    ) -> float:
        """Calculate statistical power (optional override)

        Args:
            sample_size: Sample size per group
            effect_size: Expected effect size
            alpha: Significance level

        Returns:
            Statistical power (0-1)
        """
        raise NotImplementedError(
            f"{self.metadata.name} does not support power calculation"
        )

    def calculate_required_sample_size(
        self,
        effect_size: float,
        power: float = 0.8,
        alpha: float = 0.05
    ) -> int:
        """Calculate required sample size (optional override)

        Args:
            effect_size: Minimum detectable effect size
            power: Target statistical power
            alpha: Significance level

        Returns:
            Required sample size per group
        """
        raise NotImplementedError(
            f"{self.metadata.name} does not support sample size calculation"
        )

    def _validate_plugin(self):
        """Internal validation of plugin configuration"""
        # Ensure design types are valid
        valid_types = {
            'ab', 'multivariate', 'factorial',
            'within_subjects', 'switchback', 'stepped_wedge',
            'geo', 'cluster_randomized', 'crossover'
        }
        for dt in self.capabilities.supported_design_types:
            if dt not in valid_types:
                raise ValueError(f"Invalid design type: {dt}")

        # Ensure metric types are valid
        valid_metric_types = {
            'continuous', 'binary', 'count', 'proportion', 'duration', 'rate'
        }
        for mt in self.capabilities.supported_metric_types:
            if mt not in valid_metric_types:
                raise ValueError(f"Invalid metric type: {mt}")
