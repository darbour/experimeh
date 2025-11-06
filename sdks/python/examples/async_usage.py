"""Example: Async usage of the Experimeh SDK."""

import asyncio

from experimeh import AsyncExperimentClient


async def run_experiment(user_id: str):
    """Run experiment for a single user."""
    # Initialize async client
    client = AsyncExperimentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
        cache_enabled=True,
    )

    # Use async context manager
    async with client:
        print(f"Processing user: {user_id}")

        # Get assignment
        assignment = await client.get_assignment(
            experiment_key="homepage_redesign",
            unit_id=user_id,
            context={"platform": "web"},
        )

        print(f"  Assigned to: {assignment.variant_key}")

        if assignment.assigned:
            # Track exposure
            await client.track_exposure(
                experiment_key="homepage_redesign",
                unit_id=user_id,
                variant_key=assignment.variant_key,
            )

            # Simulate user action
            await asyncio.sleep(0.1)  # Simulate some processing

            # Track metric
            await client.track_metric(
                event_name="page_view",
                unit_id=user_id,
                value=1,
            )

            print(f"  Tracked exposure and metrics")

        return assignment


async def run_multiple_experiments():
    """Run experiments for multiple users concurrently."""
    users = [f"user_{i}" for i in range(10)]

    print(f"Running experiments for {len(users)} users concurrently...\n")

    # Run experiments concurrently
    tasks = [run_experiment(user_id) for user_id in users]
    assignments = await asyncio.gather(*tasks)

    print(f"\n{len(assignments)} assignments completed")

    # Count variant distribution
    variant_counts = {}
    for assignment in assignments:
        variant = assignment.variant_key
        variant_counts[variant] = variant_counts.get(variant, 0) + 1

    print("\nVariant distribution:")
    for variant, count in variant_counts.items():
        print(f"  {variant}: {count} users ({count/len(users)*100:.1f}%)")


async def main():
    """Main async function."""
    print("=== Async Experimeh SDK Demo ===\n")

    # Example 1: Single user
    print("Example 1: Single user experiment")
    await run_experiment("demo_user_001")

    print("\n" + "=" * 50 + "\n")

    # Example 2: Multiple users concurrently
    print("Example 2: Multiple users concurrently")
    await run_multiple_experiments()

    print("\n=== Demo completed ===")


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
