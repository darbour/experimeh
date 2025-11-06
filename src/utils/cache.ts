/**
 * Cache abstraction with in-memory and Redis adapters
 */

import { createClient, RedisClientType } from 'redis';
import { Logger, defaultLogger } from './logger';
import { CacheError } from './errors';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * In-memory cache entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * In-memory cache implementation with TTL support
 */
export class InMemoryCache implements CacheAdapter {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null;
  private logger: Logger;

  constructor(logger?: Logger, cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.logger = logger || defaultLogger.child('InMemoryCache');

    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const expiresAt = options?.ttl
      ? Date.now() + (options.ttl * 1000)
      : null;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Redis cache implementation
 */
export class RedisCache implements CacheAdapter {
  private client: RedisClientType;
  private keyPrefix: string;
  private logger: Logger;
  private connected: boolean = false;

  constructor(config: RedisCacheConfig = {}, logger?: Logger) {
    this.keyPrefix = config.keyPrefix || 'experimeh:';
    this.logger = logger || defaultLogger.child('RedisCache');

    // Create Redis client
    const redisConfig: any = {};

    if (config.url) {
      redisConfig.url = config.url;
    } else {
      redisConfig.socket = {
        host: config.host || 'localhost',
        port: config.port || 6379,
      };
      if (config.password) {
        redisConfig.password = config.password;
      }
      if (config.db !== undefined) {
        redisConfig.database = config.db;
      }
    }

    this.client = createClient(redisConfig);

    // Error handling
    this.client.on('error', (err) => {
      this.logger.error('Redis client error', { error: err.message });
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Redis client disconnected');
      this.connected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      try {
        await this.client.connect();
      } catch (error) {
        throw new CacheError('Failed to connect to Redis', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get prefixed key
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(this.getKey(key));

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Failed to get value from Redis', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new CacheError('Failed to get value from cache', { key });
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const prefixedKey = this.getKey(key);

      if (options?.ttl) {
        await this.client.setEx(prefixedKey, options.ttl, serialized);
      } else {
        await this.client.set(prefixedKey, serialized);
      }
    } catch (error) {
      this.logger.error('Failed to set value in Redis', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new CacheError('Failed to set value in cache', { key });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.getKey(key));
    } catch (error) {
      this.logger.error('Failed to delete value from Redis', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new CacheError('Failed to delete value from cache', { key });
    }
  }

  /**
   * Clear all cache entries with prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);

      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      this.logger.error('Failed to clear Redis cache', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new CacheError('Failed to clear cache');
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(this.getKey(key));
      return exists > 0;
    } catch (error) {
      this.logger.error('Failed to check key existence in Redis', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
    }
  }
}

/**
 * Cache factory for creating cache instances
 */
export class CacheFactory {
  /**
   * Create in-memory cache
   */
  static createInMemory(logger?: Logger): InMemoryCache {
    return new InMemoryCache(logger);
  }

  /**
   * Create Redis cache
   */
  static createRedis(config?: RedisCacheConfig, logger?: Logger): RedisCache {
    return new RedisCache(config, logger);
  }

  /**
   * Create cache based on environment configuration
   */
  static create(logger?: Logger): CacheAdapter {
    const cacheType = process.env.CACHE_TYPE || 'memory';

    if (cacheType === 'redis') {
      const config: RedisCacheConfig = {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
        keyPrefix: process.env.CACHE_KEY_PREFIX,
      };

      return CacheFactory.createRedis(config, logger);
    }

    return CacheFactory.createInMemory(logger);
  }
}
