"""Example: Simple A/B test using the Experimeh SDK."""

from experimeh import ExperimentClient

# Initialize the client
client = ExperimentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key",
    cache_enabled=True,
    cache_ttl=300,
)

# Initialize client
client.initialize()

try:
    # User ID for this session
    user_id = "user_12345"

    # Get experiment assignment
    print(f"Getting assignment for user {user_id}...")
    assignment = client.get_assignment(
        experiment_key="button_color_test",
        unit_id=user_id,
        context={
            "platform": "web",
            "country": "US",
        },
    )

    print(f"User assigned to variant: {assignment.variant_key}")
    print(f"Assignment reason: {assignment.reason}")
    print(f"From cache: {assignment.cached}")

    # Check which variant the user got
    if assignment.assigned:
        if assignment.variant_key == "blue_button":
            print("Showing blue button")
        elif assignment.variant_key == "green_button":
            print("Showing green button")
        else:
            print("Showing control (red button)")

        # Track exposure (user actually saw the variant)
        client.track_exposure(
            experiment_key="button_color_test",
            unit_id=user_id,
            variant_key=assignment.variant_key,
            context={"page": "checkout"},
        )
        print("Exposure tracked")

    # Simulate user clicking the button
    print("\nUser clicked the button!")

    # Track the conversion metric
    client.track_metric(
        event_name="button_clicked",
        unit_id=user_id,
        value=1,
        properties={
            "button_color": assignment.variant_key,
            "timestamp": "2025-11-06T10:00:00Z",
        },
    )
    print("Metric tracked: button_clicked")

    # Simulate successful checkout
    client.track_metric(
        event_name="checkout_completed",
        unit_id=user_id,
        value=99.99,
        properties={
            "cart_value": 99.99,
            "items": 3,
        },
    )
    print("Metric tracked: checkout_completed")

finally:
    # Shutdown client (flushes pending events)
    client.shutdown()
    print("\nClient shut down successfully")
