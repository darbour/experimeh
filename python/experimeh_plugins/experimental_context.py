"""
Experimental Context - Rich metadata for complex experimental designs

Provides comprehensive context about experimental design structure,
enabling plugins to properly handle temporal, spatial, hierarchical,
and factorial experiments.

References:
- Hemming, K., et al. (2015). "Stepped-wedge cluster randomised trials"
- Hussey, M. A., & Hughes, J. P. (2007). "Design and analysis of stepped wedge cluster randomized trials"
- Montgomery, D. C. (2017). "Design and Analysis of Experiments"
"""

from typing import Any, Dict, List, Optional, Literal, Union
from pydantic import BaseModel, Field
from datetime import datetime


class TemporalStructure(BaseModel):
    """Temporal information for time-based designs (switchback, time-series)"""

    time_column: str = Field(..., description="Column containing timestamps")
    time_unit: Literal["second", "minute", "hour", "day", "week", "month"] = Field(
        default="day",
        description="Unit of time measurement"
    )
    period_column: Optional[str] = Field(
        None,
        description="Column for switchback periods"
    )
    sequence_column: Optional[str] = Field(
        None,
        description="Column for within-subjects ordering"
    )
    baseline_period: Optional[tuple[datetime, datetime]] = Field(
        None,
        description="Pre-treatment baseline period for diff-in-diff"
    )
    autocorrelation_structure: Optional[Literal["ar1", "ma1", "arma", "none"]] = Field(
        None,
        description="Assumed autocorrelation structure"
    )

    class Config:
        frozen = True


class SpatialStructure(BaseModel):
    """Spatial information for geographic experiments"""

    geo_unit_column: str = Field(..., description="Column identifying geographic units")
    geo_level: Literal["zip", "city", "dma", "state", "country", "custom"] = Field(
        default="custom",
        description="Level of geographic aggregation"
    )
    coordinates_lat: Optional[str] = Field(
        None,
        description="Column containing latitude coordinates"
    )
    coordinates_lon: Optional[str] = Field(
        None,
        description="Column containing longitude coordinates"
    )
    adjacency_matrix: Optional[List[List[float]]] = Field(
        None,
        description="Spatial adjacency matrix for spatial correlation"
    )
    distance_matrix: Optional[List[List[float]]] = Field(
        None,
        description="Distance matrix between geo units"
    )

    class Config:
        frozen = True


class ClusterStructure(BaseModel):
    """Cluster information for cluster-randomized designs"""

    cluster_column: str = Field(..., description="Column identifying clusters")
    cluster_level: str = Field(..., description="Type of cluster (e.g., 'store', 'hospital')")
    nesting_structure: Optional[List[str]] = Field(
        None,
        description="Hierarchical nesting (e.g., ['state', 'county', 'zip'])"
    )
    cluster_size_column: Optional[str] = Field(
        None,
        description="Column containing cluster sizes"
    )
    intracluster_correlation: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Expected or estimated ICC"
    )

    class Config:
        frozen = True


class FactorialStructure(BaseModel):
    """Factorial design information for multi-factor experiments"""

    factors: List[str] = Field(..., description="Factor column names", min_items=2)
    levels_per_factor: Dict[str, List[str]] = Field(
        ...,
        description="Mapping of factor name to its levels"
    )
    interaction_terms: Optional[List[List[str]]] = Field(
        None,
        description="Specific interactions to test (default: all)"
    )
    blocking_factors: Optional[List[str]] = Field(
        None,
        description="Factors used for blocking"
    )
    fractional_design: Optional[str] = Field(
        None,
        description="Fractional factorial specification (e.g., '2^(4-1)')"
    )

    class Config:
        frozen = True


class WithinSubjectsStructure(BaseModel):
    """Within-subjects/repeated measures information"""

    subject_column: str = Field(..., description="Column identifying subjects")
    condition_column: str = Field(..., description="Column identifying conditions")
    order_column: Optional[str] = Field(
        None,
        description="Column for counterbalancing order"
    )
    period_column: Optional[str] = Field(
        None,
        description="Column for measurement period"
    )
    carryover_periods: Optional[int] = Field(
        None,
        ge=0,
        description="Number of washout periods"
    )

    class Config:
        frozen = True


class SteppedWedgeStructure(BaseModel):
    """Stepped wedge cluster randomized trial information"""

    cluster_column: str = Field(..., description="Column identifying clusters")
    time_period_column: str = Field(..., description="Column identifying time periods")
    rollout_sequence: List[List[str]] = Field(
        ...,
        description="Nested list: each sublist contains cluster IDs for that wave"
    )
    n_periods_pre: int = Field(..., ge=1, description="Number of pre-treatment periods")
    n_periods_post: int = Field(..., ge=1, description="Number of post-treatment periods")
    transition_periods: Optional[List[int]] = Field(
        None,
        description="Period indices to exclude (contamination)"
    )

    class Config:
        frozen = True


class MetricSpecification(BaseModel):
    """Detailed metric information for proper statistical handling"""

    name: str = Field(..., description="Metric name")
    column: str = Field(..., description="Data column name")
    metric_type: Literal[
        "continuous",
        "binary",
        "count",
        "proportion",
        "duration",
        "rate"
    ] = Field(..., description="Type of metric")

    aggregation: Optional[Literal["sum", "mean", "median", "count", "rate"]] = Field(
        None,
        description="How to aggregate if needed"
    )
    transformation: Optional[Literal["log", "sqrt", "logit", "identity", "rank"]] = Field(
        "identity",
        description="Data transformation to apply"
    )

    # For ratio metrics
    numerator_column: Optional[str] = Field(
        None,
        description="Numerator column for rate/ratio metrics"
    )
    denominator_column: Optional[str] = Field(
        None,
        description="Denominator column for rate/ratio metrics"
    )

    # For handling outliers
    winsorize_percentile: Optional[float] = Field(
        None,
        ge=0,
        le=50,
        description="Percentile for winsorization (e.g., 1 = 1st/99th percentile)"
    )
    outlier_threshold_sd: Optional[float] = Field(
        None,
        gt=0,
        description="Remove outliers beyond N standard deviations"
    )

    # Directionality
    higher_is_better: bool = Field(True, description="Whether higher values are better")

    class Config:
        frozen = True


class ExperimentalDesign(BaseModel):
    """Complete experimental design specification

    Provides comprehensive metadata about the experimental design,
    enabling plugins to apply appropriate statistical methods.
    """

    design_type: Literal[
        "ab",
        "multivariate",
        "factorial",
        "switchback",
        "geo",
        "stepped_wedge",
        "within_subjects",
        "crossover",
        "cluster_randomized"
    ] = Field(..., description="Type of experimental design")

    # Treatment assignment
    treatment_column: str = Field(..., description="Column containing treatment assignment")
    control_value: str = Field(..., description="Value representing control group")
    treatment_values: List[str] = Field(..., description="Values representing treatment groups")

    # Design-specific structures
    temporal: Optional[TemporalStructure] = None
    spatial: Optional[SpatialStructure] = None
    cluster: Optional[ClusterStructure] = None
    factorial: Optional[FactorialStructure] = None
    within_subjects: Optional[WithinSubjectsStructure] = None
    stepped_wedge: Optional[SteppedWedgeStructure] = None

    # Covariates and adjustment
    covariates: Optional[List[str]] = Field(
        None,
        description="Pre-treatment covariates for variance reduction"
    )
    stratification_vars: Optional[List[str]] = Field(
        None,
        description="Variables used for stratified randomization"
    )
    blocking_vars: Optional[List[str]] = Field(
        None,
        description="Variables used for blocking"
    )

    # Randomization
    randomization_unit: str = Field(
        ...,
        description="Unit of randomization (e.g., 'user_id', 'store_id')"
    )
    analysis_unit: Optional[str] = Field(
        None,
        description="Unit of analysis if different from randomization unit"
    )

    class Config:
        frozen = True


class ExperimentalContext(BaseModel):
    """Complete context for experimental analysis

    Provides all information needed for proper statistical analysis:
    - Design specification (temporal, spatial, hierarchical structure)
    - Metric definitions (type, transformations, outlier handling)
    - Data (observations)
    - Sample sizes and quality indicators

    This rich context enables plugins to:
    1. Validate compatibility with the experimental design
    2. Apply appropriate statistical methods
    3. Check assumptions properly
    4. Provide accurate inference
    """

    # Core components
    design: ExperimentalDesign = Field(..., description="Experimental design specification")
    metrics: List[MetricSpecification] = Field(..., description="Metric specifications")
    data: Any = Field(..., description="DataFrame with experimental data")

    # Sample information
    n_total: int = Field(..., ge=0, description="Total sample size")
    n_per_treatment: Dict[str, int] = Field(..., description="Sample size per treatment group")

    # Timing
    start_date: Optional[datetime] = Field(None, description="Experiment start date")
    end_date: Optional[datetime] = Field(None, description="Experiment end date")

    # Quality indicators
    sample_ratio_mismatch: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="SRM p-value (should be > 0.001)"
    )
    missing_data_rate: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Proportion of missing data"
    )

    # Pre-computed statistics (optional, for performance)
    precomputed_stats: Optional[Dict[str, Any]] = Field(
        None,
        description="Pre-computed statistics to avoid redundant computation"
    )

    class Config:
        arbitrary_types_allowed = True  # For pandas DataFrames
        frozen = True  # Immutable context
