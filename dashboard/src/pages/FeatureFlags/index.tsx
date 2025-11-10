/**
 * Feature Flags List Page
 *
 * Displays all feature flags with their status, linked experiments, and actions.
 * This is the foundation layer - flags must be created before experiments.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Flag, Link as LinkIcon } from 'lucide-react';

export default function FeatureFlagsList() {
  const navigate = useNavigate();

  // Mock data - in production, this would come from API
  const [flags] = useState([
    {
      id: '1',
      key: 'new_checkout_button',
      name: 'New Checkout Button',
      status: 'enabled',
      variants: [
        { key: 'control', name: 'Blue Button' },
        { key: 'treatment', name: 'Green Button' },
      ],
      linkedExperiments: [
        { experimentId: 'exp-1', experimentKey: 'button_color_test', status: 'active' },
      ],
      environment: 'production',
      createdAt: new Date('2025-01-15'),
    },
    {
      id: '2',
      key: 'personalized_recommendations',
      name: 'Personalized Recommendations',
      status: 'enabled',
      variants: [
        { key: 'off', name: 'Generic Recommendations' },
        { key: 'on', name: 'ML-Based Recommendations' },
      ],
      linkedExperiments: [],
      environment: 'production',
      createdAt: new Date('2025-01-10'),
    },
  ]);

  const getStatusBadge = (status: string) => {
    const styles = {
      enabled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      disabled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      archived: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return styles[status as keyof typeof styles] || styles.disabled;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Flag className="w-8 h-8" />
              Feature Flags
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              The foundation layer - create flags before experiments
            </p>
          </div>
          <button
            onClick={() => navigate('/flags/new')}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Flag
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Flags</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {flags.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">Enabled</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {flags.filter((f) => f.status === 'enabled').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">With Experiments</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {flags.filter((f) => f.linkedExperiments.length > 0).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Experiments</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {flags.reduce((sum, f) => sum + f.linkedExperiments.filter((e) => e.status === 'active').length, 0)}
          </div>
        </div>
      </div>

      {/* Flags Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Flag
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Variants
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Linked Experiments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {flags.map((flag) => (
              <tr key={flag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {flag.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {flag.key}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(flag.status)}`}>
                    {flag.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {flag.variants.map((v) => (
                      <span
                        key={v.key}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {flag.linkedExperiments.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {flag.linkedExperiments.length} experiment(s)
                      </span>
                      {flag.linkedExperiments.some((e) => e.status === 'active') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {flag.environment}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => navigate(`/experiments/new?flagId=${flag.id}`)}
                      className="inline-flex items-center px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      New Experiment
                    </button>
                    <button
                      onClick={() => navigate(`/flags/${flag.id}`)}
                      className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {flags.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Flag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No feature flags yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Get started by creating your first feature flag
          </p>
          <button
            onClick={() => navigate('/flags/new')}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Flag
          </button>
        </div>
      )}
    </div>
  );
}
