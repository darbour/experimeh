import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type {
  FeatureFlag,
  CreateFeatureFlagForm,
  FeatureFlagFilters,
} from '../types';

// Query keys
const featureFlagKeys = {
  all: ['feature-flags'] as const,
  lists: () => [...featureFlagKeys.all, 'list'] as const,
  list: (filters: FeatureFlagFilters) => [...featureFlagKeys.lists(), filters] as const,
  details: () => [...featureFlagKeys.all, 'detail'] as const,
  detail: (id: string) => [...featureFlagKeys.details(), id] as const,
  byKey: (key: string) => [...featureFlagKeys.all, 'by-key', key] as const,
};

// Fetch feature flags with filters
export function useFeatureFlags(filters?: FeatureFlagFilters) {
  return useQuery({
    queryKey: featureFlagKeys.list(filters || {}),
    queryFn: () => apiClient.getFeatureFlags(filters),
    staleTime: 30000, // 30 seconds
  });
}

// Fetch single feature flag by ID
export function useFeatureFlag(id: string) {
  return useQuery({
    queryKey: featureFlagKeys.detail(id),
    queryFn: () => apiClient.getFeatureFlag(id),
    enabled: !!id,
    staleTime: 10000, // 10 seconds
  });
}

// Fetch single feature flag by key
export function useFeatureFlagByKey(key: string) {
  return useQuery({
    queryKey: featureFlagKeys.byKey(key),
    queryFn: () => apiClient.getFeatureFlagByKey(key),
    enabled: !!key,
    staleTime: 10000, // 10 seconds
  });
}

// Create feature flag
export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeatureFlagForm) => apiClient.createFeatureFlag(data),
    onSuccess: () => {
      // Invalidate feature flags list
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
}

// Update feature flag
export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FeatureFlag> }) =>
      apiClient.updateFeatureFlag(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific feature flag and lists
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
}

// Delete feature flag
export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteFeatureFlag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
}

// Toggle feature flag enabled status
export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.toggleFeatureFlag(id, enabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.lists() });
    },
  });
}

// Evaluate feature flag
export function useEvaluateFeatureFlag(key: string, unitId: string, context?: Record<string, any>) {
  return useQuery({
    queryKey: ['flag-evaluation', key, unitId, context],
    queryFn: () => apiClient.evaluateFeatureFlag(key, unitId, context),
    enabled: !!key && !!unitId,
    staleTime: 5000, // 5 seconds
  });
}
