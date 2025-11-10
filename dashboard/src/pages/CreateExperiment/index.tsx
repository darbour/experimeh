/**
 * Enhanced Experiment Wizard - Main Controller
 *
 * Multi-step wizard that makes it visually clear what experiment is being built.
 * Addresses user feedback: "It's very unclear what is being built at any point"
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import Step1_SelectFlag from './Step1_SelectFlag';
import Step2_DesignType from './Step2_DesignType';
import Step3_Configure from './Step3_Configure';
import Step4_PowerAnalysis from './Step4_PowerAnalysis';
import Step5_Review from './Step5_Review';

export type ExperimentDesignType = 'ab' | 'factorial' | 'switchback' | 'stepped_wedge';

export interface WizardState {
  // Step 1: Flag selection
  featureFlagId: string | null;
  featureFlag: any | null;

  // Step 2: Design type
  designType: ExperimentDesignType | null;

  // Step 3: Configuration (design-specific)
  experimentName: string;
  experimentKey: string;
  description: string;
  primaryMetric: string;
  secondaryMetrics: string[];

  // Design-specific configurations
  abConfig?: any;
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
  variantAllocations: Array<{
    flagVariantId: string;
    flagVariantKey: string;
    experimentRole: string;
    allocationPercentage: number;
    description: string;
  }>;
}

const STEPS = [
  { id: 1, title: 'Select Flag', description: 'Choose feature flag' },
  { id: 2, title: 'Design Type', description: 'Choose experiment design' },
  { id: 3, title: 'Configure', description: 'Set up experiment' },
  { id: 4, title: 'Power Analysis', description: 'Calculate sample size' },
  { id: 5, title: 'Review', description: 'Review and launch' },
];

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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardState.featureFlagId;
      case 2:
        return !!wizardState.designType;
      case 3:
        return wizardState.experimentName && wizardState.experimentKey && wizardState.primaryMetric;
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
                onClick={() => {/* Handle submission */}}
                className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-5 h-5 mr-2" />
                Create Experiment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
