/**
 * LocalStorage-based caching for experiment assignments
 */

import { CacheEntry } from './types';
import { CacheError } from './errors';

const CACHE_PREFIX = 'experimeh_';

export class CacheManager {
  private enabled: boolean;
  private defaultTTL: number;

  constructor(enabled: boolean = true, defaultTTL: number = 300000) {
    this.enabled = enabled && this.isLocalStorageAvailable();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__experimeh_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('LocalStorage not available, caching disabled');
      return false;
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.enabled) return;

    try {
      const entry: CacheEntry<T> = {
        data,
        cachedAt: Date.now(),
        ttl: ttl || this.defaultTTL,
      };

      localStorage.setItem(this.getCacheKey(key), JSON.stringify(entry));
    } catch (error) {
      throw new CacheError(`Failed to set cache: ${error}`);
    }
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    try {
      const item = localStorage.getItem(this.getCacheKey(key));
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check if expired
      if (Date.now() - entry.cachedAt > entry.ttl) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn(`Failed to get cache: ${error}`);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    if (!this.enabled) return;

    try {
      localStorage.removeItem(this.getCacheKey(key));
    } catch (error) {
      console.warn(`Failed to delete cache: ${error}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (!this.enabled) return;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      throw new CacheError(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
