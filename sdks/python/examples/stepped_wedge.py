"""Example: Stepped wedge experiment using the Experimeh SDK."""

from experimeh import ExperimentClient


def main():
    """Demo stepped wedge experiment."""
    print("=== Stepped Wedge Experiment Demo ===\n")

    client = ExperimentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
        cache_enabled=True,
    )

    with client:
        # Simulate different patients in different hospital units
        units_and_patients = [
            ("unit-1", "patient_001"),
            ("unit-5", "patient_002"),
            ("unit-10", "patient_003"),
            ("unit-15", "patient_004"),
            ("unit-20", "patient_005"),
        ]

        print("Hospital Protocol Rollout - Stepped Wedge Design")
        print("=" * 60)

        for unit_id, patient_id in units_and_patients:
            print(f"\nUnit: {unit_id}, Patient: {patient_id}")

            # Get assignment with cluster context
            assignment = client.get_assignment(
                experiment_key="hospital_protocol_rollout",
                unit_id=patient_id,
                context={"hospital_unit_id": unit_id},
            )

            print(f"  Assigned to: {assignment.variant_key}")

            # Check stepped wedge metadata
            if assignment.stepped_wedge_metadata:
                metadata = assignment.stepped_wedge_metadata

                print(f"  Current step: {metadata['currentStep']}")
                print(f"  Switch step: {metadata['switchStep']}")
                print(f"  In treatment: {metadata['inTreatment']}")
                print(f"  Step duration: {metadata.get('stepDurationMinutes', 0)} minutes")

                # Track exposure
                client.track_exposure(
                    experiment_key="hospital_protocol_rollout",
                    unit_id=patient_id,
                    variant_key=assignment.variant_key,
                    context={
                        "hospital_unit_id": unit_id,
                        "current_step": metadata["currentStep"],
                    },
                )

                # Simulate measuring compliance
                if metadata["inTreatment"]:
                    print("  → Using enhanced protocol")
                    compliance_rate = 0.85  # Example
                else:
                    print("  → Using standard protocol")
                    compliance_rate = 0.65  # Example

                # Track compliance metric
                client.track_metric(
                    event_name="hand_hygiene_compliance",
                    unit_id=patient_id,
                    value=compliance_rate,
                    properties={
                        "hospital_unit_id": unit_id,
                        "protocol": assignment.variant_key,
                        "current_step": metadata["currentStep"],
                    },
                )

                print(f"  Compliance rate tracked: {compliance_rate:.2%}")

        print("\n" + "=" * 60)
        print("Stepped wedge experiment demo completed")


if __name__ == "__main__":
    main()
