"""Experimeh Python SDK - Feature flag experimentation client.

This module provides a production-ready Python SDK for the Experimeh
experimentation platform, with support for A/B tests, multivariate tests,
factorial designs, and complex experimental designs.
"""

from .cache import CacheAdapter, InMemoryCache, NoOpCache, RedisCache
from .client import AsyncExperimentClient, ExperimentClient
from .config import ExperimentClientConfig
from .errors import (
    APIError,
    AssignmentError,
    CacheError,
    ConfigurationError,
    ExperimentError,
    ExperimentInactiveError,
    ExperimentNotFoundError,
    NetworkError,
    RateLimitError,
    TimeoutError,
    ValidationError,
)
from .models import (
    Assignment,
    DesignType,
    ExperimentStatus,
    ExposureEvent,
    FeatureFlag,
    FeatureFlagEvaluation,
    MetricEvent,
    RandomizationUnit,
)

__version__ = "1.0.0"
__author__ = "Experimeh Team"

__all__ = [
    # Main client classes
    "ExperimentClient",
    "AsyncExperimentClient",
    # Configuration
    "ExperimentClientConfig",
    # Cache adapters
    "CacheAdapter",
    "InMemoryCache",
    "RedisCache",
    "NoOpCache",
    # Models
    "Assignment",
    "ExposureEvent",
    "MetricEvent",
    "FeatureFlag",
    "FeatureFlagEvaluation",
    # Enums
    "ExperimentStatus",
    "DesignType",
    "RandomizationUnit",
    # Errors
    "ExperimentError",
    "ExperimentNotFoundError",
    "ExperimentInactiveError",
    "AssignmentError",
    "ValidationError",
    "ConfigurationError",
    "NetworkError",
    "APIError",
    "CacheError",
    "RateLimitError",
    "TimeoutError",
    # Version
    "__version__",
]
