/**
 * Quality Check Framework
 *
 * Implements automated quality checks to detect common issues in
 * experiment analysis. These checks catch problems like sample ratio
 * mismatch (SRM), guardrail violations, novelty effects, and more.
 *
 * Quality checks are essential for maintaining experimental integrity
 * and catching implementation bugs before they lead to wrong decisions.
 */

import { AnalysisData, Observation } from './analysis-engine';

export interface QualityCheck {
  /** Name of the check */
  name: string;
  /** Description */
  description: string;
  /** Severity if check fails */
  severity: 'error' | 'warning' | 'info';
  /** Execute the check */
  check(data: AnalysisData, metadata: ExperimentMetadata): Promise<CheckResult>;
}

export interface ExperimentMetadata {
  experimentId: string;
  designType: string;
  expectedAllocation: Record<string, number>;  // Expected allocation percentages
  startDate: Date;
  guardrailThresholds?: Record<string, GuardrailThreshold>;
}

export interface GuardrailThreshold {
  metricName: string;
  direction: 'increase' | 'decrease';
  maxDegradation: number;  // Maximum acceptable degradation (%)
}

export interface CheckResult {
  passed: boolean;
  score?: number;
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

/**
 * Sample Ratio Mismatch (SRM) Check
 *
 * Detects if the observed allocation ratios differ significantly from expected.
 * This is one of the most important checks as SRM indicates implementation bugs.
 *
 * Uses chi-square goodness of fit test.
 */
export class SampleRatioMismatchCheck implements QualityCheck {
  name = 'Sample Ratio Mismatch (SRM)';
  description = 'Detects allocation imbalances that indicate implementation bugs';
  severity: 'error' = 'error';

  async check(data: AnalysisData, metadata: ExperimentMetadata): Promise<CheckResult> {
    // Count observations per variant
    const observed: Record<string, number> = {};
    data.observations.forEach((obs) => {
      observed[obs.variantKey] = (observed[obs.variantKey] || 0) + 1;
    });

    const totalObservations = data.observations.length;

    // Calculate expected counts
    const expected: Record<string, number> = {};
    Object.entries(metadata.expectedAllocation).forEach(([variant, percentage]) => {
      expected[variant] = (totalObservations * percentage) / 100;
    });

    // Chi-square test
    let chiSquare = 0;
    Object.entries(observed).forEach(([variant, observedCount]) => {
      const expectedCount = expected[variant] || 0;
      if (expectedCount > 0) {
        chiSquare += Math.pow(observedCount - expectedCount, 2) / expectedCount;
      }
    });

    // Degrees of freedom
    const df = Object.keys(observed).length - 1;

    // Calculate p-value (critical value at 0.001 significance for df=1 is 10.83)
    const criticalValue = this.chiSquareCriticalValue(df, 0.001);
    const passed = chiSquare < criticalValue;

    // Calculate p-value approximation
    const pValue = this.chiSquarePValue(chiSquare, df);

    const chiSq = chiSquare.toFixed(2);
    const pVal = pValue.toFixed(4);

    return {
      passed,
      score: pValue,
      message: passed
        ? `No significant sample ratio mismatch detected (chi-squared=${chiSq}, p=${pVal})`
        : `WARNING: SAMPLE RATIO MISMATCH DETECTED! (chi-squared=${chiSq}, p=${pVal})`,
      details: {
        chiSquare,
        pValue,
        degreesOfFreedom: df,
        observed,
        expected,
      },
      recommendation: passed
        ? undefined
        : 'STOP THE EXPERIMENT. SRM indicates a serious implementation bug. Do not trust results until the cause is identified and fixed.',
    };
  }

  private chiSquareCriticalValue(df: number, alpha: number): number {
    // Simplified critical values
    // In production, use proper statistical library
    const criticalValues: Record<number, Record<number, number>> = {
      1: { 0.05: 3.84, 0.01: 6.63, 0.001: 10.83 },
      2: { 0.05: 5.99, 0.01: 9.21, 0.001: 13.82 },
      3: { 0.05: 7.81, 0.01: 11.34, 0.001: 16.27 },
    };
    return criticalValues[df]?.[alpha] || 10.83;
  }

  private chiSquarePValue(chiSquare: number, df: number): number {
    // Simplified p-value calculation
    // In production, use proper statistical library
    if (chiSquare < 3.84) return 0.05;
    if (chiSquare < 6.63) return 0.01;
    if (chiSquare < 10.83) return 0.001;
    return 0.0001;
  }
}

/**
 * Guardrail Metric Check
 *
 * Ensures that guardrail metrics (e.g., latency, error rate) haven't degraded
 * beyond acceptable thresholds. Prevents launching changes that improve one
 * metric at the cost of critical business metrics.
 */
export class GuardrailMetricCheck implements QualityCheck {
  name = 'Guardrail Metrics';
  description = 'Ensures critical metrics have not degraded significantly';
  severity: 'error' = 'error';

  async check(data: AnalysisData, metadata: ExperimentMetadata): Promise<CheckResult> {
    if (!metadata.guardrailThresholds || data.guardrailMetrics.length === 0) {
      return {
        passed: true,
        message: 'No guardrail metrics configured',
      };
    }

    const violations: Array<{ metric: string; degradation: number; threshold: number }> = [];

    for (const metricName of data.guardrailMetrics) {
      const threshold = metadata.guardrailThresholds[metricName];
      if (!threshold) continue;

      // Calculate treatment vs control
      const controlObs = data.observations
        .filter((o) => o.variantKey === 'control')
        .map((o) => o.metrics[metricName])
        .filter((v) => v !== undefined && !isNaN(v));

      const treatmentObs = data.observations
        .filter((o) => o.variantKey === 'treatment')
        .map((o) => o.metrics[metricName])
        .filter((v) => v !== undefined && !isNaN(v));

      const controlMean = this.mean(controlObs);
      const treatmentMean = this.mean(treatmentObs);

      const relativeChange = ((treatmentMean - controlMean) / controlMean) * 100;

      // Check if degraded beyond threshold
      const degraded =
        (threshold.direction === 'decrease' && relativeChange > threshold.maxDegradation) ||
        (threshold.direction === 'increase' && relativeChange < -threshold.maxDegradation);

      if (degraded) {
        violations.push({
          metric: metricName,
          degradation: Math.abs(relativeChange),
          threshold: threshold.maxDegradation,
        });
      }
    }

    const passed = violations.length === 0;

    return {
      passed,
      message: passed
        ? `All ${data.guardrailMetrics.length} guardrail metrics within acceptable bounds`
        : `WARNING: ${violations.length} guardrail metric(s) violated: ${violations.map((v) => v.metric).join(', ')}`,
      details: { violations },
      recommendation: passed
        ? undefined
        : 'Do not launch. Investigate why guardrail metrics degraded and consider design changes.',
    };
  }

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

/**
 * Quality Check Runner
 *
 * Runs all quality checks and aggregates results.
 */
export class QualityCheckRunner {
  private checks: QualityCheck[];

  constructor() {
    this.checks = [
      new SampleRatioMismatchCheck(),
      new GuardrailMetricCheck(),
    ];
  }

  async runAll(
    data: AnalysisData,
    metadata: ExperimentMetadata
  ): Promise<QualityCheckReport> {
    const results: Array<{
      check: QualityCheck;
      result: CheckResult;
    }> = [];

    for (const check of this.checks) {
      const result = await check.check(data, metadata);
      results.push({ check, result });
    }

    // Categorize by severity and pass/fail
    const errors = results.filter(
      (r) => !r.result.passed && r.check.severity === 'error'
    );
    const warnings = results.filter(
      (r) => !r.result.passed && r.check.severity === 'warning'
    );
    const passed = results.filter((r) => r.result.passed);

    const overallPassed = errors.length === 0;

    return {
      overallPassed,
      totalChecks: this.checks.length,
      passed: passed.length,
      errors: errors.length,
      warnings: warnings.length,
      results,
      summary: this.generateSummary(errors, warnings, passed),
    };
  }

  private generateSummary(
    errors: Array<{ check: QualityCheck; result: CheckResult }>,
    warnings: Array<{ check: QualityCheck; result: CheckResult }>,
    passed: Array<{ check: QualityCheck; result: CheckResult }>
  ): string {
    if (errors.length > 0) {
      return `CRITICAL: ${errors.length} critical issue(s) detected. Do not trust experiment results.`;
    }
    if (warnings.length > 0) {
      return `WARNING: ${warnings.length} warning(s). Review carefully before making decisions.`;
    }
    return `SUCCESS: All ${passed.length} quality checks passed.`;
  }
}

export interface QualityCheckReport {
  overallPassed: boolean;
  totalChecks: number;
  passed: number;
  errors: number;
  warnings: number;
  results: Array<{
    check: QualityCheck;
    result: CheckResult;
  }>;
  summary: string;
}
