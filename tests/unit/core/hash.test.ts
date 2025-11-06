/**
 * Unit Tests for Hash Functions
 * Tests determinism, uniformity, range functions, and performance
 */

import {
  murmurHash3,
  hashToFloat,
  hashToRange,
  createHashKey,
  hashExperiment,
  hashExperimentFloat,
  hashFactorialFactor,
  hashSwitchbackPeriod,
  hashWithinSubjects,
  verifyHashUniformity,
  generateHashResult,
  benchmarkHashPerformance,
} from '../../../src/core/hash';

describe('Hash Functions', () => {
  describe('murmurHash3', () => {
    it('should return consistent hash for same input', () => {
      const input = 'test-user-123';
      const hash1 = murmurHash3(input);
      const hash2 = murmurHash3(input);
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = murmurHash3('user-1');
      const hash2 = murmurHash3('user-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 32-bit unsigned integer', () => {
      const hash = murmurHash3('test');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should respect seed parameter', () => {
      const input = 'test';
      const hash1 = murmurHash3(input, 0);
      const hash2 = murmurHash3(input, 1);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = murmurHash3('');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = murmurHash3(longString);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const hash = murmurHash3(specialChars);
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界🌍';
      const hash = murmurHash3(unicode);
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hashToFloat', () => {
    it('should return value in [0, 1) range', () => {
      const floats = Array.from({ length: 1000 }, (_, i) =>
        hashToFloat(`user-${i}`)
      );

      floats.forEach(f => {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(1);
      });
    });

    it('should be deterministic', () => {
      const input = 'test-user';
      const float1 = hashToFloat(input);
      const float2 = hashToFloat(input);
      expect(float1).toBe(float2);
    });

    it('should respect seed parameter', () => {
      const input = 'test';
      const float1 = hashToFloat(input, 0);
      const float2 = hashToFloat(input, 1);
      expect(float1).not.toBe(float2);
    });

    it('should produce uniform distribution', () => {
      const samples = Array.from({ length: 10000 }, (_, i) =>
        hashToFloat(`user-${i}`)
      );

      // Split into 10 buckets
      const buckets = Array(10).fill(0);
      samples.forEach(s => {
        const bucket = Math.floor(s * 10);
        buckets[bucket]++;
      });

      // Each bucket should have ~1000 samples (±300 for chi-square)
      buckets.forEach(count => {
        expect(count).toBeGreaterThan(700);
        expect(count).toBeLessThan(1300);
      });
    });
  });

  describe('hashToRange', () => {
    it('should return value in [0, max) range', () => {
      const max = 100;
      const values = Array.from({ length: 1000 }, (_, i) =>
        hashToRange(`user-${i}`, max)
      );

      values.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(max);
        expect(Number.isInteger(v)).toBe(true);
      });
    });

    it('should throw error for non-positive max', () => {
      expect(() => hashToRange('test', 0)).toThrow('Max must be positive');
      expect(() => hashToRange('test', -1)).toThrow('Max must be positive');
    });

    it('should handle max=1', () => {
      const value = hashToRange('test', 1);
      expect(value).toBe(0);
    });

    it('should handle large max values', () => {
      const max = 1000000;
      const value = hashToRange('test', max);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(max);
    });

    it('should be deterministic', () => {
      const input = 'test-user';
      const max = 100;
      const value1 = hashToRange(input, max);
      const value2 = hashToRange(input, max);
      expect(value1).toBe(value2);
    });
  });

  describe('createHashKey', () => {
    it('should create composite key from experimentId and unitId', () => {
      const key = createHashKey('exp-123', 'user-456');
      expect(key).toBe('exp-123:user-456');
    });

    it('should include salt when provided', () => {
      const key = createHashKey('exp-123', 'user-456', 'salt');
      expect(key).toBe('exp-123:user-456:salt');
    });

    it('should throw error for empty experimentId', () => {
      expect(() => createHashKey('', 'user-456')).toThrow(
        'experimentId and unitId are required'
      );
    });

    it('should throw error for empty unitId', () => {
      expect(() => createHashKey('exp-123', '')).toThrow(
        'experimentId and unitId are required'
      );
    });

    it('should handle special characters in ids', () => {
      const key = createHashKey('exp:123', 'user:456', 'salt:789');
      expect(key).toBe('exp:123:user:456:salt:789');
    });
  });

  describe('hashExperiment', () => {
    it('should return consistent hash for same inputs', () => {
      const hash1 = hashExperiment('exp-123', 'user-456');
      const hash2 = hashExperiment('exp-123', 'user-456');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different experiments', () => {
      const hash1 = hashExperiment('exp-1', 'user-456');
      const hash2 = hashExperiment('exp-2', 'user-456');
      expect(hash1).not.toBe(hash2);
    });

    it('should return different hashes for different users', () => {
      const hash1 = hashExperiment('exp-123', 'user-1');
      const hash2 = hashExperiment('exp-123', 'user-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should include salt in hash', () => {
      const hash1 = hashExperiment('exp-123', 'user-456', 'salt1');
      const hash2 = hashExperiment('exp-123', 'user-456', 'salt2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashExperimentFloat', () => {
    it('should return consistent float for same inputs', () => {
      const float1 = hashExperimentFloat('exp-123', 'user-456');
      const float2 = hashExperimentFloat('exp-123', 'user-456');
      expect(float1).toBe(float2);
    });

    it('should return value in [0, 1) range', () => {
      const float = hashExperimentFloat('exp-123', 'user-456');
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);
    });
  });

  describe('hashFactorialFactor', () => {
    it('should return different hashes for different factors', () => {
      const hash1 = hashFactorialFactor('exp-123', 'user-456', 'color');
      const hash2 = hashFactorialFactor('exp-123', 'user-456', 'size');
      expect(hash1).not.toBe(hash2);
    });

    it('should return consistent hash for same factor', () => {
      const hash1 = hashFactorialFactor('exp-123', 'user-456', 'color');
      const hash2 = hashFactorialFactor('exp-123', 'user-456', 'color');
      expect(hash1).toBe(hash2);
    });

    it('should throw error for empty factor name', () => {
      expect(() => hashFactorialFactor('exp-123', 'user-456', '')).toThrow(
        'factorName is required'
      );
    });

    it('should ensure factorial independence', () => {
      // Test that factors are independent by checking different users
      const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

      const colorAssignments = users.map(u =>
        hashFactorialFactor('exp-123', u, 'color') % 2
      );
      const sizeAssignments = users.map(u =>
        hashFactorialFactor('exp-123', u, 'size') % 2
      );

      // Count co-occurrences
      let count00 = 0, count01 = 0, count10 = 0, count11 = 0;
      for (let i = 0; i < users.length; i++) {
        if (colorAssignments[i] === 0 && sizeAssignments[i] === 0) count00++;
        if (colorAssignments[i] === 0 && sizeAssignments[i] === 1) count01++;
        if (colorAssignments[i] === 1 && sizeAssignments[i] === 0) count10++;
        if (colorAssignments[i] === 1 && sizeAssignments[i] === 1) count11++;
      }

      // Each combination should be roughly 25% (±10%)
      [count00, count01, count10, count11].forEach(count => {
        expect(count).toBeGreaterThan(200);
        expect(count).toBeLessThan(300);
      });
    });
  });

  describe('hashSwitchbackPeriod', () => {
    it('should return consistent hash for same period', () => {
      const hash1 = hashSwitchbackPeriod('exp-123', 5);
      const hash2 = hashSwitchbackPeriod('exp-123', 5);
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different periods', () => {
      const hash1 = hashSwitchbackPeriod('exp-123', 1);
      const hash2 = hashSwitchbackPeriod('exp-123', 2);
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for negative period', () => {
      expect(() => hashSwitchbackPeriod('exp-123', -1)).toThrow(
        'periodNumber must be non-negative'
      );
    });

    it('should handle period 0', () => {
      const hash = hashSwitchbackPeriod('exp-123', 0);
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should handle large period numbers', () => {
      const hash = hashSwitchbackPeriod('exp-123', 1000000);
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hashWithinSubjects', () => {
    it('should return consistent hash for same user', () => {
      const hash1 = hashWithinSubjects('exp-123', 'user-456');
      const hash2 = hashWithinSubjects('exp-123', 'user-456');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different users', () => {
      const hash1 = hashWithinSubjects('exp-123', 'user-1');
      const hash2 = hashWithinSubjects('exp-123', 'user-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should use within_subjects salt', () => {
      const hash1 = hashWithinSubjects('exp-123', 'user-456');
      const hash2 = hashExperiment('exp-123', 'user-456', 'within_subjects');
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyHashUniformity', () => {
    it('should validate uniform distribution', () => {
      // Generate 10,000 samples with uniform hashes
      const samples = Array.from({ length: 10000 }, (_, i) =>
        murmurHash3(`user-${i}`)
      );

      const result = verifyHashUniformity(samples, 100);
      expect(result.isUniform).toBe(true);
      expect(result.chiSquare).toBeGreaterThan(0);
    });

    it('should detect non-uniform distribution', () => {
      // Create biased samples (all in first half)
      const samples = Array.from({ length: 10000 }, (_, i) => i % 50);

      const result = verifyHashUniformity(samples, 100);
      expect(result.isUniform).toBe(false);
    });

    it('should throw error for insufficient samples', () => {
      const samples = Array.from({ length: 100 }, (_, i) => i);
      expect(() => verifyHashUniformity(samples, 100)).toThrow(
        'Insufficient samples for uniformity test'
      );
    });

    it('should work with different bucket sizes', () => {
      const samples = Array.from({ length: 5000 }, (_, i) =>
        murmurHash3(`user-${i}`)
      );

      const result = verifyHashUniformity(samples, 50);
      expect(result.isUniform).toBe(true);
    });
  });

  describe('generateHashResult', () => {
    it('should return complete hash result', () => {
      const result = generateHashResult('exp-123', 'user-456', 100);

      expect(result.hash).toBeGreaterThanOrEqual(0);
      expect(result.normalized).toBeGreaterThanOrEqual(0);
      expect(result.normalized).toBeLessThan(1);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThan(100);
      expect(Number.isInteger(result.bucket)).toBe(true);
    });

    it('should respect seed in config', () => {
      const result1 = generateHashResult('exp-123', 'user-456', 100, { seed: 0 });
      const result2 = generateHashResult('exp-123', 'user-456', 100, { seed: 1 });

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should respect salt in config', () => {
      const result1 = generateHashResult('exp-123', 'user-456', 100, { salt: 'salt1' });
      const result2 = generateHashResult('exp-123', 'user-456', 100, { salt: 'salt2' });

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should ensure bucket matches hash % numBuckets', () => {
      const result = generateHashResult('exp-123', 'user-456', 100);
      expect(result.bucket).toBe(result.hash % 100);
    });
  });

  describe('benchmarkHashPerformance', () => {
    it('should measure hash performance', () => {
      const avgTime = benchmarkHashPerformance(1000);

      expect(avgTime).toBeGreaterThan(0);
      // Hash should be very fast (<0.01ms per operation)
      expect(avgTime).toBeLessThan(0.01);
    });

    it('should complete benchmark quickly', () => {
      const start = performance.now();
      benchmarkHashPerformance(100);
      const duration = performance.now() - start;

      // Should complete 100 iterations in <10ms
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Uniformity Statistical Test', () => {
    it('should pass chi-square test with 10,000+ samples', () => {
      const samples = Array.from({ length: 10000 }, (_, i) =>
        murmurHash3(`user-${i}`)
      );

      const { chiSquare, isUniform } = verifyHashUniformity(samples, 100);

      // For 100 buckets, df = 99
      // Chi-square should be around 99 ± (3 * sqrt(2*99)) ≈ 99 ± 42
      expect(chiSquare).toBeGreaterThan(50);
      expect(chiSquare).toBeLessThan(150);
      expect(isUniform).toBe(true);
    });

    it('should distribute users evenly across variants', () => {
      const numVariants = 4;
      const numUsers = 10000;

      const assignments = Array.from({ length: numUsers }, (_, i) => {
        const hash = hashExperiment('exp-123', `user-${i}`);
        return hash % numVariants;
      });

      const counts = Array(numVariants).fill(0);
      assignments.forEach(a => counts[a]++);

      // Each variant should get ~2500 users (±200)
      counts.forEach(count => {
        expect(count).toBeGreaterThan(2300);
        expect(count).toBeLessThan(2700);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null bytes in string', () => {
      const hash = murmurHash3('test\x00string');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should handle very similar strings differently', () => {
      const hash1 = murmurHash3('experiment_a');
      const hash2 = murmurHash3('experiment_b');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle numeric strings', () => {
      const hash1 = murmurHash3('12345');
      const hash2 = murmurHash3('12346');
      expect(hash1).not.toBe(hash2);
    });
  });
});
