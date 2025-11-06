"""Custom exception classes for the Experimeh SDK."""

from typing import Any, Dict, Optional


class ExperimentError(Exception):
    """Base exception class for all Experimeh errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        """Initialize ExperimentError.

        Args:
            message: Error message
            status_code: HTTP status code (if applicable)
            details: Additional error details
        """
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

    def __str__(self) -> str:
        """Return string representation of error."""
        if self.status_code:
            return f"{self.__class__.__name__} (HTTP {self.status_code}): {self.message}"
        return f"{self.__class__.__name__}: {self.message}"


class ExperimentNotFoundError(ExperimentError):
    """Raised when an experiment is not found."""

    def __init__(self, experiment_id: str, message: Optional[str] = None):
        """Initialize ExperimentNotFoundError.

        Args:
            experiment_id: ID of the experiment that was not found
            message: Optional custom message
        """
        self.experiment_id = experiment_id
        msg = message or f"Experiment not found: {experiment_id}"
        super().__init__(msg, status_code=404, details={"experimentId": experiment_id})


class ExperimentInactiveError(ExperimentError):
    """Raised when attempting to use an inactive experiment."""

    def __init__(self, experiment_id: str, status: str):
        """Initialize ExperimentInactiveError.

        Args:
            experiment_id: ID of the inactive experiment
            status: Current status of the experiment
        """
        self.experiment_id = experiment_id
        self.status = status
        super().__init__(
            f"Experiment {experiment_id} is not active (status: {status})",
            details={"experimentId": experiment_id, "status": status},
        )


class AssignmentError(ExperimentError):
    """Raised when assignment fails."""

    def __init__(self, message: str, experiment_id: Optional[str] = None):
        """Initialize AssignmentError.

        Args:
            message: Error message
            experiment_id: ID of the experiment (if applicable)
        """
        self.experiment_id = experiment_id
        details = {"experimentId": experiment_id} if experiment_id else {}
        super().__init__(message, details=details)


class ValidationError(ExperimentError):
    """Raised when input validation fails."""

    def __init__(self, message: str, field: Optional[str] = None):
        """Initialize ValidationError.

        Args:
            message: Error message
            field: Field that failed validation
        """
        self.field = field
        details = {"field": field} if field else {}
        super().__init__(message, status_code=400, details=details)


class ConfigurationError(ExperimentError):
    """Raised when there's a configuration error."""

    def __init__(self, message: str, config_key: Optional[str] = None):
        """Initialize ConfigurationError.

        Args:
            message: Error message
            config_key: Configuration key that caused the error
        """
        self.config_key = config_key
        details = {"configKey": config_key} if config_key else {}
        super().__init__(message, details=details)


class NetworkError(ExperimentError):
    """Raised when a network request fails."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Any] = None,
    ):
        """Initialize NetworkError.

        Args:
            message: Error message
            status_code: HTTP status code
            response: Response object (if available)
        """
        self.response = response
        super().__init__(message, status_code=status_code)


class APIError(ExperimentError):
    """Raised when the API returns an error response."""

    def __init__(
        self,
        message: str,
        status_code: int,
        response_data: Optional[Dict[str, Any]] = None,
    ):
        """Initialize APIError.

        Args:
            message: Error message
            status_code: HTTP status code
            response_data: Response data from the API
        """
        self.response_data = response_data or {}
        super().__init__(message, status_code=status_code, details=response_data)


class CacheError(ExperimentError):
    """Raised when a cache operation fails."""

    def __init__(self, message: str, operation: Optional[str] = None):
        """Initialize CacheError.

        Args:
            message: Error message
            operation: Cache operation that failed (get, set, delete, etc.)
        """
        self.operation = operation
        details = {"operation": operation} if operation else {}
        super().__init__(message, details=details)


class RateLimitError(ExperimentError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        """Initialize RateLimitError.

        Args:
            message: Error message
            retry_after: Seconds to wait before retrying
            limit: Rate limit that was exceeded
        """
        self.retry_after = retry_after
        self.limit = limit
        super().__init__(
            message,
            status_code=429,
            details={"retryAfter": retry_after, "limit": limit},
        )


class TimeoutError(ExperimentError):
    """Raised when a request times out."""

    def __init__(self, message: str, timeout: Optional[float] = None):
        """Initialize TimeoutError.

        Args:
            message: Error message
            timeout: Timeout value in seconds
        """
        self.timeout = timeout
        super().__init__(message, details={"timeout": timeout})
