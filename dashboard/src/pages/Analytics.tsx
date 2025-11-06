import { useState } from 'react';
import { BarChart3 } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Detailed analysis and insights across all experiments
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
            <BarChart3 className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Analytics Dashboard Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            We're building comprehensive analytics features including cross-experiment insights,
            trend analysis, and advanced statistical reports.
          </p>
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Cross-Experiment Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Compare performance across multiple experiments to identify patterns and best practices.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Trend Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track how key metrics evolve over time across your experimentation program.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Segment Insights
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Understand how different user segments respond to experiments.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Statistical Reports
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export detailed statistical reports for stakeholders and documentation.
          </p>
        </div>
      </div>
    </div>
  );
}
