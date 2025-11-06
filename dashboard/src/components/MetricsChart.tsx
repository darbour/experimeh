import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import type { AnalysisResult } from '../types';

interface MetricsChartProps {
  analysis: AnalysisResult;
}

export default function MetricsChart({ analysis }: MetricsChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Get unique metrics from results
  const primaryMetrics = analysis.primary_metric_results.map((r) => r.metric_name);
  const uniqueMetrics = Array.from(new Set([...primaryMetrics]));

  // Default to first metric if none selected
  const activeMetric = selectedMetric || (uniqueMetrics[0] ?? null);

  // Prepare time series data
  const timeSeriesData = analysis.time_series || [];
  const filteredTimeSeries = activeMetric
    ? timeSeriesData.filter((point) => point.metric_name === activeMetric)
    : [];

  // Group by timestamp for line chart
  const groupedData = filteredTimeSeries.reduce((acc, point) => {
    const timestamp = point.timestamp;
    if (!acc[timestamp]) {
      acc[timestamp] = { timestamp };
    }
    acc[timestamp][point.variant_name] = point.value;
    return acc;
  }, {} as Record<string, any>);

  const lineChartData = Object.values(groupedData);

  // Prepare comparison bar chart data
  const comparisonData = activeMetric
    ? analysis.primary_metric_results
        .filter((r) => r.metric_name === activeMetric)
        .map((result) => ({
          variant: result.variant_name,
          mean: result.mean,
          lower: result.confidence_interval.lower,
          upper: result.confidence_interval.upper,
          significant: result.is_significant || false,
        }))
    : [];

  // Get unique variant names for colors
  const variants = Array.from(
    new Set(filteredTimeSeries.map((point) => point.variant_name))
  );

  const colors = [
    '#0ea5e9', // sky-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#ef4444', // red-500
    '#ec4899', // pink-500
  ];

  const getVariantColor = (variantName: string) => {
    const index = variants.indexOf(variantName);
    return colors[index % colors.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          {chartType === 'line'
            ? format(new Date(label), 'MMM d, HH:mm')
            : label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!activeMetric) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No metrics data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Metric selector */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Metric:
          </label>
          <select
            value={activeMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {uniqueMetrics.map((metric) => (
              <option key={metric} value={metric}>
                {metric}
              </option>
            ))}
          </select>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartType === 'line'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Time Series
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartType === 'bar'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Comparison
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-80">
        {chartType === 'line' && lineChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                className="text-xs text-gray-600 dark:text-gray-400"
              />
              <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {variants.map((variant) => (
                <Line
                  key={variant}
                  type="monotone"
                  dataKey={variant}
                  stroke={getVariantColor(variant)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : chartType === 'bar' && comparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="variant"
                className="text-xs text-gray-600 dark:text-gray-400"
              />
              <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="mean"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
              >
                {comparisonData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.significant ? '#10b981' : '#0ea5e9'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            No data available for selected metric
          </div>
        )}
      </div>

      {/* Legend for significance */}
      {chartType === 'bar' && comparisonData.length > 0 && (
        <div className="flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">Not Significant</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">Significant</span>
          </div>
        </div>
      )}

      {/* Confidence intervals note */}
      {chartType === 'bar' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Confidence intervals shown in results table below
        </p>
      )}
    </div>
  );
}
