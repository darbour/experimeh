/**
 * Design Type Card Component
 *
 * Reusable card for displaying experiment design types with:
 * - Visual diagram
 * - Statistics
 * - Best use cases
 * - Statistical methods
 */

import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface Props {
  type: string;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  diagram: ReactNode;
  stats: {
    sampleMultiplier: string;
    power: string;
    complexity: string;
    runtime: string;
  };
  bestFor: string[];
  statisticalMethods: string[];
}

export default function DesignTypeCard({
  type,
  selected,
  onClick,
  icon,
  title,
  description,
  diagram,
  stats,
  bestFor,
  statisticalMethods,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-6 rounded-lg border-2 transition-all transform ${
        selected
          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 shadow-lg scale-105'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
      }`}
    >
      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
          <Check className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`p-2 rounded-lg ${
            selected
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>

      {/* Visual Diagram */}
      <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {diagram}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-xs">
          <div className="text-gray-500 dark:text-gray-400 mb-0.5">Sample Size</div>
          <div className="font-semibold text-gray-900 dark:text-white">{stats.sampleMultiplier}</div>
        </div>
        <div className="text-xs">
          <div className="text-gray-500 dark:text-gray-400 mb-0.5">Power</div>
          <div className="font-semibold text-gray-900 dark:text-white">{stats.power}</div>
        </div>
        <div className="text-xs">
          <div className="text-gray-500 dark:text-gray-400 mb-0.5">Complexity</div>
          <div className="font-semibold text-gray-900 dark:text-white">{stats.complexity}</div>
        </div>
        <div className="text-xs">
          <div className="text-gray-500 dark:text-gray-400 mb-0.5">Runtime</div>
          <div className="font-semibold text-gray-900 dark:text-white">{stats.runtime}</div>
        </div>
      </div>

      {/* Best For Section */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          BEST FOR:
        </div>
        <ul className="space-y-1">
          {bestFor.map((item, index) => (
            <li key={index} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Statistical Methods */}
      <div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          STATISTICAL METHODS:
        </div>
        <ul className="space-y-1">
          {statisticalMethods.map((method, index) => (
            <li key={index} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
              <span className="mr-2">•</span>
              <span>{method}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}
