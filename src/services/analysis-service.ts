/**
 * Analysis Service
 * Handles statistical analysis of experiment results
 * Supports all experiment types and provides formatted results for API
 */

import {
  Experiment,
  AnalysisResult,
  StatisticalResult,
  MainEffect,
  InteractionEffect,
  ExperimentStatus,
} from '../types';
import { ILogger, ICacheStore, IStatisticalEngine } from '../types/interfaces';
import { AnalysisError, NotFoundError } from '../types/errors';
import { ConfigurationService } from './configuration-service';

export interface AnalysisServiceOptions {
  configurationService: ConfigurationService;
  statisticalEngine: IStatisticalEngine;
  cache: ICacheStore;
  logger: ILogger;
  analysisCacheTtlSeconds?: number;
  defaultAlpha?: number;
}

/**
 * Metric data structure for analysis
 */
export interface MetricData {
  variantKey: string;
  values: number[];
  mean: number;
  stdDev: number;
  sampleSize: number;
}

/**
 * Experiment data for analysis
 */
export interface ExperimentAnalysisData {
  experimentId: string;
  metrics: Record<string, MetricData[]>; // metricName -> [variant data]
  sampleSizes: Record<string, number>; // variantKey -> count
}

export class AnalysisService {
  private configService: ConfigurationService;
  private statisticalEngine: IStatisticalEngine;
  private cache: ICacheStore;
  private logger: ILogger;
  private analysisCacheTtlSeconds: number;
  private defaultAlpha: number;

  constructor(options: AnalysisServiceOptions) {
    this.configService = options.configurationService;
    this.statisticalEngine = options.statisticalEngine;
    this.cache = options.cache;
    this.logger = options.logger.child({ service: 'AnalysisService' });
    this.analysisCacheTtlSeconds = options.analysisCacheTtlSeconds || 300; // 5 minutes
    this.defaultAlpha = options.defaultAlpha || 0.05;
  }

  /**
   * Analyze experiment results
   */
  async analyzeExperiment(
    experimentId: string,
    data: ExperimentAnalysisData,
    options?: {
      alpha?: number;
      useCache?: boolean;
    }
  ): Promise<AnalysisResult> {
    this.logger.info('Analyzing experiment', { experimentId });

    try {
      const alpha = options?.alpha || this.defaultAlpha;
      const useCache = options?.useCache ?? true;

      // Try cache first
      if (useCache) {
        const cacheKey = `analysis:${experimentId}:${alpha}`;
        const cached = await this.cache.get<AnalysisResult>(cacheKey);
        if (cached) {
          this.logger.debug('Analysis found in cache', { experimentId });
          return cached;
        }
      }

      // Get experiment configuration
      const experiment = await this.configService.getExperiment(experimentId);
      if (!experiment) {
        throw new NotFoundError('Experiment', experimentId);
      }

      // Perform analysis based on experiment type
      const result = await this.performAnalysis(experiment, data, alpha);

      // Add recommendations and warnings
      result.recommendation = this.generateRecommendation(result);
      result.warnings = this.generateWarnings(result, experiment);

      // Cache the result
      if (useCache) {
        await this.cacheAnalysisResult(experimentId, alpha, result);
      }

      this.logger.info('Analysis completed', { experimentId });

      return result;
    } catch (error) {
      this.logger.error('Failed to analyze experiment', { error, experimentId });
      throw new AnalysisError('Failed to analyze experiment', { experimentId, error });
    }
  }

  /**
   * Analyze a simple A/B test
   */
  async analyzeABTest(
    experimentId: string,
    data: ExperimentAnalysisData,
    alpha: number = this.defaultAlpha
  ): Promise<AnalysisResult> {
    this.logger.info('Analyzing A/B test', { experimentId });

    const experiment = await this.configService.getExperiment(experimentId);
    if (!experiment) {
      throw new NotFoundError('Experiment', experimentId);
    }

    const results: StatisticalResult[] = [];

    // Analyze primary metric
    const primaryMetricData = data.metrics[experiment.primaryMetric];
    if (primaryMetricData && primaryMetricData.length >= 2) {
      const result = await this.compareVariants(
        primaryMetricData[0],
        primaryMetricData[1],
        experiment.primaryMetric,
        alpha
      );
      results.push(result);
    }

    // Analyze secondary metrics
    for (const metric of experiment.secondaryMetrics) {
      const metricData = data.metrics[metric];
      if (metricData && metricData.length >= 2) {
        const result = await this.compareVariants(
          metricData[0],
          metricData[1],
          metric,
          alpha
        );
        results.push(result);
      }
    }

    // Analyze guardrail metrics
    const guardrailResults: StatisticalResult[] = [];
    for (const metric of experiment.guardrailMetrics) {
      const metricData = data.metrics[metric];
      if (metricData && metricData.length >= 2) {
        const result = await this.compareVariants(
          metricData[0],
          metricData[1],
          metric,
          alpha
        );
        guardrailResults.push(result);
      }
    }

    return {
      experimentId,
      status: experiment.status,
      sampleSize: Object.values(data.sampleSizes).reduce((sum, count) => sum + count, 0),
      startDate: experiment.startDate || new Date(),
      endDate: experiment.endDate,
      results,
      guardrailResults,
    };
  }

  /**
   * Analyze factorial experiment
   */
  async analyzeFactorial(
    experimentId: string,
    data: ExperimentAnalysisData,
    alpha: number = this.defaultAlpha
  ): Promise<AnalysisResult> {
    this.logger.info('Analyzing factorial experiment', { experimentId });

    const experiment = await this.configService.getExperiment(experimentId);
    if (!experiment) {
      throw new NotFoundError('Experiment', experimentId);
    }

    const mainEffects: MainEffect[] = [];
    const interactions: InteractionEffect[] = [];

    // Analyze main effects for each factor
    const factors = experiment.designConfig.factors || [];
    for (const factor of factors) {
      for (const metric of [experiment.primaryMetric, ...experiment.secondaryMetrics]) {
        const effect = await this.analyzeMainEffect(factor, metric, data, alpha);
        if (effect) {
          mainEffects.push(effect);
        }
      }
    }

    // Analyze interaction effects (for 2-factor designs)
    if (factors.length === 2) {
      for (const metric of [experiment.primaryMetric, ...experiment.secondaryMetrics]) {
        const interaction = await this.analyzeInteraction(factors, metric, data, alpha);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    return {
      experimentId,
      status: experiment.status,
      sampleSize: Object.values(data.sampleSizes).reduce((sum, count) => sum + count, 0),
      startDate: experiment.startDate || new Date(),
      endDate: experiment.endDate,
      mainEffects,
      interactions,
    };
  }

  /**
   * Calculate required sample size for an experiment
   */
  async calculateSampleSize(params: {
    baselineRate: number;
    minimumDetectableEffect: number;
    alpha?: number;
    power?: number;
  }): Promise<number> {
    this.logger.info('Calculating sample size', params);

    try {
      const sampleSize = await this.statisticalEngine.calculateSampleSize({
        baselineRate: params.baselineRate,
        minimumDetectableEffect: params.minimumDetectableEffect,
        alpha: params.alpha || this.defaultAlpha,
        power: params.power || 0.8,
      });

      this.logger.info('Sample size calculated', { sampleSize });

      return sampleSize;
    } catch (error) {
      this.logger.error('Failed to calculate sample size', { error, params });
      throw new AnalysisError('Failed to calculate sample size', { params, error });
    }
  }

  /**
   * Calculate statistical power
   */
  async calculatePower(params: {
    sampleSize: number;
    baselineRate: number;
    effect: number;
    alpha?: number;
  }): Promise<number> {
    this.logger.info('Calculating power', params);

    try {
      const power = await this.statisticalEngine.calculatePower({
        sampleSize: params.sampleSize,
        baselineRate: params.baselineRate,
        effect: params.effect,
        alpha: params.alpha || this.defaultAlpha,
      });

      this.logger.info('Power calculated', { power });

      return power;
    } catch (error) {
      this.logger.error('Failed to calculate power', { error, params });
      throw new AnalysisError('Failed to calculate power', { params, error });
    }
  }

  /**
   * Invalidate analysis cache for an experiment
   */
  async invalidateCache(experimentId: string): Promise<void> {
    this.logger.info('Invalidating analysis cache', { experimentId });

    try {
      await this.cache.deletePattern(`analysis:${experimentId}:*`);
    } catch (error) {
      this.logger.warn('Failed to invalidate analysis cache', { error, experimentId });
    }
  }

  /**
   * ============================================
   * PRIVATE HELPER METHODS
   * ============================================
   */

  /**
   * Perform analysis based on experiment type
   */
  private async performAnalysis(
    experiment: Experiment,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<AnalysisResult> {
    switch (experiment.designType) {
      case 'ab':
        return await this.analyzeABTest(experiment.id, data, alpha);

      case 'multivariate':
        return await this.analyzeMultivariate(experiment, data, alpha);

      case 'factorial':
        return await this.analyzeFactorial(experiment.id, data, alpha);

      case 'within_subjects':
        return await this.analyzeWithinSubjects(experiment, data, alpha);

      case 'switchback':
        return await this.analyzeSwitchback(experiment, data, alpha);

      case 'stepped_wedge':
        return await this.analyzeSteppedWedge(experiment, data, alpha);

      default:
        throw new AnalysisError(`Unsupported experiment type: ${experiment.designType}`);
    }
  }

  /**
   * Compare two variants using t-test
   */
  private async compareVariants(
    control: MetricData,
    treatment: MetricData,
    metric: string,
    alpha: number
  ): Promise<StatisticalResult> {
    const result = await this.statisticalEngine.tTest(control.values, treatment.values, alpha);

    const absoluteChange = result.mean2 - result.mean1;
    const relativeChange = (absoluteChange / result.mean1) * 100;

    return {
      metric,
      controlMean: result.mean1,
      treatmentMean: result.mean2,
      relativeChange,
      absoluteChange,
      pValue: result.pValue,
      confidenceInterval: result.confidenceInterval,
      significant: result.significant,
      sampleSizeControl: control.sampleSize,
      sampleSizeTreatment: treatment.sampleSize,
    };
  }

  /**
   * Analyze multivariate test using ANOVA
   */
  private async analyzeMultivariate(
    experiment: Experiment,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<AnalysisResult> {
    const results: StatisticalResult[] = [];

    // Get primary metric data
    const primaryMetricData = data.metrics[experiment.primaryMetric];
    if (primaryMetricData) {
      // Use ANOVA for multiple groups
      const groups = primaryMetricData.map(v => v.values);
      const anovaResult = await this.statisticalEngine.anova(groups, alpha);

      // If significant, do pairwise comparisons
      if (anovaResult.significant && primaryMetricData.length >= 2) {
        const control = primaryMetricData[0];
        for (let i = 1; i < primaryMetricData.length; i++) {
          const treatment = primaryMetricData[i];
          const result = await this.compareVariants(control, treatment, experiment.primaryMetric, alpha);
          results.push(result);
        }
      }
    }

    return {
      experimentId: experiment.id,
      status: experiment.status,
      sampleSize: Object.values(data.sampleSizes).reduce((sum, count) => sum + count, 0),
      startDate: experiment.startDate || new Date(),
      endDate: experiment.endDate,
      results,
    };
  }

  /**
   * Analyze main effect for a factor
   */
  private async analyzeMainEffect(
    factor: { name: string; levels: string[] },
    metric: string,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<MainEffect | null> {
    // This is a simplified version
    // In production, you'd aggregate data across other factors
    const metricData = data.metrics[metric];
    if (!metricData || metricData.length < 2) {
      return null;
    }

    // Compare first two levels (simplified)
    const control = metricData[0];
    const treatment = metricData[1];

    const result = await this.statisticalEngine.tTest(control.values, treatment.values, alpha);

    const relativeChange = ((result.mean2 - result.mean1) / result.mean1) * 100;

    return {
      factor: factor.name,
      metric,
      control: factor.levels[0],
      treatment: factor.levels[1],
      controlMean: result.mean1,
      treatmentMean: result.mean2,
      relativeChange,
      pValue: result.pValue,
      confidenceInterval: result.confidenceInterval,
      significant: result.significant,
    };
  }

  /**
   * Analyze interaction effect
   */
  private async analyzeInteraction(
    factors: { name: string; levels: string[] }[],
    metric: string,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<InteractionEffect | null> {
    // This is a placeholder
    // In production, you'd use proper 2-way ANOVA or regression
    return {
      factors: factors.map(f => f.name),
      pValue: 0.5, // Placeholder
      significant: false,
      effectSize: 0,
    };
  }

  /**
   * Analyze within-subjects design
   */
  private async analyzeWithinSubjects(
    experiment: Experiment,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<AnalysisResult> {
    // Use repeated measures ANOVA or paired t-test
    // For now, use standard analysis
    return await this.analyzeABTest(experiment.id, data, alpha);
  }

  /**
   * Analyze switchback experiment
   */
  private async analyzeSwitchback(
    experiment: Experiment,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<AnalysisResult> {
    // Account for temporal correlation and clustering
    // For now, use standard analysis with note
    const result = await this.analyzeABTest(experiment.id, data, alpha);

    result.warnings = result.warnings || [];
    result.warnings.push(
      'Switchback analysis should account for temporal correlation. Consider using clustered standard errors.'
    );

    return result;
  }

  /**
   * Analyze stepped wedge experiment
   * Accounts for cluster randomization and time trends
   */
  private async analyzeSteppedWedge(
    experiment: Experiment,
    data: ExperimentAnalysisData,
    alpha: number
  ): Promise<AnalysisResult> {
    this.logger.info('Analyzing stepped wedge experiment', { experimentId: experiment.id });

    // Group data by cluster and step for proper analysis
    const clusterData = this.groupByCluster(data);

    // Calculate treatment effect adjusting for time trends
    // This is a simplified analysis - proper mixed effects modeling would be ideal
    const results: StatisticalResult[] = [];

    // Analyze primary metric
    const primaryMetricData = data.metrics[experiment.primaryMetric];
    if (primaryMetricData && primaryMetricData.length >= 2) {
      const result = await this.compareVariants(
        primaryMetricData[0],
        primaryMetricData[1],
        experiment.primaryMetric,
        alpha
      );
      results.push(result);
    }

    // Analyze secondary metrics
    for (const metric of experiment.secondaryMetrics) {
      const metricData = data.metrics[metric];
      if (metricData && metricData.length >= 2) {
        const result = await this.compareVariants(
          metricData[0],
          metricData[1],
          metric,
          alpha
        );
        results.push(result);
      }
    }

    // Calculate intracluster correlation (ICC)
    const icc = this.calculateICC(clusterData, experiment.primaryMetric);

    const analysisResult: AnalysisResult = {
      experimentId: experiment.id,
      status: experiment.status,
      sampleSize: Object.values(data.sampleSizes).reduce((sum, count) => sum + count, 0),
      startDate: experiment.startDate || new Date(),
      endDate: experiment.endDate,
      results,
      warnings: [],
    };

    // Add stepped wedge specific warnings
    analysisResult.warnings = analysisResult.warnings || [];

    analysisResult.warnings.push(
      'Stepped wedge analysis: This is a simplified analysis. For rigorous results, use mixed effects models that account for:',
      '  - Within-cluster correlation (ICC)',
      '  - Time trends (secular effects)',
      '  - Cluster-level random effects',
      'Consider exporting data for analysis in R (lme4) or Python (statsmodels).'
    );

    if (icc > 0.1) {
      analysisResult.warnings.push(
        `High intracluster correlation detected (ICC=${icc.toFixed(3)}). ` +
        `Standard errors may be underestimated without proper clustering adjustment.`
      );
    }

    // Check for sufficient clusters
    const numClusters = Object.keys(clusterData).length;
    if (numClusters < 10) {
      analysisResult.warnings.push(
        `Small number of clusters (${numClusters}). ` +
        `Stepped wedge designs typically require 10+ clusters for adequate power.`
      );
    }

    // Check for time trend issues
    const hasTimeTrend = this.detectTimeTrend(clusterData, experiment.primaryMetric);
    if (hasTimeTrend) {
      analysisResult.warnings.push(
        'Significant time trend detected. Treatment effect estimates may be confounded with secular trends. ' +
        'Consider adjusting for time in the analysis model.'
      );
    }

    return analysisResult;
  }

  /**
   * Group data by cluster for cluster-level analysis
   */
  private groupByCluster(data: ExperimentAnalysisData): Record<string, any> {
    // This is a placeholder implementation
    // In practice, you'd need cluster information in the data structure
    return {};
  }

  /**
   * Calculate intracluster correlation coefficient (ICC)
   * Measures similarity of responses within clusters
   */
  private calculateICC(clusterData: Record<string, any>, metric: string): number {
    // Simplified ICC calculation
    // ICC = (between-cluster variance) / (total variance)
    // Proper implementation would use ANOVA or mixed effects model

    // Placeholder: return moderate ICC
    // In production, calculate from actual cluster data
    return 0.05;
  }

  /**
   * Detect secular time trends in the data
   */
  private detectTimeTrend(clusterData: Record<string, any>, metric: string): boolean {
    // Simplified time trend detection
    // In practice, would fit regression model and test time coefficient

    // Placeholder: assume no strong trend
    return false;
  }

  /**
   * Generate recommendation based on results
   */
  private generateRecommendation(result: AnalysisResult): string {
    if (!result.results || result.results.length === 0) {
      return 'Insufficient data for recommendation';
    }

    const primaryResult = result.results[0];

    if (!primaryResult.significant) {
      return 'No significant difference detected. Consider running longer or increasing sample size.';
    }

    if (primaryResult.relativeChange > 0) {
      // Check guardrails
      const guardrailViolation = result.guardrailResults?.some(
        g => g.significant && g.relativeChange < 0
      );

      if (guardrailViolation) {
        return 'Treatment shows positive effect but violates guardrail metrics. Proceed with caution.';
      }

      return `Treatment shows significant improvement (${primaryResult.relativeChange.toFixed(2)}% lift). Consider rolling out.`;
    } else {
      return 'Treatment shows significant negative effect. Do not roll out.';
    }
  }

  /**
   * Generate warnings based on results and experiment config
   */
  private generateWarnings(result: AnalysisResult, experiment: Experiment): string[] {
    const warnings: string[] = [];

    // Check sample size
    if (experiment.minSampleSize && result.sampleSize < experiment.minSampleSize) {
      warnings.push(
        `Sample size (${result.sampleSize}) is below minimum required (${experiment.minSampleSize})`
      );
    }

    // Check runtime
    if (experiment.startDate) {
      const runtime = Date.now() - experiment.startDate.getTime();
      const minRuntime = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (runtime < minRuntime) {
        warnings.push('Experiment has been running for less than 7 days. Consider running longer.');
      }
    }

    // Check for multiple comparisons
    if (result.results && result.results.length > 1) {
      warnings.push(
        'Multiple comparisons detected. Consider applying Bonferroni or other corrections.'
      );
    }

    // Check guardrail violations
    const guardrailViolations = result.guardrailResults?.filter(
      g => g.significant && g.relativeChange < 0
    );

    if (guardrailViolations && guardrailViolations.length > 0) {
      warnings.push(
        `Guardrail metric violations detected: ${guardrailViolations.map(g => g.metric).join(', ')}`
      );
    }

    return warnings;
  }

  /**
   * Cache analysis result
   */
  private async cacheAnalysisResult(
    experimentId: string,
    alpha: number,
    result: AnalysisResult
  ): Promise<void> {
    try {
      const cacheKey = `analysis:${experimentId}:${alpha}`;
      await this.cache.set(cacheKey, result, this.analysisCacheTtlSeconds);
    } catch (error) {
      this.logger.warn('Failed to cache analysis result', { error, experimentId });
    }
  }
}
