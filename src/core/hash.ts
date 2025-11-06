/**
 * Deterministic Hash Functions for Experiment Assignment
 *
 * This module provides cryptographically-stable hash functions for consistent
 * user assignment in experiments. Uses MurmurHash3 for:
 * - High performance (<1ms)
 * - Uniform distribution
 * - Deterministic results across platforms
 * - Low collision rate
 *
 * References:
 * - MurmurHash3: https://github.com/aappleby/smhasher/wiki/MurmurHash3
 * - "Consistent Hashing for A/B Testing" - Kohavi et al.
 */

/**
 * 32-bit MurmurHash3 implementation
 * Provides uniform distribution for assignment with minimal bias
 *
 * Time Complexity: O(n) where n is input length
 * Space Complexity: O(1)
 *
 * @param key - String to hash
 * @param seed - Seed value for hash consistency (default: 0)
 * @returns 32-bit unsigned integer hash
 */
export function murmurHash3(key: string, seed: number = 0): number {
  const remainder = key.length % 4;
  const bytes = key.length - remainder;

  let h1 = seed;
  let k1 = 0;

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  // Process 4-byte chunks
  for (let i = 0; i < bytes; i += 4) {
    k1 =
      ((key.charCodeAt(i) & 0xff)) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  // Process remaining bytes
  k1 = 0;

  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(bytes + 2) & 0xff) << 16;
      // fallthrough
    case 2:
      k1 ^= (key.charCodeAt(bytes + 1) & 0xff) << 8;
      // fallthrough
    case 1:
      k1 ^= (key.charCodeAt(bytes) & 0xff);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  // Finalization mix
  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  // Return as unsigned 32-bit integer
  return h1 >>> 0;
}

/**
 * Hash result normalized to [0, 1) range
 * Useful for percentage-based assignment (e.g., traffic allocation)
 *
 * @param key - String to hash
 * @param seed - Seed value for hash consistency
 * @returns Float in range [0, 1)
 */
export function hashToFloat(key: string, seed: number = 0): number {
  const hash = murmurHash3(key, seed);
  // Divide by 2^32 to get [0, 1) range
  return hash / 0x100000000;
}

/**
 * Hash result normalized to [0, max) range
 * Useful for bucket assignment
 *
 * @param key - String to hash
 * @param max - Maximum value (exclusive)
 * @param seed - Seed value for hash consistency
 * @returns Integer in range [0, max)
 */
export function hashToRange(key: string, max: number, seed: number = 0): number {
  if (max <= 0) {
    throw new Error('Max must be positive');
  }
  const hash = murmurHash3(key, seed);
  return hash % max;
}

/**
 * Generate a composite hash key for experiment assignment
 * Combines multiple identifiers to ensure unique, deterministic hashing
 *
 * Format: `{experimentId}:{unitId}:{salt}`
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier (user, session, device, etc.)
 * @param salt - Optional salt for additional entropy or namespacing
 * @returns Composite string key
 */
export function createHashKey(
  experimentId: string,
  unitId: string,
  salt?: string
): string {
  if (!experimentId || !unitId) {
    throw new Error('experimentId and unitId are required');
  }

  const parts = [experimentId, unitId];
  if (salt) {
    parts.push(salt);
  }

  return parts.join(':');
}

/**
 * Generate hash for experiment assignment
 * Primary function for deterministic assignment
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier (user, session, device, etc.)
 * @param salt - Optional salt for additional entropy
 * @returns 32-bit unsigned integer hash
 *
 * @example
 * ```typescript
 * const hash = hashExperiment('exp-123', 'user-456');
 * const bucket = hash % 100; // Assign to bucket 0-99
 * ```
 */
export function hashExperiment(
  experimentId: string,
  unitId: string,
  salt?: string
): number {
  const key = createHashKey(experimentId, unitId, salt);
  return murmurHash3(key);
}

/**
 * Generate hash for experiment assignment normalized to [0, 1)
 * Useful for percentage-based traffic allocation
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier
 * @param salt - Optional salt
 * @returns Float in range [0, 1)
 *
 * @example
 * ```typescript
 * const hashValue = hashExperimentFloat('exp-123', 'user-456');
 * if (hashValue < 0.5) {
 *   // User is in first 50% of traffic
 * }
 * ```
 */
export function hashExperimentFloat(
  experimentId: string,
  unitId: string,
  salt?: string
): number {
  const key = createHashKey(experimentId, unitId, salt);
  return hashToFloat(key);
}

/**
 * Generate hash for factorial experiment factor
 * Each factor gets independent hashing to ensure orthogonality
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier
 * @param factorName - Name of the factor being assigned
 * @returns 32-bit unsigned integer hash
 *
 * @example
 * ```typescript
 * const colorHash = hashFactorialFactor('exp-123', 'user-456', 'button_color');
 * const textHash = hashFactorialFactor('exp-123', 'user-456', 'button_text');
 * // Independent hashes ensure factorial independence
 * ```
 */
export function hashFactorialFactor(
  experimentId: string,
  unitId: string,
  factorName: string
): number {
  if (!factorName) {
    throw new Error('factorName is required');
  }
  return hashExperiment(experimentId, unitId, factorName);
}

/**
 * Generate hash for switchback experiment period
 * Time-based hashing for temporal assignment
 *
 * @param experimentId - Unique experiment identifier
 * @param periodNumber - Sequential period number
 * @returns 32-bit unsigned integer hash
 *
 * @example
 * ```typescript
 * const periodHash = hashSwitchbackPeriod('exp-123', 5);
 * const variantIndex = periodHash % numVariants;
 * ```
 */
export function hashSwitchbackPeriod(
  experimentId: string,
  periodNumber: number
): number {
  if (periodNumber < 0) {
    throw new Error('periodNumber must be non-negative');
  }
  const key = `${experimentId}:period:${periodNumber}`;
  return murmurHash3(key);
}

/**
 * Generate hash for within-subjects counterbalancing
 * Ensures each user gets a unique order assignment
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier
 * @returns 32-bit unsigned integer hash
 *
 * @example
 * ```typescript
 * const orderHash = hashWithinSubjects('exp-123', 'user-456');
 * const orderIndex = orderHash % numOrders; // Latin square order
 * ```
 */
export function hashWithinSubjects(
  experimentId: string,
  unitId: string
): number {
  return hashExperiment(experimentId, unitId, 'within_subjects');
}

/**
 * Verify hash distribution uniformity (for testing/validation)
 * Performs chi-square goodness of fit test
 *
 * @param samples - Array of hash values
 * @param numBuckets - Number of expected buckets
 * @returns Chi-square statistic and p-value estimate
 */
export function verifyHashUniformity(
  samples: number[],
  numBuckets: number = 100
): { chiSquare: number; isUniform: boolean } {
  if (samples.length < numBuckets * 5) {
    throw new Error('Insufficient samples for uniformity test (need 5+ per bucket)');
  }

  // Count observations per bucket
  const bucketCounts = new Array(numBuckets).fill(0);
  for (const sample of samples) {
    const bucket = sample % numBuckets;
    bucketCounts[bucket]++;
  }

  // Expected count per bucket
  const expected = samples.length / numBuckets;

  // Calculate chi-square statistic
  let chiSquare = 0;
  for (const observed of bucketCounts) {
    const diff = observed - expected;
    chiSquare += (diff * diff) / expected;
  }

  // Critical value for chi-square with (numBuckets - 1) degrees of freedom at α=0.05
  // For 100 buckets: critical value ≈ 123.23
  // Simplified check: chi-square should be close to df (within 3 standard deviations)
  const df = numBuckets - 1;
  const stdDev = Math.sqrt(2 * df);
  const isUniform = Math.abs(chiSquare - df) <= 3 * stdDev;

  return { chiSquare, isUniform };
}

/**
 * Type definitions for hash-based assignment
 */
export interface HashConfig {
  seed?: number;
  salt?: string;
}

export interface HashResult {
  hash: number;
  normalized: number; // [0, 1)
  bucket: number; // For specific bucketing
}

/**
 * Generate complete hash result for assignment
 * Returns multiple representations for different use cases
 *
 * @param experimentId - Unique experiment identifier
 * @param unitId - Unit identifier
 * @param numBuckets - Number of buckets for assignment
 * @param config - Optional hash configuration
 * @returns Complete hash result with multiple formats
 */
export function generateHashResult(
  experimentId: string,
  unitId: string,
  numBuckets: number,
  config: HashConfig = {}
): HashResult {
  const key = createHashKey(experimentId, unitId, config.salt);
  const hash = murmurHash3(key, config.seed);
  const normalized = hash / 0x100000000;
  const bucket = hash % numBuckets;

  return {
    hash,
    normalized,
    bucket,
  };
}

/**
 * Performance benchmarking utility
 * Measures hash function performance
 *
 * @param iterations - Number of hash operations to perform
 * @returns Average time per hash in milliseconds
 */
export function benchmarkHashPerformance(iterations: number = 10000): number {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    murmurHash3(`experiment-${i}:user-${i}`);
  }

  const endTime = performance.now();
  return (endTime - startTime) / iterations;
}
