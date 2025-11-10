/**
 * Step 1: Select Feature Flag
 *
 * Enforces flag-first architecture by requiring users to select a flag
 * before creating an experiment.
 */

import { useEffect } from 'react';
import { Flag, AlertCircle } from 'lucide-react';
import { WizardState } from './index';

interface Props {
  wizardState: WizardState;
  setWizardState: (state: WizardState) => void;
}

export default function Step1_SelectFlag({ wizardState, setWizardState }: Props) {
  // Mock data - in production, fetch from API
  const mockFlags = [
    {
      id: '1',
      key: 'new_checkout_button',
      name: 'New Checkout Button',
      status: 'enabled',
      variants: [
        { id: 'v1', key: 'control', name: 'Blue Button', value: { color: 'blue' } },
        { id: 'v2', key: 'treatment', name: 'Green Button', value: { color: 'green' } },
      ],
      environment: 'production',
    },
    {
      id: '2',
      key: 'personalized_recommendations',
      name: 'Personalized Recommendations',
      status: 'enabled',
      variants: [
        { id: 'v3', key: 'off', name: 'Generic Recommendations', value: false },
        { id: 'v4', key: 'on', name: 'ML-Based Recommendations', value: true },
      ],
      environment: 'production',
    },
    {
      id: '3',
      key: 'premium_features',
      name: 'Premium Features Access',
      status: 'enabled',
      variants: [
        { id: 'v5', key: 'basic', name: 'Basic Tier', value: 'basic' },
        { id: 'v6', key: 'pro', name: 'Pro Tier', value: 'pro' },
        { id: 'v7', key: 'enterprise', name: 'Enterprise Tier', value: 'enterprise' },
      ],
      environment: 'staging',
    },
  ];

  // If flagId provided via URL, auto-select it
  useEffect(() => {
    if (wizardState.featureFlagId && !wizardState.featureFlag) {
      const flag = mockFlags.find((f) => f.id === wizardState.featureFlagId);
      if (flag) {
        setWizardState({
          ...wizardState,
          featureFlag: flag,
        });
      }
    }
  }, [wizardState.featureFlagId]);

  const handleSelectFlag = (flag: any) => {
    setWizardState({
      ...wizardState,
      featureFlagId: flag.id,
      featureFlag: flag,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Select Feature Flag
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Experiments are built on top of feature flags. Select the flag you want to experiment with.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Feature Flag-First Architecture</p>
            <p>
              Experiments MUST link to an existing feature flag. The flag's variants will be used
              as the foundation for your experimental conditions. If you don't see your flag, create
              it first in the Feature Flags section.
            </p>
          </div>
        </div>
      </div>

      {/* Flag Selection */}
      <div className="space-y-3">
        {mockFlags.map((flag) => (
          <button
            key={flag.id}
            onClick={() => handleSelectFlag(flag)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              wizardState.featureFlagId === flag.id
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Flag
                  className={`w-5 h-5 mt-1 ${
                    wizardState.featureFlagId === flag.id
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {flag.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        flag.status === 'enabled'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {flag.status}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {flag.environment}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 font-mono mb-2">
                    {flag.key}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Variants ({flag.variants.length}):
                    </span>
                    {flag.variants.map((variant) => (
                      <span
                        key={variant.id}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {variant.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {wizardState.featureFlagId === flag.id && (
                <div className="ml-4">
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Flag Summary */}
      {wizardState.featureFlag && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="text-sm text-green-900 dark:text-green-100">
              <p className="font-medium mb-1">Flag Selected</p>
              <p>
                Your experiment will use the <strong>{wizardState.featureFlag.name}</strong> flag's{' '}
                {wizardState.featureFlag.variants.length} variants as experimental conditions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
