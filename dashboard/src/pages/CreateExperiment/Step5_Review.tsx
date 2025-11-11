/**
 * Step 5: Review & Summary
 *
 * Final review before creating the experiment.
 * Shows all configuration in a clear summary format.
 */

import { WizardState } from './index';
import { CheckCircle, Flag, Beaker, BarChart3, Users } from 'lucide-react';

interface Props {
  wizardState: WizardState;
  setWizardState: (state: WizardState) => void;
}

export default function Step5_Review({ wizardState }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Review & Confirm
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review your experiment configuration before creating it
        </p>
      </div>

      {/* Feature Flag Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Flag className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Feature Flag
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Foundation for this experiment
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
              Name:
            </span>
            <span className="text-sm text-gray-900 dark:text-white">
              {wizardState.featureFlag?.name}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
              Key:
            </span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {wizardState.featureFlag?.key}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
              Variants:
            </span>
            <div className="flex flex-wrap gap-2">
              {wizardState.featureFlag?.variants.map((v: any) => (
                <span
                  key={v.id}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {v.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Experiment Configuration */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Beaker className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Experiment Configuration
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getDesignName(wizardState.designType!)} design
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
              Name:
            </span>
            <span className="text-sm text-gray-900 dark:text-white">
              {wizardState.experimentName}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
              Key:
            </span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {wizardState.experimentKey}
            </span>
          </div>
          {wizardState.description && (
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                Description:
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                {wizardState.description}
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
              Design Type:
            </span>
            <span className="text-sm text-gray-900 dark:text-white font-semibold">
              {getDesignName(wizardState.designType!)}
            </span>
          </div>
        </div>

        {/* Design-Specific Details */}
        {renderDesignSpecificSummary(wizardState)}
      </div>

      {/* Metrics */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Metrics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Success criteria
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
              Primary:
            </span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {wizardState.primaryMetric}
            </span>
          </div>
          {wizardState.secondaryMetrics.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                Secondary:
              </span>
              <div className="flex-1">
                {wizardState.secondaryMetrics.map((metric, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-1 mr-2 mb-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                  >
                    {metric}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Power Analysis */}
      {wizardState.powerAnalysis && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Power Analysis
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sample size requirements
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {wizardState.powerAnalysis.requiredSampleSize.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                users per variant
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ~{wizardState.powerAnalysis.estimatedRuntimeDays} days
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                estimated runtime
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-900 dark:text-white">
                MDE: <strong>{wizardState.powerAnalysis.minimumDetectableEffect}%</strong>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                minimum detectable effect
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-900 dark:text-white">
                Power: <strong>{(wizardState.powerAnalysis.power * 100).toFixed(0)}%</strong>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                statistical power
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Confirmation */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
              Ready to Create Experiment
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              Your {getDesignName(wizardState.designType!)} experiment is configured and ready to
              launch. Click "Create Experiment" below to save it as a draft. You can start the
              experiment from the experiments list when you're ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderDesignSpecificSummary(wizardState: WizardState) {
  if (!wizardState.designType) return null;

  switch (wizardState.designType) {
    case 'factorial':
      if (!wizardState.factorialConfig?.factors.length) return null;
      return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Factors ({wizardState.factorialConfig.factors.length}):
          </div>
          <div className="space-y-2">
            {wizardState.factorialConfig.factors.map((factor, i) => (
              <div key={i} className="text-sm text-gray-600 dark:text-gray-400">
                • <strong>{factor.name}</strong>: {factor.levels.join(', ')}
              </div>
            ))}
          </div>
        </div>
      );

    case 'switchback':
      if (!wizardState.switchbackConfig) return null;
      return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Period Length</div>
              <div className="text-gray-600 dark:text-gray-400">
                {wizardState.switchbackConfig.periodLengthMinutes} min
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Washout</div>
              <div className="text-gray-600 dark:text-gray-400">
                {wizardState.switchbackConfig.washoutPeriodMinutes} min
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Periods</div>
              <div className="text-gray-600 dark:text-gray-400">
                {wizardState.switchbackConfig.numPeriods}
              </div>
            </div>
          </div>
        </div>
      );

    case 'stepped_wedge':
      if (!wizardState.steppedWedgeConfig?.clusters.length) return null;
      return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Clusters ({wizardState.steppedWedgeConfig.clusters.length}):
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {wizardState.steppedWedgeConfig.clusters.map((cluster, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {cluster}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Steps</div>
              <div className="text-gray-600 dark:text-gray-400">
                {wizardState.steppedWedgeConfig.stepsPerCluster}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700 dark:text-gray-300">Step Length</div>
              <div className="text-gray-600 dark:text-gray-400">
                {wizardState.steppedWedgeConfig.stepLengthDays} days
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
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
