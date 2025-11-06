import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { AnalysisResult, MetricResult } from '../types';

interface ResultsTableProps {
  analysis: AnalysisResult;
}

type MetricCategory = 'primary' | 'secondary' | 'guardrail';

export default function ResultsTable({ analysis }: ResultsTableProps) {
  const [activeCategory, setActiveCategory] = useState<MetricCategory>('primary');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const getResults = (): MetricResult[] => {
    switch (activeCategory) {
      case 'primary':
        return analysis.primary_metric_results;
      case 'secondary':
        return analysis.secondary_metric_results;
      case 'guardrail':
        return analysis.guardrail_results;
      default:
        return [];
    }
  };

  const results = getResults();

  // Group results by metric
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.metric_name]) {
      acc[result.metric_name] = [];
    }
    acc[result.metric_name].push(result);
    return acc;
  }, {} as Record<string, MetricResult[]>);

  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(2)}%`;
  };

  const getSignificanceColor = (isSignificant?: boolean) => {
    if (isSignificant === undefined) return '';
    return isSignificant
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-600 dark:text-gray-400';
  };

  const getGuardrailColor = (isViolated?: boolean) => {
    if (isViolated === undefined) return '';
    return isViolated
      ? 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400'
      : '';
  };

  const getLiftIcon = (relativeLift?: number) => {
    if (relativeLift === undefined || relativeLift === null) return null;
    if (relativeLift > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (relativeLift < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveCategory('primary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeCategory === 'primary'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Primary Metrics ({analysis.primary_metric_results.length})
        </button>
        <button
          onClick={() => setActiveCategory('secondary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeCategory === 'secondary'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Secondary Metrics ({analysis.secondary_metric_results.length})
        </button>
        <button
          onClick={() => setActiveCategory('guardrail')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
            activeCategory === 'guardrail'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Guardrail Metrics ({analysis.guardrail_results.length})
          {analysis.guardrail_results.some((r) => r.is_guardrail_violated) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Results table */}
      {results.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No {activeCategory} metrics configured
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedResults).map(([metricName, metricResults]) => (
            <div
              key={metricName}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Metric header */}
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {metricName}
                </h3>
              </div>

              {/* Results table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Variant
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Mean
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Std Dev
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Sample Size
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        95% CI
                      </th>
                      {activeCategory !== 'guardrail' && (
                        <>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Lift
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            P-value
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Significant
                          </th>
                        </>
                      )}
                      {activeCategory === 'guardrail' && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {metricResults.map((result, index) => (
                      <tr
                        key={`${result.variant_name}-${index}`}
                        className={`${
                          activeCategory === 'guardrail' && result.is_guardrail_violated
                            ? getGuardrailColor(true)
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        } transition-colors`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {result.variant_name}
                          {result.variant_name === 'control' && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              (baseline)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                          {formatNumber(result.mean)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(result.std_dev)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          {result.sample_size.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          [{formatNumber(result.confidence_interval.lower)},{' '}
                          {formatNumber(result.confidence_interval.upper)}]
                        </td>
                        {activeCategory !== 'guardrail' && (
                          <>
                            <td className="px-4 py-3 text-sm text-right">
                              {result.variant_name !== 'control' ? (
                                <div className="flex items-center justify-end space-x-1">
                                  {getLiftIcon(result.relative_lift)}
                                  <span
                                    className={getSignificanceColor(result.is_significant)}
                                  >
                                    {formatPercentage(result.relative_lift)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {result.variant_name !== 'control' ? (
                                <span
                                  className={getSignificanceColor(result.is_significant)}
                                >
                                  {formatNumber(result.p_value, 4)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {result.variant_name !== 'control' ? (
                                result.is_significant ? (
                                  <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </>
                        )}
                        {activeCategory === 'guardrail' && (
                          <td className="px-4 py-3 text-center">
                            {result.is_guardrail_violated ? (
                              <div className="flex items-center justify-center space-x-1">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                  Violated
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center space-x-1">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                  OK
                                </span>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistical notes */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-400">
          <strong>Note:</strong> Results use 95% confidence intervals. P-values {'<'} 0.05
          are considered statistically significant. Lift is calculated relative to the control
          variant.
        </p>
      </div>
    </div>
  );
}
