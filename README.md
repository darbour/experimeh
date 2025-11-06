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
- PostgreSQL >= 14
- Redis >= 6
- Kafka >= 3.0 (optional, for production)

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

## Architecture

The system consists of six major components:

1. **Configuration Service**: Manages experiment and feature flag definitions
2. **Assignment Service**: Handles deterministic assignment for all experiment types
3. **Feature Flag Evaluation**: Real-time flag evaluation with caching
4. **Event Tracking**: High-throughput event ingestion
5. **Data Pipeline**: Stream processing and storage
6. **Analysis Engine**: Statistical analysis and reporting

## Documentation

📚 **[Browse Full Documentation](https://darbour.github.io/experimeh/)** - Interactive documentation site with guides and API reference

### Quick Links

- **[Getting Started Guide](https://darbour.github.io/experimeh/)** - Introduction and quick start
- **[API Reference](https://darbour.github.io/experimeh/api/)** - Complete TypeScript API documentation
- **[Guides & Tutorials](https://darbour.github.io/experimeh/guides.html)** - In-depth guides and best practices

### Building Documentation Locally

```bash
# Generate API documentation
npm run docs:build

# Serve documentation locally
npm run docs:serve
```

The documentation will be available at `http://localhost:8080`

## API Quick Reference

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

## Additional Documentation

For comprehensive documentation, visit our **[Documentation Site](https://darbour.github.io/experimeh/)**

Documentation files in this repository:

- [Architecture Guide](docs/ARCHITECTURE.md) - System architecture and design
- [Statistical Guide](docs/STATISTICAL_GUIDE.md) - Statistical methods and analysis
- [Best Practices](docs/BEST_PRACTICES.md) - Design patterns and recommendations
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Examples](examples/) - Example implementations

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
