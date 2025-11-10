import { useState } from 'react';
import { Plus, FileText, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useSurveyAnalyses, useDeleteAnalysis } from '../hooks/useSurveyExperiments';
import { SurveyAnalysis } from '../types';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function SurveyExperiments() {
  const { data: analyses, isLoading } = useSurveyAnalyses();
  const deleteAnalysis = useDeleteAnalysis();
  const [filter, setFilter] = useState<'all' | 'completed' | 'running' | 'failed'>('all');

  const filteredAnalyses = analyses?.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || colors.pending}`}>
        {status}
      </span>
    );
  };

  const getAnalysisTypeLabel = (type: string) => {
    return type === 'paired_comparison' ? 'Paired Comparison' : 'Multi-Item Survey';
  };

  const handleDelete = async (analysisId: string) => {
    if (confirm('Are you sure you want to delete this analysis?')) {
      await deleteAnalysis.mutateAsync(analysisId);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Survey Experiments
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Analyze survey experiments with quality checks and statistical testing
          </p>
        </div>
        <Link
          to="/survey-experiments/new"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Analysis
        </Link>
      </div>

      {/* Stats */}
      {analyses && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Analyses</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {analyses.length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {analyses.filter(a => a.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Running</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {analyses.filter(a => a.status === 'running').length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {analyses.filter(a => a.status === 'failed').length}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'completed', 'running', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Analyses List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analyses...</p>
          </div>
        ) : filteredAnalyses && filteredAnalyses.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{getStatusIcon(analysis.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/survey-experiments/${analysis.id}`}
                          className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {analysis.name}
                        </Link>
                        {getStatusBadge(analysis.status)}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getAnalysisTypeLabel(analysis.analysisType)}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Created {format(new Date(analysis.createdAt), 'MMM d, yyyy h:mm a')}
                        {analysis.completedAt && (
                          <span className="ml-3">
                            Completed {format(new Date(analysis.completedAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </div>

                      {analysis.error && (
                        <div className="mt-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{analysis.error}</span>
                        </div>
                      )}

                      {analysis.results && analysis.results.warnings && analysis.results.warnings.length > 0 && (
                        <div className="mt-2 flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{analysis.results.warnings.length} warning(s)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/survey-experiments/${analysis.id}`}
                      className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(analysis.id)}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No analyses found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {filter !== 'all'
                ? `No ${filter} analyses. Try a different filter.`
                : 'Get started by creating your first survey analysis.'}
            </p>
            {filter === 'all' && (
              <Link
                to="/survey-experiments/new"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Analysis
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
