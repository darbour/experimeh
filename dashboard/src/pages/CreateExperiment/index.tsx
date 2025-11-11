/**
 * Enhanced Experiment Wizard - Main Controller
 *
 * Multi-step wizard that makes it visually clear what experiment is being built.
 * Addresses user feedback: "It's very unclear what is being built at any point"
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Loader } from 'lucide-react';
import { useCreateExperiment } from '../../hooks/useExperiments';
import type { CreateExperimentForm, VariantAllocation, FeatureFlag } from '../../types';
import {
  validateExperimentKey,
  validateExperimentName,
  validatePrimaryMetric,
  validateVariantCount,
} from '../../utils/validation';
import Step1_SelectFlag from './Step1_SelectFlag';
import Step2_DesignType from './Step2_DesignType';
import Step3_Configure from './Step3_Configure';
import Step4_PowerAnalysis from './Step4_PowerAnalysis';
import Step5_Review from './Step5_Review';

export type ExperimentDesignType = 'ab' | 'factorial' | 'switchback' | 'stepped_wedge';

export interface WizardState {
  // Step 1: Flag selection
  featureFlagId: string | null;
  featureFlag: FeatureFlag | null;

  // Step 2: Design type
  designType: ExperimentDesignType | null;

  // Step 3: Configuration (design-specific)
  experimentName: string;
  experimentKey: string;
  description: string;
  primaryMetric: string;
  secondaryMetrics: string[];

  // Design-specific configurations
  factorialConfig?: {
    factors: Array<{ name: string; levels: string[] }>;
  };
  switchbackConfig?: {
    periodLengthMinutes: number;
    washoutPeriodMinutes: number;
    numPeriods: number;
  };
  steppedWedgeConfig?: {
    clusters: string[];
    stepsPerCluster: number;
    stepLengthDays: number;
  };

  // Step 4: Power analysis
  powerAnalysis?: {
    baselineValue: number;
    minimumDetectableEffect: number;
    alpha: number;
    power: number;
    requiredSampleSize: number;
    estimatedRuntimeDays?: number;
  };

  // Variant allocations
  variantAllocations: Omit<VariantAllocation, 'id'>[];
}

const STEPS = [
  { id: 1, title: 'Select Flag', description: 'Choose feature flag' },
  { id: 2, title: 'Design Type', description: 'Choose experiment design' },
  { id: 3, title: 'Configure', description: 'Set up experiment' },
  { id: 4, title: 'Power Analysis', description: 'Calculate sample size' },
  { id: 5, title: 'Review', description: 'Review and launch' },
];

/**
 * Helper to map variant index to experiment role
 */
function getExperimentRole(index: number): VariantAllocation['experimentRole'] {
  if (index === 0) return 'control';
  if (index === 1) return 'treatment';
  if (index === 2) return 'treatment_1';
  if (index === 3) return 'treatment_2';
  if (index === 4) return 'treatment_3';
  // Fallback for >5 variants (should not happen, but type-safe)
  return 'treatment';
}

/**
 * Generate all combinations for a factorial design
 *
 * For example, with factors:
 * - Factor A: [level1, level2]
 * - Factor B: [level1, level2]
 *
 * Returns: [
 *   ['level1', 'level1'],
 *   ['level1', 'level2'],
 *   ['level2', 'level1'],
 *   ['level2', 'level2']
 * ]
 */
function generateFactorialCombinations(
  factors: Array<{ name: string; levels: string[] }>
): string[][] {
  if (factors.length === 0) return [[]];
  if (factors.length === 1) return factors[0].levels.map((level) => [level]);

  // Recursive cartesian product
  const [firstFactor, ...restFactors] = factors;
  const restCombinations = generateFactorialCombinations(restFactors);

  const combinations: string[][] = [];
  for (const level of firstFactor.levels) {
    for (const restCombo of restCombinations) {
      combinations.push([level, ...restCombo]);
    }
  }

  return combinations;
}

/**
 * Generate variant allocations based on design type and flag variants
 */
function generateVariantAllocations(
  designType: ExperimentDesignType,
  flagVariants: Array<{ id: string; key: string; name: string }>,
  factorialConfig?: { factors: Array<{ name: string; levels: string[] }> }
): Omit<VariantAllocation, 'id'>[] {
  const allocations: Omit<VariantAllocation, 'id'>[] = [];

  switch (designType) {
    case 'ab': {
      // Simple A/B test: split variants evenly
      const percentage = 100 / flagVariants.length;
      flagVariants.forEach((variant, index) => {
        allocations.push({
          flagVariantId: variant.id,
          flagVariantKey: variant.key,
          experimentRole: getExperimentRole(index),
          allocationPercentage: percentage,
          description: `${variant.name} - ${index === 0 ? 'Control' : 'Treatment'} group`,
        });
      });
      break;
    }

    case 'factorial': {
      // Factorial: assign variants to factor combinations
      if (factorialConfig && factorialConfig.factors.length >= 2) {
        // Generate all factorial combinations
        const combinations = generateFactorialCombinations(factorialConfig.factors);
        const numCombinations = combinations.length;

        // Validate: number of variants should match number of combinations
        if (flagVariants.length !== numCombinations) {
          console.warn(
            `Factorial design: Expected ${numCombinations} variants for ${factorialConfig.factors.length} factors, but got ${flagVariants.length}. Using equal split.`
          );
        }

        const percentage = 100 / flagVariants.length;

        flagVariants.forEach((variant, index) => {
          // Map variant to factorial combination
          const combination = combinations[index] || combinations[0]; // Fallback to first if index out of bounds
          const combinationDesc = combination
            .map((level, factorIdx) => `${factorialConfig.factors[factorIdx].name}=${level}`)
            .join(', ');

          allocations.push({
            flagVariantId: variant.id,
            flagVariantKey: variant.key,
            experimentRole: getExperimentRole(index),
            allocationPercentage: percentage,
            description: `${variant.name} (${combinationDesc})`,
          });
        });
      } else {
        // Fallback to even split if no proper factorial config
        const percentage = 100 / flagVariants.length;
        flagVariants.forEach((variant, index) => {
          allocations.push({
            flagVariantId: variant.id,
            flagVariantKey: variant.key,
            experimentRole: getExperimentRole(index),
            allocationPercentage: percentage,
            description: variant.name,
          });
        });
      }
      break;
    }

    case 'switchback': {
      // Switchback: all users see all variants over time
      // Equal allocation across time periods
      const percentage = 100 / flagVariants.length;
      flagVariants.forEach((variant, index) => {
        allocations.push({
          flagVariantId: variant.id,
          flagVariantKey: variant.key,
          experimentRole: getExperimentRole(index),
          allocationPercentage: percentage,
          description: `${variant.name} - Time period ${index + 1}`,
        });
      });
      break;
    }

    case 'stepped_wedge': {
      // Stepped wedge: clusters roll out gradually
      // Start with control, gradually shift to treatment
      const percentage = 100 / flagVariants.length;
      flagVariants.forEach((variant, index) => {
        allocations.push({
          flagVariantId: variant.id,
          flagVariantKey: variant.key,
          experimentRole: getExperimentRole(index),
          allocationPercentage: percentage,
          description: `${variant.name} - ${index === 0 ? 'Initial control' : 'Rollout treatment'}`,
        });
      });
      break;
    }
  }

  return allocations;
}

export default function CreateExperimentWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flagIdFromUrl = searchParams.get('flagId');

  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({
    featureFlagId: flagIdFromUrl,
    featureFlag: null,
    designType: null,
    experimentName: '',
    experimentKey: '',
    description: '',
    primaryMetric: '',
    secondaryMetrics: [],
    variantAllocations: [],
  });

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Mutation hook for creating experiment
  const { mutate: createExperiment, isPending: isCreating } = useCreateExperiment();

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardState.featureFlagId;
      case 2:
        return !!wizardState.designType;
      case 3: {
        // Validate all required fields
        if (!wizardState.experimentName || !wizardState.experimentKey || !wizardState.primaryMetric) {
          return false;
        }

        // Validate field formats
        const nameValid = validateExperimentName(wizardState.experimentName).success;
        const keyValid = validateExperimentKey(wizardState.experimentKey).success;
        const metricValid = validatePrimaryMetric(wizardState.primaryMetric).success;

        // Validate variant count for design type
        let variantCountValid = true;
        if (wizardState.designType && wizardState.featureFlag) {
          variantCountValid = validateVariantCount(
            wizardState.designType,
            wizardState.featureFlag.variants.length
          ).success;
        }

        return nameValid && keyValid && metricValid && variantCountValid;
      }
      case 4:
        return !!wizardState.powerAnalysis;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    navigate('/experiments');
  };

  const handleSubmit = () => {
    // Validate wizard state
    if (!wizardState.featureFlagId || !wizardState.designType || !wizardState.featureFlag) {
      setSubmissionError('Missing required fields. Please complete all steps.');
      return;
    }

    // Generate variant allocations from flag variants
    const variantAllocations = generateVariantAllocations(
      wizardState.designType,
      wizardState.featureFlag.variants,
      wizardState.factorialConfig
    );

    // Build experiment form data
    const experimentData: CreateExperimentForm = {
      name: wizardState.experimentName,
      key: wizardState.experimentKey,
      description: wizardState.description,
      featureFlagId: wizardState.featureFlagId,
      variantAllocations,
      design_type: wizardState.designType,
      primaryMetric: wizardState.primaryMetric,
      secondaryMetrics: wizardState.secondaryMetrics,
    };

    // Add design-specific configuration
    switch (wizardState.designType) {
      case 'factorial':
        if (wizardState.factorialConfig) {
          experimentData.factors = wizardState.factorialConfig.factors;
        }
        break;
      case 'switchback':
        if (wizardState.switchbackConfig) {
          experimentData.switchback_config = {
            switch_duration_seconds: wizardState.switchbackConfig.periodLengthMinutes * 60,
            switch_unit: 'time',
          };
        }
        break;
      case 'stepped_wedge':
        if (wizardState.steppedWedgeConfig) {
          experimentData.stepped_wedge_config = {
            num_steps: wizardState.steppedWedgeConfig.stepsPerCluster,
            step_duration_seconds: wizardState.steppedWedgeConfig.stepLengthDays * 86400,
            rollout_order: 'sequential',
          };
        }
        break;
    }

    // Create experiment
    createExperiment(experimentData, {
      onSuccess: (newExperiment) => {
        // Navigate to experiment detail page
        navigate(`/experiments/${newExperiment.id}`);
      },
      onError: (error) => {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : 'Failed to create experiment. Please try again.'
        );
      },
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1_SelectFlag
            wizardState={wizardState}
            setWizardState={setWizardState}
          />
        );
      case 2:
        return (
          <Step2_DesignType
            wizardState={wizardState}
            setWizardState={setWizardState}
          />
        );
      case 3:
        return (
          <Step3_Configure
            wizardState={wizardState}
            setWizardState={setWizardState}
          />
        );
      case 4:
        return (
          <Step4_PowerAnalysis
            wizardState={wizardState}
            setWizardState={setWizardState}
          />
        );
      case 5:
        return (
          <Step5_Review
            wizardState={wizardState}
            setWizardState={setWizardState}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create New Experiment
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Follow the steps below to create a statistically rigorous experiment
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={`text-sm font-medium ${
                        currentStep >= step.id
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {step.description}
                    </div>
                  </div>
                </div>

                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 transition-colors ${
                      currentStep > step.id
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-6">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`inline-flex items-center px-6 py-2 rounded-lg transition-colors ${
                  canProceed()
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isCreating}
                className={`inline-flex items-center px-6 py-2 rounded-lg transition-colors ${
                  isCreating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                {isCreating ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Create Experiment
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {submissionError && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-900 dark:text-red-100">{submissionError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
