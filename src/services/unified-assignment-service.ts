/**
 * Unified Assignment Service
 *
 * This is the CRITICAL integration layer between feature flags and experiments.
 * It evaluates feature flags while respecting active experiments, ensuring that
 * experiments control allocation when active, and flags provide defaults otherwise.
 *
 * Evaluation Flow:
 * 1. Fetch feature flag by key
 * 2. Check for active linked experiments
 * 3. If experiment active: Use experiment allocation logic
 * 4. Else: Use feature flag rollout logic
 * 5. Log exposure with experiment context (if applicable)
 *
 * This uphelds the principle: Feature flags are the foundation, experiments are the methodology.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  UnifiedAssignmentRequest,
  UnifiedAssignmentResult,
  AssignmentReason,
  AssignmentContext,
  BatchUnifiedAssignmentRequest,
  BatchUnifiedAssignmentResponse,
  ExposureEvent,
} from '../models/assignment';
import { FeatureFlag, LinkedExperiment } from '../models/feature-flag';
import { Experiment, ExperimentStatus } from '../models/experiment';

export interface UnifiedAssignmentServiceConfig {
  /** Enable caching of assignments */
  enableCache: boolean;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Enable exposure logging */
  enableExposureLogging: boolean;
  /** Log to console (for development) */
  logToConsole: boolean;
}

export class UnifiedAssignmentService {
  private config: UnifiedAssignmentServiceConfig;
  private assignmentCache: Map<string, { result: UnifiedAssignmentResult; expiresAt: number }>;
  private exposureLog: ExposureEvent[];
  private stats: {
    totalAssignments: number;
    cacheHits: number;
    cacheMisses: number;
    experimentAssignments: number;
    flagRolloutAssignments: number;
    errors: number;
  };

  // In-memory stores (in production, these would be database queries)
  private featureFlags: Map<string, FeatureFlag>;
  private experiments: Map<string, Experiment>;

  constructor(config: Partial<UnifiedAssignmentServiceConfig> = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheTtlSeconds: config.cacheTtlSeconds ?? 300, // 5 minutes
      enableExposureLogging: config.enableExposureLogging ?? true,
      logToConsole: config.logToConsole ?? false,
    };

    this.assignmentCache = new Map();
    this.exposureLog = [];
    this.stats = {
      totalAssignments: 0,
      cacheHits: 0,
      cacheMisses: 0,
      experimentAssignments: 0,
      flagRolloutAssignments: 0,
      errors: 0,
    };

    // Initialize stores
    this.featureFlags = new Map();
    this.experiments = new Map();
  }

  /**
   * MAIN EVALUATION METHOD
   *
   * Evaluates a feature flag and returns the assigned variant.
   * If an active experiment is linked, uses experiment allocation.
   * Otherwise, uses feature flag rollout logic.
   */
  async evaluate(request: UnifiedAssignmentRequest): Promise<UnifiedAssignmentResult> {
    const startTime = Date.now();
    this.stats.totalAssignments++;

    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getCachedAssignment(request.flagKey, request.unitId);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
      }
      this.stats.cacheMisses++;

      // Fetch feature flag
      const flag = await this.getFeatureFlag(request.flagKey);
      if (!flag) {
        return this.createErrorResult(
          request.flagKey,
          request.unitId,
          AssignmentReason.NOT_FOUND,
          'Feature flag not found',
          startTime
        );
      }

      // Check if flag is disabled
      if (flag.status !== 'enabled') {
        return this.createDefaultResult(flag, request.unitId, AssignmentReason.FLAG_DISABLED, startTime);
      }

      // Check for active experiments
      const activeExperiment = await this.getActiveExperiment(flag);
      if (activeExperiment) {
        // Use experiment allocation
        return await this.evaluateWithExperiment(flag, activeExperiment, request, startTime);
      }

      // Use flag rollout
      return await this.evaluateWithFlagRollout(flag, request, startTime);
    } catch (error) {
      this.stats.errors++;
      if (this.config.logToConsole) {
        console.error('[UnifiedAssignmentService] Evaluation error:', error);
      }
      return this.createErrorResult(
        request.flagKey,
        request.unitId,
        AssignmentReason.ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Evaluate with experiment allocation logic
   */
  private async evaluateWithExperiment(
    flag: FeatureFlag,
    experiment: Experiment,
    request: UnifiedAssignmentRequest,
    startTime: number
  ): Promise<UnifiedAssignmentResult> {
    this.stats.experimentAssignments++;

    // Apply targeting rules from experiment
    if (!this.evaluateTargetingRules(experiment, request.context)) {
      return this.createDefaultResult(flag, request.unitId, AssignmentReason.INELIGIBLE, startTime);
    }

    // Apply traffic allocation
    const bucketHash = this.hashForBucketing(request.unitId, flag.key, experiment.id);
    const bucketValue = bucketHash % 100;

    if (bucketValue >= experiment.trafficAllocation) {
      // User not in experiment
      return this.createDefaultResult(flag, request.unitId, AssignmentReason.FLAG_ROLLOUT, startTime);
    }

    // Assign variant using experiment allocation
    const variantAllocation = this.selectVariantFromExperiment(
      experiment,
      request.unitId,
      bucketValue
    );

    if (!variantAllocation) {
      return this.createDefaultResult(flag, request.unitId, AssignmentReason.ERROR, startTime);
    }

    // Find the flag variant
    const flagVariant = flag.variants.find((v) => v.id === variantAllocation.flagVariantId);
    if (!flagVariant) {
      return this.createDefaultResult(flag, request.unitId, AssignmentReason.ERROR, startTime);
    }

    // Create result with experiment context
    const exposureId = uuidv4();
    const result: UnifiedAssignmentResult = {
      flagKey: flag.key,
      flagId: flag.id,
      variantKey: flagVariant.key,
      variantId: flagVariant.id,
      value: flagVariant.value,
      reason: AssignmentReason.EXPERIMENT_ALLOCATION,
      experiment: {
        id: experiment.id,
        key: experiment.key,
        name: experiment.name,
        designType: experiment.designType,
        variantRole: variantAllocation.experimentRole,
        allocationPercentage: variantAllocation.allocationPercentage,
      },
      exposureId,
      timestamp: new Date(),
      fromCache: false,
      metadata: {
        evaluationTimeMs: Date.now() - startTime,
        bucketHash,
        bucketValue,
      },
    };

    // Cache result
    if (this.config.enableCache) {
      this.cacheAssignment(request.flagKey, request.unitId, result);
    }

    // Log exposure
    if (this.config.enableExposureLogging) {
      this.logExposure(result, request);
    }

    return result;
  }

  /**
   * Evaluate with feature flag rollout logic (no active experiment)
   */
  private async evaluateWithFlagRollout(
    flag: FeatureFlag,
    request: UnifiedAssignmentRequest,
    startTime: number
  ): Promise<UnifiedAssignmentResult> {
    this.stats.flagRolloutAssignments++;

    // Check targeting rules
    const matchedRule = this.findMatchingTargetingRule(flag, request.context);
    if (matchedRule) {
      const variant = flag.variants.find((v) => v.id === matchedRule.variantId);
      if (variant) {
        return this.createVariantResult(
          flag,
          variant,
          AssignmentReason.TARGETING,
          request.unitId,
          startTime,
          matchedRule.id
        );
      }
    }

    // Check rollout percentage
    if (flag.rollout.enabled) {
      const bucketHash = this.hashForBucketing(request.unitId, flag.key);
      const bucketValue = bucketHash % 100;

      if (bucketValue < flag.rollout.percentage) {
        const variant = flag.variants.find((v) => v.id === flag.rollout.variantId);
        if (variant) {
          return this.createVariantResult(
            flag,
            variant,
            AssignmentReason.FLAG_ROLLOUT,
            request.unitId,
            startTime
          );
        }
      }
    }

    // Default
    return this.createDefaultResult(flag, request.unitId, AssignmentReason.DEFAULT, startTime);
  }

  /**
   * Batch evaluation (evaluates multiple flags in one call)
   */
  async evaluateBatch(request: BatchUnifiedAssignmentRequest): Promise<BatchUnifiedAssignmentResponse> {
    const startTime = Date.now();
    const assignments: Record<string, UnifiedAssignmentResult> = {};
    const errors: Array<{ flagKey: string; error: string; code: string }> = [];

    await Promise.all(
      request.flagKeys.map(async (flagKey) => {
        try {
          const result = await this.evaluate({
            flagKey,
            unitId: request.unitId,
            unitType: request.unitType,
            context: request.context,
          });
          assignments[flagKey] = result;
        } catch (error) {
          errors.push({
            flagKey,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'EVALUATION_ERROR',
          });
        }
      })
    );

    return {
      assignments,
      errors,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * HELPER METHODS
   */

  private async getFeatureFlag(flagKey: string): Promise<FeatureFlag | null> {
    // In production, this would be a database query
    return this.featureFlags.get(flagKey) || null;
  }

  private async getActiveExperiment(flag: FeatureFlag): Promise<Experiment | null> {
    // Find active experiment with highest priority
    const activeLinks = flag.linkedExperiments
      .filter((link) => link.status === 'active')
      .sort((a, b) => b.priority - a.priority);

    if (activeLinks.length === 0) {
      return null;
    }

    const experiment = this.experiments.get(activeLinks[0].experimentId);
    if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
      return null;
    }

    return experiment;
  }

  private evaluateTargetingRules(experiment: Experiment, context?: AssignmentContext): boolean {
    // Simplified targeting rule evaluation
    // In production, use a proper expression evaluator
    return true;
  }

  private findMatchingTargetingRule(
    flag: FeatureFlag,
    context?: AssignmentContext
  ): FeatureFlag['targetingRules'][0] | null {
    // Simplified targeting rule evaluation
    const enabledRules = flag.targetingRules
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of enabledRules) {
      if (this.evaluateConditionGroup(rule.conditions, context)) {
        return rule;
      }
    }

    return null;
  }

  private evaluateConditionGroup(conditions: any, context?: AssignmentContext): boolean {
    // Simplified condition evaluation
    // In production, implement proper logic
    return false;
  }

  private selectVariantFromExperiment(
    experiment: Experiment,
    unitId: string,
    bucketValue: number
  ): Experiment['variantAllocations'][0] | null {
    let cumulativeAllocation = 0;
    for (const allocation of experiment.variantAllocations) {
      cumulativeAllocation += allocation.allocationPercentage;
      if (bucketValue < cumulativeAllocation) {
        return allocation;
      }
    }
    return null;
  }

  private hashForBucketing(unitId: string, ...additionalInputs: string[]): number {
    const input = [unitId, ...additionalInputs].join(':');
    const hash = crypto.createHash('sha256').update(input).digest();
    // Use first 4 bytes as a 32-bit integer
    return hash.readUInt32BE(0);
  }

  private createVariantResult(
    flag: FeatureFlag,
    variant: FeatureFlag['variants'][0],
    reason: AssignmentReason,
    unitId: string,
    startTime: number,
    matchedRuleId?: string
  ): UnifiedAssignmentResult {
    const exposureId = uuidv4();
    const result: UnifiedAssignmentResult = {
      flagKey: flag.key,
      flagId: flag.id,
      variantKey: variant.key,
      variantId: variant.id,
      value: variant.value,
      reason,
      exposureId,
      timestamp: new Date(),
      fromCache: false,
      matchedRuleId,
      metadata: {
        evaluationTimeMs: Date.now() - startTime,
      },
    };

    if (this.config.enableCache) {
      this.cacheAssignment(flag.key, unitId, result);
    }

    return result;
  }

  private createDefaultResult(
    flag: FeatureFlag,
    unitId: string,
    reason: AssignmentReason,
    startTime: number
  ): UnifiedAssignmentResult {
    const exposureId = uuidv4();
    return {
      flagKey: flag.key,
      flagId: flag.id,
      variantKey: 'default',
      variantId: 'default',
      value: flag.defaultValue,
      reason,
      exposureId,
      timestamp: new Date(),
      fromCache: false,
      metadata: {
        evaluationTimeMs: Date.now() - startTime,
      },
    };
  }

  private createErrorResult(
    flagKey: string,
    unitId: string,
    reason: AssignmentReason,
    errorMessage: string,
    startTime: number
  ): UnifiedAssignmentResult {
    return {
      flagKey,
      flagId: 'unknown',
      variantKey: 'error',
      variantId: 'error',
      value: null,
      reason,
      exposureId: uuidv4(),
      timestamp: new Date(),
      fromCache: false,
      metadata: {
        evaluationTimeMs: Date.now() - startTime,
        ...( errorMessage ? { error: errorMessage } : {}),
      } as any,
    };
  }

  private getCachedAssignment(flagKey: string, unitId: string): UnifiedAssignmentResult | null {
    const cacheKey = `${flagKey}:${unitId}`;
    const cached = this.assignmentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, fromCache: true };
    }
    if (cached) {
      this.assignmentCache.delete(cacheKey);
    }
    return null;
  }

  private cacheAssignment(flagKey: string, unitId: string, result: UnifiedAssignmentResult): void {
    const cacheKey = `${flagKey}:${unitId}`;
    this.assignmentCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
    });
  }

  private logExposure(result: UnifiedAssignmentResult, request: UnifiedAssignmentRequest): void {
    // Simplified exposure for internal logging (not the full ExposureEvent model)
    const exposure: any = {
      id: result.exposureId,
      unitId: request.unitId,
      flagId: result.flagId,
      flagKey: result.flagKey,
      variantId: result.variantId,
      variantKey: result.variantKey,
      value: result.value,
      experimentId: result.experiment?.id || undefined,
      experimentKey: result.experiment?.key || undefined,
      variantRole: result.experiment?.variantRole,
      reason: result.reason,
      context: request.context || ({ customAttributes: {} } as AssignmentContext),
      timestamp: result.timestamp,
      metadata: result.metadata,
    };

    this.exposureLog.push(exposure);

    if (this.config.logToConsole) {
      console.log('[Exposure]', {
        flagKey: result.flagKey,
        unitId: request.unitId,
        variantKey: result.variantKey,
        experimentId: result.experiment?.id,
        reason: result.reason,
      });
    }
  }

  /**
   * PUBLIC UTILITY METHODS
   */

  public setFeatureFlags(flags: FeatureFlag[]): void {
    flags.forEach((flag) => this.featureFlags.set(flag.key, flag));
  }

  public setExperiments(experiments: Experiment[]): void {
    experiments.forEach((exp) => this.experiments.set(exp.id, exp));
  }

  public getStats() {
    return { ...this.stats };
  }

  public getExposureLog(): ExposureEvent[] {
    return [...this.exposureLog];
  }

  public clearCache(): void {
    this.assignmentCache.clear();
  }

  public clearExposureLog(): void {
    this.exposureLog = [];
  }
}
