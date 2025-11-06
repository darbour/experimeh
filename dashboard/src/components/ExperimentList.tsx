import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  ArrowUpDown,
  Play,
  Pause,
  Square,
  Archive,
  Eye,
  Loader2,
} from 'lucide-react';
import { useExperiments } from '../hooks/useExperiments';
import { useRealtimeExperiments } from '../hooks/useRealtime';
import type { Experiment, ExperimentStatus, DesignType, SortConfig } from '../types';

export default function ExperimentList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus[]>([]);
  const [designFilter, setDesignFilter] = useState<DesignType[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc',
  });

  const { data, isLoading, error } = useExperiments({
    status: statusFilter.length > 0 ? statusFilter : undefined,
    design_type: designFilter.length > 0 ? designFilter : undefined,
    search: search || undefined,
  });

  // Enable real-time updates
  useRealtimeExperiments({ enabled: true });

  const experiments = data?.data || [];

  // Sort experiments
  const sortedExperiments = useMemo(() => {
    const sorted = [...experiments];
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.field as keyof Experiment];
      const bValue = b[sortConfig.field as keyof Experiment];

      if (aValue === undefined || bValue === undefined) return 0;

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [experiments, sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getStatusBadge = (status: ExperimentStatus) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDesignTypeBadge = (designType: DesignType) => {
    const labels = {
      ab: 'A/B Test',
      factorial: 'Factorial',
      switchback: 'Switchback',
      stepped_wedge: 'Stepped Wedge',
    };

    return (
      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
        {labels[designType]}
      </span>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">
            Error loading experiments: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Experiments
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage and monitor your feature flag experiments
          </p>
        </div>
        <Link
          to="/experiments/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Create Experiment
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search experiments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              multiple
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  Array.from(e.target.selectedOptions, (option) => option.value as ExperimentStatus)
                )
              }
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Experiments table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : sortedExperiments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No experiments found</p>
            <Link
              to="/experiments/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create your first experiment
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                    >
                      <span>Name</span>
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Design
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                    >
                      <span>Created</span>
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Assignments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedExperiments.map((experiment) => (
                  <tr
                    key={experiment.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link
                          to={`/experiments/${experiment.id}`}
                          className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {experiment.name}
                        </Link>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {experiment.flag_key}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getDesignTypeBadge(experiment.design_type)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(experiment.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(experiment.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {experiment.total_assignments?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/experiments/${experiment.id}`}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {data.data.length} of {data.total} experiments
          </p>
          <div className="flex space-x-2">
            {/* Add pagination buttons here */}
          </div>
        </div>
      )}
    </div>
  );
}
