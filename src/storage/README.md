# Storage Adapters

Production-ready storage implementations for the Experimeh feature flag and experimentation system.

## Overview

This module provides concrete implementations of storage interfaces for:

- **PostgreSQL** - Persistent configuration storage for experiments and feature flags
- **Redis** - High-performance caching layer
- **Kafka** - Event streaming for exposures, metrics, and assignments
- **In-Memory** - Fast storage for development and testing

## Components

### 1. PostgreSQL Store (`postgres-store.ts`)

Implements `IConfigurationStore` interface for persistent storage.

**Features:**
- Connection pooling with configurable pool size
- Transaction support for data consistency
- Optimistic locking using version numbers
- CRUD operations for experiments and feature flags
- Audit trail logging
- Parameterized queries to prevent SQL injection
- Automatic retry and error handling
- Health checks

**Configuration:**
```typescript
const store = new PostgresStore({
  host: 'localhost',
  port: 5432,
  database: 'experimeh',
  user: 'postgres',
  password: 'password',
  ssl: true,
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

await store.initialize();
```

**Environment Variables:**
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5432)
- `POSTGRES_DB` - Database name (default: experimeh)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_SSL` - Enable SSL (default: false)
- `POSTGRES_MAX_CONNECTIONS` - Max pool size (default: 20)

### 2. Redis Adapter (`redis-adapter.ts`)

Implements `ICacheStore` interface for caching.

**Features:**
- Automatic reconnection with exponential backoff
- TTL support for automatic expiration
- Batch operations (mget, mset)
- Hash operations for complex data structures
- Pattern-based deletion
- Key prefix support for namespacing
- Graceful degradation on errors
- Health checks and statistics

**Configuration:**
```typescript
const cache = new RedisAdapter({
  host: 'localhost',
  port: 6379,
  password: 'password',
  database: 0,
  keyPrefix: 'experimeh:',
  connectTimeout: 10000
});

await cache.connect();
```

**Environment Variables:**
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password
- `REDIS_DB` - Database number (default: 0)

### 3. Kafka Adapter (`kafka-adapter.ts`)

Implements `IEventQueue` interface for event streaming.

**Features:**
- Idempotent producer for reliable delivery
- Automatic topic creation
- Message compression (GZIP)
- Batch publishing support
- Consumer groups for parallel processing
- Retry logic with exponential backoff
- Graceful shutdown with message flushing
- Topic management (create, delete, metadata)
- SSL/SASL authentication support

**Configuration:**
```typescript
const eventQueue = new KafkaAdapter(
  {
    brokers: ['localhost:9092'],
    clientId: 'experimeh',
    connectionTimeout: 10000,
    ssl: true,
    sasl: {
      mechanism: 'plain',
      username: 'user',
      password: 'password'
    }
  },
  {
    exposures: 'experimeh.exposures',
    metrics: 'experimeh.metrics',
    assignments: 'experimeh.assignments'
  }
);

await eventQueue.connect();
```

**Environment Variables:**
- `KAFKA_BROKERS` - Comma-separated list of brokers (default: localhost:9092)
- `KAFKA_CLIENT_ID` - Client identifier (default: experimeh)
- `KAFKA_TOPIC_EXPOSURES` - Exposures topic (default: experimeh.exposures)
- `KAFKA_TOPIC_METRICS` - Metrics topic (default: experimeh.metrics)
- `KAFKA_TOPIC_ASSIGNMENTS` - Assignments topic (default: experimeh.assignments)
- `KAFKA_SSL` - Enable SSL (default: false)
- `KAFKA_SASL_ENABLED` - Enable SASL auth (default: false)
- `KAFKA_SASL_MECHANISM` - SASL mechanism (plain, scram-sha-256, scram-sha-512)
- `KAFKA_SASL_USERNAME` - SASL username
- `KAFKA_SASL_PASSWORD` - SASL password

### 4. In-Memory Store (`in-memory-store.ts`)

Implements `IConfigurationStore` interface for testing.

**Features:**
- Fast Map-based storage
- Deep cloning to prevent mutations
- Full CRUD operations
- Audit logging
- Data export/import for testing
- Statistics tracking
- No persistence (data lost on restart)

**Configuration:**
```typescript
const store = new InMemoryStore();

// Useful for testing
await store.importData({
  experiments: [...],
  featureFlags: [...]
});

const stats = store.getStats();
```

### 5. Database Schema (`schemas.sql`)

Comprehensive PostgreSQL schema with:

**Tables:**
- `experiments` - Experiment configurations
- `feature_flags` - Feature flag configurations
- `assignments` - Assignment logs (optional)
- `exposures` - Exposure event logs (optional)
- `metrics` - Metric event logs (optional)
- `audit_log` - Change audit trail

**Features:**
- UUID primary keys
- JSONB columns for flexible data
- GIN indexes for JSONB queries
- Proper foreign keys and constraints
- Optimistic locking with version numbers
- Automatic timestamp updates via triggers
- Materialized views for analytics
- Helper functions for common queries
- Comments and documentation

**Usage:**
```bash
psql -U postgres -d experimeh -f src/storage/schemas.sql
```

## Usage

### Quick Start

```typescript
import { initializeStorage, shutdownStorage } from './storage';

// Initialize all storage adapters
const storage = await initializeStorage({
  postgres: {
    host: 'localhost',
    port: 5432,
    database: 'experimeh',
    user: 'postgres',
    password: 'password'
  },
  redis: {
    host: 'localhost',
    port: 6379
  },
  kafka: {
    brokers: ['localhost:9092']
  }
});

// Use storage adapters
const experiment = await storage.configStore.getExperiment(id);
await storage.cache.set('key', value, 3600);
await storage.eventQueue.publishExposure(exposure);

// Health check
const health = await healthCheckStorage(storage);
console.log('Storage healthy:', health.healthy);

// Graceful shutdown
await shutdownStorage(storage);
```

### Individual Adapters

```typescript
import { PostgresStore, RedisAdapter, KafkaAdapter } from './storage';

// PostgreSQL
const db = new PostgresStore();
await db.initialize();
const experiment = await db.createExperiment({...});

// Redis
const cache = new RedisAdapter();
await cache.connect();
await cache.set('exp:123', experiment, 3600);

// Kafka
const kafka = new KafkaAdapter();
await kafka.connect();
await kafka.publishExposure({
  experimentId: '123',
  unitId: 'user-456',
  variantKey: 'treatment'
});
```

### Testing with In-Memory Store

```typescript
import { InMemoryStore } from './storage';

const store = new InMemoryStore();

// Fast, synchronous operations
const experiment = await store.createExperiment({...});
await store.updateExperiment(id, updates);

// Useful for testing
const stats = store.getStats();
const data = store.exportData();
await store.clear();
```

## Error Handling

All adapters throw custom errors from `utils/errors.ts`:

```typescript
import {
  ConfigurationError,
  CacheError,
  ExperimentNotFoundError
} from '../utils/errors';

try {
  await store.getExperiment(id);
} catch (error) {
  if (error instanceof ExperimentNotFoundError) {
    // Handle not found
  } else if (error instanceof ConfigurationError) {
    // Handle config error
  }
}
```

## Best Practices

### Connection Management

1. **Initialize once** - Create adapters at application startup
2. **Reuse connections** - Don't create new instances for each operation
3. **Graceful shutdown** - Always call disconnect/close on shutdown
4. **Health checks** - Monitor adapter health regularly

### PostgreSQL

1. **Use transactions** - For multi-step operations
2. **Connection pooling** - Configure pool size based on load
3. **Indexes** - Schema includes optimal indexes for queries
4. **Migrations** - Version control schema changes

### Redis

1. **Set TTLs** - Always use expiration for temporary data
2. **Key prefixes** - Use namespacing to organize keys
3. **Fallback gracefully** - Cache failures shouldn't break app
4. **Monitor memory** - Use Redis memory policies

### Kafka

1. **Batch operations** - Use batch publishing for high volume
2. **Topic partitioning** - Configure based on throughput needs
3. **Consumer groups** - Use for parallel processing
4. **Retention policies** - Set appropriate data retention

## Performance Considerations

### PostgreSQL
- Connection pool size: 20 (adjust based on CPU cores)
- Query timeout: 30s
- Use prepared statements for repeated queries
- JSONB indexes for fast JSON queries

### Redis
- Key expiration: Set TTLs to prevent memory bloat
- Pipelining: Use mget/mset for bulk operations
- Compression: Consider for large values
- Max memory policy: Configure eviction

### Kafka
- Batch size: Adjust for latency/throughput tradeoff
- Compression: GZIP enabled by default
- Partitions: 3 per topic (increase for higher load)
- Replication: Minimum 1 (increase for production)

## Monitoring

### Health Checks

```typescript
const health = await storage.configStore.healthCheck();
const cacheHealth = await storage.cache.healthCheck();
const queueHealth = await storage.eventQueue.healthCheck();
```

### Metrics

```typescript
// Redis statistics
const stats = await cache.getStats();

// Kafka producer metrics
const metrics = eventQueue.getProducerMetrics();

// In-memory store stats
const inMemStats = store.getStats();
```

## Production Checklist

- [ ] PostgreSQL connection pool configured
- [ ] Database indexes created
- [ ] Redis memory policy configured
- [ ] Kafka topics created with proper partitions
- [ ] SSL/TLS enabled for all connections
- [ ] Authentication configured (passwords in env vars)
- [ ] Logging level set appropriately
- [ ] Health check endpoints configured
- [ ] Graceful shutdown handlers registered
- [ ] Monitoring and alerting set up
- [ ] Backup strategy for PostgreSQL
- [ ] Data retention policies configured

## Environment Setup

### Development

```bash
# PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Redis
docker run -d -p 6379:6379 redis:7

# Kafka
docker run -d -p 9092:9092 \
  -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 \
  confluentinc/cp-kafka:latest
```

### Production

Use managed services:
- **PostgreSQL**: AWS RDS, Google Cloud SQL, Azure Database
- **Redis**: AWS ElastiCache, Redis Cloud, Azure Cache
- **Kafka**: Confluent Cloud, AWS MSK, Azure Event Hubs

## Troubleshooting

### PostgreSQL Connection Issues
- Check connection string and credentials
- Verify database exists and is accessible
- Check firewall/security group rules
- Review connection pool settings

### Redis Connection Issues
- Verify Redis is running and accessible
- Check authentication (password)
- Monitor memory usage
- Review connection timeout settings

### Kafka Issues
- Verify brokers are reachable
- Check topic exists and has partitions
- Review consumer group status
- Monitor lag and throughput

## License

MIT
