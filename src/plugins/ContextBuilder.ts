/**
 * Experimental Context Builder
 *
 * Builds rich experimental context from configuration and data for plugin execution.
 * Handles transformation between TypeScript experiment configuration and Python plugin format.
 */

import { Experiment } from '../types';
import {
  ExperimentalContext,
  ExperimentalDesign,
  MetricSpecification,
  TemporalStructure,
  SpatialStructure,
  ClusterStructure,
  FactorialStructure,
  SteppedWedgeStructure,
  WithinSubjectsStructure,
} from './types';

export class ContextBuilder {
  /**
   * Build experimental context from experiment configuration and data
   */
  static buildContext(
    experiment: Experiment,
    data: any[],
    metrics: string[]
  ): ExperimentalContext {
    const design = this.buildDesignSpec(experiment);
    const metricSpecs = this.buildMetricSpecs(experiment, metrics);
    const nPerTreatment = this.calculateSampleSizes(data, design);

    return {
      design,
      metrics: metricSpecs,
      data,
      nTotal: data.length,
      nPerTreatment,
      startDate: experiment.startDate,
      endDate: experiment.endDate,
    };
  }

  /**
   * Build design specification from experiment
   */
  private static buildDesignSpec(experiment: Experiment): ExperimentalDesign {
    const design: ExperimentalDesign = {
      designType: experiment.designType,
      treatmentColumn: 'variant',
      controlValue: experiment.variants[0].key, // Assume first variant is control
      treatmentValues: experiment.variants.slice(1).map(v => v.key),
      randomizationUnit: experiment.randomizationUnit,
    };

    // Add design-specific structures
    switch (experiment.designType) {
      case 'factorial':
        design.factorial = this.buildFactorialStructure(experiment);
        break;
      case 'stepped_wedge':
        design.steppedWedge = this.buildSteppedWedgeStructure(experiment);
        break;
      case 'switchback':
        design.temporal = this.buildTemporalStructure(experiment);
        break;
      case 'within_subjects':
        design.withinSubjects = this.buildWithinSubjectsStructure(experiment);
        break;
    }

    return design;
  }

  /**
   * Build factorial structure
   */
  private static buildFactorialStructure(experiment: Experiment): FactorialStructure | undefined {
    if (!experiment.designConfig.factors) {
      return undefined;
    }

    const levelsPerFactor: Record<string, string[]> = {};
    for (const factor of experiment.designConfig.factors) {
      levelsPerFactor[factor.name] = factor.levels;
    }

    return {
      factors: experiment.designConfig.factors.map(f => f.name),
      levelsPerFactor,
    };
  }

  /**
   * Build stepped wedge structure
   */
  private static buildSteppedWedgeStructure(experiment: Experiment): SteppedWedgeStructure | undefined {
    const config = experiment.designConfig;

    if (!config.schedule || !config.numSteps) {
      return undefined;
    }

    // Convert schedule to rollout sequence
    const rolloutSequence: string[][] = [];
    for (let step = 0; step < config.numSteps; step++) {
      const clusters = config.schedule.stepToClusters[step] || [];
      rolloutSequence.push(clusters);
    }

    return {
      clusterColumn: config.clusterKey || 'cluster_id',
      timePeriodColumn: 'period',
      rolloutSequence,
      nPeriodsPre: Math.floor((config.numSteps || 1) / 3),
      nPeriodsPost: Math.floor((config.numSteps || 1) / 3),
    };
  }

  /**
   * Build temporal structure for switchback
   */
  private static buildTemporalStructure(experiment: Experiment): TemporalStructure | undefined {
    if (!experiment.designConfig.switchbackPeriodMinutes) {
      return undefined;
    }

    return {
      timeColumn: 'timestamp',
      timeUnit: 'minute',
      periodColumn: 'period',
    };
  }

  /**
   * Build within-subjects structure
   */
  private static buildWithinSubjectsStructure(experiment: Experiment): WithinSubjectsStructure | undefined {
    return {
      subjectColumn: experiment.randomizationUnit,
      conditionColumn: 'variant',
    };
  }

  /**
   * Build metric specifications
   */
  private static buildMetricSpecs(
    experiment: Experiment,
    metrics: string[]
  ): MetricSpecification[] {
    return metrics.map(metric => ({
      name: metric,
      column: metric,
      metricType: 'continuous', // Default, could be inferred from data
      higherIsBetter: true,
    }));
  }

  /**
   * Calculate sample sizes per treatment group
   */
  private static calculateSampleSizes(
    data: any[],
    design: ExperimentalDesign
  ): Record<string, number> {
    const sizes: Record<string, number> = {};

    // Count control
    sizes[design.controlValue] = data.filter(
      row => row[design.treatmentColumn] === design.controlValue
    ).length;

    // Count treatments
    for (const treatment of design.treatmentValues) {
      sizes[treatment] = data.filter(
        row => row[design.treatmentColumn] === treatment
      ).length;
    }

    return sizes;
  }
}
