import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  useExperiment,
  useStartExperiment,
  usePauseExperiment,
  useStopExperiment,
  useAssignmentDistribution,
} from '../hooks/useExperiments';
import { useLatestAnalysis, getAnalysisSummary } from '../hooks/useAnalysis';
import { useSmartRealtime } from '../hooks/useRealtime';
import MetricsChart from './MetricsChart';
import ResultsTable from './ResultsTable';

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment, isLoading: experimentLoading } = useExperiment(id!);
  const { data: analysis, isLoading: analysisLoading } = useLatestAnalysis(
    id!,
    experiment?.status === 'running'
  );
  const { data: distribution } = useAssignmentDistribution(id!);

  const startMutation = useStartExperiment();
  const pauseMutation = usePauseExperiment();
  const stopMutation = useStopExperiment();

  // Enable real-time updates for running experiments
  useSmartRealtime(experiment);

  const analysisSummary = getAnalysisSummary(analysis);

  const handleStart = async () => {
    if (!id) return;
    try {
      await startMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to start experiment:', error);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    try {
      await pauseMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to pause experiment:', error);
    }
  };

  const handleStop = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to stop this experiment? This action cannot be undone.')) {
      return;
    }
    try {
      await stopMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to stop experiment:', error);
    }
  };

  if (experimentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Experiment not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-4 flex-1">
          <Link
            to="/experiments"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Experiments
          </Link>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {experiment.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {experiment.description}
            </p>
            <div className="flex items-center space-x-4 mt-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Flag Key: <span className="font-mono">{experiment.flag_key}</span>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Created: {format(new Date(experiment.created_at), 'PPP')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {experiment.status === 'draft' && (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Start</span>
            </button>
          )}
          {experiment.status === 'running' && (
            <>
              <button
                onClick={handlePause}
                disabled={pauseMutation.isPending}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleStop}
                disabled={stopMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </>
          )}
          {experiment.status === 'paused' && (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Resume</span>
            </button>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
              </p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              {experiment.status === 'running' ? (
                <Play className="w-6 h-6 text-primary-600" />
              ) : (
                <Pause className="w-6 h-6 text-primary-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Assignments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {experiment.total_assignments?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Variants</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {experiment.variants.length}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Significant Results</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {analysisSummary.significantResults}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              {analysisSummary.guardrailViolations > 0 ? (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Guardrail warnings */}
      {analysisSummary.guardrailViolations > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-400">
                Guardrail Violations Detected
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-500 mt-1">
                {analysisSummary.guardrailViolations} guardrail metric(s) have been violated.
                Review the results below for details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {analysisSummary.recommendation && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-400">
                Recommendation: {analysisSummary.recommendation.toUpperCase()}
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-500 mt-1">
                Confidence: {(analysisSummary.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Variant distribution */}
      {distribution && distribution.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Assignment Distribution
          </h2>
          <div className="space-y-3">
            {distribution.map((item) => (
              <div key={item.variant_name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.variant_name}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {item.count.toLocaleString()} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Charts */}
      {analysis && !analysisLoading && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Metrics Over Time
            </h2>
            <MetricsChart analysis={analysis} />
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Analysis Results
            </h2>
            <ResultsTable analysis={analysis} />
          </div>
        </>
      )}

      {analysisLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Variants
            </h3>
            <div className="space-y-2">
              {experiment.variants.map((variant) => (
                <div
                  key={variant.name}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {variant.name}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {(variant.allocation * 100).toFixed(0)}% allocation
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Metrics
            </h3>
            <div className="space-y-2">
              {experiment.metrics.map((metric) => (
                <div
                  key={metric.name}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {metric.name}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                      {metric.type}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                      {metric.aggregation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
