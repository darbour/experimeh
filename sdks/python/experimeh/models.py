"""Data models for the Experimeh SDK."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator


class ExperimentStatus(str, Enum):
    """Experiment status enum."""

    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


class DesignType(str, Enum):
    """Experiment design type enum."""

    AB = "ab"
    MULTIVARIATE = "multivariate"
    FACTORIAL = "factorial"
    WITHIN_SUBJECTS = "within_subjects"
    SWITCHBACK = "switchback"
    STEPPED_WEDGE = "stepped_wedge"


class RandomizationUnit(str, Enum):
    """Randomization unit enum."""

    USER = "user"
    SESSION = "session"
    DEVICE = "device"
    OTHER = "other"


class Variant(BaseModel):
    """Experiment variant."""

    key: str = Field(..., description="Unique variant key")
    name: str = Field(..., description="Human-readable variant name")
    description: Optional[str] = Field(None, description="Variant description")
    allocation: float = Field(..., ge=0, le=100, description="Traffic allocation percentage")
    config: Optional[Dict[str, Any]] = Field(None, description="Variant configuration")

    class Config:
        """Pydantic config."""

        use_enum_values = True


class Assignment(BaseModel):
    """Experiment assignment result."""

    experiment_id: str = Field(..., alias="experimentId")
    experiment_key: Optional[str] = Field(None, alias="experimentKey")
    unit_id: str = Field(..., alias="unitId")
    variant_key: str = Field(..., alias="variantKey")
    variant_name: Optional[str] = Field(None, alias="variantName")
    config: Optional[Dict[str, Any]] = None
    assigned: bool = Field(default=True)
    cached: bool = Field(default=False)
    reason: Optional[str] = None
    factors: Optional[Dict[str, str]] = None
    stepped_wedge_metadata: Optional[Dict[str, Any]] = Field(
        None, alias="steppedWedgeMetadata"
    )
    timestamp: Optional[datetime] = None

    class Config:
        """Pydantic config."""

        populate_by_name = True
        use_enum_values = True


class ExposureEvent(BaseModel):
    """Exposure event data."""

    experiment_id: str = Field(..., alias="experimentId")
    unit_id: str = Field(..., alias="unitId")
    variant_key: str = Field(..., alias="variantKey")
    exposure_point: Optional[str] = Field(None, alias="exposurePoint")
    context: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    class Config:
        """Pydantic config."""

        populate_by_name = True


class MetricEvent(BaseModel):
    """Metric event data."""

    event_name: str = Field(..., alias="eventName")
    unit_id: str = Field(..., alias="unitId")
    value: Optional[float] = None
    properties: Optional[Dict[str, Any]] = None
    experiment_ids: Optional[List[str]] = Field(None, alias="experimentIds")
    timestamp: Optional[datetime] = None

    class Config:
        """Pydantic config."""

        populate_by_name = True


class BatchEvent(BaseModel):
    """Batch event wrapper."""

    type: str = Field(..., description="Event type: exposure or metric")
    data: Union[ExposureEvent, MetricEvent]

    @validator("type")
    def validate_type(cls, v: str) -> str:
        """Validate event type."""
        if v not in ["exposure", "metric"]:
            raise ValueError("Event type must be 'exposure' or 'metric'")
        return v


class FeatureFlag(BaseModel):
    """Feature flag model."""

    id: str
    key: str
    name: str
    description: Optional[str] = None
    enabled: bool
    default_value: Any = Field(..., alias="defaultValue")
    variants: Optional[List[Dict[str, Any]]] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        """Pydantic config."""

        populate_by_name = True


class FeatureFlagEvaluation(BaseModel):
    """Feature flag evaluation result."""

    key: str
    value: Any
    enabled: bool
    variant: Optional[str] = None
    reason: str

    class Config:
        """Pydantic config."""

        use_enum_values = True


class Experiment(BaseModel):
    """Experiment model."""

    id: str
    key: str
    name: str
    description: Optional[str] = None
    status: ExperimentStatus
    design_type: DesignType = Field(..., alias="designType")
    primary_metric: str = Field(..., alias="primaryMetric")
    secondary_metrics: Optional[List[str]] = Field(None, alias="secondaryMetrics")
    guardrail_metrics: Optional[List[str]] = Field(None, alias="guardrailMetrics")
    randomization_unit: RandomizationUnit = Field(..., alias="randomizationUnit")
    assignment_key: str = Field(..., alias="assignmentKey")
    variants: List[Variant]
    design_config: Optional[Dict[str, Any]] = Field(None, alias="designConfig")
    traffic_allocation: float = Field(
        100, ge=0, le=100, alias="trafficAllocation"
    )
    min_sample_size: Optional[int] = Field(None, alias="minSampleSize")
    expected_effect: Optional[float] = Field(None, alias="expectedEffect")
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        """Pydantic config."""

        populate_by_name = True
        use_enum_values = True


class PaginationInfo(BaseModel):
    """Pagination information."""

    page: int
    limit: int
    total: int
    total_pages: int = Field(..., alias="totalPages")

    class Config:
        """Pydantic config."""

        populate_by_name = True


class APIResponse(BaseModel):
    """Generic API response."""

    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None

    class Config:
        """Pydantic config."""

        populate_by_name = True


class APIErrorResponse(BaseModel):
    """API error response."""

    error: str
    message: str
    status_code: int = Field(..., alias="statusCode")
    details: Optional[Dict[str, Any]] = None

    class Config:
        """Pydantic config."""

        populate_by_name = True
