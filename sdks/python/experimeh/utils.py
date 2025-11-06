"""Utility functions for the Experimeh SDK."""

import hashlib
import re
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from .errors import ValidationError


def validate_experiment_key(key: str) -> None:
    """Validate experiment key format.

    Args:
        key: Experiment key to validate

    Raises:
        ValidationError: If key is invalid
    """
    if not key:
        raise ValidationError("Experiment key cannot be empty", field="experimentKey")

    if not isinstance(key, str):
        raise ValidationError("Experiment key must be a string", field="experimentKey")

    if len(key) > 255:
        raise ValidationError(
            "Experiment key must be 255 characters or less", field="experimentKey"
        )


def validate_unit_id(unit_id: str) -> None:
    """Validate unit ID format.

    Args:
        unit_id: Unit ID to validate

    Raises:
        ValidationError: If unit ID is invalid
    """
    if not unit_id:
        raise ValidationError("Unit ID cannot be empty", field="unitId")

    if not isinstance(unit_id, str):
        raise ValidationError("Unit ID must be a string", field="unitId")

    if len(unit_id) > 255:
        raise ValidationError(
            "Unit ID must be 255 characters or less", field="unitId"
        )


def validate_variant_key(key: str) -> None:
    """Validate variant key format.

    Args:
        key: Variant key to validate

    Raises:
        ValidationError: If key is invalid
    """
    if not key:
        raise ValidationError("Variant key cannot be empty", field="variantKey")

    if not isinstance(key, str):
        raise ValidationError("Variant key must be a string", field="variantKey")


def validate_event_name(name: str) -> None:
    """Validate event name format.

    Args:
        name: Event name to validate

    Raises:
        ValidationError: If name is invalid
    """
    if not name:
        raise ValidationError("Event name cannot be empty", field="eventName")

    if not isinstance(name, str):
        raise ValidationError("Event name must be a string", field="eventName")

    if len(name) > 255:
        raise ValidationError(
            "Event name must be 255 characters or less", field="eventName"
        )

    # Event names should be alphanumeric with underscores
    if not re.match(r"^[a-zA-Z0-9_]+$", name):
        raise ValidationError(
            "Event name must contain only letters, numbers, and underscores",
            field="eventName",
        )


def hash_string(value: str, salt: str = "") -> str:
    """Hash a string value using SHA-256.

    Args:
        value: String to hash
        salt: Optional salt for hashing

    Returns:
        Hex-encoded hash string
    """
    combined = f"{value}{salt}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def hash_assignment(experiment_key: str, unit_id: str) -> str:
    """Generate a hash for assignment caching.

    Args:
        experiment_key: Experiment key
        unit_id: Unit ID

    Returns:
        Hash string for caching
    """
    return hash_string(f"{experiment_key}:{unit_id}")


def build_query_string(params: Dict[str, Any]) -> str:
    """Build URL query string from parameters.

    Args:
        params: Dictionary of query parameters

    Returns:
        URL-encoded query string
    """
    if not params:
        return ""

    # Flatten nested context parameters
    flattened: Dict[str, Any] = {}
    for key, value in params.items():
        if key == "context" and isinstance(value, dict):
            for ctx_key, ctx_value in value.items():
                flattened[f"context[{ctx_key}]"] = ctx_value
        elif value is not None:
            flattened[key] = value

    return urlencode(flattened)


def sanitize_context(context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sanitize context dictionary by removing None values.

    Args:
        context: Context dictionary

    Returns:
        Sanitized context or None
    """
    if not context:
        return None

    sanitized = {k: v for k, v in context.items() if v is not None}
    return sanitized if sanitized else None


def exponential_backoff(
    attempt: int, base_delay: float = 1.0, backoff: float = 2.0, max_delay: float = 60.0
) -> float:
    """Calculate exponential backoff delay.

    Args:
        attempt: Retry attempt number (0-indexed)
        base_delay: Base delay in seconds
        backoff: Backoff multiplier
        max_delay: Maximum delay in seconds

    Returns:
        Delay in seconds
    """
    delay = base_delay * (backoff**attempt)
    return min(delay, max_delay)


def merge_dicts(*dicts: Dict[str, Any]) -> Dict[str, Any]:
    """Merge multiple dictionaries, with later ones taking precedence.

    Args:
        *dicts: Dictionaries to merge

    Returns:
        Merged dictionary
    """
    result: Dict[str, Any] = {}
    for d in dicts:
        if d:
            result.update(d)
    return result


def safe_json_value(value: Any) -> Any:
    """Convert value to JSON-safe type.

    Args:
        value: Value to convert

    Returns:
        JSON-safe value
    """
    if value is None:
        return None
    if isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [safe_json_value(v) for v in value]
    if isinstance(value, dict):
        return {k: safe_json_value(v) for k, v in value.items()}
    # Convert other types to string
    return str(value)
