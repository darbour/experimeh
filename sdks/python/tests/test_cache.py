"""Tests for cache implementations."""

import asyncio
import time

import pytest

from experimeh import InMemoryCache, NoOpCache


@pytest.mark.asyncio
class TestInMemoryCache:
    """Tests for InMemoryCache."""

    async def test_get_set(self):
        """Test basic get and set operations."""
        cache = InMemoryCache(default_ttl=300)

        await cache.set("key1", "value1")
        result = await cache.get("key1")

        assert result == "value1"

    async def test_get_missing(self):
        """Test getting missing key."""
        cache = InMemoryCache()
        result = await cache.get("missing")

        assert result is None

    async def test_ttl_expiration(self):
        """Test TTL expiration."""
        cache = InMemoryCache(default_ttl=1)

        await cache.set("key1", "value1", ttl=1)
        result1 = await cache.get("key1")
        assert result1 == "value1"

        # Wait for expiration
        await asyncio.sleep(1.1)

        result2 = await cache.get("key1")
        assert result2 is None

    async def test_delete(self):
        """Test delete operation."""
        cache = InMemoryCache()

        await cache.set("key1", "value1")
        assert await cache.has("key1") is True

        await cache.delete("key1")
        assert await cache.has("key1") is False

    async def test_clear(self):
        """Test clear operation."""
        cache = InMemoryCache()

        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        assert cache.size() == 2

        await cache.clear()
        assert cache.size() == 0

    async def test_has(self):
        """Test has operation."""
        cache = InMemoryCache()

        assert await cache.has("key1") is False

        await cache.set("key1", "value1")
        assert await cache.has("key1") is True

    async def test_max_size(self):
        """Test max size enforcement."""
        cache = InMemoryCache(max_size=2)

        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.set("key3", "value3")

        # Should evict oldest entry
        assert cache.size() == 2
        assert await cache.has("key1") is False
        assert await cache.has("key2") is True
        assert await cache.has("key3") is True

    async def test_complex_values(self):
        """Test caching complex values."""
        cache = InMemoryCache()

        value = {
            "experimentId": "exp-123",
            "variantKey": "treatment",
            "assigned": True,
        }

        await cache.set("assignment", value)
        result = await cache.get("assignment")

        assert result == value


@pytest.mark.asyncio
class TestNoOpCache:
    """Tests for NoOpCache."""

    async def test_noop_operations(self):
        """Test that NoOpCache doesn't store anything."""
        cache = NoOpCache()

        await cache.set("key1", "value1")
        result = await cache.get("key1")

        assert result is None
        assert await cache.has("key1") is False

    async def test_clear(self):
        """Test clear operation (does nothing)."""
        cache = NoOpCache()
        await cache.clear()  # Should not raise

    async def test_delete(self):
        """Test delete operation (does nothing)."""
        cache = NoOpCache()
        await cache.delete("key1")  # Should not raise
