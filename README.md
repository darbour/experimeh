# Experimeh - Feature Flag Experimentation System

A comprehensive feature flag based experimentation system supporting complex experimental designs including factorial, within-subjects, and switchback experiments.

## Features

- **Feature Flags**: Real-time feature flag evaluation with targeting rules
- **Simple A/B Testing**: Traditional two-variant experiments
- **Multivariate Testing**: Compare multiple variants of a single factor
- **Factorial Design**: Test multiple factors simultaneously and detect interactions
- **Within-Subjects Design**: Repeated measures with counterbalancing
- **Switchback Experiments**: Temporal switching to mitigate network interference
- **Stepped Wedge Design**: Cluster-randomized trial where all clusters start in control and switch to treatment at randomized times
- **Statistical Analysis**: Built-in statistical tests with proper corrections
- **High Performance**: Deterministic assignment with caching (<10ms latency)
- **Scalable**: Event-driven architecture with Kafka
- **Type Safe**: Written in TypeScript with full type coverage

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Docker >= 20.10 (for infrastructure)
- Docker Compose >= 2.0 (for infrastructure)

Or manually install:
- PostgreSQL >= 14
- Redis >= 6
- Kafka >= 3.0

### Infrastructure Setup

The easiest way to get started is using Docker:

```bash
# Start all infrastructure services (Postgres, Redis, Kafka, Zookeeper)
./scripts/infra-setup.sh

# Follow logs after setup
./scripts/infra-setup.sh --logs

# Check infrastructure health
./scripts/infra-health.sh

# View detailed status
./scripts/infra-health.sh --details

# Stop infrastructure
./scripts/infra-teardown.sh

# Stop and remove all data
./scripts/infra-teardown.sh --volumes

# Complete reset (teardown + setup)
./scripts/infra-reset.sh
```

**Services started:**
- PostgreSQL: `localhost:5432` (DB: `experimeh_test`, User: `experimeh`, Password: `test_password`)
- Redis: `localhost:6379`
- Kafka: `localhost:9092`
- Zookeeper: `localhost:2181`

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure your environment:

```bash
cp .env.example .env
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage
```

## Docker Deployment

### Pre-built Images

The application is automatically built and published to GitHub Container Registry on every push to main and on version tags.

**Pull and run the latest image:**

```bash
# Pull the latest image
docker pull ghcr.io/darbour/experimeh:latest

# Run the full stack (app + dependencies)
docker-compose up -d

# Check health
curl http://localhost:3000/health
```

**Available image tags:**
- `latest`: Most recent build from main branch
- `v1.0.0`: Specific version tags
- `main-{sha}`: Commit-specific builds

### Local Docker Build

```bash
# Build locally
docker build -t experimeh:local .

# Or use docker-compose
docker-compose build
```

### Docker Compose

The `docker-compose.yml` includes the complete stack:
- Experimeh application (port 3000)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Kafka + Zookeeper (port 9092)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f experimeh

# Scale the application
docker-compose up -d --scale experimeh=3

# Stop all services
docker-compose down
```

### Production Deployment

See [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md) for:
- Kubernetes deployment
- Cloud platform deployment (AWS, GCP, Azure)
- Security best practices
- Monitoring and logging
- CI/CD automation
- Environment configuration

## Architecture

The system consists of six major components:

1. **Configuration Service**: Manages experiment and feature flag definitions
2. **Assignment Service**: Handles deterministic assignment for all experiment types
3. **Feature Flag Evaluation**: Real-time flag evaluation with caching
4. **Event Tracking**: High-throughput event ingestion
5. **Data Pipeline**: Stream processing and storage
6. **Analysis Engine**: Statistical analysis and reporting

## API Documentation

See [docs/API.md](docs/API.md) for complete API reference.

### Quick Example

```typescript
import { ExperimentClient } from 'experimeh';

const client = new ExperimentClient({
  apiKey: 'your-api-key',
  endpoint: 'http://localhost:3000'
});

// Get assignment
const assignment = await client.getAssignment({
  experimentKey: 'checkout_optimization',
  unitId: 'user-123',
  context: { platform: 'mobile' }
});

// Track exposure
await client.trackExposure({
  experimentKey: 'checkout_optimization',
  unitId: 'user-123',
  variantKey: assignment.variantKey
});

// Track metric
await client.trackMetric({
  eventName: 'purchase_completed',
  unitId: 'user-123',
  value: 99.99
});
```

## Experimental Designs

### Factorial Design

Test multiple factors simultaneously:

```typescript
{
  "designType": "factorial",
  "designConfig": {
    "factors": [
      { "name": "button_color", "levels": ["blue", "green"] },
      { "name": "button_text", "levels": ["buy_now", "purchase"] }
    ]
  }
}
```

### Switchback Design

Temporal switching for marketplace experiments:

```typescript
{
  "designType": "switchback",
  "designConfig": {
    "switchbackPeriodMinutes": 30,
    "washoutPeriodMinutes": 5
  }
}
```

### Within-Subjects Design

Repeated measures with counterbalancing:

```typescript
{
  "designType": "within_subjects",
  "designConfig": {
    "counterbalancingScheme": "latin_square",
    "sessionCount": 4
  }
}
```

### Stepped Wedge Design

Cluster-randomized trial where all clusters start in control and switch to treatment at randomized times:

```typescript
{
  "designType": "stepped_wedge",
  "designConfig": {
    "numSteps": 5,
    "stepDurationMinutes": 10080,  // 1 week per step
    "clusterKey": "hospital_id",
    "numClusters": 20
  }
}
```

## Documentation

- [Implementation Plan](EXPERIMENTATION_SYSTEM_PLAN.md)
- [API Reference](docs/API.md)
- [Statistical Methods](docs/STATISTICAL_METHODS.md)
- [Best Practices](docs/BEST_PRACTICES.md)
- [Examples](examples/)

## Testing

The system includes comprehensive tests:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and service interactions
- **Statistical Validation Tests**: Verify statistical properties of assignment and analysis

Run with:

```bash
npm run test:coverage
```

## License

MIT
