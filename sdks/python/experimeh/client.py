"""Main client for the Experimeh SDK."""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from .cache import CacheAdapter, InMemoryCache, NoOpCache
from .config import ExperimentClientConfig
from .errors import ValidationError
from .http_client import AsyncHTTPClient, HTTPClient
from .models import (
    Assignment,
    BatchEvent,
    Experiment,
    ExposureEvent,
    FeatureFlag,
    FeatureFlagEvaluation,
    MetricEvent,
)
from .utils import (
    build_query_string,
    hash_assignment,
    sanitize_context,
    validate_event_name,
    validate_experiment_key,
    validate_unit_id,
    validate_variant_key,
)

logger = logging.getLogger(__name__)


class ExperimentClient:
    """Synchronous experiment client."""

    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        cache: Optional[CacheAdapter] = None,
        cache_enabled: bool = True,
        cache_ttl: int = 300,
        timeout: int = 10,
        max_retries: int = 3,
        **kwargs: Any,
    ):
        """Initialize experiment client.

        Args:
            api_url: Base URL for the Experimeh API
            api_key: API key for authentication
            cache: Custom cache adapter
            cache_enabled: Enable/disable caching
            cache_ttl: Cache TTL in seconds
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            **kwargs: Additional configuration options
        """
        self.config = ExperimentClientConfig(
            api_url=api_url,
            api_key=api_key,
            cache_enabled=cache_enabled,
            cache_ttl=cache_ttl,
            timeout=timeout,
            max_retries=max_retries,
            **kwargs,
        )
        self.config.validate()

        self._http_client = HTTPClient(self.config)

        # Setup cache
        if cache:
            self._cache = cache
        elif cache_enabled:
            self._cache = InMemoryCache(default_ttl=cache_ttl)
        else:
            self._cache = NoOpCache()

        # Event batching
        self._event_queue: List[BatchEvent] = []
        self._flush_task: Optional[Any] = None
        self._initialized = False

        logger.info(f"Initialized ExperimentClient: {api_url}")

    def initialize(self) -> None:
        """Initialize the client and start background tasks."""
        if self._initialized:
            return

        self._initialized = True
        logger.info("ExperimentClient initialized")

    def close(self) -> None:
        """Close the client and cleanup resources."""
        self._http_client.close()
        self._initialized = False
        logger.info("ExperimentClient closed")

    def get_assignment(
        self,
        experiment_key: str,
        unit_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Assignment:
        """Get experiment assignment for a unit.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID (user, session, etc.)
            context: Additional context for assignment

        Returns:
            Assignment object

        Raises:
            ValidationError: If input is invalid
            ExperimentError: If assignment fails
        """
        validate_experiment_key(experiment_key)
        validate_unit_id(unit_id)

        # Check cache
        cache_key = hash_assignment(experiment_key, unit_id)
        cached = self._cache.get_sync(cache_key)

        if cached:
            logger.debug(f"Assignment cache hit: {experiment_key}:{unit_id}")
            assignment = Assignment(**cached)
            assignment.cached = True
            return assignment

        # Fetch from API
        params = {
            "unitId": unit_id,
            "experimentKey": experiment_key,
        }

        if context:
            params["context"] = sanitize_context(context)

        query_string = build_query_string(params)
        response = self._http_client.get(f"/api/v1/assignments?{query_string}")

        # Parse response
        data = response.get("data", {})
        assignments = data.get("assignments", {})
        assignment_data = assignments.get(experiment_key)

        if not assignment_data:
            # Return unassigned
            assignment = Assignment(
                experimentId="",
                experimentKey=experiment_key,
                unitId=unit_id,
                variantKey="control",
                assigned=False,
                reason="not_assigned",
            )
        else:
            assignment = Assignment(
                experimentId=assignment_data.get("experimentId", ""),
                experimentKey=experiment_key,
                unitId=unit_id,
                variantKey=assignment_data.get("variantKey", "control"),
                assigned=assignment_data.get("assigned", False),
                reason=assignment_data.get("reason"),
                factors=assignment_data.get("factors"),
                steppedWedgeMetadata=assignment_data.get("steppedWedgeMetadata"),
            )

        # Cache the assignment
        if assignment.assigned and self.config.cache_enabled:
            self._cache.set_sync(
                cache_key, assignment.model_dump(by_alias=True), self.config.cache_ttl
            )

        logger.debug(
            f"Assignment fetched: {experiment_key}:{unit_id} -> {assignment.variant_key}"
        )
        return assignment

    def track_exposure(
        self,
        experiment_key: str,
        unit_id: str,
        variant_key: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track exposure event.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID
            variant_key: Variant key
            context: Additional context

        Raises:
            ValidationError: If input is invalid
        """
        validate_experiment_key(experiment_key)
        validate_unit_id(unit_id)
        validate_variant_key(variant_key)

        event = ExposureEvent(
            experimentId=experiment_key,
            unitId=unit_id,
            variantKey=variant_key,
            context=sanitize_context(context),
        )

        # Send immediately (can be batched in future)
        response = self._http_client.post(
            "/api/v1/events/exposures",
            json=event.model_dump(by_alias=True, exclude_none=True),
        )

        logger.debug(f"Exposure tracked: {experiment_key}:{unit_id}:{variant_key}")

    def track_metric(
        self,
        event_name: str,
        unit_id: str,
        value: Optional[float] = None,
        properties: Optional[Dict[str, Any]] = None,
        experiment_ids: Optional[List[str]] = None,
    ) -> None:
        """Track metric event.

        Args:
            event_name: Event name
            unit_id: Unit ID
            value: Metric value
            properties: Additional properties
            experiment_ids: Associated experiment IDs

        Raises:
            ValidationError: If input is invalid
        """
        validate_event_name(event_name)
        validate_unit_id(unit_id)

        event = MetricEvent(
            eventName=event_name,
            unitId=unit_id,
            value=value,
            properties=sanitize_context(properties),
            experimentIds=experiment_ids,
        )

        # Send immediately (can be batched in future)
        response = self._http_client.post(
            "/api/v1/events/metrics",
            json=event.model_dump(by_alias=True, exclude_none=True),
        )

        logger.debug(f"Metric tracked: {event_name}:{unit_id}")

    def get_assignment_and_track_exposure(
        self,
        experiment_key: str,
        unit_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Assignment:
        """Get assignment and track exposure in one call.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID
            context: Additional context

        Returns:
            Assignment object
        """
        assignment = self.get_assignment(experiment_key, unit_id, context)

        if assignment.assigned:
            self.track_exposure(experiment_key, unit_id, assignment.variant_key, context)

        return assignment

    def get_experiment(self, experiment_id: str) -> Experiment:
        """Get experiment details.

        Args:
            experiment_id: Experiment ID

        Returns:
            Experiment object
        """
        response = self._http_client.get(f"/api/v1/experiments/{experiment_id}")
        data = response.get("data", {})
        return Experiment(**data)

    def list_experiments(
        self,
        status: Optional[str] = None,
        design_type: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[Experiment]:
        """List experiments.

        Args:
            status: Filter by status
            design_type: Filter by design type
            page: Page number
            limit: Items per page

        Returns:
            List of Experiment objects
        """
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if design_type:
            params["designType"] = design_type

        query_string = build_query_string(params)
        response = self._http_client.get(f"/api/v1/experiments?{query_string}")
        data = response.get("data", [])
        return [Experiment(**exp) for exp in data]

    def evaluate_flag(
        self, flag_key: str, unit_id: str, context: Optional[Dict[str, Any]] = None
    ) -> FeatureFlagEvaluation:
        """Evaluate feature flag.

        Args:
            flag_key: Feature flag key
            unit_id: Unit ID
            context: Additional context

        Returns:
            FeatureFlagEvaluation object
        """
        params = {"unitId": unit_id}
        if context:
            params["context"] = sanitize_context(context)

        query_string = build_query_string(params)
        response = self._http_client.get(
            f"/api/v1/flags/{flag_key}/evaluate?{query_string}"
        )
        data = response.get("data", {})
        return FeatureFlagEvaluation(**data)

    def flush(self) -> None:
        """Flush queued events (placeholder for future batch support)."""
        pass

    def shutdown(self) -> None:
        """Shutdown client and flush events."""
        self.flush()
        self.close()

    def __enter__(self):
        """Context manager entry."""
        self.initialize()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.shutdown()


class AsyncExperimentClient:
    """Asynchronous experiment client."""

    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        cache: Optional[CacheAdapter] = None,
        cache_enabled: bool = True,
        cache_ttl: int = 300,
        timeout: int = 10,
        max_retries: int = 3,
        **kwargs: Any,
    ):
        """Initialize async experiment client.

        Args:
            api_url: Base URL for the Experimeh API
            api_key: API key for authentication
            cache: Custom cache adapter
            cache_enabled: Enable/disable caching
            cache_ttl: Cache TTL in seconds
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            **kwargs: Additional configuration options
        """
        self.config = ExperimentClientConfig(
            api_url=api_url,
            api_key=api_key,
            cache_enabled=cache_enabled,
            cache_ttl=cache_ttl,
            timeout=timeout,
            max_retries=max_retries,
            **kwargs,
        )
        self.config.validate()

        self._http_client = AsyncHTTPClient(self.config)

        # Setup cache
        if cache:
            self._cache = cache
        elif cache_enabled:
            self._cache = InMemoryCache(default_ttl=cache_ttl)
        else:
            self._cache = NoOpCache()

        # Event batching
        self._event_queue: List[BatchEvent] = []
        self._flush_task: Optional[asyncio.Task] = None
        self._initialized = False

        logger.info(f"Initialized AsyncExperimentClient: {api_url}")

    async def initialize(self) -> None:
        """Initialize the client and start background tasks."""
        if self._initialized:
            return

        self._initialized = True
        logger.info("AsyncExperimentClient initialized")

    async def close(self) -> None:
        """Close the client and cleanup resources."""
        await self._http_client.close()
        self._initialized = False
        logger.info("AsyncExperimentClient closed")

    async def get_assignment(
        self,
        experiment_key: str,
        unit_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Assignment:
        """Get experiment assignment for a unit.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID (user, session, etc.)
            context: Additional context for assignment

        Returns:
            Assignment object

        Raises:
            ValidationError: If input is invalid
            ExperimentError: If assignment fails
        """
        validate_experiment_key(experiment_key)
        validate_unit_id(unit_id)

        # Check cache
        cache_key = hash_assignment(experiment_key, unit_id)
        cached = await self._cache.get(cache_key)

        if cached:
            logger.debug(f"Assignment cache hit: {experiment_key}:{unit_id}")
            assignment = Assignment(**cached)
            assignment.cached = True
            return assignment

        # Fetch from API
        params = {
            "unitId": unit_id,
            "experimentKey": experiment_key,
        }

        if context:
            params["context"] = sanitize_context(context)

        query_string = build_query_string(params)
        response = await self._http_client.get(f"/api/v1/assignments?{query_string}")

        # Parse response
        data = response.get("data", {})
        assignments = data.get("assignments", {})
        assignment_data = assignments.get(experiment_key)

        if not assignment_data:
            # Return unassigned
            assignment = Assignment(
                experimentId="",
                experimentKey=experiment_key,
                unitId=unit_id,
                variantKey="control",
                assigned=False,
                reason="not_assigned",
            )
        else:
            assignment = Assignment(
                experimentId=assignment_data.get("experimentId", ""),
                experimentKey=experiment_key,
                unitId=unit_id,
                variantKey=assignment_data.get("variantKey", "control"),
                assigned=assignment_data.get("assigned", False),
                reason=assignment_data.get("reason"),
                factors=assignment_data.get("factors"),
                steppedWedgeMetadata=assignment_data.get("steppedWedgeMetadata"),
            )

        # Cache the assignment
        if assignment.assigned and self.config.cache_enabled:
            await self._cache.set(
                cache_key, assignment.model_dump(by_alias=True), self.config.cache_ttl
            )

        logger.debug(
            f"Assignment fetched: {experiment_key}:{unit_id} -> {assignment.variant_key}"
        )
        return assignment

    async def track_exposure(
        self,
        experiment_key: str,
        unit_id: str,
        variant_key: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track exposure event.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID
            variant_key: Variant key
            context: Additional context

        Raises:
            ValidationError: If input is invalid
        """
        validate_experiment_key(experiment_key)
        validate_unit_id(unit_id)
        validate_variant_key(variant_key)

        event = ExposureEvent(
            experimentId=experiment_key,
            unitId=unit_id,
            variantKey=variant_key,
            context=sanitize_context(context),
        )

        # Send immediately (can be batched in future)
        response = await self._http_client.post(
            "/api/v1/events/exposures",
            json=event.model_dump(by_alias=True, exclude_none=True),
        )

        logger.debug(f"Exposure tracked: {experiment_key}:{unit_id}:{variant_key}")

    async def track_metric(
        self,
        event_name: str,
        unit_id: str,
        value: Optional[float] = None,
        properties: Optional[Dict[str, Any]] = None,
        experiment_ids: Optional[List[str]] = None,
    ) -> None:
        """Track metric event.

        Args:
            event_name: Event name
            unit_id: Unit ID
            value: Metric value
            properties: Additional properties
            experiment_ids: Associated experiment IDs

        Raises:
            ValidationError: If input is invalid
        """
        validate_event_name(event_name)
        validate_unit_id(unit_id)

        event = MetricEvent(
            eventName=event_name,
            unitId=unit_id,
            value=value,
            properties=sanitize_context(properties),
            experimentIds=experiment_ids,
        )

        # Send immediately (can be batched in future)
        response = await self._http_client.post(
            "/api/v1/events/metrics",
            json=event.model_dump(by_alias=True, exclude_none=True),
        )

        logger.debug(f"Metric tracked: {event_name}:{unit_id}")

    async def get_assignment_and_track_exposure(
        self,
        experiment_key: str,
        unit_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Assignment:
        """Get assignment and track exposure in one call.

        Args:
            experiment_key: Experiment key
            unit_id: Unit ID
            context: Additional context

        Returns:
            Assignment object
        """
        assignment = await self.get_assignment(experiment_key, unit_id, context)

        if assignment.assigned:
            await self.track_exposure(
                experiment_key, unit_id, assignment.variant_key, context
            )

        return assignment

    async def get_experiment(self, experiment_id: str) -> Experiment:
        """Get experiment details.

        Args:
            experiment_id: Experiment ID

        Returns:
            Experiment object
        """
        response = await self._http_client.get(f"/api/v1/experiments/{experiment_id}")
        data = response.get("data", {})
        return Experiment(**data)

    async def list_experiments(
        self,
        status: Optional[str] = None,
        design_type: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> List[Experiment]:
        """List experiments.

        Args:
            status: Filter by status
            design_type: Filter by design type
            page: Page number
            limit: Items per page

        Returns:
            List of Experiment objects
        """
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if design_type:
            params["designType"] = design_type

        query_string = build_query_string(params)
        response = await self._http_client.get(f"/api/v1/experiments?{query_string}")
        data = response.get("data", [])
        return [Experiment(**exp) for exp in data]

    async def evaluate_flag(
        self, flag_key: str, unit_id: str, context: Optional[Dict[str, Any]] = None
    ) -> FeatureFlagEvaluation:
        """Evaluate feature flag.

        Args:
            flag_key: Feature flag key
            unit_id: Unit ID
            context: Additional context

        Returns:
            FeatureFlagEvaluation object
        """
        params = {"unitId": unit_id}
        if context:
            params["context"] = sanitize_context(context)

        query_string = build_query_string(params)
        response = await self._http_client.get(
            f"/api/v1/flags/{flag_key}/evaluate?{query_string}"
        )
        data = response.get("data", {})
        return FeatureFlagEvaluation(**data)

    async def flush(self) -> None:
        """Flush queued events (placeholder for future batch support)."""
        pass

    async def shutdown(self) -> None:
        """Shutdown client and flush events."""
        await self.flush()
        await self.close()

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.shutdown()
