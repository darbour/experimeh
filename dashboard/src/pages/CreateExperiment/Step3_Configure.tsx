/**
 * Step 3: Configure Experiment
 *
 * Design-specific configuration that CHANGES based on the selected design type.
 * This addresses: "when I choose a different experiment type nothing changes"
 */

import { useState, useEffect } from 'react';
import { WizardState } from './index';
import { AlertCircle } from 'lucide-react';
import FactorialConfiguration from './components/FactorialConfiguration';
import SwitchbackConfiguration from './components/SwitchbackConfiguration';
import SteppedWedgeConfiguration from './components/SteppedWedgeConfiguration';
import {
  validateExperimentKey,
  validateExperimentName,
  validatePrimaryMetric,
  validateVariantCount,
} from '../../utils/validation';

interface Props {
  wizardState: WizardState;
  setWizardState: (state: WizardState) => void;
}

export default function Step3_Configure({ wizardState, setWizardState }: Props) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validate variant count for the selected design type
  useEffect(() => {
    if (wizardState.designType && wizardState.featureFlag) {
      const variantCountResult = validateVariantCount(
        wizardState.designType,
        wizardState.featureFlag.variants.length
      );
      if (!variantCountResult.success) {
        setValidationErrors((prev) => ({
          ...prev,
          ...variantCountResult.errors,
        }));
      } else {
        setValidationErrors((prev) => {
          const { variantCount, ...rest } = prev;
          return rest;
        });
      }
    }
  }, [wizardState.designType, wizardState.featureFlag]);

  const handleBasicChange = (field: string, value: any) => {
    setWizardState({
      ...wizardState,
      [field]: value,
    });

    // Validate on change
    let validationResult;
    switch (field) {
      case 'experimentName':
        validationResult = validateExperimentName(value);
        break;
      case 'experimentKey':
        validationResult = validateExperimentKey(value);
        break;
      case 'primaryMetric':
        validationResult = validatePrimaryMetric(value);
        break;
      default:
        return;
    }

    if (validationResult && !validationResult.success) {
      setValidationErrors((prev) => ({
        ...prev,
        ...validationResult.errors,
      }));
    } else if (validationResult) {
      setValidationErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Configure Experiment
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Set up your {getDesignName(wizardState.designType)} experiment
        </p>
      </div>

      {/* Variant Count Warning */}
      {validationErrors.variantCount && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-900 dark:text-red-100">
              <p className="font-medium mb-1">Variant Count Mismatch</p>
              <p>{validationErrors.variantCount}</p>
              <p className="mt-2">
                Please go back to Step 1 and select a feature flag with the appropriate number of variants,
                or change the experiment design type in Step 2.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Configuration (Common to all designs) */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Basic Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Experiment Name *
            </label>
            <input
              type="text"
              value={wizardState.experimentName}
              onChange={(e) => handleBasicChange('experimentName', e.target.value)}
              placeholder="e.g., Checkout Button Color Test"
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 ${
                validationErrors.experimentName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
              }`}
            />
            {validationErrors.experimentName && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.experimentName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Experiment Key *
            </label>
            <input
              type="text"
              value={wizardState.experimentKey}
              onChange={(e) => handleBasicChange('experimentKey', e.target.value)}
              placeholder="e.g., checkout-button-test-2025"
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 font-mono text-sm ${
                validationErrors.experimentKey
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
              }`}
            />
            {validationErrors.experimentKey && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.experimentKey}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lowercase alphanumeric with hyphens (3-50 characters)
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={wizardState.description}
            onChange={(e) => handleBasicChange('description', e.target.value)}
            placeholder="Describe the hypothesis and what you're testing..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Metric *
            </label>
            <input
              type="text"
              value={wizardState.primaryMetric}
              onChange={(e) => handleBasicChange('primaryMetric', e.target.value)}
              placeholder="e.g., conversion_rate"
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 ${
                validationErrors.primaryMetric
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
              }`}
            />
            {validationErrors.primaryMetric && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.primaryMetric}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The main metric used for decision-making
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secondary Metrics (comma-separated)
            </label>
            <input
              type="text"
              value={wizardState.secondaryMetrics.join(', ')}
              onChange={(e) =>
                handleBasicChange(
                  'secondaryMetrics',
                  e.target.value.split(',').map((m) => m.trim()).filter(Boolean)
                )
              }
              placeholder="e.g., revenue, engagement_rate"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Design-Specific Configuration */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {getDesignName(wizardState.designType)} Configuration
        </h3>

        {renderDesignSpecificConfig(wizardState, setWizardState)}
      </div>
    </div>
  );
}

function renderDesignSpecificConfig(
  wizardState: WizardState,
  setWizardState: (state: WizardState) => void
) {
  switch (wizardState.designType) {
    case 'ab':
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">A/B Test Configuration</p>
              <p>
                Users will be randomly assigned to variants from your feature flag:{' '}
                <strong>{wizardState.featureFlag?.name}</strong>. Default allocation is equal
                split across all variants. You can customize allocations in the power analysis step.
              </p>
            </div>
          </div>
        </div>
      );

    case 'factorial':
      return (
        <FactorialConfiguration
          config={wizardState.factorialConfig || { factors: [] }}
          setConfig={(config) =>
            setWizardState({
              ...wizardState,
              factorialConfig: config,
            })
          }
          flag={wizardState.featureFlag}
        />
      );

    case 'switchback':
      return (
        <SwitchbackConfiguration
          config={
            wizardState.switchbackConfig || {
              periodLengthMinutes: 30,
              washoutPeriodMinutes: 5,
              numPeriods: 48,
            }
          }
          setConfig={(config) =>
            setWizardState({
              ...wizardState,
              switchbackConfig: config,
            })
          }
        />
      );

    case 'stepped_wedge':
      return (
        <SteppedWedgeConfiguration
          config={
            wizardState.steppedWedgeConfig || {
              clusters: [],
              stepsPerCluster: 4,
              stepLengthDays: 7,
            }
          }
          setConfig={(config) =>
            setWizardState({
              ...wizardState,
              steppedWedgeConfig: config,
            })
          }
        />
      );

    default:
      return null;
  }
}

function getDesignName(designType: string | null): string {
  const names: { [key: string]: string } = {
    ab: 'A/B Test',
    factorial: 'Factorial',
    switchback: 'Switchback',
    stepped_wedge: 'Stepped Wedge',
  };
  return designType ? names[designType] : 'Unknown';
}
