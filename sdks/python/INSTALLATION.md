# Installation and Quick Start Guide

## Installation

### Option 1: Install from source (local development)

```bash
cd /home/user/experimeh/sdks/python

# Install dependencies
pip install -r requirements.txt

# Install package in editable mode
pip install -e .

# Or install with all extras
pip install -e ".[dev,redis]"
```

### Option 2: Install for production use

```bash
# Once published to PyPI
pip install experimeh

# With Redis support
pip install experimeh[redis]
```

## Quick Verification

After installation, verify the SDK is working:

```python
# test_import.py
from experimeh import (
    ExperimentClient,
    AsyncExperimentClient,
    InMemoryCache,
    Assignment,
    __version__
)

print(f"✓ Experimeh SDK v{__version__} imported successfully")
print(f"✓ ExperimentClient: {ExperimentClient}")
print(f"✓ AsyncExperimentClient: {AsyncExperimentClient}")
print(f"✓ InMemoryCache: {InMemoryCache}")
print(f"✓ Assignment model: {Assignment}")
```

Run with:
```bash
python test_import.py
```

## Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=experimeh --cov-report=html

# View coverage report
open htmlcov/index.html
```

## Running Examples

```bash
# Make sure API is running on localhost:3000
# Then run examples:

python examples/simple_ab_test.py
python examples/factorial.py
python examples/async_usage.py
python examples/with_caching.py
python examples/stepped_wedge.py
```

## Development Setup

```bash
# Clone and setup
cd /home/user/experimeh/sdks/python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode with all extras
pip install -e ".[dev,redis]"

# Install pre-commit hooks (optional)
pip install pre-commit
pre-commit install

# Run quality checks
make format      # Format code
make lint        # Lint code
make type-check  # Type checking
make test        # Run tests
make check       # Run all checks
```

## Configuration for Your Environment

1. **Set API URL**: Update `api_url` in examples or use environment variable:
   ```python
   import os
   client = ExperimentClient(
       api_url=os.getenv("EXPERIMEH_API_URL", "http://localhost:3000"),
       api_key=os.getenv("EXPERIMEH_API_KEY"),
   )
   ```

2. **Configure Redis** (if using Redis cache):
   ```bash
   # Start Redis with Docker
   docker run -d -p 6379:6379 redis:latest

   # Or use existing Redis instance
   export REDIS_HOST=your-redis-host
   export REDIS_PORT=6379
   ```

3. **Set Log Level**:
   ```python
   client = ExperimentClient(
       api_url="...",
       log_level="DEBUG",  # DEBUG, INFO, WARNING, ERROR
   )
   ```

## Troubleshooting

### Import Errors

If you get import errors:
```bash
# Make sure you're in the right directory
cd /home/user/experimeh/sdks/python

# Reinstall dependencies
pip install -r requirements.txt

# Check Python version (requires 3.8+)
python --version
```

### Pydantic Errors

If you see Pydantic version errors:
```bash
# Upgrade Pydantic
pip install --upgrade "pydantic>=2.0.0"
```

### Redis Connection Errors

If Redis cache fails:
```bash
# Check if Redis is running
redis-cli ping

# Or start Redis
docker run -d -p 6379:6379 redis:latest

# Or use in-memory cache instead
client = ExperimentClient(
    api_url="...",
    cache=InMemoryCache(),  # Use in-memory instead of Redis
)
```

### API Connection Errors

If you can't connect to the API:
```bash
# Check if API is running
curl http://localhost:3000/health

# Start the API server
cd /home/user/experimeh
npm run dev
```

## Next Steps

1. Read the [README.md](README.md) for complete documentation
2. Review [examples/](examples/) for usage patterns
3. Check [tests/](tests/) for testing examples
4. See [PYTHON_SDK_SUMMARY.md](PYTHON_SDK_SUMMARY.md) for architecture details

## Support

For issues or questions:
- Check the [README.md](README.md) documentation
- Review the [examples/](examples/) directory
- Run tests to verify installation: `pytest`
