# @experimeh/browser

Lightweight Browser JavaScript SDK for Experimeh feature flag experimentation.

## Features

- **Lightweight**: < 10KB gzipped
- **TypeScript First**: Full type definitions included
- **Caching**: LocalStorage-based caching with configurable TTL
- **Retry Logic**: Automatic retry with exponential backoff
- **Modern Browsers**: Works in all modern browsers (ES2015+)
- **Multiple Formats**: UMD, ESM, and CJS builds included
- **Zero Dependencies**: No external runtime dependencies

## Installation

```bash
npm install @experimeh/browser
```

Or using yarn:

```bash
yarn add @experimeh/browser
```

Or via CDN:

```html
<script src="https://unpkg.com/@experimeh/browser@1.0.0/dist/index.umd.js"></script>
```

## Quick Start

```typescript
import { ExperimentClient } from '@experimeh/browser';

// Initialize the client
const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
});

// Get user assignment
const assignment = await client.getAssignment('checkout-redesign', 'user-123');
console.log(assignment.variantKey); // 'control' or 'treatment'

// Track exposure
await client.trackExposure('checkout-redesign', 'user-123', assignment.variantKey);

// Use the variant
if (assignment.variantKey === 'treatment') {
  showNewCheckout();
} else {
  showOldCheckout();
}

// Track conversion
await client.trackMetric('purchase', 'user-123', 99.99);
```

## API Reference

### ExperimentClient

#### Constructor

```typescript
new ExperimentClient(config: ExperimentClientConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | *required* | Base URL of the Experimeh API |
| `apiKey` | string | *required* | API key for authentication |
| `cacheEnabled` | boolean | `true` | Enable LocalStorage caching |
| `cacheTTL` | number | `300000` | Cache TTL in milliseconds (5 min) |
| `maxRetries` | number | `3` | Maximum number of retry attempts |
| `retryDelay` | number | `1000` | Initial retry delay in milliseconds |
| `timeout` | number | `5000` | Request timeout in milliseconds |

#### Methods

##### getAssignment()

Get assignment for a user in an experiment.

```typescript
async getAssignment(
  experimentKey: string,
  userId: string,
  forceRefresh?: boolean
): Promise<Assignment>
```

**Example:**

```typescript
const assignment = await client.getAssignment('exp-1', 'user-123');
console.log(assignment);
// {
//   id: 'assignment-1',
//   experimentKey: 'exp-1',
//   userId: 'user-123',
//   variantKey: 'treatment',
//   allocationGroup: 'group-1',
//   assignedAt: Date,
//   metadata: { ... }
// }
```

##### getExperiment()

Get experiment details.

```typescript
async getExperiment(experimentKey: string): Promise<Experiment>
```

**Example:**

```typescript
const experiment = await client.getExperiment('exp-1');
console.log(experiment.variants);
// [
//   { key: 'control', name: 'Control', weight: 0.5 },
//   { key: 'treatment', name: 'Treatment', weight: 0.5 }
// ]
```

##### trackExposure()

Track when a user is exposed to an experiment variant.

```typescript
async trackExposure(
  experimentKey: string,
  userId: string,
  variantKey: string,
  metadata?: Record<string, any>
): Promise<void>
```

**Example:**

```typescript
await client.trackExposure('exp-1', 'user-123', 'treatment', {
  page: '/checkout',
  device: 'mobile',
});
```

##### trackMetric()

Track a metric event.

```typescript
async trackMetric(
  metricKey: string,
  userId: string,
  value: number,
  metadata?: Record<string, any>
): Promise<void>
```

**Example:**

```typescript
// Track conversion
await client.trackMetric('purchase', 'user-123', 1);

// Track revenue
await client.trackMetric('revenue', 'user-123', 99.99, {
  currency: 'USD',
  productId: 'prod-123',
});
```

##### clearCache()

Clear all cached data.

```typescript
clearCache(): void
```

**Example:**

```typescript
client.clearCache();
```

## TypeScript Usage

The SDK is written in TypeScript and includes full type definitions:

```typescript
import {
  ExperimentClient,
  Assignment,
  Experiment,
  Variant,
  ExperimentError,
  NetworkError,
  ValidationError,
} from '@experimeh/browser';

// All types are exported
const handleAssignment = (assignment: Assignment) => {
  console.log(assignment.variantKey);
};

// Error handling with type safety
try {
  const assignment = await client.getAssignment('exp-1', 'user-123');
  handleAssignment(assignment);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.statusCode);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.field);
  }
}
```

## Error Handling

The SDK includes specific error types for different failure scenarios:

```typescript
import {
  ExperimentError,
  NetworkError,
  ValidationError,
  CacheError,
  TimeoutError,
} from '@experimeh/browser';

try {
  const assignment = await client.getAssignment('exp-1', 'user-123');
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid parameters
    console.error('Validation error:', error.message);
  } else if (error instanceof NetworkError) {
    // API error
    console.error('Network error:', error.statusCode, error.response);
  } else if (error instanceof TimeoutError) {
    // Request timeout
    console.error('Request timed out');
  } else if (error instanceof CacheError) {
    // Cache error (non-fatal)
    console.warn('Cache error:', error.message);
  }
}
```

## Caching

The SDK uses LocalStorage for caching with configurable TTL:

```typescript
const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'key',
  cacheEnabled: true,
  cacheTTL: 600000, // 10 minutes
});

// First call - fetches from API
const assignment1 = await client.getAssignment('exp-1', 'user-123');

// Second call - returns from cache
const assignment2 = await client.getAssignment('exp-1', 'user-123');

// Force refresh - bypasses cache
const assignment3 = await client.getAssignment('exp-1', 'user-123', true);

// Clear all cache
client.clearCache();
```

## Retry Logic

The SDK automatically retries failed requests with exponential backoff:

```typescript
const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'key',
  maxRetries: 3, // Retry up to 3 times
  retryDelay: 1000, // Start with 1 second delay
});

// Retry delays: 1s, 2s, 4s
// Will not retry on validation errors or 4xx responses
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)

Requires ES2015 support. For older browsers, use a transpiler like Babel.

## Examples

### Basic A/B Test

```typescript
const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'key',
});

async function showFeature(userId: string) {
  try {
    const assignment = await client.getAssignment('new-feature', userId);

    // Track exposure
    await client.trackExposure('new-feature', userId, assignment.variantKey);

    // Show variant
    if (assignment.variantKey === 'treatment') {
      return <NewFeature />;
    } else {
      return <OldFeature />;
    }
  } catch (error) {
    console.error('Failed to get assignment:', error);
    // Fallback to control
    return <OldFeature />;
  }
}
```

### Multi-Variate Test

```typescript
async function getButtonColor(userId: string) {
  const assignment = await client.getAssignment('button-color', userId);

  await client.trackExposure('button-color', userId, assignment.variantKey);

  const colors = {
    control: 'blue',
    red: 'red',
    green: 'green',
    yellow: 'yellow',
  };

  return colors[assignment.variantKey] || colors.control;
}
```

### Feature Flag

```typescript
async function isFeatureEnabled(featureKey: string, userId: string): Promise<boolean> {
  try {
    const assignment = await client.getAssignment(featureKey, userId);
    return assignment.variantKey === 'enabled';
  } catch (error) {
    // Fail closed (feature disabled on error)
    return false;
  }
}

// Usage
if (await isFeatureEnabled('new-checkout', userId)) {
  showNewCheckout();
}
```

### Tracking Conversion Funnel

```typescript
// Track user through funnel
await client.trackMetric('page_view', userId, 1);
await client.trackMetric('add_to_cart', userId, 1);
await client.trackMetric('checkout_start', userId, 1);
await client.trackMetric('purchase', userId, 1, {
  revenue: 99.99,
  items: ['item-1', 'item-2'],
});
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT

## Support

- GitHub Issues: https://github.com/experimeh/experimeh/issues
- Documentation: https://docs.experimeh.com
- Email: support@experimeh.com
