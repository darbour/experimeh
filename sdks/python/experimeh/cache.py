"""Caching implementation for the Experimeh SDK."""

import json
import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from .errors import CacheError

logger = logging.getLogger(__name__)


class CacheAdapter(ABC):
    """Abstract base class for cache adapters."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        pass

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
        """
        pass

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete value from cache.

        Args:
            key: Cache key
        """
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all cached values."""
        pass

    @abstractmethod
    async def has(self, key: str) -> bool:
        """Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if key exists, False otherwise
        """
        pass

    def get_sync(self, key: str) -> Optional[Any]:
        """Synchronous version of get (for backwards compatibility).

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is running, create a new task
                raise CacheError("Cannot call sync method from async context")
            return loop.run_until_complete(self.get(key))
        except RuntimeError:
            # No event loop, create one
            return asyncio.run(self.get(key))

    def set_sync(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Synchronous version of set.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                raise CacheError("Cannot call sync method from async context")
            loop.run_until_complete(self.set(key, value, ttl))
        except RuntimeError:
            asyncio.run(self.set(key, value, ttl))


class InMemoryCache(CacheAdapter):
    """In-memory cache implementation with TTL support."""

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """Initialize in-memory cache.

        Args:
            default_ttl: Default TTL in seconds
            max_size: Maximum number of items to cache
        """
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        logger.debug(f"Initialized InMemoryCache with TTL={default_ttl}s, max_size={max_size}")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found or expired
        """
        if key not in self._cache:
            logger.debug(f"Cache miss: {key}")
            return None

        value, expires_at = self._cache[key]

        # Check if expired
        if expires_at and time.time() > expires_at:
            logger.debug(f"Cache expired: {key}")
            await self.delete(key)
            return None

        logger.debug(f"Cache hit: {key}")
        return value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (uses default if not specified)
        """
        # Enforce max size
        if len(self._cache) >= self._max_size and key not in self._cache:
            # Remove oldest entry (simple FIFO)
            oldest_key = next(iter(self._cache))
            await self.delete(oldest_key)
            logger.debug(f"Cache evicted oldest entry: {oldest_key}")

        ttl = ttl if ttl is not None else self._default_ttl
        expires_at = time.time() + ttl if ttl > 0 else 0

        self._cache[key] = (value, expires_at)
        logger.debug(f"Cache set: {key} (TTL={ttl}s)")

    async def delete(self, key: str) -> None:
        """Delete value from cache.

        Args:
            key: Cache key
        """
        if key in self._cache:
            del self._cache[key]
            logger.debug(f"Cache deleted: {key}")

    async def clear(self) -> None:
        """Clear all cached values."""
        count = len(self._cache)
        self._cache.clear()
        logger.debug(f"Cache cleared: {count} entries removed")

    async def has(self, key: str) -> bool:
        """Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if key exists and not expired, False otherwise
        """
        value = await self.get(key)
        return value is not None

    def size(self) -> int:
        """Get current cache size.

        Returns:
            Number of items in cache
        """
        return len(self._cache)


class RedisCache(CacheAdapter):
    """Redis cache implementation."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        key_prefix: str = "experimeh:",
        default_ttl: int = 300,
        **kwargs: Any,
    ):
        """Initialize Redis cache.

        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            password: Redis password
            key_prefix: Prefix for all cache keys
            default_ttl: Default TTL in seconds
            **kwargs: Additional redis connection parameters
        """
        self._host = host
        self._port = port
        self._db = db
        self._password = password
        self._key_prefix = key_prefix
        self._default_ttl = default_ttl
        self._redis_kwargs = kwargs
        self._redis: Optional[Any] = None
        logger.debug(
            f"Initialized RedisCache with host={host}:{port}, db={db}, prefix={key_prefix}"
        )

    async def connect(self) -> None:
        """Connect to Redis server.

        Raises:
            CacheError: If connection fails
        """
        try:
            import redis.asyncio as redis
        except ImportError:
            raise CacheError(
                "redis package is required for RedisCache. Install with: pip install redis"
            )

        try:
            self._redis = redis.Redis(
                host=self._host,
                port=self._port,
                db=self._db,
                password=self._password,
                decode_responses=True,
                **self._redis_kwargs,
            )
            # Test connection
            await self._redis.ping()
            logger.info(f"Connected to Redis at {self._host}:{self._port}")
        except Exception as e:
            raise CacheError(f"Failed to connect to Redis: {str(e)}")

    async def disconnect(self) -> None:
        """Disconnect from Redis server."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("Disconnected from Redis")

    def _ensure_connected(self) -> None:
        """Ensure Redis connection is established.

        Raises:
            CacheError: If not connected
        """
        if not self._redis:
            raise CacheError("Redis not connected. Call connect() first.")

    def _make_key(self, key: str) -> str:
        """Create Redis key with prefix.

        Args:
            key: Cache key

        Returns:
            Prefixed key
        """
        return f"{self._key_prefix}{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        self._ensure_connected()
        try:
            redis_key = self._make_key(key)
            value = await self._redis.get(redis_key)

            if value is None:
                logger.debug(f"Cache miss: {key}")
                return None

            logger.debug(f"Cache hit: {key}")
            # Try to parse as JSON
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value

        except Exception as e:
            logger.error(f"Redis get error: {str(e)}")
            raise CacheError(f"Failed to get from cache: {str(e)}", operation="get")

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
        """
        self._ensure_connected()
        try:
            redis_key = self._make_key(key)
            ttl = ttl if ttl is not None else self._default_ttl

            # Serialize value as JSON if not string
            if not isinstance(value, str):
                value = json.dumps(value)

            if ttl > 0:
                await self._redis.setex(redis_key, ttl, value)
            else:
                await self._redis.set(redis_key, value)

            logger.debug(f"Cache set: {key} (TTL={ttl}s)")

        except Exception as e:
            logger.error(f"Redis set error: {str(e)}")
            raise CacheError(f"Failed to set in cache: {str(e)}", operation="set")

    async def delete(self, key: str) -> None:
        """Delete value from cache.

        Args:
            key: Cache key
        """
        self._ensure_connected()
        try:
            redis_key = self._make_key(key)
            await self._redis.delete(redis_key)
            logger.debug(f"Cache deleted: {key}")

        except Exception as e:
            logger.error(f"Redis delete error: {str(e)}")
            raise CacheError(f"Failed to delete from cache: {str(e)}", operation="delete")

    async def clear(self) -> None:
        """Clear all cached values with prefix."""
        self._ensure_connected()
        try:
            # Scan for keys with prefix
            pattern = f"{self._key_prefix}*"
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                await self._redis.delete(*keys)
                logger.debug(f"Cache cleared: {len(keys)} entries removed")

        except Exception as e:
            logger.error(f"Redis clear error: {str(e)}")
            raise CacheError(f"Failed to clear cache: {str(e)}", operation="clear")

    async def has(self, key: str) -> bool:
        """Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if key exists, False otherwise
        """
        self._ensure_connected()
        try:
            redis_key = self._make_key(key)
            exists = await self._redis.exists(redis_key)
            return bool(exists)

        except Exception as e:
            logger.error(f"Redis has error: {str(e)}")
            raise CacheError(f"Failed to check cache: {str(e)}", operation="has")


class NoOpCache(CacheAdapter):
    """No-operation cache that doesn't store anything."""

    async def get(self, key: str) -> Optional[Any]:
        """Always returns None."""
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Does nothing."""
        pass

    async def delete(self, key: str) -> None:
        """Does nothing."""
        pass

    async def clear(self) -> None:
        """Does nothing."""
        pass

    async def has(self, key: str) -> bool:
        """Always returns False."""
        return False
