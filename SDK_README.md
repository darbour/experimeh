# Experimeh SDK Documentation

## Overview

The Experimeh SDK provides a type-safe, production-ready client for feature flag experimentation. It includes automatic caching, batch event tracking, retry logic, and comprehensive error handling.

## Features

- **Type-Safe API**: Full TypeScript support with detailed type definitions
- **Automatic Caching**: Configurable in-memory or Redis caching for assignments
- **Batch Event Tracking**: Efficient event batching with auto-flush
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Custom error types with detailed context
- **Logging**: Structured logging with Winston
- **Validation**: Comprehensive input validation

## Installation

```bash
npm install experimeh
```

## Quick Start

```typescript
import { createClient } from 'experimeh';

// Create client
const client = createClient({
  apiUrl: 'https://experiments.example.com',
  apiKey: 'your-api-key',
});

// Initialize
await client.initialize();

// Get assignment
const assignment = await client.getAssignment('exp-123', 'user-456');
console.log('Variant:', assignment.variantId);

// Track exposure
await client.trackExposure('exp-123', 'user-456', assignment.variantId);

// Track metric
await client.trackMetric('exp-123', 'user-456', 'conversion', 1);

// Shutdown
await client.shutdown();
```

## Configuration

### Client Configuration

```typescript
interface ExperimentClientConfig {
  // Required
  apiUrl: string;              // API endpoint URL

  // Optional
  apiKey?: string;             // API key for authentication
  cache?: CacheAdapter;        // Custom cache adapter
  cacheEnabled?: boolean;      // Enable/disable caching (default: true)
  cacheTTL?: number;          // Cache TTL in seconds (default: 300)
  retryAttempts?: number;     // Number of retry attempts (default: 3)
  retryDelay?: number;        // Initial retry delay in ms (default: 1000)
  timeout?: number;           // Request timeout in ms (default: 5000)
  batchSize?: number;         // Event batch size (default: 100)
  flushInterval?: number;     // Auto-flush interval in ms (default: 10000)
  logger?: Logger;            // Custom logger instance
}
```

### Example with Full Configuration

```typescript
import { createClient, InMemoryCache, getLogger } from 'experimeh';

const client = createClient({
  apiUrl: 'https://experiments.example.com',
  apiKey: process.env.EXPERIMENT_API_KEY,
  cache: new InMemoryCache(),
  cacheEnabled: true,
  cacheTTL: 600, // 10 minutes
  retryAttempts: 5,
  retryDelay: 1000,
  timeout: 10000,
  batchSize: 50,
  flushInterval: 5000,
  logger: getLogger({ level: 'debug' }),
});
```

## API Reference

### ExperimentClient

#### `initialize(): Promise<void>`

Initialize the client and start event batching.

```typescript
await client.initialize();
```

#### `getAssignment(experimentId, userId, context?): Promise<Assignment>`

Get experiment assignment for a user.

```typescript
const assignment = await client.getAssignment(
  'exp-homepage',
  'user-123',
  {
    userAttributes: { country: 'US', premium: true },
    deviceInfo: { platform: 'web' },
  }
);
```

**Returns:**
```typescript
interface Assignment {
  experimentId: string;
  userId: string;
  variantId: string;
  variantName: string;
  config?: Record<string, any>;
  assigned: boolean;
  cached?: boolean;
}
```

#### `trackExposure(experimentId, userId, variantId, context?): Promise<void>`

Track when a user is exposed to an experiment variant.

```typescript
await client.trackExposure(
  'exp-homepage',
  'user-123',
  'variant-a',
  { pageUrl: '/home' }
);
```

#### `trackMetric(experimentId, userId, metricName, value, context?): Promise<void>`

Track a metric event for analysis.

```typescript
await client.trackMetric(
  'exp-homepage',
  'user-123',
  'conversion',
  1,
  { orderValue: 49.99 }
);
```

#### `getAssignmentAndTrackExposure(experimentId, userId, context?): Promise<Assignment>`

Convenience method that gets assignment and tracks exposure in one call.

```typescript
const assignment = await client.getAssignmentAndTrackExposure(
  'exp-homepage',
  'user-123'
);
```

#### `flush(): Promise<void>`

Manually flush queued events immediately.

```typescript
await client.flush();
```

#### `shutdown(): Promise<void>`

Gracefully shutdown the client, flushing all pending events.

```typescript
await client.shutdown();
```

## Caching

### In-Memory Cache

```typescript
import { createClient, InMemoryCache } from 'experimeh';

const client = createClient({
  apiUrl: 'https://api.example.com',
  cache: new InMemoryCache(),
  cacheTTL: 300, // 5 minutes
});
```

### Redis Cache

```typescript
import { createClient, RedisCache } from 'experimeh';

const redisCache = new RedisCache({
  host: 'localhost',
  port: 6379,
  password: 'secret',
  keyPrefix: 'exp:',
});

await redisCache.connect();

const client = createClient({
  apiUrl: 'https://api.example.com',
  cache: redisCache,
  cacheTTL: 600,
});
```

### Custom Cache Adapter

Implement the `CacheAdapter` interface:

```typescript
interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}
```

## Error Handling

The SDK uses custom error types for better error handling:

```typescript
import {
  ExperimentError,
  ExperimentNotFoundError,
  NetworkError,
  ValidationError,
} from 'experimeh';

try {
  const assignment = await client.getAssignment('exp-123', 'user-456');
} catch (error) {
  if (error instanceof ExperimentNotFoundError) {
    console.error('Experiment not found:', error.experimentId);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.details);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Error Types

- `ExperimentError`: Base error class
- `ExperimentNotFoundError`: Experiment doesn't exist
- `ExperimentInactiveError`: Experiment is not active
- `AssignmentError`: Assignment failed
- `ValidationError`: Input validation failed
- `ConfigurationError`: Configuration error
- `NetworkError`: Network request failed
- `APIError`: API returned error response
- `CacheError`: Cache operation failed

## Logging

### Using the Default Logger

```typescript
import { defaultLogger } from 'experimeh';

defaultLogger.info('Application started');
defaultLogger.error('Error occurred', { error: 'details' });
```

### Creating a Custom Logger

```typescript
import { getLogger } from 'experimeh';

const logger = getLogger({
  level: 'debug',
  serviceName: 'my-app',
  enableJson: true,
  enableFile: true,
  filePath: 'logs/app.log',
}, 'MyComponent');

logger.info('Component initialized');
logger.debug('Debug information', { data: 'value' });
```

### Logger Methods

- `error(message, metadata?)`: Log error
- `warn(message, metadata?)`: Log warning
- `info(message, metadata?)`: Log info
- `debug(message, metadata?)`: Log debug
- `logError(message, error, metadata?)`: Log error object
- `logAssignment(experimentId, userId, variant, metadata?)`: Log assignment
- `logMetric(metricName, value, metadata?)`: Log metric
- `logExposure(experimentId, userId, variant, metadata?)`: Log exposure

## Validation

The SDK automatically validates all inputs. You can also use validators directly:

```typescript
import {
  validateExperimentConfig,
  validateUserId,
  validateMetricName,
} from 'experimeh';

// Validate experiment configuration
validateExperimentConfig({
  name: 'My Experiment',
  type: 'ab_test',
  variants: [
    { id: 'a', name: 'Control', weight: 0.5 },
    { id: 'b', name: 'Treatment', weight: 0.5 },
  ],
});

// Validate user ID
validateUserId('user-123');

// Validate metric name
validateMetricName('conversion_rate');
```

## Best Practices

### 1. Initialize Once

Create and initialize the client once at application startup:

```typescript
// app.ts
export const experimentClient = createClient({
  apiUrl: process.env.EXPERIMENT_API_URL!,
  apiKey: process.env.EXPERIMENT_API_KEY,
});

await experimentClient.initialize();
```

### 2. Use Context for Better Targeting

Provide user context for more accurate targeting:

```typescript
const assignment = await client.getAssignment('exp-123', userId, {
  userAttributes: {
    country: user.country,
    isPremium: user.subscription === 'premium',
    signupDate: user.createdAt,
  },
  deviceInfo: {
    platform: 'web',
    browser: 'chrome',
  },
});
```

### 3. Track Exposures Separately

Track exposure only when the user actually sees the variant:

```typescript
const assignment = await client.getAssignment('exp-123', userId);

// User sees the variant
if (assignment.assigned) {
  renderVariant(assignment.variantId);
  await client.trackExposure('exp-123', userId, assignment.variantId);
}
```

### 4. Handle Errors Gracefully

Always handle errors to prevent experiment failures from breaking your app:

```typescript
try {
  const assignment = await client.getAssignment('exp-123', userId);
  return assignment.variantId;
} catch (error) {
  logger.error('Failed to get assignment', { error });
  return 'control'; // Fallback to control variant
}
```

### 5. Shutdown Gracefully

Ensure all events are flushed before shutdown:

```typescript
process.on('SIGTERM', async () => {
  await experimentClient.shutdown();
  process.exit(0);
});
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import {
  ExperimentClient,
  ExperimentClientConfig,
  Assignment,
  ExposureEvent,
  MetricEvent,
  ExperimentError,
} from 'experimeh';

const config: ExperimentClientConfig = {
  apiUrl: 'https://api.example.com',
};

const client: ExperimentClient = createClient(config);
const assignment: Assignment = await client.getAssignment('exp', 'user');
```

## Examples

See the `/examples` directory for complete examples:

- `sdk-usage.ts`: Basic SDK usage
- More examples coming soon...

## Support

For issues, questions, or contributions, please visit:
https://github.com/yourusername/experimeh

## License

MIT
