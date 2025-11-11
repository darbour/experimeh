/**
 * Stepped Wedge Design Configuration Component
 *
 * Configure clusters and rollout schedule.
 */

import { useState } from 'react';
import { Plus, Trash2, TrendingUp, Info } from 'lucide-react';

interface Props {
  config: {
    clusters: string[];
    stepsPerCluster: number;
    stepLengthDays: number;
  };
  setConfig: (config: {
    clusters: string[];
    stepsPerCluster: number;
    stepLengthDays: number;
  }) => void;
}

export default function SteppedWedgeConfiguration({ config, setConfig }: Props) {
  const [newCluster, setNewCluster] = useState('');

  const addCluster = () => {
    if (newCluster.trim()) {
      setConfig({
        ...config,
        clusters: [...config.clusters, newCluster.trim()],
      });
      setNewCluster('');
    }
  };

  const removeCluster = (index: number) => {
    setConfig({
      ...config,
      clusters: config.clusters.filter((_, i) => i !== index),
    });
  };

  const handleChange = (field: 'stepsPerCluster' | 'stepLengthDays', value: number) => {
    setConfig({
      ...config,
      [field]: value,
    });
  };

  const totalDurationDays = config.clusters.length * config.stepLengthDays;
  const totalDurationWeeks = totalDurationDays / 7;

  return (
    <div className="space-y-6">
      {/* Cluster Definition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Define Clusters *
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Clusters are groups that transition together (e.g., cities, teams, stores)
        </p>

        <div className="space-y-2">
          {config.clusters.map((cluster, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {cluster}
              </div>
              <button
                onClick={() => removeCluster(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCluster}
              onChange={(e) => setNewCluster(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCluster()}
              placeholder="Enter cluster name (e.g., New York)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <button
              onClick={addCluster}
              disabled={!newCluster.trim()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Rollout Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Steps Per Cluster *
          </label>
          <input
            type="number"
            min="2"
            max="10"
            value={config.stepsPerCluster}
            onChange={(e) => handleChange('stepsPerCluster', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Number of rollout phases
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Step Length (days) *
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={config.stepLengthDays}
            onChange={(e) => handleChange('stepLengthDays', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Duration of each step
          </p>
        </div>
      </div>

      {/* Rollout Summary */}
      {config.clusters.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                Rollout Schedule
              </p>
              <div className="space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
                <p>
                  • <strong>Clusters:</strong> {config.clusters.length}
                </p>
                <p>
                  • <strong>Steps:</strong> {config.stepsPerCluster}
                </p>
                <p>
                  • <strong>Step Duration:</strong> {config.stepLengthDays} days
                </p>
                <p>
                  • <strong>Total Duration:</strong> {totalDurationDays} days ({totalDurationWeeks.toFixed(1)} weeks)
                </p>
                <p>
                  • <strong>Clusters per step:</strong> {Math.ceil(config.clusters.length / config.stepsPerCluster)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-2">How Stepped Wedge Works</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clusters transition from control to treatment in stages</li>
              <li>Each cluster stays in control, then switches to treatment</li>
              <li>Eventually, ALL clusters receive the treatment</li>
              <li>Controls for cluster-level confounders and time trends</li>
              <li>Best when you can't ethically deny treatment long-term</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
