/**
 * Switchback Design Configuration Component
 *
 * Configure time-based switching parameters.
 */

import { Clock, Info } from 'lucide-react';

interface Props {
  config: {
    periodLengthMinutes: number;
    washoutPeriodMinutes: number;
    numPeriods: number;
  };
  setConfig: (config: {
    periodLengthMinutes: number;
    washoutPeriodMinutes: number;
    numPeriods: number;
  }) => void;
}

export default function SwitchbackConfiguration({ config, setConfig }: Props) {
  const handleChange = (field: keyof typeof config, value: number) => {
    setConfig({
      ...config,
      [field]: value,
    });
  };

  const totalDurationHours = ((config.periodLengthMinutes + config.washoutPeriodMinutes) * config.numPeriods) / 60;
  const totalDurationDays = totalDurationHours / 24;

  return (
    <div className="space-y-6">
      {/* Configuration Inputs */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Period Length (minutes) *
          </label>
          <input
            type="number"
            min="5"
            max="1440"
            value={config.periodLengthMinutes}
            onChange={(e) => handleChange('periodLengthMinutes', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            How long each variant runs
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Washout Period (minutes) *
          </label>
          <input
            type="number"
            min="0"
            max="60"
            value={config.washoutPeriodMinutes}
            onChange={(e) => handleChange('washoutPeriodMinutes', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cool-down between switches
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Number of Periods *
          </label>
          <input
            type="number"
            min="4"
            max="200"
            value={config.numPeriods}
            onChange={(e) => handleChange('numPeriods', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total switches (even number recommended)
          </p>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Switchback Timeline
            </p>
            <div className="space-y-1 text-sm text-purple-800 dark:text-purple-200">
              <p>
                • <strong>Period Duration:</strong> {config.periodLengthMinutes} minutes
              </p>
              <p>
                • <strong>Washout:</strong> {config.washoutPeriodMinutes} minutes between periods
              </p>
              <p>
                • <strong>Total Periods:</strong> {config.numPeriods}
              </p>
              <p>
                • <strong>Experiment Duration:</strong> {totalDurationDays.toFixed(1)} days (
                {totalDurationHours.toFixed(1)} hours)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-2">How Switchback Works</p>
            <ul className="list-disc list-inside space-y-1">
              <li>ALL users experience BOTH variants over time</li>
              <li>Variants switch every {config.periodLengthMinutes} minutes</li>
              <li>
                Washout period ({config.washoutPeriodMinutes} min) prevents contamination
                between switches
              </li>
              <li>Controls for time-of-day effects and marketplace interference</li>
              <li>Best for two-sided marketplaces (e.g., rideshare, delivery)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
