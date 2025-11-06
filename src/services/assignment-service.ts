/**
 * Assignment Service
 * Handles assignment of units to experiment variants
 * Supports all experiment types: A/B, multivariate, factorial, within-subjects, switchback
 */

import crypto from 'crypto';
import { Experiment, Assignment, AssignmentResult, EvaluationContext } from '../types';
import { ILogger, ICacheStore, IAssignmentAlgorithm } from '../types/interfaces';
import { AssignmentError } from '../types/errors';
import { ConfigurationService } from './configuration-service';

export interface AssignmentServiceOptions {
  configurationService: ConfigurationService;
  cache: ICacheStore;
  logger: ILogger;
  assignmentCacheTtlSeconds?: number;
  enableLogging?: boolean;
}

/**
 * Default assignment algorithm implementation using consistent hashing
 */
class DefaultAssignmentAlgorithm implements IAssignmentAlgorithm {
  /**
   * Hash function using SHA-256 for deterministic assignment
   */
  private hash(input: string): number {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    // Convert first 8 hex characters to number (0 to 4294967295)
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Simple A/B or multivariate assignment
   */
  assign(unitId: string, experiment: Experiment, context?: Record<string, any>): string {
    const hashInput = `${unitId}:${experiment.id}:${experiment.version}`;
    const hashValue = this.hash(hashInput);
    const percentage = (hashValue % 10000) / 100; // 0.00 to 99.99

    // Apply traffic allocation first
    if (percentage >= experiment.trafficAllocation) {
      // Unit is not in experiment
      return 'control'; // or could throw to indicate not assigned
    }

    // Assign to variant based on allocation
    let cumulativeAllocation = 0;
    for (const variant of experiment.variants) {
      cumulativeAllocation += variant.allocation;
      if (percentage < cumulativeAllocation) {
        return variant.key;
      }
    }

    // Fallback (shouldn't reach here if allocations are correct)
    return experiment.variants[0].key;
  }

  /**
   * Factorial design assignment
   * Assigns independently to each factor
   */
  assignFactorial(unitId: string, experiment: Experiment): Record<string, string> {
    const factors = experiment.designConfig.factors || [];
    const assignment: Record<string, string> = {};

    for (const factor of factors) {
      // Hash with factor name for independence
      const hashInput = `${unitId}:${experiment.id}:${factor.name}:${experiment.version}`;
      const hashValue = this.hash(hashInput);
      const levelIndex = hashValue % factor.levels.length;
      assignment[factor.name] = factor.levels[levelIndex];
    }

    return assignment;
  }

  /**
   * Switchback assignment based on time periods
   */
  assignSwitchback(experiment: Experiment, timestamp: Date): string {
    if (!experiment.startDate || !experiment.designConfig.switchbackPeriodMinutes) {
      throw new AssignmentError('Invalid switchback configuration');
    }

    const periodMinutes = experiment.designConfig.switchbackPeriodMinutes;
    const startTime = experiment.startDate.getTime();
    const currentTime = timestamp.getTime();

    // Calculate which period we're in
    const minutesSinceStart = Math.floor((currentTime - startTime) / (60 * 1000));
    const periodNumber = Math.floor(minutesSinceStart / periodMinutes);

    // Deterministic assignment based on period number
    const hashInput = `${experiment.id}:period:${periodNumber}`;
    const hashValue = this.hash(hashInput);
    const variantIndex = hashValue % experiment.variants.length;

    return experiment.variants[variantIndex].key;
  }

  /**
   * Within-subjects assignment with counterbalancing
   */
  assignWithinSubjects(unitId: string, experiment: Experiment, sessionNumber: number): string {
    const variants = experiment.variants;
    const numVariants = variants.length;

    // Simple counterbalancing: Latin square
    // User A: Session 0 -> Variant 0, Session 1 -> Variant 1, ...
    // User B: Session 0 -> Variant 1, Session 1 -> Variant 2, ...

    // Hash user ID to get starting position
    const hashInput = `${unitId}:${experiment.id}:${experiment.version}`;
    const hashValue = this.hash(hashInput);
    const startPosition = hashValue % numVariants;

    // Calculate variant for this session
    const variantIndex = (startPosition + sessionNumber) % numVariants;
    return variants[variantIndex].key;
  }

  /**
   * Stepped wedge assignment
   * Cluster-level unidirectional switching from control to treatment
   */
  assignSteppedWedge(experiment: Experiment, clusterId: string, timestamp: Date): {
    variantKey: string;
    currentStep: number;
    stepStart: Date;
    stepEnd: Date;
    switchStep: number;
    inTreatment: boolean;
  } {
    if (!experiment.startDate) {
      throw new AssignmentError('Stepped wedge requires experiment startDate');
    }

    const config = experiment.designConfig;
    if (!config?.numSteps || !config?.stepDurationMinutes) {
      throw new AssignmentError('Stepped wedge requires numSteps and stepDurationMinutes');
    }

    // Calculate current step
    const startTime = experiment.startDate.getTime();
    const currentTime = timestamp.getTime();
    const elapsedMinutes = (currentTime - startTime) / (1000 * 60);
    const currentStep = Math.max(0, Math.floor(elapsedMinutes / config.stepDurationMinutes));

    // Calculate step boundaries
    const stepStart = new Date(startTime + currentStep * config.stepDurationMinutes * 60 * 1000);
    const stepEnd = new Date(startTime + (currentStep + 1) * config.stepDurationMinutes * 60 * 1000);

    // Generate or use existing schedule
    const schedule = config.schedule || this.generateSteppedWedgeSchedule(
      config.numClusters || 0,
      config.numSteps,
      experiment.id
    );

    // Get switch step for this cluster
    const switchStep = schedule.clusterToStep[clusterId];
    if (switchStep === undefined) {
      throw new AssignmentError(`Cluster ${clusterId} not found in schedule`);
    }

    // Determine assignment
    const inTreatment = currentStep >= switchStep;
    const variantKey = inTreatment ? 'treatment' : 'control';

    return {
      variantKey,
      currentStep,
      stepStart,
      stepEnd,
      switchStep,
      inTreatment,
    };
  }

  /**
   * Generate stepped wedge schedule
   */
  private generateSteppedWedgeSchedule(
    numClusters: number,
    numSteps: number,
    seed: string
  ): { clusterToStep: Record<string, number>; stepToClusters: Record<number, string[]>; seed: string } {
    const clusterIds = Array.from({ length: numClusters }, (_, i) => `cluster-${i + 1}`);
    const shuffled = this.shuffleArray(clusterIds, seed);

    const clustersPerStep = Math.ceil(numClusters / numSteps);
    const clusterToStep: Record<string, number> = {};
    const stepToClusters: Record<number, string[]> = {};

    shuffled.forEach((clusterId, index) => {
      const switchStep = Math.floor(index / clustersPerStep) + 1;
      const cappedStep = Math.min(switchStep, numSteps);

      if (!stepToClusters[cappedStep]) {
        stepToClusters[cappedStep] = [];
      }
      stepToClusters[cappedStep].push(clusterId);
      clusterToStep[clusterId] = cappedStep;
    });

    return { clusterToStep, stepToClusters, seed };
  }

  /**
   * Deterministic shuffle based on seed
   */
  private shuffleArray<T>(array: T[], seed: string): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const hashInput = `${seed}:shuffle:${i}`;
      const hashValue = this.hash(hashInput);
      const j = hashValue % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export class AssignmentService {
  private configService: ConfigurationService;
  private cache: ICacheStore;
  private logger: ILogger;
  private algorithm: IAssignmentAlgorithm;
  private assignmentCacheTtlSeconds: number;
  private enableLogging: boolean;

  constructor(options: AssignmentServiceOptions) {
    this.configService = options.configurationService;
    this.cache = options.cache;
    this.logger = options.logger.child({ service: 'AssignmentService' });
    this.algorithm = new DefaultAssignmentAlgorithm();
    this.assignmentCacheTtlSeconds = options.assignmentCacheTtlSeconds || 86400; // 24 hours
    this.enableLogging = options.enableLogging ?? true;
  }

  /**
   * Get assignment for a unit in a specific experiment
   */
  async getAssignment(
    experimentKey: string,
    context: EvaluationContext
  ): Promise<AssignmentResult> {
    const unitId = this.getUnitId(context);

    this.logger.debug('Getting assignment', { experimentKey, unitId });

    try {
      // Get experiment configuration first to determine cache key strategy
      const experiment = await this.configService.getExperimentByKey(experimentKey);
      if (!experiment) {
        this.logger.warn('Experiment not found', { experimentKey });
        return {
          variantKey: 'control',
          assigned: false,
          reason: 'experiment_not_found',
        };
      }

      // Build cache key based on experiment type
      let cacheKey = `assignment:${experimentKey}:${unitId}`;

      // For stepped wedge, include cluster ID and current step in cache key
      if (experiment.designType === 'stepped_wedge' && experiment.designConfig?.clusterKey) {
        const clusterId = context.attributes?.[experiment.designConfig.clusterKey];
        if (clusterId && experiment.startDate && experiment.designConfig?.stepDurationMinutes) {
          const elapsedMinutes = (Date.now() - experiment.startDate.getTime()) / (1000 * 60);
          const currentStep = Math.max(0, Math.floor(elapsedMinutes / experiment.designConfig.stepDurationMinutes));
          cacheKey = `assignment:${experimentKey}:${clusterId}:step:${currentStep}`;
        }
      }

      // Try cache first
      const cached = await this.cache.get<AssignmentResult>(cacheKey);
      if (cached) {
        this.logger.debug('Assignment found in cache', { experimentKey, unitId, cacheKey });
        return cached;
      }

      // Check if experiment is running
      if (experiment.status !== 'running') {
        this.logger.debug('Experiment not running', { experimentKey, status: experiment.status });
        return {
          variantKey: 'control',
          assigned: false,
          reason: `experiment_${experiment.status}`,
        };
      }

      // Evaluate targeting rules if present
      if (experiment.targetingRules && !this.evaluateTargetingRules(experiment.targetingRules, context)) {
        this.logger.debug('Unit does not match targeting rules', { experimentKey, unitId });
        return {
          variantKey: 'control',
          assigned: false,
          reason: 'targeting_rules_not_met',
        };
      }

      // Get assignment based on experiment type
      const assignment = await this.performAssignment(experiment, context);

      // Cache the assignment
      await this.cacheAssignment(experimentKey, unitId, assignment);

      // Log assignment for debugging (if enabled)
      if (this.enableLogging) {
        await this.logAssignment(experiment, unitId, assignment, context);
      }

      this.logger.debug('Assignment completed', {
        experimentKey,
        unitId,
        variantKey: assignment.variantKey,
      });

      return assignment;
    } catch (error) {
      this.logger.error('Assignment failed', { error, experimentKey, unitId });
      throw new AssignmentError('Failed to get assignment', { experimentKey, unitId, error });
    }
  }

  /**
   * Get assignments for all running experiments for a unit
   */
  async getAllAssignments(context: EvaluationContext): Promise<Record<string, AssignmentResult>> {
    const unitId = this.getUnitId(context);

    this.logger.debug('Getting all assignments', { unitId });

    try {
      // Get all running experiments
      const { experiments } = await this.configService.listExperiments({
        status: ['running'],
        limit: 100, // Reasonable limit
      });

      // Get assignments in parallel
      const assignmentPromises = experiments.map(async (experiment) => {
        const assignment = await this.getAssignment(experiment.key, context);
        return [experiment.key, assignment] as [string, AssignmentResult];
      });

      const assignments = await Promise.all(assignmentPromises);

      // Convert to object
      return Object.fromEntries(assignments.filter(([_, result]) => result.assigned));
    } catch (error) {
      this.logger.error('Failed to get all assignments', { error, unitId });
      throw new AssignmentError('Failed to get all assignments', { unitId, error });
    }
  }

  /**
   * Force a specific assignment (for testing/debugging)
   */
  async forceAssignment(
    experimentKey: string,
    unitId: string,
    variantKey: string,
    ttlSeconds?: number
  ): Promise<void> {
    this.logger.info('Forcing assignment', { experimentKey, unitId, variantKey });

    try {
      // Verify experiment and variant exist
      const experiment = await this.configService.getExperimentByKey(experimentKey);
      if (!experiment) {
        throw new AssignmentError('Experiment not found', { experimentKey });
      }

      const variant = experiment.variants.find(v => v.key === variantKey);
      if (!variant) {
        throw new AssignmentError('Variant not found', { experimentKey, variantKey });
      }

      const assignment: AssignmentResult = {
        variantKey,
        assigned: true,
        reason: 'forced',
      };

      // Cache the forced assignment
      const cacheKey = `assignment:${experimentKey}:${unitId}`;
      await this.cache.set(cacheKey, assignment, ttlSeconds || this.assignmentCacheTtlSeconds);

      this.logger.info('Assignment forced successfully', { experimentKey, unitId, variantKey });
    } catch (error) {
      this.logger.error('Failed to force assignment', { error, experimentKey, unitId });
      throw error;
    }
  }

  /**
   * Clear assignment cache for a unit
   */
  async clearAssignmentCache(experimentKey: string, unitId: string): Promise<void> {
    this.logger.info('Clearing assignment cache', { experimentKey, unitId });

    try {
      const cacheKey = `assignment:${experimentKey}:${unitId}`;
      await this.cache.delete(cacheKey);
    } catch (error) {
      this.logger.warn('Failed to clear assignment cache', { error, experimentKey, unitId });
    }
  }

  /**
   * ============================================
   * PRIVATE HELPER METHODS
   * ============================================
   */

  /**
   * Perform assignment based on experiment type
   */
  private async performAssignment(
    experiment: Experiment,
    context: EvaluationContext
  ): Promise<AssignmentResult> {
    const unitId = this.getUnitId(context);

    switch (experiment.designType) {
      case 'ab':
      case 'multivariate':
        const variantKey = this.algorithm.assign(unitId, experiment, context.attributes);
        return {
          variantKey,
          assigned: true,
          reason: 'assigned',
        };

      case 'factorial':
        const factors = this.algorithm.assignFactorial(unitId, experiment);
        // Construct variant key from factors
        const factorialVariantKey = this.constructFactorialVariantKey(factors, experiment);
        return {
          variantKey: factorialVariantKey,
          factors,
          assigned: true,
          reason: 'assigned',
        };

      case 'switchback':
        const timestamp = context.timestamp || new Date();
        const switchbackVariantKey = this.algorithm.assignSwitchback(experiment, timestamp);
        return {
          variantKey: switchbackVariantKey,
          assigned: true,
          reason: 'assigned',
        };

      case 'within_subjects':
        // For within-subjects, we need session number
        const sessionNumber = context.attributes?.sessionNumber || 0;
        const withinSubjectsVariantKey = this.algorithm.assignWithinSubjects(
          unitId,
          experiment,
          sessionNumber
        );
        return {
          variantKey: withinSubjectsVariantKey,
          assigned: true,
          reason: 'assigned',
        };

      case 'stepped_wedge':
        // For stepped wedge, extract cluster ID from context
        const swConfig = experiment.designConfig;
        if (!swConfig?.clusterKey) {
          throw new AssignmentError('Stepped wedge requires clusterKey in designConfig');
        }

        const clusterId = context.attributes?.[swConfig.clusterKey];
        if (!clusterId) {
          throw new AssignmentError(
            `Cluster key '${swConfig.clusterKey}' not found in context attributes. ` +
            `Available attributes: ${Object.keys(context.attributes || {}).join(', ')}`
          );
        }

        const swTimestamp = context.timestamp || new Date();
        const steppedWedgeAssignment = this.algorithm.assignSteppedWedge(
          experiment,
          clusterId,
          swTimestamp
        );

        return {
          variantKey: steppedWedgeAssignment.variantKey,
          assigned: true,
          reason: 'assigned',
          currentStep: steppedWedgeAssignment.currentStep,
          stepStart: steppedWedgeAssignment.stepStart,
          stepEnd: steppedWedgeAssignment.stepEnd,
          switchStep: steppedWedgeAssignment.switchStep,
          inTreatment: steppedWedgeAssignment.inTreatment,
          clusterId: clusterId,
        };

      default:
        throw new AssignmentError(`Unsupported experiment type: ${experiment.designType}`);
    }
  }

  /**
   * Construct variant key from factorial assignment
   */
  private constructFactorialVariantKey(
    factors: Record<string, string>,
    experiment: Experiment
  ): string {
    // Sort factor names for consistency
    const factorNames = Object.keys(factors).sort();
    const factorValues = factorNames.map(name => factors[name]);

    // Create a deterministic key
    const compositeKey = factorValues.join('_');

    // Try to find matching variant
    const variant = experiment.variants.find(v => {
      // Variant keys should match the pattern (e.g., "blue_buy_now")
      return v.key === compositeKey;
    });

    return variant ? variant.key : compositeKey;
  }

  /**
   * Get unit ID from context based on randomization unit
   */
  private getUnitId(context: EvaluationContext): string {
    // Default to unitId if provided
    if (context.unitId) {
      return context.unitId;
    }

    // Fallback based on available IDs
    return context.userId || context.sessionId || context.deviceId || 'anonymous';
  }

  /**
   * Evaluate targeting rules
   * This is a simplified version - in production you'd use a proper expression evaluator
   */
  private evaluateTargetingRules(rules: string, context: EvaluationContext): boolean {
    try {
      // For now, just return true
      // In production, you'd parse and evaluate the expression against context
      // Example: "context.platform === 'mobile' && context.version >= '2.0'"

      // Simple placeholder implementation
      if (!rules || rules.trim() === '') {
        return true;
      }

      // You would integrate a library like jsonlogic or create a custom evaluator
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate targeting rules', { error, rules });
      return false;
    }
  }

  /**
   * Cache assignment result
   */
  private async cacheAssignment(
    experimentKey: string,
    unitId: string,
    assignment: AssignmentResult
  ): Promise<void> {
    try {
      let cacheKey = `assignment:${experimentKey}:${unitId}`;

      // For stepped wedge, use cluster and step-based caching
      if (assignment.clusterId && assignment.currentStep !== undefined) {
        cacheKey = `assignment:${experimentKey}:${assignment.clusterId}:step:${assignment.currentStep}`;
      }

      await this.cache.set(cacheKey, assignment, this.assignmentCacheTtlSeconds);
    } catch (error) {
      this.logger.warn('Failed to cache assignment', { error, experimentKey, unitId });
      // Don't throw - caching failure shouldn't break assignment
    }
  }

  /**
   * Log assignment for debugging and analysis
   */
  private async logAssignment(
    experiment: Experiment,
    unitId: string,
    assignment: AssignmentResult,
    context: EvaluationContext
  ): Promise<void> {
    try {
      const logEntry: Assignment = {
        experimentId: experiment.id,
        unitId,
        variantKey: assignment.variantKey,
        timestamp: new Date(),
        context: {
          ...context.attributes,
          platform: context.platform,
          version: context.version,
        },
        factors: assignment.factors,
      };

      // Store in cache for later batch processing
      const logKey = `assignment:log:${experiment.id}:${unitId}:${Date.now()}`;
      await this.cache.set(logKey, logEntry, 3600); // 1 hour TTL

      this.logger.debug('Assignment logged', {
        experimentId: experiment.id,
        unitId,
        variantKey: assignment.variantKey,
      });
    } catch (error) {
      this.logger.warn('Failed to log assignment', { error, experimentId: experiment.id, unitId });
      // Don't throw - logging failure shouldn't break assignment
    }
  }

  /**
   * Set custom assignment algorithm
   */
  setAssignmentAlgorithm(algorithm: IAssignmentAlgorithm): void {
    this.algorithm = algorithm;
    this.logger.info('Custom assignment algorithm set');
  }
}
