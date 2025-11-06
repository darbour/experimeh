"""Example: Factorial experiment using the Experimeh SDK."""

from experimeh import ExperimentClient

# Initialize the client
client = ExperimentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key",
)

# Context manager automatically handles initialization and shutdown
with client:
    user_id = "user_67890"

    print("Running factorial experiment...")
    print(f"User ID: {user_id}\n")

    # Get assignment for factorial experiment
    # This experiment tests: button_color (blue/green) x button_text (buy_now/purchase)
    assignment = client.get_assignment(
        experiment_key="checkout_optimization",
        unit_id=user_id,
        context={
            "platform": "mobile",
            "device": "ios",
        },
    )

    print(f"Assigned to variant: {assignment.variant_key}")

    if assignment.factors:
        print(f"Factor levels:")
        for factor, level in assignment.factors.items():
            print(f"  {factor}: {level}")

        # Extract factor values
        button_color = assignment.factors.get("button_color", "blue")
        button_text = assignment.factors.get("button_text", "buy_now")

        print(f"\nShowing {button_color} button with text '{button_text}'")

        # Track exposure
        client.track_exposure(
            experiment_key="checkout_optimization",
            unit_id=user_id,
            variant_key=assignment.variant_key,
        )

        # Simulate user interaction
        print("\nUser interacted with button")
        client.track_metric(
            event_name="button_interaction",
            unit_id=user_id,
            value=1,
            properties={
                "button_color": button_color,
                "button_text": button_text,
                "interaction_type": "click",
            },
        )

        # Simulate completion
        print("User completed checkout")
        client.track_metric(
            event_name="checkout_completion",
            unit_id=user_id,
            value=1,
            properties={
                "completion_time_seconds": 45,
                "cart_value": 149.99,
            },
        )

        print("\nFactorial experiment completed successfully")
    else:
        print("User not assigned to factorial experiment")
