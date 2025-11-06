/**
 * Redis implementation of ICacheStore
 * Provides high-performance caching with TTL support
 */

import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { ICacheStore } from '../types/interfaces';
import { Logger } from '../utils/logger';
import { CacheError } from '../utils/errors';

export interface RedisAdapterConfig {
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
}

/**
 * Redis cache adapter implementation
 */
export class RedisAdapter implements ICacheStore {
  private client: RedisClientType;
  private logger: Logger;
  private keyPrefix: string;
  private connected: boolean = false;
  private reconnecting: boolean = false;

  constructor(config?: RedisAdapterConfig, logger?: Logger) {
    this.logger = logger || new Logger(undefined, 'RedisAdapter');
    this.keyPrefix = config?.keyPrefix || 'experimeh:';

    const redisOptions: RedisClientOptions = {
      socket: {
        host: config?.host || process.env.REDIS_HOST || 'localhost',
        port: config?.port || parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: config?.connectTimeout || 10000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            this.logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection limit exceeded');
          }
          const delay = Math.min(retries * 100, 3000);
          this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
      password: config?.password || process.env.REDIS_PASSWORD,
      database: config?.database || parseInt(process.env.REDIS_DB || '0', 10),
    };

    this.client = createClient(redisOptions) as RedisClientType;

    // Event handlers
    this.client.on('connect', () => {
      this.logger.info('Redis client connecting');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
      this.connected = true;
      this.reconnecting = false;
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis client error', { error: err.message });
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis client reconnecting');
      this.reconnecting = true;
    });

    this.client.on('end', () => {
      this.logger.info('Redis client connection closed');
      this.connected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      await this.client.connect();
      this.logger.info('Redis connection established successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to connect to Redis', { error: err.message });
      throw new CacheError('Failed to connect to Redis', { error: err.message });
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.client.quit();
        this.logger.info('Redis connection closed');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error disconnecting from Redis', { error: err.message });
      throw new CacheError('Failed to disconnect from Redis', { error: err.message });
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        // If not JSON, return as-is (cast to T)
        return value as unknown as T;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get value from cache', { error: err.message, key });
      // Return null on error to allow graceful degradation
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client.setEx(fullKey, ttlSeconds, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      this.logger.debug('Value set in cache', { key, ttl: ttlSeconds });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to set value in cache', { error: err.message, key });
      throw new CacheError('Failed to set value in cache', { error: err.message, key });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.client.del(fullKey);
      this.logger.debug('Value deleted from cache', { key });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to delete value from cache', { error: err.message, key });
      throw new CacheError('Failed to delete value from cache', { error: err.message, key });
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(keys);
      this.logger.debug('Pattern deleted from cache', { pattern, count: deleted });
      return deleted;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to delete pattern from cache', { error: err.message, pattern });
      throw new CacheError('Failed to delete pattern from cache', { error: err.message, pattern });
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to check key existence', { error: err.message, key });
      return false;
    }
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.incrBy(fullKey, amount);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to increment value', { error: err.message, key, amount });
      throw new CacheError('Failed to increment value', { error: err.message, key });
    }
  }

  /**
   * Decrement numeric value
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.decrBy(fullKey, amount);
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to decrement value', { error: err.message, key, amount });
      throw new CacheError('Failed to decrement value', { error: err.message, key });
    }
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.expire(fullKey, ttlSeconds);
      return result === 1;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to set expiration', { error: err.message, key, ttlSeconds });
      throw new CacheError('Failed to set expiration', { error: err.message, key });
    }
  }

  // ==================== HASH OPERATIONS ====================

  /**
   * Get field from hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.client.hGet(fullKey, field);
      return value || null;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get hash field', { error: err.message, key, field });
      return null;
    }
  }

  /**
   * Set field in hash
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.client.hSet(fullKey, field, value);
      this.logger.debug('Hash field set', { key, field });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to set hash field', { error: err.message, key, field });
      throw new CacheError('Failed to set hash field', { error: err.message, key, field });
    }
  }

  /**
   * Get all fields from hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.hGetAll(fullKey);
      return result || {};
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get all hash fields', { error: err.message, key });
      return {};
    }
  }

  /**
   * Delete fields from hash
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const deleted = await this.client.hDel(fullKey, fields);
      this.logger.debug('Hash fields deleted', { key, count: deleted });
      return deleted;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to delete hash fields', { error: err.message, key, fields });
      throw new CacheError('Failed to delete hash fields', { error: err.message, key });
    }
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Get multiple values at once
   */
  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      const fullKeys = keys.map((key) => this.getFullKey(key));
      const values = await this.client.mGet(fullKeys);

      return values.map((value) => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get multiple values', { error: err.message, count: keys.length });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(entries: Record<string, any>): Promise<void> {
    try {
      const pairs: [string, string][] = Object.entries(entries).map(([key, value]) => [
        this.getFullKey(key),
        typeof value === 'string' ? value : JSON.stringify(value),
      ]);

      await this.client.mSet(pairs);
      this.logger.debug('Multiple values set', { count: pairs.length });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to set multiple values', { error: err.message });
      throw new CacheError('Failed to set multiple values', { error: err.message });
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushAll();
      this.logger.warn('All cache keys flushed');
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to flush cache', { error: err.message });
      throw new CacheError('Failed to flush cache', { error: err.message });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const info = await this.client.info('stats');
      const stats: Record<string, any> = {};

      info.split('\r\n').forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return stats;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to get cache stats', { error: err.message });
      return {};
    }
  }
}
