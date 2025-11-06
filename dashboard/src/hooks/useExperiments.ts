import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type {
  Experiment,
  CreateExperimentForm,
  ExperimentFilters,
} from '../types';

// Query keys
const experimentKeys = {
  all: ['experiments'] as const,
  lists: () => [...experimentKeys.all, 'list'] as const,
  list: (filters: ExperimentFilters) => [...experimentKeys.lists(), filters] as const,
  details: () => [...experimentKeys.all, 'detail'] as const,
  detail: (id: string) => [...experimentKeys.details(), id] as const,
};

// Fetch experiments with filters
export function useExperiments(filters?: ExperimentFilters) {
  return useQuery({
    queryKey: experimentKeys.list(filters || {}),
    queryFn: () => apiClient.getExperiments({
      status: filters?.status,
      design_type: filters?.design_type,
      search: filters?.search,
    }),
    staleTime: 30000, // 30 seconds
  });
}

// Fetch single experiment
export function useExperiment(id: string) {
  return useQuery({
    queryKey: experimentKeys.detail(id),
    queryFn: () => apiClient.getExperiment(id),
    enabled: !!id,
    staleTime: 10000, // 10 seconds
  });
}

// Create experiment
export function useCreateExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExperimentForm) => apiClient.createExperiment(data),
    onSuccess: () => {
      // Invalidate experiments list
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Update experiment
export function useUpdateExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Experiment> }) =>
      apiClient.updateExperiment(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific experiment and lists
      queryClient.invalidateQueries({ queryKey: experimentKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Delete experiment
export function useDeleteExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteExperiment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Start experiment
export function useStartExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.startExperiment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: experimentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Pause experiment
export function usePauseExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.pauseExperiment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: experimentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Stop experiment
export function useStopExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.stopExperiment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: experimentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Archive experiment
export function useArchiveExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.archiveExperiment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: experimentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: experimentKeys.lists() });
    },
  });
}

// Get assignment distribution
export function useAssignmentDistribution(experimentId: string) {
  return useQuery({
    queryKey: ['assignment-distribution', experimentId],
    queryFn: () => apiClient.getAssignmentDistribution(experimentId),
    enabled: !!experimentId,
    refetchInterval: 10000, // Refetch every 10 seconds for running experiments
  });
}
