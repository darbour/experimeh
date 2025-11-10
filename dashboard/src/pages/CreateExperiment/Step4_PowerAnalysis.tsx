/**
 * Step 4: Power Analysis Calculator
 *
 * Calculates required sample size based on statistical parameters.
 * Design-specific calculations for each experiment type.
 */

import { useState, useEffect } from 'react';
import { WizardState } from './index';
import { Calculator, AlertTriangle, Info } from 'lucide-react';

interface Props {
  wizardState: WizardState;
  setWizardState: (state: WizardState) => void;
}

export default function Step4_PowerAnalysis({ wizardState, setWizardState }: Props) {
  const [params, setParams] = useState({
    baselineValue: 10,
    minimumDetectableEffect: 5,
    alpha: 0.05,
    power: 0.80,
    averageDailyUsers: 10000,
  });

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    // Calculate sample size when parameters change
    const calculated = calculateSampleSize(
      wizardState.designType!,
      params.baselineValue,
      params.minimumDetectableEffect,
      params.alpha,
      params.power
    );

    const estimatedDays = Math.ceil(
      calculated.requiredSampleSizePerVariant / params.averageDailyUsers
    );

    const fullResult = {
      ...calculated,
      estimatedRuntimeDays: estimatedDays,
    };

    setResult(fullResult);

    // Update wizard state
    setWizardState({
      ...wizardState,
      powerAnalysis: {
        baselineValue: params.baselineValue,
        minimumDetectableEffect: params.minimumDetectableEffect,
        alpha: params.alpha,
        power: params.power,
        requiredSampleSize: calculated.requiredSampleSizePerVariant,
        estimatedRuntimeDays: estimatedDays,
      },
    });
  }, [params, wizardState.designType]);

  const handleParamChange = (field: string, value: number) => {
    setParams({
      ...params,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Power Analysis & Sample Size
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Calculate how many users you need to reliably detect your target effect size
        </p>
      </div>

      {/* Input Parameters */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Baseline Conversion Rate (%) *
          </label>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={params.baselineValue}
            onChange={(e) => handleParamChange('baselineValue', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Current value of your primary metric
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Minimum Detectable Effect (%) *
          </label>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={params.minimumDetectableEffect}
            onChange={(e) => handleParamChange('minimumDetectableEffect', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Smallest change you want to detect
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Significance Level (α) *
          </label>
          <select
            value={params.alpha}
            onChange={(e) => handleParamChange('alpha', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value={0.01}>0.01 (very conservative)</option>
            <option value={0.05}>0.05 (standard)</option>
            <option value={0.10}>0.10 (liberal)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Probability of false positive (Type I error)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Statistical Power (1-β) *
          </label>
          <select
            value={params.power}
            onChange={(e) => handleParamChange('power', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value={0.70}>0.70</option>
            <option value={0.80}>0.80 (standard)</option>
            <option value={0.90}>0.90 (high power)</option>
            <option value={0.95}>0.95 (very high power)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Probability of detecting true effect
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Average Daily Users (for runtime estimate)
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={params.averageDailyUsers}
            onChange={(e) => handleParamChange('averageDailyUsers', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            How many users visit daily
          </p>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <Calculator className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Required Sample Size
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Based on your parameters and {getDesignName(wizardState.designType!)} design
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <div className="text-4xl font-bold text-green-900 dark:text-green-100 mb-1">
                {result.requiredSampleSizePerVariant.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                users per variant
              </div>
            </div>

            <div>
              <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                {result.estimatedRuntimeDays}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                days estimated runtime
              </div>
            </div>
          </div>

          {/* Total Sample Size */}
          <div className="bg-white dark:bg-gray-800 rounded p-3 mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total sample size (all variants):
            </div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {(result.requiredSampleSizePerVariant * (wizardState.featureFlag?.variants.length || 2)).toLocaleString()}
            </div>
          </div>

          {/* Assumptions */}
          {result.assumptions && result.assumptions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                ASSUMPTIONS:
              </div>
              <ul className="space-y-1">
                {result.assumptions.map((assumption: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400">
                    • {assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {result && result.estimatedRuntimeDays > 30 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-900 dark:text-yellow-100">
              <p className="font-medium mb-1">Long Runtime Warning</p>
              <p>
                This experiment will take {result.estimatedRuntimeDays} days to complete. Consider:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Increasing the minimum detectable effect (requires fewer users)</li>
                <li>Reducing statistical power (not recommended below 80%)</li>
                <li>Waiting for higher traffic</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Statistical Power Explained</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Alpha (α):</strong> Risk of false positive. Standard is 0.05 (5% chance of
                seeing an effect that doesn't exist)
              </li>
              <li>
                <strong>Power (1-β):</strong> Ability to detect real effects. Standard is 0.80 (80%
                chance of detecting a true effect)
              </li>
              <li>
                <strong>MDE:</strong> The smaller the effect you want to detect, the more users you
                need
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simplified sample size calculation (in production, use proper statistical formulas)
function calculateSampleSize(
  designType: string,
  baseline: number,
  mde: number,
  alpha: number,
  power: number
): { requiredSampleSizePerVariant: number; assumptions: string[] } {
  // Z-scores for alpha and power
  const zAlpha = getZScore(1 - alpha / 2);
  const zBeta = getZScore(power);

  // Convert percentages to proportions
  const p1 = baseline / 100;
  const p2 = (baseline + mde) / 100;

  // Pooled proportion
  const pPooled = (p1 + p2) / 2;

  // Standard two-sample proportion test formula
  const baseSampleSize = Math.ceil(
    ((zAlpha + zBeta) ** 2 * 2 * pPooled * (1 - pPooled)) / ((p2 - p1) ** 2)
  );

  // Design-specific multipliers and assumptions
  let multiplier = 1;
  const assumptions: string[] = [];

  switch (designType) {
    case 'ab':
      multiplier = 1;
      assumptions.push('Two-sample t-test with equal allocation');
      assumptions.push('Independent observations');
      assumptions.push('Normal distribution of metric');
      break;

    case 'factorial':
      multiplier = 2; // More cells reduce power per cell
      assumptions.push('Factorial ANOVA with interaction effects');
      assumptions.push('Multiple comparison correction applied');
      assumptions.push('Assumes 2x2 design (adjust for larger factorials)');
      break;

    case 'switchback':
      multiplier = 1.5; // Temporal correlation reduces effective sample size
      assumptions.push('Accounts for temporal autocorrelation');
      assumptions.push('Cluster-robust standard errors');
      assumptions.push('Assumes 30-minute periods');
      break;

    case 'stepped_wedge':
      multiplier = 1.3; // Cluster effects and ICC
      assumptions.push('Mixed-effects model with cluster random effects');
      assumptions.push('Assumes ICC = 0.05');
      assumptions.push('Hussey-Hughes formula for stepped wedge');
      break;
  }

  return {
    requiredSampleSizePerVariant: Math.ceil(baseSampleSize * multiplier),
    assumptions,
  };
}

function getZScore(probability: number): number {
  // Simplified Z-score lookup
  const lookup: { [key: number]: number } = {
    0.90: 1.282,
    0.95: 1.645,
    0.975: 1.96,
    0.99: 2.326,
    0.995: 2.576,
    0.70: 0.524,
    0.80: 0.842,
  };

  return lookup[probability] || 1.96;
}

function getDesignName(designType: string): string {
  const names: { [key: string]: string } = {
    ab: 'A/B Test',
    factorial: 'Factorial',
    switchback: 'Switchback',
    stepped_wedge: 'Stepped Wedge',
  };
  return names[designType] || 'Unknown';
}
