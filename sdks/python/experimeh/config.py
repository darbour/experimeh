"""Configuration for the Experimeh SDK."""

import logging
from typing import Any, Dict, Optional

from .errors import ConfigurationError


class ExperimentClientConfig:
    """Configuration for ExperimentClient."""

    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        cache_enabled: bool = True,
        cache_ttl: int = 300,
        timeout: int = 10,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        retry_backoff: float = 2.0,
        batch_size: int = 100,
        flush_interval: float = 10.0,
        log_level: str = "INFO",
        user_agent: Optional[str] = None,
        verify_ssl: bool = True,
        **kwargs: Any,
    ):
        """Initialize client configuration.

        Args:
            api_url: Base URL for the Experimeh API
            api_key: API key for authentication
            cache_enabled: Enable/disable caching (default: True)
            cache_ttl: Cache TTL in seconds (default: 300)
            timeout: Request timeout in seconds (default: 10)
            max_retries: Maximum number of retry attempts (default: 3)
            retry_delay: Initial retry delay in seconds (default: 1.0)
            retry_backoff: Backoff multiplier for retries (default: 2.0)
            batch_size: Maximum batch size for events (default: 100)
            flush_interval: Auto-flush interval in seconds (default: 10.0)
            log_level: Logging level (default: INFO)
            user_agent: Custom user agent string
            verify_ssl: Verify SSL certificates (default: True)
            **kwargs: Additional configuration options
        """
        # Required
        if not api_url:
            raise ConfigurationError("api_url is required")

        self.api_url = api_url.rstrip("/")

        # Authentication
        self.api_key = api_key

        # Cache settings
        self.cache_enabled = cache_enabled
        self.cache_ttl = cache_ttl

        # HTTP settings
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.retry_backoff = retry_backoff
        self.verify_ssl = verify_ssl

        # Batch settings
        self.batch_size = batch_size
        self.flush_interval = flush_interval

        # Logging
        self.log_level = log_level.upper()
        self._setup_logging()

        # User agent
        self.user_agent = user_agent or "experimeh-python-sdk/1.0.0"

        # Additional config
        self.extra = kwargs

    def _setup_logging(self) -> None:
        """Setup logging configuration."""
        log_level = getattr(logging, self.log_level, logging.INFO)
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def get_headers(self) -> Dict[str, str]:
        """Get default headers for API requests.

        Returns:
            Dictionary of headers
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        }

        if self.api_key:
            headers["X-API-Key"] = self.api_key

        return headers

    def validate(self) -> None:
        """Validate configuration.

        Raises:
            ConfigurationError: If configuration is invalid
        """
        if not self.api_url:
            raise ConfigurationError("api_url is required")

        if self.timeout <= 0:
            raise ConfigurationError("timeout must be positive")

        if self.max_retries < 0:
            raise ConfigurationError("max_retries must be non-negative")

        if self.cache_ttl < 0:
            raise ConfigurationError("cache_ttl must be non-negative")

        if self.batch_size <= 0:
            raise ConfigurationError("batch_size must be positive")

        if self.flush_interval <= 0:
            raise ConfigurationError("flush_interval must be positive")

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            Configuration as dictionary
        """
        return {
            "api_url": self.api_url,
            "cache_enabled": self.cache_enabled,
            "cache_ttl": self.cache_ttl,
            "timeout": self.timeout,
            "max_retries": self.max_retries,
            "retry_delay": self.retry_delay,
            "retry_backoff": self.retry_backoff,
            "batch_size": self.batch_size,
            "flush_interval": self.flush_interval,
            "log_level": self.log_level,
            "user_agent": self.user_agent,
            "verify_ssl": self.verify_ssl,
            **self.extra,
        }

    def __repr__(self) -> str:
        """Return string representation of configuration."""
        return f"ExperimentClientConfig(api_url='{self.api_url}', cache_enabled={self.cache_enabled})"
