"""Tests for ExperimentClient."""

import pytest
from unittest.mock import Mock, patch

from experimeh import (
    ExperimentClient,
    AsyncExperimentClient,
    Assignment,
    ValidationError,
    NetworkError,
)


class TestExperimentClient:
    """Tests for synchronous ExperimentClient."""

    def test_init(self):
        """Test client initialization."""
        client = ExperimentClient(
            api_url="http://localhost:3000",
            api_key="test-key",
            cache_enabled=True,
            cache_ttl=300,
        )

        assert client.config.api_url == "http://localhost:3000"
        assert client.config.api_key == "test-key"
        assert client.config.cache_enabled is True
        assert client.config.cache_ttl == 300

    def test_init_missing_url(self):
        """Test client initialization without URL."""
        with pytest.raises(Exception):
            ExperimentClient(api_url="")

    @patch("experimeh.client.HTTPClient.get")
    def test_get_assignment(self, mock_get):
        """Test get_assignment method."""
        mock_get.return_value = {
            "success": True,
            "data": {
                "unitId": "user123",
                "assignments": {
                    "test_exp": {
                        "experimentId": "exp-123",
                        "variantKey": "treatment",
                        "assigned": True,
                        "reason": "hash_assignment",
                    }
                },
            },
        }

        client = ExperimentClient(
            api_url="http://localhost:3000", cache_enabled=False
        )
        assignment = client.get_assignment("test_exp", "user123")

        assert isinstance(assignment, Assignment)
        assert assignment.variant_key == "treatment"
        assert assignment.assigned is True
        assert assignment.experiment_key == "test_exp"
        assert assignment.unit_id == "user123"

    def test_get_assignment_validation(self):
        """Test assignment validation."""
        client = ExperimentClient(
            api_url="http://localhost:3000", cache_enabled=False
        )

        with pytest.raises(ValidationError):
            client.get_assignment("", "user123")

        with pytest.raises(ValidationError):
            client.get_assignment("test_exp", "")

    @patch("experimeh.client.HTTPClient.post")
    def test_track_exposure(self, mock_post):
        """Test track_exposure method."""
        mock_post.return_value = {"success": True}

        client = ExperimentClient(api_url="http://localhost:3000")
        client.track_exposure("test_exp", "user123", "treatment")

        mock_post.assert_called_once()

    @patch("experimeh.client.HTTPClient.post")
    def test_track_metric(self, mock_post):
        """Test track_metric method."""
        mock_post.return_value = {"success": True}

        client = ExperimentClient(api_url="http://localhost:3000")
        client.track_metric("conversion", "user123", value=1.0)

        mock_post.assert_called_once()

    def test_context_manager(self):
        """Test context manager usage."""
        with ExperimentClient(api_url="http://localhost:3000") as client:
            assert client._initialized is True

    def test_caching(self):
        """Test assignment caching."""
        with patch("experimeh.client.HTTPClient.get") as mock_get:
            mock_get.return_value = {
                "success": True,
                "data": {
                    "unitId": "user123",
                    "assignments": {
                        "test_exp": {
                            "experimentId": "exp-123",
                            "variantKey": "treatment",
                            "assigned": True,
                        }
                    },
                },
            }

            client = ExperimentClient(
                api_url="http://localhost:3000", cache_enabled=True
            )

            # First call - should hit API
            assignment1 = client.get_assignment("test_exp", "user123")
            assert mock_get.call_count == 1

            # Second call - should use cache
            assignment2 = client.get_assignment("test_exp", "user123")
            assert mock_get.call_count == 1  # Still 1, used cache
            assert assignment2.cached is True


@pytest.mark.asyncio
class TestAsyncExperimentClient:
    """Tests for asynchronous AsyncExperimentClient."""

    async def test_init(self):
        """Test async client initialization."""
        client = AsyncExperimentClient(
            api_url="http://localhost:3000",
            api_key="test-key",
            cache_enabled=True,
        )

        assert client.config.api_url == "http://localhost:3000"
        assert client.config.api_key == "test-key"

    @patch("experimeh.client.AsyncHTTPClient.get")
    async def test_get_assignment(self, mock_get):
        """Test async get_assignment method."""
        mock_get.return_value = {
            "success": True,
            "data": {
                "unitId": "user123",
                "assignments": {
                    "test_exp": {
                        "experimentId": "exp-123",
                        "variantKey": "treatment",
                        "assigned": True,
                    }
                },
            },
        }

        client = AsyncExperimentClient(
            api_url="http://localhost:3000", cache_enabled=False
        )
        assignment = await client.get_assignment("test_exp", "user123")

        assert isinstance(assignment, Assignment)
        assert assignment.variant_key == "treatment"

    @patch("experimeh.client.AsyncHTTPClient.post")
    async def test_track_exposure(self, mock_post):
        """Test async track_exposure method."""
        mock_post.return_value = {"success": True}

        client = AsyncExperimentClient(api_url="http://localhost:3000")
        await client.track_exposure("test_exp", "user123", "treatment")

        mock_post.assert_called_once()

    async def test_context_manager(self):
        """Test async context manager usage."""
        async with AsyncExperimentClient(api_url="http://localhost:3000") as client:
            assert client._initialized is True
