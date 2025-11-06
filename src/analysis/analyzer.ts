/**
 * Main Experiment Analyzer - Orchestrator
 *
 * Integrates all statistical analysis components to provide comprehensive
 * experiment analysis for various experimental designs:
 * - Simple A/B tests
 * - Multivariate tests
 * - Factorial designs with interaction effects
 * - Switchback experiments with clustered errors
 * - Within-subjects (repeated measures) designs
 * - Stepped wedge cluster randomized trials
 *
 * References:
 * - Kohavi, R., Tang, D., & Xu, Y. (2020). "Trustworthy Online Controlled Experiments"
 * - Montgomery, D. C. (2017). "Design and Analysis of Experiments"
 */

import {
  twoSampleTTest,
  twoProportionZTest,
  oneWayANOVA,
  factorialANOVA,
  multipleRegression,
  TTestResult,
  ZTestResult,
  ANOVAResult,
  RegressionResult
} from './statistical-tests';

import {
  analyzeSteppedWedge,
  SteppedWedgeData,
  SteppedWedgeAnalysisResult
} from './stepped-wedge-analysis';


import {
  bayesianProportionTest,
  bayesianContinuousTest,
  BayesianProportionResult,
  BayesianContinuousResult
} from './bayesian';

import {
  bonferroniCorrection,
  holmBonferroniCorrection,
  benjaminiHochbergCorrection,
  sequentialTest,
  MultipleTestingResult,
  SequentialTestResult
} from './corrections';

import {
  tTestSampleSize,
  proportionTestSampleSize,
  tTestMDE,
  proportionTestMDE,
  PowerAnalysisResult,
  MinimumDetectableEffectResult
} from './power';

import {
  applyCUPED,
  cupedABTest,
  stratifiedABTest,
  CUPEDResult
} from './variance-reduction';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Experiment data for analysis
 */
export interface ExperimentData {
  design: 'ab' | 'multivariate' | 'factorial' | 'switchback' | 'within-subjects' | 'stepped_wedge';
  metric: {
    name: string;
    type: 'continuous' | 'proportion' | 'count';
    values: number[];
  };
  assignment: {
    variant: (string | number)[];
    timestamp?: number[]; // For switchback
    period?: number[]; // For switchback
    subject?: (string | number)[]; // For within-subjects
    cluster?: (string | number)[]; // For stepped wedge
    step?: number[]; // For stepped wedge
  };
  covariates?: {
    [name: string]: number[];
  };
  metadata?: {
    alpha?: number;
    power?: number;
    baselineRate?: number; // For proportion tests
    expectedEffect?: number;
  };
  steppedWedge?: SteppedWedgeDesign;
}

/**
 * Factorial design specification
 */
export interface FactorialDesign {
  factors: Array<{
    name: string;
    levels: (string | number)[];
  }>;
  factorAssignments: {
    [factorName: string]: (string | number)[];
  };
}

/**
 * Stepped wedge design specification
 */
export interface SteppedWedgeDesign {
  /** Cluster identifiers for each observation */
  clusters: (string | number)[];
  /** Time step for each observation */
  steps: number[];
  /** Treatment status for each observation */
  treatments: (0 | 1)[];
}

/**
 * Comprehensive analysis result
 */
export interface AnalysisResult {
  design: string;
  metric: string;
  metricType: string;

  // Primary analysis
  primary: {
    test: string;
    result: TTestResult | ZTestResult | ANOVAResult;
    interpretation: string;
  };

  // Bayesian analysis (optional)
  bayesian?: {
    result: BayesianProportionResult | BayesianContinuousResult;
    interpretation: string;
  };

  // Multiple testing correction
  correction?: MultipleTestingResult;

  // Variance reduction
  varianceReduction?: {
    method: string;
    result: CUPEDResult | any;
    improvement: string;
  };

  // Power analysis
  power?: {
    achievedPower: number;
    minimumDetectableEffect: MinimumDetectableEffectResult;
    recommendation: string;
  };

  // Warnings and recommendations
  warnings: string[];
  recommendations: string[];

  // Summary
  summary: {
    significant: boolean;
    winner?: string | number;
    effect: number;
    confidenceInterval: [number, number];
  };
}

/**
 * Factorial analysis result
 */
export interface FactorialAnalysisResult {
  mainEffects: {
    [factorName: string]: {
      result: ANOVAResult;
      significant: boolean;
      interpretation: string;
    };
  };
  interactions: {
    factors: string[];
    result: ANOVAResult;
    significant: boolean;
    interpretation: string;
  }[];
  correction: MultipleTestingResult;
  warnings: string[];
  recommendations: string[];
}

/**
 * Switchback analysis result
 */
export interface SwitchbackAnalysisResult {
  treatmentEffect: number;
  standardError: number;
  adjustedSE: number; // Clustered SE
  pValue: number;
  confidenceInterval: [number, number];
  clusteringAdjustment: {
    designEffect: number;
    effectiveN: number;
    icc: number; // Intraclass correlation
  };
  temporalAnalysis: {
    periodMeans: { [period: number]: number };
    trendTest: {
      significant: boolean;
      slope: number;
    };
  };
  warnings: string[];
}

// ============================================================================
// Main Analyzer Class
// ============================================================================

/**
 * Experiment Analyzer
 *
 * Main class for analyzing experiments with various designs.
 */
export class ExperimentAnalyzer {
  private alpha: number;
  private useBayesian: boolean;
  private useCUPED: boolean;
  private correctionMethod: 'bonferroni' | 'holm' | 'bh' | 'none';

  constructor(options?: {
    alpha?: number;
    useBayesian?: boolean;
    useCUPED?: boolean;
    correctionMethod?: 'bonferroni' | 'holm' | 'bh' | 'none';
  }) {
    this.alpha = options?.alpha ?? 0.05;
    this.useBayesian = options?.useBayesian ?? false;
    this.useCUPED = options?.useCUPED ?? false;
    this.correctionMethod = options?.correctionMethod ?? 'bh';
  }

  /**
   * Analyze experiment based on design type
   */
  analyze(data: ExperimentData): AnalysisResult {
    switch (data.design) {
      case 'ab':
        return this.analyzeAB(data);
      case 'multivariate':
        return this.analyzeMultivariate(data);
      case 'factorial':
        return this.analyzeFactorial(data);
      case 'switchback':
        return this.analyzeSwitchback(data);
      case 'within-subjects':
        return this.analyzeWithinSubjects(data);
      case 'stepped_wedge':
        return this.analyzeSteppedWedge(data);
      default:
        throw new Error(`Unknown design type: ${data.design}`);
    }
  }

  /**
   * Analyze simple A/B test
   */
  private analyzeAB(data: ExperimentData): AnalysisResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Extract control and treatment groups
    const variants = Array.from(new Set(data.assignment.variant));

    if (variants.length !== 2) {
      throw new Error('A/B test requires exactly 2 variants');
    }

    const [control, treatment] = variants;

    const controlIdx = data.assignment.variant.map((v, i) => v === control ? i : -1).filter(i => i !== -1);
    const treatmentIdx = data.assignment.variant.map((v, i) => v === treatment ? i : -1).filter(i => i !== -1);

    const controlValues = controlIdx.map(i => data.metric.values[i]);
    const treatmentValues = treatmentIdx.map(i => data.metric.values[i]);

    // Check sample sizes
    if (controlValues.length < 10 || treatmentValues.length < 10) {
      warnings.push('Small sample size (< 10 per group). Results may be unreliable.');
    }

    // Primary frequentist analysis
    let primaryResult: TTestResult | ZTestResult;
    let testType: string;

    if (data.metric.type === 'proportion') {
      // Z-test for proportions
      const controlSuccesses = controlValues.filter(v => v === 1).length;
      const treatmentSuccesses = treatmentValues.filter(v => v === 1).length;

      primaryResult = twoProportionZTest(
        controlSuccesses,
        controlValues.length,
        treatmentSuccesses,
        treatmentValues.length,
        this.alpha
      );
      testType = 'Two-proportion z-test';
    } else {
      // T-test for continuous metrics
      primaryResult = twoSampleTTest(controlValues, treatmentValues, this.alpha, false);
      testType = "Welch's t-test";
    }

    const interpretation = this.interpretResult(primaryResult);

    // Bayesian analysis (optional)
    let bayesianResult: BayesianProportionResult | BayesianContinuousResult | undefined;
    let bayesianInterpretation: string | undefined;

    if (this.useBayesian) {
      if (data.metric.type === 'proportion') {
        const controlSuccesses = controlValues.filter(v => v === 1).length;
        const treatmentSuccesses = treatmentValues.filter(v => v === 1).length;

        bayesianResult = bayesianProportionTest(
          controlSuccesses,
          controlValues.length,
          treatmentSuccesses,
          treatmentValues.length
        );
      } else {
        bayesianResult = bayesianContinuousTest(controlValues, treatmentValues);
      }

      bayesianInterpretation = this.interpretBayesianResult(bayesianResult);
    }

    // Variance reduction (CUPED)
    let varianceReductionResult: any;
    let varianceImprovement: string | undefined;

    if (this.useCUPED && data.covariates) {
      const covariateName = Object.keys(data.covariates)[0];
      const covariate = data.covariates[covariateName];

      if (covariate) {
        const controlCovariate = controlIdx.map(i => covariate[i]);
        const treatmentCovariate = treatmentIdx.map(i => covariate[i]);

        varianceReductionResult = cupedABTest(
          controlValues,
          controlCovariate,
          treatmentValues,
          treatmentCovariate
        );

        varianceImprovement = `CUPED reduced variance by ${varianceReductionResult.treatmentEffect.varianceReduction.toFixed(1)}%`;

        recommendations.push(varianceImprovement);
      }
    }

    // Power analysis
    const sampleSize = Math.min(controlValues.length, treatmentValues.length);
    let mdeResult: MinimumDetectableEffectResult;

    if (data.metric.type === 'proportion') {
      const baselineRate = data.metadata?.baselineRate ?? controlValues.filter(v => v === 1).length / controlValues.length;
      mdeResult = proportionTestMDE(sampleSize, baselineRate, this.alpha, 0.8);
    } else {
      mdeResult = tTestMDE(sampleSize, this.alpha, 0.8);
    }

    // Summary
    const effect = 'mean1' in primaryResult
      ? (primaryResult as TTestResult).mean2 - (primaryResult as TTestResult).mean1
      : (primaryResult as ZTestResult).proportion2 - (primaryResult as ZTestResult).proportion1;

    return {
      design: 'A/B Test',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: testType,
        result: primaryResult,
        interpretation
      },
      bayesian: this.useBayesian && bayesianResult ? {
        result: bayesianResult,
        interpretation: bayesianInterpretation!
      } : undefined,
      varianceReduction: varianceReductionResult ? {
        method: 'CUPED',
        result: varianceReductionResult,
        improvement: varianceImprovement!
      } : undefined,
      power: {
        achievedPower: 0, // Would need effect size
        minimumDetectableEffect: mdeResult,
        recommendation: `With current sample size, can detect effects of ${mdeResult.minimumDetectableEffect.toFixed(4)} or larger`
      },
      warnings,
      recommendations,
      summary: {
        significant: primaryResult.significant,
        winner: primaryResult.significant ? treatment : undefined,
        effect,
        confidenceInterval: primaryResult.confidenceInterval!
      }
    };
  }

  /**
   * Analyze multivariate test (3+ variants)
   */
  private analyzeMultivariate(data: ExperimentData): AnalysisResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const variants = Array.from(new Set(data.assignment.variant));

    if (variants.length < 3) {
      throw new Error('Multivariate test requires at least 3 variants');
    }

    // Group data by variant
    const groups = variants.map(variant => {
      const indices = data.assignment.variant
        .map((v, i) => v === variant ? i : -1)
        .filter(i => i !== -1);
      return indices.map(i => data.metric.values[i]);
    });

    // Check sample sizes
    groups.forEach((group, i) => {
      if (group.length < 10) {
        warnings.push(`Variant ${variants[i]} has small sample size (< 10)`);
      }
    });

    // ANOVA for overall test
    const anovaResult = oneWayANOVA(groups, this.alpha);

    // Multiple testing correction for pairwise comparisons
    const pairwiseTests: { pair: string; result: TTestResult | ZTestResult }[] = [];

    for (let i = 0; i < variants.length - 1; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        if (data.metric.type === 'proportion') {
          const successes1 = groups[i].filter(v => v === 1).length;
          const successes2 = groups[j].filter(v => v === 1).length;
          const result = twoProportionZTest(successes1, groups[i].length, successes2, groups[j].length, this.alpha);
          pairwiseTests.push({
            pair: `${variants[i]} vs ${variants[j]}`,
            result
          });
        } else {
          const result = twoSampleTTest(groups[i], groups[j], this.alpha, false);
          pairwiseTests.push({
            pair: `${variants[i]} vs ${variants[j]}`,
            result
          });
        }
      }
    }

    // Apply multiple testing correction
    const pValues = pairwiseTests.map(t => t.result.pValue);
    const testNames = pairwiseTests.map(t => t.pair);

    let correction: MultipleTestingResult;
    switch (this.correctionMethod) {
      case 'bonferroni':
        correction = bonferroniCorrection(pValues, testNames, this.alpha);
        break;
      case 'holm':
        correction = holmBonferroniCorrection(pValues, testNames, this.alpha);
        break;
      case 'bh':
        correction = benjaminiHochbergCorrection(pValues, testNames, this.alpha);
        break;
      default:
        correction = { method: 'none', alpha: this.alpha, numTests: 0, numSignificant: 0, tests: [] };
    }

    recommendations.push(
      `With ${variants.length} variants, consider using ${correction.method} correction for multiple comparisons`
    );

    // Find winner
    const means = groups.map(g => g.reduce((sum, v) => sum + v, 0) / g.length);
    const bestVariantIdx = means.indexOf(Math.max(...means));

    return {
      design: 'Multivariate Test',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: 'One-way ANOVA',
        result: anovaResult,
        interpretation: this.interpretResult(anovaResult)
      },
      correction,
      warnings,
      recommendations,
      summary: {
        significant: anovaResult.significant,
        winner: anovaResult.significant ? variants[bestVariantIdx] : undefined,
        effect: anovaResult.etaSquared,
        confidenceInterval: [0, 0] // Not directly applicable to ANOVA
      }
    };
  }

  /**
   * Analyze factorial design
   */
  private analyzeFactorial(data: ExperimentData & { factorial?: FactorialDesign }): AnalysisResult {
    if (!data.factorial) {
      throw new Error('Factorial design requires factor specifications');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    const factors = data.factorial.factors;

    if (factors.length !== 2) {
      throw new Error('Currently only 2-factor designs are supported');
    }

    const factorA = data.factorial.factorAssignments[factors[0].name];
    const factorB = data.factorial.factorAssignments[factors[1].name];

    // Run factorial ANOVA
    const factorialResult = factorialANOVA(
      data.metric.values,
      factorA,
      factorB,
      this.alpha
    );

    // Check for interaction
    if (factorialResult.interactionEffect.significant) {
      warnings.push('Significant interaction detected. Main effects should be interpreted cautiously.');
      recommendations.push('Plot interaction graph to understand how factors interact');
    }

    // Multiple testing correction (3 tests: 2 main effects + 1 interaction)
    const pValues = [
      factorialResult.mainEffectA.pValue,
      factorialResult.mainEffectB.pValue,
      factorialResult.interactionEffect.pValue
    ];

    const testNames = [
      `Main Effect: ${factors[0].name}`,
      `Main Effect: ${factors[1].name}`,
      'Interaction'
    ];

    let correction: MultipleTestingResult;
    if (this.correctionMethod !== 'none') {
      correction = benjaminiHochbergCorrection(pValues, testNames, this.alpha);
      recommendations.push('Applied Benjamini-Hochberg correction for 3 simultaneous tests');
    } else {
      correction = { method: 'none', alpha: this.alpha, numTests: 3, numSignificant: 0, tests: [] };
    }

    return {
      design: 'Factorial Design',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: 'Factorial ANOVA',
        result: factorialResult.mainEffectA, // Simplified
        interpretation: `Main Effect ${factors[0].name}: ${factorialResult.mainEffectA.significant ? 'Significant' : 'Not significant'}. ` +
                       `Main Effect ${factors[1].name}: ${factorialResult.mainEffectB.significant ? 'Significant' : 'Not significant'}. ` +
                       `Interaction: ${factorialResult.interactionEffect.significant ? 'Significant' : 'Not significant'}.`
      },
      correction,
      warnings,
      recommendations,
      summary: {
        significant: factorialResult.mainEffectA.significant || factorialResult.mainEffectB.significant,
        effect: factorialResult.mainEffectA.etaSquared + factorialResult.mainEffectB.etaSquared,
        confidenceInterval: [0, 0]
      }
    };
  }

  /**
   * Analyze switchback experiment
   */
  private analyzeSwitchback(data: ExperimentData): AnalysisResult {
    if (!data.assignment.period) {
      throw new Error('Switchback design requires period assignments');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Group by period and variant
    const periods = Array.from(new Set(data.assignment.period));
    const variants = Array.from(new Set(data.assignment.variant));

    if (variants.length !== 2) {
      throw new Error('Switchback currently supports 2 variants only');
    }

    // Calculate period-level means
    const periodMeans: { period: number; variant: string | number; mean: number }[] = [];

    for (const period of periods) {
      for (const variant of variants) {
        const indices = data.assignment.period!
          .map((p, i) => p === period && data.assignment.variant[i] === variant ? i : -1)
          .filter(i => i !== -1);

        if (indices.length > 0) {
          const values = indices.map(i => data.metric.values[i]);
          const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
          periodMeans.push({ period: period as number, variant, mean });
        }
      }
    }

    // Calculate treatment effect using period-level data
    const controlMeans = periodMeans.filter(p => p.variant === variants[0]).map(p => p.mean);
    const treatmentMeans = periodMeans.filter(p => p.variant === variants[1]).map(p => p.mean);

    // Standard t-test on period means (accounts for clustering)
    const result = twoSampleTTest(controlMeans, treatmentMeans, this.alpha, false);

    // Calculate intraclass correlation (ICC) for clustering
    const allPeriodData: { [period: number]: number[] } = {};

    for (const period of periods) {
      const indices = data.assignment.period!
        .map((p, i) => p === period ? i : -1)
        .filter(i => i !== -1);
      allPeriodData[period as number] = indices.map(i => data.metric.values[i]);
    }

    const icc = this.calculateICC(allPeriodData);

    warnings.push(`Intraclass correlation: ${icc.toFixed(3)}. Higher ICC indicates stronger within-period correlation.`);

    if (periods.length < 10) {
      warnings.push('Fewer than 10 periods. Switchback designs typically require many switches for adequate power.');
    }

    recommendations.push('Review time series plot for temporal trends');
    recommendations.push('Consider washout periods if carryover effects are expected');

    return {
      design: 'Switchback',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: "Welch's t-test on period means",
        result,
        interpretation: this.interpretResult(result) + ' (Clustering adjusted via period-level aggregation)'
      },
      warnings,
      recommendations,
      summary: {
        significant: result.significant,
        winner: result.significant ? variants[1] : undefined,
        effect: (result as TTestResult).mean2 - (result as TTestResult).mean1,
        confidenceInterval: result.confidenceInterval!
      }
    };
  }

  /**
   * Analyze stepped wedge cluster randomized trial
   */
  private analyzeSteppedWedge(data: ExperimentData): AnalysisResult {
    if (!data.assignment.cluster || !data.assignment.step) {
      throw new Error('Stepped wedge design requires cluster and step assignments');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Convert data to SteppedWedgeData format
    const clusterIds = Array.from(new Set(data.assignment.cluster));
    const steppedWedgeData: SteppedWedgeData = {
      clusters: []
    };

    // Group data by cluster and step
    for (const clusterId of clusterIds) {
      const clusterObservations = data.assignment.cluster
        .map((c, i) => c === clusterId ? i : -1)
        .filter(i => i !== -1);

      const steps = Array.from(new Set(clusterObservations.map(i => data.assignment.step![i])));
      steps.sort((a, b) => a - b);

      const clusterData: any = {
        clusterId: String(clusterId),
        steps: []
      };

      for (const step of steps) {
        const stepIndices = clusterObservations.filter(i => data.assignment.step![i] === step);
        const outcomes = stepIndices.map(i => data.metric.values[i]);
        const treatment = data.assignment.variant[stepIndices[0]];

        clusterData.steps.push({
          step,
          treatment: treatment === 'treatment' || treatment === 1 ? 1 : 0,
          outcomes
        });
      }

      steppedWedgeData.clusters.push(clusterData);
    }

    // Run stepped wedge analysis
    const swResult = analyzeSteppedWedge(steppedWedgeData, this.alpha);

    // Combine warnings and recommendations
    warnings.push(...swResult.warnings);
    recommendations.push(...swResult.recommendations);

    // Format treatment effect as primary result
    const treatmentEffect = swResult.treatmentEffect;

    // Create a TTestResult-like object for compatibility
    const primaryResult: TTestResult = {
      testName: 'Mixed Effects Model (Stepped Wedge)',
      statistic: treatmentEffect.tStatistic,
      pValue: treatmentEffect.pValue,
      degreesOfFreedom: steppedWedgeData.clusters.length - 3,
      confidenceInterval: treatmentEffect.confidenceInterval,
      effectSize: treatmentEffect.cohensD,
      significant: treatmentEffect.significant,
      alpha: this.alpha,
      mean1: 0, // Not directly applicable to mixed model
      mean2: treatmentEffect.coefficient, // Treatment effect
      variance1: swResult.icc.withinClusterVariance,
      variance2: swResult.icc.betweenClusterVariance,
      n1: steppedWedgeData.clusters.length,
      n2: data.metric.values.length,
      standardError: treatmentEffect.standardError,
      cohensD: treatmentEffect.cohensD
    };

    // Build interpretation
    let interpretation = `Treatment effect β₂ = ${treatmentEffect.coefficient.toFixed(4)} `;
    interpretation += `(SE = ${treatmentEffect.standardError.toFixed(4)}, `;
    interpretation += `p = ${treatmentEffect.pValue.toFixed(4)}). `;

    if (treatmentEffect.significant) {
      interpretation += `Statistically significant treatment effect detected after controlling for time trends and cluster effects. `;
    } else {
      interpretation += `No statistically significant treatment effect detected. `;
    }

    if (swResult.timeEffect.significant) {
      interpretation += `Significant secular time trend (β₁ = ${swResult.timeEffect.coefficient.toFixed(4)}, p = ${swResult.timeEffect.pValue.toFixed(4)}). `;
    }

    interpretation += `ICC = ${swResult.icc.icc.toFixed(3)} (${swResult.icc.interpretation}).`;

    // Add diagnostic information to recommendations
    if (swResult.diagnostics.overallValid) {
      recommendations.push('Model assumptions are satisfied. Results are reliable.');
    }

    recommendations.push(`Number of clusters: ${steppedWedgeData.clusters.length}`);
    recommendations.push(`Number of time steps: ${Array.from(new Set(data.assignment.step)).length}`);
    recommendations.push(`Design effect: ${swResult.icc.icc > 0 ? (1 + (data.metric.values.length / steppedWedgeData.clusters.length - 1) * swResult.icc.icc).toFixed(2) : '1.00'}`);

    // Provide recommendations based on ICC
    if (swResult.icc.icc > 0.1) {
      recommendations.push('Consider reporting cluster-robust confidence intervals due to moderate/high ICC');
    }

    return {
      design: 'Stepped Wedge Cluster Randomized Trial',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: 'Mixed Effects Model (Stepped Wedge)',
        result: primaryResult,
        interpretation
      },
      warnings,
      recommendations,
      summary: {
        significant: treatmentEffect.significant,
        winner: treatmentEffect.significant && treatmentEffect.coefficient > 0 ? 'treatment' : undefined,
        effect: treatmentEffect.coefficient,
        confidenceInterval: treatmentEffect.confidenceInterval
      }
    };
  }

  /**
   * Analyze within-subjects (repeated measures) design
   */
  private analyzeWithinSubjects(data: ExperimentData): AnalysisResult {
    if (!data.assignment.subject) {
      throw new Error('Within-subjects design requires subject identifiers');
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // This is a simplified implementation
    // Full repeated measures ANOVA would be more complex
    warnings.push('Within-subjects analysis is simplified. Consider using mixed-effects model for complex designs.');
    warnings.push('Within-subjects analysis not fully implemented - returning placeholder result');

    recommendations.push('Check for order effects using counterbalancing analysis');
    recommendations.push('Test for carryover effects between treatments');
    recommendations.push('Implement full repeated measures ANOVA or mixed-effects model');

    // For now, perform paired comparison if possible
    const subjects = Array.from(new Set(data.assignment.subject));
    const variants = Array.from(new Set(data.assignment.variant));

    // Return placeholder result
    // TODO: Implement full repeated measures ANOVA
    return {
      design: 'Within-Subjects',
      metric: data.metric.name,
      metricType: data.metric.type,
      primary: {
        test: 'Not implemented',
        result: {
          testName: 'Within-subjects analysis',
          statistic: 0,
          pValue: 1,
          significant: false,
          alpha: this.alpha
        } as any,
        interpretation: 'Within-subjects analysis requires full implementation with repeated measures ANOVA or mixed-effects models.'
      },
      warnings,
      recommendations,
      summary: {
        significant: false,
        effect: 0,
        confidenceInterval: [0, 0]
      }
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private interpretResult(result: TTestResult | ZTestResult | ANOVAResult): string {
    if (result.significant) {
      return `Statistically significant result (p = ${result.pValue.toFixed(4)} < ${this.alpha}). ` +
             `Effect size: ${'cohensD' in result ? result.cohensD.toFixed(3) : result.effectSize?.toFixed(3)}`;
    } else {
      return `Not statistically significant (p = ${result.pValue.toFixed(4)} ≥ ${this.alpha}). ` +
             `Insufficient evidence to reject null hypothesis.`;
    }
  }

  private interpretBayesianResult(result: BayesianProportionResult | BayesianContinuousResult): string {
    const prob = result.probabilityTreatmentBetter;

    if (prob > 0.95) {
      return `Strong evidence that treatment is better (${(prob * 100).toFixed(1)}% probability)`;
    } else if (prob > 0.8) {
      return `Moderate evidence that treatment is better (${(prob * 100).toFixed(1)}% probability)`;
    } else if (prob < 0.2) {
      return `Strong evidence that control is better (${(100 - prob * 100).toFixed(1)}% probability)`;
    } else if (prob < 0.5) {
      return `Moderate evidence that control is better (${(100 - prob * 100).toFixed(1)}% probability)`;
    } else {
      return `Inconclusive - probabilities are close to 50-50`;
    }
  }

  /**
   * Calculate intraclass correlation coefficient (ICC)
   * for clustered data (switchback design)
   */
  private calculateICC(clusterData: { [cluster: number]: number[] }): number {
    // Calculate between-cluster and within-cluster variance
    const clusterMeans: number[] = [];
    const clusterSizes: number[] = [];
    let grandTotal = 0;
    let grandN = 0;

    for (const cluster in clusterData) {
      const values = clusterData[cluster];
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      clusterMeans.push(mean);
      clusterSizes.push(values.length);
      grandTotal += values.reduce((sum, v) => sum + v, 0);
      grandN += values.length;
    }

    const grandMean = grandTotal / grandN;

    // Between-cluster variance
    let ssBetween = 0;
    for (let i = 0; i < clusterMeans.length; i++) {
      ssBetween += clusterSizes[i] * Math.pow(clusterMeans[i] - grandMean, 2);
    }

    // Within-cluster variance
    let ssWithin = 0;
    for (const cluster in clusterData) {
      const values = clusterData[cluster];
      const mean = clusterMeans[Object.keys(clusterData).indexOf(cluster)];
      for (const value of values) {
        ssWithin += Math.pow(value - mean, 2);
      }
    }

    const k = clusterMeans.length;
    const msBetween = ssBetween / (k - 1);
    const msWithin = ssWithin / (grandN - k);

    // Average cluster size
    const avgClusterSize = grandN / k;

    // ICC formula
    const icc = (msBetween - msWithin) / (msBetween + (avgClusterSize - 1) * msWithin);

    return Math.max(0, Math.min(1, icc)); // Bound between 0 and 1
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick analysis for simple A/B test
 */
export function quickABAnalysis(
  controlValues: number[],
  treatmentValues: number[],
  metricType: 'continuous' | 'proportion' = 'continuous',
  options?: {
    alpha?: number;
    useBayesian?: boolean;
  }
): AnalysisResult {
  const analyzer = new ExperimentAnalyzer({
    alpha: options?.alpha,
    useBayesian: options?.useBayesian
  });

  const data: ExperimentData = {
    design: 'ab',
    metric: {
      name: 'outcome',
      type: metricType,
      values: [...controlValues, ...treatmentValues]
    },
    assignment: {
      variant: [
        ...Array(controlValues.length).fill('control'),
        ...Array(treatmentValues.length).fill('treatment')
      ]
    }
  };

  return analyzer.analyze(data);
}

/**
 * Calculate required sample size for experiment
 */
export function calculateSampleSize(
  metricType: 'continuous' | 'proportion',
  effectSize: number,
  options?: {
    alpha?: number;
    power?: number;
    baselineRate?: number; // For proportions
  }
): PowerAnalysisResult {
  const alpha = options?.alpha ?? 0.05;
  const power = options?.power ?? 0.8;

  if (metricType === 'proportion') {
    const baselineRate = options?.baselineRate ?? 0.1;
    return proportionTestSampleSize(baselineRate, effectSize, alpha, power);
  } else {
    return tTestSampleSize(effectSize, alpha, power);
  }
}

export default ExperimentAnalyzer;
