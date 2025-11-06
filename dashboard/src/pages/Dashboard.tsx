import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Play, CheckCircle, Users, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '../api/client';
import { useRealtimeDashboard } from '../hooks/useRealtime';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.getDashboardStats(),
  });

  // Enable real-time updates
  useRealtimeDashboard();

  const { data: experiments } = useQuery({
    queryKey: ['experiments', 'list', {}],
    queryFn: () => apiClient.getExperiments({ page: 1, page_size: 5 }),
  });

  const recentExperiments = experiments?.data.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Overview of your experimentation platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Experiments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '-' : stats?.total_experiments || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FlaskConical className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Running</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '-' : stats?.running_experiments || 0}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '-' : stats?.completed_experiments || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Assignments Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '-' : stats?.total_assignments_today?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/experiments/new"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors group"
          >
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                Create Experiment
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Start a new A/B test or experiment
              </p>
            </div>
            <FlaskConical className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
          </Link>

          <Link
            to="/experiments"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors group"
          >
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                View All Experiments
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Manage and monitor experiments
              </p>
            </div>
            <Play className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
          </Link>

          <Link
            to="/analytics"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors group"
          >
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                Analytics
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                View detailed analysis and insights
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
          </Link>
        </div>
      </div>

      {/* Recent Experiments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Experiments
          </h2>
          <Link
            to="/experiments"
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            View all
          </Link>
        </div>

        {recentExperiments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No experiments yet
            </p>
            <Link
              to="/experiments/new"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <FlaskConical className="w-4 h-4 mr-2" />
              Create your first experiment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentExperiments.map((experiment) => (
              <Link
                key={experiment.id}
                to={`/experiments/${experiment.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {experiment.name}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {format(new Date(experiment.created_at), 'PPP')}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      experiment.status === 'running'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : experiment.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {experiment.status}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {experiment.variants.length} variants
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Results */}
      {stats?.recent_results && stats.recent_results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Analysis Results
          </h2>
          <div className="space-y-3">
            {stats.recent_results.slice(0, 3).map((result) => (
              <div
                key={result.analysis_id}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Analysis {result.analysis_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {format(new Date(result.timestamp), 'PPP p')}
                    </p>
                  </div>
                  {result.recommendation && (
                    <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                      {result.recommendation.action}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
