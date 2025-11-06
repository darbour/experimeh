"""Example: Using different cache backends with the Experimeh SDK."""

import time

from experimeh import ExperimentClient, InMemoryCache, RedisCache


def demo_in_memory_cache():
    """Demo using in-memory cache."""
    print("=== In-Memory Cache Demo ===\n")

    # Create custom in-memory cache
    cache = InMemoryCache(default_ttl=60, max_size=1000)

    client = ExperimentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
        cache=cache,
    )

    with client:
        user_id = "cache_demo_user_001"

        # First call - should hit API
        print("First call (should hit API)...")
        start = time.time()
        assignment1 = client.get_assignment("button_test", user_id)
        duration1 = time.time() - start
        print(f"  Variant: {assignment1.variant_key}")
        print(f"  Cached: {assignment1.cached}")
        print(f"  Duration: {duration1*1000:.2f}ms\n")

        # Second call - should use cache
        print("Second call (should use cache)...")
        start = time.time()
        assignment2 = client.get_assignment("button_test", user_id)
        duration2 = time.time() - start
        print(f"  Variant: {assignment2.variant_key}")
        print(f"  Cached: {assignment2.cached}")
        print(f"  Duration: {duration2*1000:.2f}ms\n")

        print(f"Cache speedup: {duration1/duration2:.1f}x faster\n")


def demo_redis_cache():
    """Demo using Redis cache."""
    print("=== Redis Cache Demo ===\n")

    # Note: Redis must be running for this to work
    try:
        # Create Redis cache
        redis_cache = RedisCache(
            host="localhost",
            port=6379,
            db=0,
            key_prefix="experimeh:",
            default_ttl=300,
        )

        # Connect to Redis (async operation - needs event loop)
        # In a real app, you'd use AsyncExperimentClient with Redis
        print("Note: Redis cache works best with AsyncExperimentClient")
        print("See async_usage.py for an example\n")

    except Exception as e:
        print(f"Redis not available: {e}")
        print("Make sure Redis is running: docker run -p 6379:6379 redis\n")


def demo_no_cache():
    """Demo without caching."""
    print("=== No Cache Demo ===\n")

    client = ExperimentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
        cache_enabled=False,  # Disable caching
    )

    with client:
        user_id = "no_cache_user_001"

        # Both calls should hit API
        print("First call...")
        assignment1 = client.get_assignment("button_test", user_id)
        print(f"  Variant: {assignment1.variant_key}")
        print(f"  Cached: {assignment1.cached}\n")

        print("Second call...")
        assignment2 = client.get_assignment("button_test", user_id)
        print(f"  Variant: {assignment2.variant_key}")
        print(f"  Cached: {assignment2.cached}\n")


def main():
    """Run cache demos."""
    print("Experimeh SDK - Caching Examples\n")
    print("=" * 50 + "\n")

    # Demo 1: In-memory cache
    demo_in_memory_cache()

    print("=" * 50 + "\n")

    # Demo 2: Redis cache
    demo_redis_cache()

    print("=" * 50 + "\n")

    # Demo 3: No cache
    demo_no_cache()

    print("=" * 50)
    print("Demo completed!")


if __name__ == "__main__":
    main()
