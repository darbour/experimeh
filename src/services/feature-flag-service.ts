/**
 * Feature Flag Service
 * Handles feature flag evaluation with targeting rules and variants
 */

import crypto from 'crypto';
import { FeatureFlag, EvaluationContext } from '../types';
import { ILogger, ICacheStore } from '../types/interfaces';
import { EvaluationError } from '../types/errors';
import { ConfigurationService } from './configuration-service';

export interface FeatureFlagEvaluation<T = any> {
  flagKey: string;
  value: T;
  variant?: string;
  enabled: boolean;
  reason: string;
  ruleMatched?: number;
}

export interface FeatureFlagServiceOptions {
  configurationService: ConfigurationService;
  cache: ICacheStore;
  logger: ILogger;
  evaluationCacheTtlSeconds?: number;
}

export class FeatureFlagService {
  private configService: ConfigurationService;
  private cache: ICacheStore;
  private logger: ILogger;
  private evaluationCacheTtlSeconds: number;

  constructor(options: FeatureFlagServiceOptions) {
    this.configService = options.configurationService;
    this.cache = options.cache;
    this.logger = options.logger.child({ service: 'FeatureFlagService' });
    this.evaluationCacheTtlSeconds = options.evaluationCacheTtlSeconds || 60; // 1 minute default
  }

  /**
   * Evaluate a feature flag for a given context
   */
  async evaluate<T = any>(
    flagKey: string,
    context: EvaluationContext,
    defaultValue?: T
  ): Promise<FeatureFlagEvaluation<T>> {
    this.logger.debug('Evaluating feature flag', { flagKey, unitId: context.unitId });

    try {
      // Try cache first (with context hash for personalized flags)
      const cacheKey = this.generateCacheKey(flagKey, context);
      const cached = await this.cache.get<FeatureFlagEvaluation<T>>(cacheKey);
      if (cached) {
        this.logger.debug('Flag evaluation found in cache', { flagKey });
        return cached;
      }

      // Get flag configuration
      const flag = await this.configService.getFeatureFlagByKey(flagKey);
      if (!flag) {
        this.logger.warn('Feature flag not found', { flagKey });
        return {
          flagKey,
          value: defaultValue as T,
          enabled: false,
          reason: 'flag_not_found',
        };
      }

      // Check if flag is enabled
      if (!flag.enabled) {
        this.logger.debug('Feature flag is disabled', { flagKey });
        const evaluation: FeatureFlagEvaluation<T> = {
          flagKey,
          value: flag.defaultValue as T,
          enabled: false,
          reason: 'flag_disabled',
        };
        await this.cacheEvaluation(cacheKey, evaluation);
        return evaluation;
      }

      // Evaluate targeting rules
      const ruleResult = this.evaluateTargetingRules(flag, context);
      if (ruleResult) {
        this.logger.debug('Targeting rule matched', { flagKey, ruleIndex: ruleResult.index });
        const evaluation: FeatureFlagEvaluation<T> = {
          flagKey,
          value: this.getVariantValue(flag, ruleResult.variantKey) as T,
          variant: ruleResult.variantKey,
          enabled: true,
          reason: 'targeting_rule',
          ruleMatched: ruleResult.index,
        };
        await this.cacheEvaluation(cacheKey, evaluation);
        return evaluation;
      }

      // No rules matched - use variant weights for random assignment
      if (flag.variants && flag.variants.length > 0) {
        const variantKey = this.assignVariantByWeight(context.unitId || 'anonymous', flag);
        const variant = flag.variants.find(v => v.key === variantKey);

        if (variant) {
          this.logger.debug('Assigned variant by weight', { flagKey, variantKey });
          const evaluation: FeatureFlagEvaluation<T> = {
            flagKey,
            value: variant.value as T,
            variant: variantKey,
            enabled: true,
            reason: 'variant_weight',
          };
          await this.cacheEvaluation(cacheKey, evaluation);
          return evaluation;
        }
      }

      // Fallback to default value
      this.logger.debug('Using default value', { flagKey });
      const evaluation: FeatureFlagEvaluation<T> = {
        flagKey,
        value: flag.defaultValue as T,
        enabled: true,
        reason: 'default',
      };
      await this.cacheEvaluation(cacheKey, evaluation);
      return evaluation;
    } catch (error) {
      this.logger.error('Flag evaluation failed', { error, flagKey });

      // Return default value on error
      return {
        flagKey,
        value: defaultValue as T,
        enabled: false,
        reason: 'evaluation_error',
      };
    }
  }

  /**
   * Evaluate multiple feature flags at once
   */
  async evaluateAll(
    flagKeys: string[],
    context: EvaluationContext,
    defaults?: Record<string, any>
  ): Promise<Record<string, FeatureFlagEvaluation>> {
    this.logger.debug('Evaluating multiple flags', { count: flagKeys.length });

    try {
      const evaluationPromises = flagKeys.map(async (key) => {
        const defaultValue = defaults?.[key];
        const evaluation = await this.evaluate(key, context, defaultValue);
        return [key, evaluation] as [string, FeatureFlagEvaluation];
      });

      const evaluations = await Promise.all(evaluationPromises);
      return Object.fromEntries(evaluations);
    } catch (error) {
      this.logger.error('Failed to evaluate multiple flags', { error, flagKeys });
      throw new EvaluationError('Failed to evaluate multiple flags', { flagKeys, error });
    }
  }

  /**
   * Check if a feature flag is enabled (returns boolean)
   */
  async isEnabled(flagKey: string, context: EvaluationContext): Promise<boolean> {
    const evaluation = await this.evaluate<boolean>(flagKey, context, false);
    return evaluation.enabled && Boolean(evaluation.value);
  }

  /**
   * Get flag value with type safety
   */
  async getValue<T>(flagKey: string, context: EvaluationContext, defaultValue: T): Promise<T> {
    const evaluation = await this.evaluate<T>(flagKey, context, defaultValue);
    return evaluation.value;
  }

  /**
   * Get flag variant key (for A/B tests)
   */
  async getVariant(flagKey: string, context: EvaluationContext): Promise<string | null> {
    const evaluation = await this.evaluate(flagKey, context);
    return evaluation.variant || null;
  }

  /**
   * Invalidate evaluation cache for a flag
   */
  async invalidateCache(flagKey: string): Promise<void> {
    this.logger.info('Invalidating flag cache', { flagKey });

    try {
      // Delete all cached evaluations for this flag
      await this.cache.deletePattern(`flag:eval:${flagKey}:*`);
    } catch (error) {
      this.logger.warn('Failed to invalidate flag cache', { error, flagKey });
    }
  }

  /**
   * Invalidate evaluation cache for a specific user
   */
  async invalidateUserCache(unitId: string): Promise<void> {
    this.logger.info('Invalidating user cache', { unitId });

    try {
      // Delete all cached evaluations for this user
      await this.cache.deletePattern(`flag:eval:*:${unitId}`);
    } catch (error) {
      this.logger.warn('Failed to invalidate user cache', { error, unitId });
    }
  }

  /**
   * Force a specific variant for a user (for testing)
   */
  async forceVariant(
    flagKey: string,
    unitId: string,
    variantKey: string,
    ttlSeconds?: number
  ): Promise<void> {
    this.logger.info('Forcing variant', { flagKey, unitId, variantKey });

    try {
      // Get flag to validate variant exists
      const flag = await this.configService.getFeatureFlagByKey(flagKey);
      if (!flag) {
        throw new EvaluationError('Feature flag not found', { flagKey });
      }

      const variant = flag.variants.find(v => v.key === variantKey);
      if (!variant) {
        throw new EvaluationError('Variant not found', { flagKey, variantKey });
      }

      // Create forced evaluation
      const evaluation: FeatureFlagEvaluation = {
        flagKey,
        value: variant.value,
        variant: variantKey,
        enabled: true,
        reason: 'forced',
      };

      // Cache with special key
      const cacheKey = `flag:eval:${flagKey}:${unitId}`;
      await this.cache.set(cacheKey, evaluation, ttlSeconds || this.evaluationCacheTtlSeconds);

      this.logger.info('Variant forced successfully', { flagKey, unitId, variantKey });
    } catch (error) {
      this.logger.error('Failed to force variant', { error, flagKey, unitId });
      throw error;
    }
  }

  /**
   * ============================================
   * PRIVATE HELPER METHODS
   * ============================================
   */

  /**
   * Generate cache key that includes context hash for personalized flags
   */
  private generateCacheKey(flagKey: string, context: EvaluationContext): string {
    const unitId = context.unitId || context.userId || 'anonymous';

    // For flags with targeting rules, include relevant context attributes
    // For simple flags, just use unitId
    return `flag:eval:${flagKey}:${unitId}`;
  }

  /**
   * Evaluate targeting rules in priority order
   */
  private evaluateTargetingRules(
    flag: FeatureFlag,
    context: EvaluationContext
  ): { variantKey: string; index: number } | null {
    if (!flag.targetingRules || flag.targetingRules.length === 0) {
      return null;
    }

    // Sort rules by priority (higher priority first)
    const sortedRules = [...flag.targetingRules].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    // Evaluate each rule
    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];
      if (this.evaluateCondition(rule.condition, context)) {
        return { variantKey: rule.variant, index: i };
      }
    }

    return null;
  }

  /**
   * Evaluate a single condition
   * This is a simplified implementation - in production use a proper expression evaluator
   */
  private evaluateCondition(condition: string, context: EvaluationContext): boolean {
    try {
      // For now, a simple placeholder
      // In production, you would use a library like jsonlogic or implement a custom DSL

      // Example conditions:
      // - "platform === 'mobile'"
      // - "version >= '2.0.0'"
      // - "userId in ['user1', 'user2']"
      // - "attributes.country === 'US'"

      // Simple implementation: check for common patterns
      if (condition.includes('platform')) {
        const match = condition.match(/platform\s*===\s*['"]([^'"]+)['"]/);
        if (match && context.platform) {
          return context.platform === match[1];
        }
      }

      if (condition.includes('userId')) {
        const match = condition.match(/userId\s*===\s*['"]([^'"]+)['"]/);
        if (match && context.userId) {
          return context.userId === match[1];
        }
      }

      // Attribute checks
      if (condition.includes('attributes.')) {
        const attrMatch = condition.match(/attributes\.(\w+)\s*===\s*['"]?([^'"]+)['"]?/);
        if (attrMatch && context.attributes) {
          const [, attrName, attrValue] = attrMatch;
          return context.attributes[attrName]?.toString() === attrValue;
        }
      }

      // Default: return false for unrecognized patterns
      return false;
    } catch (error) {
      this.logger.error('Failed to evaluate condition', { error, condition });
      return false;
    }
  }

  /**
   * Assign variant based on weights using consistent hashing
   */
  private assignVariantByWeight(unitId: string, flag: FeatureFlag): string {
    if (!flag.variants || flag.variants.length === 0) {
      return 'default';
    }

    // Use consistent hashing
    const hash = crypto.createHash('sha256')
      .update(`${unitId}:${flag.key}:${flag.version}`)
      .digest('hex');

    const hashValue = parseInt(hash.substring(0, 8), 16);
    const percentage = (hashValue % 10000) / 100; // 0.00 to 99.99

    // Assign based on cumulative weights
    let cumulativeWeight = 0;
    for (const variant of flag.variants) {
      cumulativeWeight += variant.weight;
      if (percentage < cumulativeWeight) {
        return variant.key;
      }
    }

    // Fallback to first variant
    return flag.variants[0].key;
  }

  /**
   * Get value for a specific variant
   */
  private getVariantValue(flag: FeatureFlag, variantKey: string): any {
    const variant = flag.variants.find(v => v.key === variantKey);
    return variant ? variant.value : flag.defaultValue;
  }

  /**
   * Cache evaluation result
   */
  private async cacheEvaluation(
    cacheKey: string,
    evaluation: FeatureFlagEvaluation
  ): Promise<void> {
    try {
      await this.cache.set(cacheKey, evaluation, this.evaluationCacheTtlSeconds);
    } catch (error) {
      this.logger.warn('Failed to cache evaluation', { error, cacheKey });
      // Don't throw - caching failure shouldn't break evaluation
    }
  }
}
