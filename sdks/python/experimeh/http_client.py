"""HTTP client with retry logic for the Experimeh SDK."""

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import aiohttp
import requests

from .config import ExperimentClientConfig
from .errors import (
    APIError,
    NetworkError,
    RateLimitError,
    TimeoutError as ExperimentTimeoutError,
)
from .utils import exponential_backoff

logger = logging.getLogger(__name__)


class HTTPClient:
    """Synchronous HTTP client with retry logic."""

    def __init__(self, config: ExperimentClientConfig):
        """Initialize HTTP client.

        Args:
            config: Client configuration
        """
        self.config = config
        self._session: Optional[requests.Session] = None

    def _get_session(self) -> requests.Session:
        """Get or create requests session.

        Returns:
            Requests session
        """
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update(self.config.get_headers())
        return self._session

    def close(self) -> None:
        """Close HTTP session."""
        if self._session:
            self._session.close()
            self._session = None

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle HTTP response.

        Args:
            response: Response object

        Returns:
            Parsed response data

        Raises:
            APIError: If API returns error response
            RateLimitError: If rate limited
        """
        try:
            data = response.json()
        except ValueError:
            data = {"text": response.text}

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            raise RateLimitError(
                "Rate limit exceeded",
                retry_after=retry_after,
                limit=response.headers.get("X-RateLimit-Limit"),
            )

        if not response.ok:
            error_msg = data.get("message", "Unknown error")
            raise APIError(error_msg, status_code=response.status_code, response_data=data)

        return data

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API path
            params: Query parameters
            json: JSON body
            headers: Additional headers

        Returns:
            Response data

        Raises:
            NetworkError: If request fails after retries
            APIError: If API returns error
            RateLimitError: If rate limited
            ExperimentTimeoutError: If request times out
        """
        url = f"{self.config.api_url}{path}"
        session = self._get_session()

        # Merge headers
        req_headers = self.config.get_headers()
        if headers:
            req_headers.update(headers)

        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries + 1):
            try:
                logger.debug(
                    f"HTTP {method} {url} (attempt {attempt + 1}/{self.config.max_retries + 1})"
                )

                response = session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    headers=req_headers,
                    timeout=self.config.timeout,
                    verify=self.config.verify_ssl,
                )

                return self._handle_response(response)

            except requests.exceptions.Timeout as e:
                last_error = ExperimentTimeoutError(
                    f"Request timed out after {self.config.timeout}s",
                    timeout=self.config.timeout,
                )
                logger.warning(f"Request timeout: {str(e)}")

            except requests.exceptions.ConnectionError as e:
                last_error = NetworkError(f"Connection error: {str(e)}")
                logger.warning(f"Connection error: {str(e)}")

            except (APIError, RateLimitError) as e:
                # Don't retry on client errors (4xx) except rate limits
                if isinstance(e, RateLimitError) or (
                    isinstance(e, APIError) and e.status_code and e.status_code >= 500
                ):
                    last_error = e
                    logger.warning(f"Retryable error: {str(e)}")
                else:
                    raise

            except Exception as e:
                last_error = NetworkError(f"Request failed: {str(e)}")
                logger.error(f"Unexpected error: {str(e)}")

            # Calculate backoff delay
            if attempt < self.config.max_retries:
                delay = exponential_backoff(
                    attempt, self.config.retry_delay, self.config.retry_backoff
                )
                logger.debug(f"Retrying in {delay:.2f}s...")
                time.sleep(delay)

        # All retries exhausted
        if last_error:
            raise last_error
        raise NetworkError("Request failed after all retries")

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make GET request.

        Args:
            path: API path
            params: Query parameters
            headers: Additional headers

        Returns:
            Response data
        """
        return self.request("GET", path, params=params, headers=headers)

    def post(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make POST request.

        Args:
            path: API path
            json: JSON body
            headers: Additional headers

        Returns:
            Response data
        """
        return self.request("POST", path, json=json, headers=headers)

    def put(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make PUT request.

        Args:
            path: API path
            json: JSON body
            headers: Additional headers

        Returns:
            Response data
        """
        return self.request("PUT", path, json=json, headers=headers)

    def delete(
        self, path: str, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make DELETE request.

        Args:
            path: API path
            headers: Additional headers

        Returns:
            Response data
        """
        return self.request("DELETE", path, headers=headers)


class AsyncHTTPClient:
    """Asynchronous HTTP client with retry logic."""

    def __init__(self, config: ExperimentClientConfig):
        """Initialize async HTTP client.

        Args:
            config: Client configuration
        """
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session.

        Returns:
            Aiohttp session
        """
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self._session = aiohttp.ClientSession(
                headers=self.config.get_headers(),
                timeout=timeout,
            )
        return self._session

    async def close(self) -> None:
        """Close HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def _handle_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """Handle HTTP response.

        Args:
            response: Response object

        Returns:
            Parsed response data

        Raises:
            APIError: If API returns error response
            RateLimitError: If rate limited
        """
        try:
            data = await response.json()
        except Exception:
            text = await response.text()
            data = {"text": text}

        if response.status == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            raise RateLimitError(
                "Rate limit exceeded",
                retry_after=retry_after,
                limit=response.headers.get("X-RateLimit-Limit"),
            )

        if not response.ok:
            error_msg = data.get("message", "Unknown error")
            raise APIError(error_msg, status_code=response.status, response_data=data)

        return data

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make async HTTP request with retry logic.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API path
            params: Query parameters
            json: JSON body
            headers: Additional headers

        Returns:
            Response data

        Raises:
            NetworkError: If request fails after retries
            APIError: If API returns error
            RateLimitError: If rate limited
            ExperimentTimeoutError: If request times out
        """
        url = f"{self.config.api_url}{path}"
        session = await self._get_session()

        # Merge headers
        req_headers = self.config.get_headers()
        if headers:
            req_headers.update(headers)

        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries + 1):
            try:
                logger.debug(
                    f"HTTP {method} {url} (attempt {attempt + 1}/{self.config.max_retries + 1})"
                )

                async with session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json,
                    headers=req_headers,
                    ssl=self.config.verify_ssl,
                ) as response:
                    return await self._handle_response(response)

            except asyncio.TimeoutError:
                last_error = ExperimentTimeoutError(
                    f"Request timed out after {self.config.timeout}s",
                    timeout=self.config.timeout,
                )
                logger.warning(f"Request timeout")

            except aiohttp.ClientConnectionError as e:
                last_error = NetworkError(f"Connection error: {str(e)}")
                logger.warning(f"Connection error: {str(e)}")

            except (APIError, RateLimitError) as e:
                # Don't retry on client errors (4xx) except rate limits
                if isinstance(e, RateLimitError) or (
                    isinstance(e, APIError) and e.status_code and e.status_code >= 500
                ):
                    last_error = e
                    logger.warning(f"Retryable error: {str(e)}")
                else:
                    raise

            except Exception as e:
                last_error = NetworkError(f"Request failed: {str(e)}")
                logger.error(f"Unexpected error: {str(e)}")

            # Calculate backoff delay
            if attempt < self.config.max_retries:
                delay = exponential_backoff(
                    attempt, self.config.retry_delay, self.config.retry_backoff
                )
                logger.debug(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)

        # All retries exhausted
        if last_error:
            raise last_error
        raise NetworkError("Request failed after all retries")

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make async GET request.

        Args:
            path: API path
            params: Query parameters
            headers: Additional headers

        Returns:
            Response data
        """
        return await self.request("GET", path, params=params, headers=headers)

    async def post(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make async POST request.

        Args:
            path: API path
            json: JSON body
            headers: Additional headers

        Returns:
            Response data
        """
        return await self.request("POST", path, json=json, headers=headers)

    async def put(
        self,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make async PUT request.

        Args:
            path: API path
            json: JSON body
            headers: Additional headers

        Returns:
            Response data
        """
        return await self.request("PUT", path, json=json, headers=headers)

    async def delete(
        self, path: str, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make async DELETE request.

        Args:
            path: API path
            headers: Additional headers

        Returns:
            Response data
        """
        return await self.request("DELETE", path, headers=headers)
