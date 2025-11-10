import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useSurveyAnalysis } from '../hooks/useSurveyExperiments';

export default function SurveyAnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: analysis, isLoading } = useSurveyAnalysis(id, 5000); // Poll every 5s if running

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis not found</h2>
          <Link to="/survey-experiments" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  const results = analysis.results;
  const qualityChecks = analysis.qualityChecks;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/survey-experiments')}
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to list
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                analysis.status === 'completed'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : analysis.status === 'running'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : analysis.status === 'failed'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {analysis.status}
              </span>
              <span className="text-sm text-gray-500">
                {analysis.analysisType === 'paired_comparison' ? 'Paired Comparison' : 'Multi-Item Survey'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {analysis.status === 'failed' && analysis.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-200">Analysis Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{analysis.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Running State */}
      {analysis.status === 'running' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 animate-spin mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-200">Analysis Running</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Your analysis is being processed. This page will update automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Main Results */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statistical Results</h2>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Method</dt>
                <dd className="mt-1 text-lg text-gray-900 dark:text-white">{results.method}</dd>
              </div>

              {Object.entries(results.estimates).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </dt>
                  <dd className="mt-1">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {value.toFixed(4)}
                    </div>
                    {results.confidence_intervals[key] && (
                      <div className="text-sm text-gray-500 mt-1">
                        95% CI: [{results.confidence_intervals[key][0].toFixed(4)}, {results.confidence_intervals[key][1].toFixed(4)}]
                      </div>
                    )}
                    {results.p_values[key] !== undefined && (
                      <div className={`text-sm mt-1 font-medium ${
                        results.p_values[key] < 0.05
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        p = {results.p_values[key].toFixed(4)}
                        {results.p_values[key] < 0.05 && ' *'}
                      </div>
                    )}
                  </dd>
                </div>
              ))}

              {results.effect_sizes && Object.entries(results.effect_sizes).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {value.toFixed(3)}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Sample Sizes */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Sample Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(results.sample_sizes).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {typeof value === 'number' ? Math.round(value) : value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clustering Info (Multi-Item) */}
            {results.random_effects && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Clustering Effects</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(results.random_effects).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {typeof value === 'number' ? value.toFixed(3) : JSON.stringify(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {results.warnings && results.warnings.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">Warnings</h3>
                    <ul className="space-y-1">
                      {results.warnings.map((warning, i) => (
                        <li key={i} className="text-sm text-yellow-800 dark:text-yellow-300">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quality Checks */}
          {qualityChecks && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quality Checks</h2>

              <div className="space-y-6">
                {/* Straightlining */}
                {qualityChecks.quality_checks.straightlining && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Straightlining</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Flagged</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {qualityChecks.quality_checks.straightlining.n_straightliners || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Rate</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((qualityChecks.quality_checks.straightlining.pct_straightliners || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Avg Rate</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((qualityChecks.quality_checks.straightlining.avg_rate || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Speeding */}
                {qualityChecks.quality_checks.speeding && (
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Speeding</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Speeders</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {qualityChecks.quality_checks.speeding.n_speeders || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Rate</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((qualityChecks.quality_checks.speeding.pct_speeders || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Threshold</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {(qualityChecks.quality_checks.speeding.threshold || 0).toFixed(1)}s
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Bias */}
                {qualityChecks.bias_checks.order_bias && (
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Order Bias</h3>
                    <div className="flex items-start gap-3">
                      {qualityChecks.bias_checks.order_bias.order_bias_detected ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {qualityChecks.bias_checks.order_bias.interpretation || 'No significant order bias'}
                        </div>
                        {qualityChecks.bias_checks.order_bias.p_value !== undefined && (
                          <div className="text-xs text-gray-500 mt-1">
                            p = {qualityChecks.bias_checks.order_bias.p_value.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Scale Bias */}
                {qualityChecks.bias_checks.scale_bias && (
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Response Scale Bias</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Extreme Usage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((qualityChecks.bias_checks.scale_bias.extreme_usage || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Midpoint Usage</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((qualityChecks.bias_checks.scale_bias.midpoint_usage || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Extreme Avoidance</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {qualityChecks.bias_checks.scale_bias.extreme_avoidance ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
