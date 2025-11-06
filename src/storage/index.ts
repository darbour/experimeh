/**
 * Storage module exports
 * Provides concrete implementations of storage interfaces
 */

// PostgreSQL store
export { PostgresStore, PostgresStoreConfig } from './postgres-store';

// Redis cache adapter
export { RedisAdapter, RedisAdapterConfig } from './redis-adapter';

// Kafka event queue adapter
export { KafkaAdapter, KafkaAdapterConfig, KafkaTopics } from './kafka-adapter';

// In-memory store (for testing)
export { InMemoryStore } from './in-memory-store';

/**
 * Storage factory functions for easy initialization
 */
import { PostgresStore, PostgresStoreConfig } from './postgres-store';
import { RedisAdapter, RedisAdapterConfig } from './redis-adapter';
import { KafkaAdapter, KafkaAdapterConfig, KafkaTopics } from './kafka-adapter';
import { InMemoryStore } from './in-memory-store';
import { Logger } from '../utils/logger';

/**
 * Create PostgreSQL store with optional configuration
 */
export function createPostgresStore(config?: PostgresStoreConfig, logger?: Logger): PostgresStore {
  return new PostgresStore(config, logger);
}

/**
 * Create Redis adapter with optional configuration
 */
export function createRedisAdapter(config?: RedisAdapterConfig, logger?: Logger): RedisAdapter {
  return new RedisAdapter(config, logger);
}

/**
 * Create Kafka adapter with optional configuration
 */
export function createKafkaAdapter(
  config?: KafkaAdapterConfig,
  topics?: Partial<KafkaTopics>,
  logger?: Logger
): KafkaAdapter {
  return new KafkaAdapter(config, topics, logger);
}

/**
 * Create in-memory store (for testing)
 */
export function createInMemoryStore(logger?: Logger): InMemoryStore {
  return new InMemoryStore(logger);
}

/**
 * Storage initialization helper
 * Initializes and connects all storage adapters based on environment
 */
export interface StorageConfig {
  postgres?: PostgresStoreConfig;
  redis?: RedisAdapterConfig;
  kafka?: KafkaAdapterConfig;
  kafkaTopics?: Partial<KafkaTopics>;
  useInMemory?: boolean;
  logger?: Logger;
}

export interface StorageAdapters {
  configStore: PostgresStore | InMemoryStore;
  cache: RedisAdapter;
  eventQueue: KafkaAdapter;
}

/**
 * Initialize all storage adapters
 */
export async function initializeStorage(config?: StorageConfig): Promise<StorageAdapters> {
  const logger = config?.logger || new Logger(undefined, 'Storage');

  try {
    // Initialize configuration store (PostgreSQL or in-memory)
    let configStore: PostgresStore | InMemoryStore;

    if (config?.useInMemory || process.env.USE_IN_MEMORY_STORE === 'true') {
      logger.info('Initializing in-memory configuration store');
      configStore = createInMemoryStore(logger);
    } else {
      logger.info('Initializing PostgreSQL configuration store');
      const postgresStore = createPostgresStore(config?.postgres, logger);
      await postgresStore.initialize();
      configStore = postgresStore;
    }

    // Initialize Redis cache
    logger.info('Initializing Redis cache adapter');
    const cache = createRedisAdapter(config?.redis, logger);
    await cache.connect();

    // Initialize Kafka event queue
    logger.info('Initializing Kafka event queue adapter');
    const eventQueue = createKafkaAdapter(config?.kafka, config?.kafkaTopics, logger);
    await eventQueue.connect();

    logger.info('All storage adapters initialized successfully');

    return {
      configStore,
      cache,
      eventQueue,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to initialize storage adapters', { error: err.message });
    throw error;
  }
}

/**
 * Gracefully shutdown all storage adapters
 */
export async function shutdownStorage(adapters: StorageAdapters, logger?: Logger): Promise<void> {
  const log = logger || new Logger(undefined, 'Storage');

  try {
    log.info('Shutting down storage adapters');

    // Shutdown Kafka first (ensure all events are published)
    try {
      await adapters.eventQueue.disconnect();
      log.info('Kafka event queue disconnected');
    } catch (error) {
      const err = error as Error;
      log.error('Error disconnecting Kafka', { error: err.message });
    }

    // Shutdown Redis
    try {
      await adapters.cache.disconnect();
      log.info('Redis cache disconnected');
    } catch (error) {
      const err = error as Error;
      log.error('Error disconnecting Redis', { error: err.message });
    }

    // Shutdown PostgreSQL (if not in-memory)
    try {
      if (adapters.configStore instanceof PostgresStore) {
        await adapters.configStore.close();
        log.info('PostgreSQL store closed');
      }
    } catch (error) {
      const err = error as Error;
      log.error('Error closing PostgreSQL', { error: err.message });
    }

    log.info('All storage adapters shut down successfully');
  } catch (error) {
    const err = error as Error;
    log.error('Error during storage shutdown', { error: err.message });
    throw error;
  }
}

/**
 * Health check for all storage adapters
 */
export async function healthCheckStorage(adapters: StorageAdapters): Promise<{
  configStore: boolean;
  cache: boolean;
  eventQueue: boolean;
  healthy: boolean;
}> {
  const results = {
    configStore: false,
    cache: false,
    eventQueue: false,
    healthy: false,
  };

  try {
    results.configStore = await adapters.configStore.healthCheck();
  } catch {
    results.configStore = false;
  }

  try {
    results.cache = await adapters.cache.healthCheck();
  } catch {
    results.cache = false;
  }

  try {
    results.eventQueue = await adapters.eventQueue.healthCheck();
  } catch {
    results.eventQueue = false;
  }

  results.healthy = results.configStore && results.cache && results.eventQueue;

  return results;
}
