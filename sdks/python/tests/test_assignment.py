"""Tests for assignment logic."""

import pytest

from experimeh import Assignment


class TestAssignment:
    """Tests for Assignment model."""

    def test_assignment_creation(self):
        """Test creating an assignment."""
        assignment = Assignment(
            experimentId="exp-123",
            experimentKey="test_exp",
            unitId="user123",
            variantKey="treatment",
            assigned=True,
        )

        assert assignment.experiment_id == "exp-123"
        assert assignment.experiment_key == "test_exp"
        assert assignment.unit_id == "user123"
        assert assignment.variant_key == "treatment"
        assert assignment.assigned is True

    def test_assignment_with_factors(self):
        """Test assignment with factorial factors."""
        assignment = Assignment(
            experimentId="exp-123",
            unitId="user123",
            variantKey="treatment",
            assigned=True,
            factors={"button_color": "blue", "button_text": "buy_now"},
        )

        assert assignment.factors is not None
        assert assignment.factors["button_color"] == "blue"
        assert assignment.factors["button_text"] == "buy_now"

    def test_assignment_with_stepped_wedge(self):
        """Test assignment with stepped wedge metadata."""
        assignment = Assignment(
            experimentId="exp-123",
            unitId="user123",
            variantKey="treatment",
            assigned=True,
            steppedWedgeMetadata={
                "currentStep": 3,
                "switchStep": 2,
                "inTreatment": True,
            },
        )

        assert assignment.stepped_wedge_metadata is not None
        assert assignment.stepped_wedge_metadata["currentStep"] == 3

    def test_assignment_from_dict(self):
        """Test creating assignment from dictionary."""
        data = {
            "experimentId": "exp-123",
            "unitId": "user123",
            "variantKey": "control",
            "assigned": False,
        }

        assignment = Assignment(**data)
        assert assignment.experiment_id == "exp-123"
        assert assignment.variant_key == "control"

    def test_assignment_to_dict(self):
        """Test converting assignment to dictionary."""
        assignment = Assignment(
            experimentId="exp-123",
            unitId="user123",
            variantKey="treatment",
            assigned=True,
        )

        data = assignment.model_dump(by_alias=True)
        assert data["experimentId"] == "exp-123"
        assert data["variantKey"] == "treatment"
