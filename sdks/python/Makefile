.PHONY: install install-dev test test-cov format lint type-check clean build publish

# Install package
install:
	pip install -e .

# Install with dev dependencies
install-dev:
	pip install -e ".[dev,redis]"

# Run tests
test:
	pytest tests/ -v

# Run tests with coverage
test-cov:
	pytest tests/ -v --cov=experimeh --cov-report=term-missing --cov-report=html

# Format code
format:
	black experimeh tests examples
	isort experimeh tests examples

# Lint code
lint:
	flake8 experimeh tests examples
	black --check experimeh tests examples
	isort --check-only experimeh tests examples

# Type checking
type-check:
	mypy experimeh

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov/
	rm -rf .mypy_cache
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Build package
build: clean
	python -m build

# Publish to PyPI (test)
publish-test: build
	twine upload --repository testpypi dist/*

# Publish to PyPI
publish: build
	twine upload dist/*

# Run all quality checks
check: format lint type-check test

# Show help
help:
	@echo "Available commands:"
	@echo "  make install       - Install package"
	@echo "  make install-dev   - Install with dev dependencies"
	@echo "  make test          - Run tests"
	@echo "  make test-cov      - Run tests with coverage"
	@echo "  make format        - Format code with black and isort"
	@echo "  make lint          - Lint code"
	@echo "  make type-check    - Run type checking"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make build         - Build package"
	@echo "  make check         - Run all quality checks"
