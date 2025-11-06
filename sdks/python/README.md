# Experimeh Python SDK

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-ready Python SDK for the Experimeh feature flag experimentation platform. Supports A/B tests, multivariate tests, factorial designs, stepped wedge designs, and other complex experimental designs.

## Features

- **Type-Safe API**: Full type hints with Pydantic models
- **Async & Sync Support**: Both synchronous and asynchronous clients
- **Automatic Caching**: In-memory and Redis cache adapters
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error types with context
- **Event Tracking**: Track exposures and metrics
- **Batch Operations**: Efficient batch event processing
- **Complex Designs**: Support for factorial, stepped wedge, and more
- **Production Ready**: Logging, validation, and graceful degradation

## Installation

```bash
pip install experimeh
```

With Redis cache support:
```bash
pip install experimeh[redis]
```

For development:
```bash
pip install experimeh[dev]
```

## Quick Start

### Synchronous Client

```python
from experimeh import ExperimentClient

# Initialize client
client = ExperimentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key",
    cache_enabled=True,
    cache_ttl=300,
)

# Use context manager
with client:
    # Get assignment
    assignment = client.get_assignment(
        experiment_key="button_color_test",
        unit_id="user_123",
        context={"platform": "web"}
    )

    print(f"Variant: {assignment.variant_key}")

    # Track exposure
    if assignment.assigned:
        client.track_exposure(
            experiment_key="button_color_test",
            unit_id="user_123",
            variant_key=assignment.variant_key,
        )

    # Track metric
    client.track_metric(
        event_name="button_clicked",
        unit_id="user_123",
        value=1,
    )
```

### Asynchronous Client

```python
import asyncio
from experimeh import AsyncExperimentClient

async def main():
    client = AsyncExperimentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
    )

    async with client:
        # Get assignment
        assignment = await client.get_assignment(
            experiment_key="button_color_test",
            unit_id="user_123",
        )

        # Track exposure
        await client.track_exposure(
            experiment_key="button_color_test",
            unit_id="user_123",
            variant_key=assignment.variant_key,
        )

        # Track metric
        await client.track_metric(
            event_name="conversion",
            unit_id="user_123",
            value=1,
        )

asyncio.run(main())
```

## Configuration

### Client Options

```python
from experimeh import ExperimentClient

client = ExperimentClient(
    # Required
    api_url="http://localhost:3000",

    # Optional
    api_key="your-api-key",           # API key for authentication
    cache_enabled=True,                # Enable caching (default: True)
    cache_ttl=300,                     # Cache TTL in seconds (default: 300)
    timeout=10,                        # Request timeout in seconds (default: 10)
    max_retries=3,                     # Max retry attempts (default: 3)
    retry_delay=1.0,                   # Initial retry delay (default: 1.0)
    retry_backoff=2.0,                 # Backoff multiplier (default: 2.0)
    log_level="INFO",                  # Logging level (default: INFO)
    verify_ssl=True,                   # Verify SSL certificates (default: True)
)
```

## Caching

### In-Memory Cache

```python
from experimeh import ExperimentClient, InMemoryCache

cache = InMemoryCache(default_ttl=600, max_size=1000)

client = ExperimentClient(
    api_url="http://localhost:3000",
    cache=cache,
)
```

### Redis Cache

```python
from experimeh import AsyncExperimentClient, RedisCache

# Create Redis cache
redis_cache = RedisCache(
    host="localhost",
    port=6379,
    db=0,
    password="your-password",
    key_prefix="experimeh:",
    default_ttl=300,
)

# Connect to Redis
await redis_cache.connect()

# Use with client
client = AsyncExperimentClient(
    api_url="http://localhost:3000",
    cache=redis_cache,
)
```

### No Cache

```python
client = ExperimentClient(
    api_url="http://localhost:3000",
    cache_enabled=False,  # Disable caching
)
```

## API Reference

### ExperimentClient

#### `get_assignment(experiment_key, unit_id, context=None) -> Assignment`

Get experiment assignment for a unit.

**Parameters:**
- `experiment_key` (str): Experiment key
- `unit_id` (str): Unit ID (user, session, etc.)
- `context` (dict, optional): Additional context

**Returns:**
- `Assignment`: Assignment object with variant information

**Example:**
```python
assignment = client.get_assignment(
    experiment_key="homepage_test",
    unit_id="user_123",
    context={
        "platform": "web",
        "country": "US",
        "isPremium": True,
    }
)

print(f"Variant: {assignment.variant_key}")
print(f"Assigned: {assignment.assigned}")
print(f"Factors: {assignment.factors}")
```

#### `track_exposure(experiment_key, unit_id, variant_key, context=None) -> None`

Track exposure event when user sees a variant.

**Parameters:**
- `experiment_key` (str): Experiment key
- `unit_id` (str): Unit ID
- `variant_key` (str): Variant key
- `context` (dict, optional): Additional context

**Example:**
```python
client.track_exposure(
    experiment_key="homepage_test",
    unit_id="user_123",
    variant_key="treatment",
    context={"page": "homepage"}
)
```

#### `track_metric(event_name, unit_id, value=None, properties=None, experiment_ids=None) -> None`

Track metric event.

**Parameters:**
- `event_name` (str): Event name
- `unit_id` (str): Unit ID
- `value` (float, optional): Metric value
- `properties` (dict, optional): Additional properties
- `experiment_ids` (list, optional): Associated experiment IDs

**Example:**
```python
client.track_metric(
    event_name="conversion",
    unit_id="user_123",
    value=99.99,
    properties={
        "cart_value": 99.99,
        "items": 3,
    }
)
```

#### `get_assignment_and_track_exposure(experiment_key, unit_id, context=None) -> Assignment`

Convenience method that gets assignment and tracks exposure.

**Example:**
```python
assignment = client.get_assignment_and_track_exposure(
    experiment_key="homepage_test",
    unit_id="user_123"
)
```

### Assignment Model

```python
class Assignment:
    experiment_id: str              # Experiment ID
    experiment_key: str            # Experiment key
    unit_id: str                   # Unit ID
    variant_key: str               # Assigned variant key
    variant_name: str              # Variant name
    assigned: bool                 # Whether assigned to experiment
    cached: bool                   # Whether from cache
    reason: str                    # Assignment reason
    factors: dict                  # Factorial factors (if applicable)
    stepped_wedge_metadata: dict   # Stepped wedge info (if applicable)
    config: dict                   # Variant configuration
```

## Error Handling

```python
from experimeh import (
    ExperimentClient,
    ExperimentError,
    ExperimentNotFoundError,
    ValidationError,
    NetworkError,
    APIError,
)

try:
    assignment = client.get_assignment("test_exp", "user_123")
except ExperimentNotFoundError as e:
    print(f"Experiment not found: {e.experiment_id}")
except ValidationError as e:
    print(f"Validation error: {e.message}")
except NetworkError as e:
    print(f"Network error: {e.message}")
except APIError as e:
    print(f"API error: {e.message} (status: {e.status_code})")
except ExperimentError as e:
    print(f"General error: {e.message}")
```

### Error Types

- `ExperimentError` - Base exception class
- `ExperimentNotFoundError` - Experiment not found
- `ExperimentInactiveError` - Experiment not active
- `AssignmentError` - Assignment failed
- `ValidationError` - Input validation failed
- `ConfigurationError` - Configuration error
- `NetworkError` - Network request failed
- `APIError` - API returned error
- `CacheError` - Cache operation failed
- `RateLimitError` - Rate limit exceeded
- `TimeoutError` - Request timeout

## Advanced Usage

### Factorial Experiments

```python
assignment = client.get_assignment(
    experiment_key="checkout_optimization",
    unit_id="user_123",
)

if assignment.factors:
    button_color = assignment.factors["button_color"]  # "blue" or "green"
    button_text = assignment.factors["button_text"]    # "buy" or "purchase"

    print(f"Show {button_color} button with text '{button_text}'")
```

### Stepped Wedge Experiments

```python
assignment = client.get_assignment(
    experiment_key="hospital_protocol_rollout",
    unit_id="patient_456",
    context={"hospital_unit_id": "unit-5"}
)

if assignment.stepped_wedge_metadata:
    metadata = assignment.stepped_wedge_metadata
    print(f"Current step: {metadata['currentStep']}")
    print(f"In treatment: {metadata['inTreatment']}")
    print(f"Switch step: {metadata['switchStep']}")
```

### Feature Flag Evaluation

```python
from experimeh import FeatureFlagEvaluation

evaluation = client.evaluate_flag(
    flag_key="new_feature",
    unit_id="user_123",
    context={"platform": "web"}
)

if evaluation.enabled and evaluation.value:
    print("Feature is enabled!")
```

### Custom Cache Adapter

```python
from experimeh import CacheAdapter

class CustomCache(CacheAdapter):
    async def get(self, key: str):
        # Your implementation
        pass

    async def set(self, key: str, value, ttl=None):
        # Your implementation
        pass

    async def delete(self, key: str):
        # Your implementation
        pass

    async def clear(self):
        # Your implementation
        pass

    async def has(self, key: str) -> bool:
        # Your implementation
        pass

client = ExperimentClient(
    api_url="http://localhost:3000",
    cache=CustomCache(),
)
```

## Examples

See the `examples/` directory for complete examples:

- `simple_ab_test.py` - Basic A/B test
- `factorial.py` - Factorial experiment
- `async_usage.py` - Async client usage
- `with_caching.py` - Different cache backends

## Testing

Run tests:
```bash
pytest
```

Run tests with coverage:
```bash
pytest --cov=experimeh --cov-report=html
```

Run async tests:
```bash
pytest tests/test_client.py -v -m asyncio
```

## Development

Install development dependencies:
```bash
pip install -e ".[dev]"
```

Format code:
```bash
black experimeh tests examples
isort experimeh tests examples
```

Type checking:
```bash
mypy experimeh
```

Linting:
```bash
flake8 experimeh tests
```

## Best Practices

### 1. Use Context Managers

Always use context managers to ensure proper cleanup:

```python
with ExperimentClient(api_url="...") as client:
    assignment = client.get_assignment("exp", "user")
```

### 2. Track Exposures Separately

Only track exposure when user actually sees the variant:

```python
assignment = client.get_assignment("exp", "user")

# Show variant to user
if assignment.assigned:
    render_variant(assignment.variant_key)
    # Now track exposure
    client.track_exposure("exp", "user", assignment.variant_key)
```

### 3. Handle Errors Gracefully

Always provide fallback behavior:

```python
try:
    assignment = client.get_assignment("exp", "user")
    variant = assignment.variant_key
except ExperimentError:
    variant = "control"  # Fallback
```

### 4. Use Caching

Enable caching for better performance:

```python
client = ExperimentClient(
    api_url="...",
    cache_enabled=True,
    cache_ttl=300,  # 5 minutes
)
```

### 5. Provide Context

Include relevant context for better targeting:

```python
assignment = client.get_assignment(
    experiment_key="exp",
    unit_id="user_123",
    context={
        "platform": "web",
        "country": "US",
        "userTier": "premium",
    }
)
```

## Python Version Support

- Python 3.8+
- Full type hints support
- Async/await support

## Requirements

- `pydantic>=2.0.0` - Data validation
- `requests>=2.31.0` - HTTP client
- `aiohttp>=3.8.0` - Async HTTP client
- `redis>=4.5.0` - Redis support (optional)

## Contributing

Contributions are welcome! Please see the main project repository for contribution guidelines.

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.experimeh.com
- GitHub: https://github.com/experimeh/experimeh-python-sdk
- Issues: https://github.com/experimeh/experimeh-python-sdk/issues

## Changelog

### 1.0.0 (2025-11-06)

- Initial release
- Synchronous and asynchronous clients
- In-memory and Redis caching
- Full support for complex experimental designs
- Comprehensive error handling
- Type hints and Pydantic models
- Complete test suite
- Examples and documentation
