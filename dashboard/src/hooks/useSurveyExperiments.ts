/**
 * React hooks for Survey Experiments API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { SurveyAnalysis, Survey

AnalysisConfig, SurveyQualityResults } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Upload survey data file
 */
export function useUploadSurveyData() {
  return useMutation({
    mutationFn: async (data: { file: File; name: string; description?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.name);
      if (data.description) {
        formData.append('description', data.description);
      }

      const response = await axios.post(
        `${API_BASE_URL}/survey-experiments/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
  });
}

/**
 * Run survey analysis
 */
export function useRunAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      analysisId: string;
      analysisType: 'paired_comparison' | 'multi_item';
      config: SurveyAnalysisConfig;
    }) => {
      const response = await axios.post(`${API_BASE_URL}/survey-experiments/analyze`, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate analyses list
      queryClient.invalidateQueries({ queryKey: ['survey-analyses'] });
    },
  });
}

/**
 * Run quality checks
 */
export function useRunQualityChecks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { analysisId: string; checks?: string }) => {
      const response = await axios.post(`${API_BASE_URL}/survey-experiments/quality`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate specific analysis
      queryClient.invalidateQueries({ queryKey: ['survey-analysis', variables.analysisId] });
    },
  });
}

/**
 * Get survey analysis by ID
 */
export function useSurveyAnalysis(analysisId: string | undefined, refetchInterval?: number) {
  return useQuery({
    queryKey: ['survey-analysis', analysisId],
    queryFn: async () => {
      if (!analysisId) throw new Error('Analysis ID is required');
      const response = await axios.get(`${API_BASE_URL}/survey-experiments/${analysisId}`);
      return response.data.analysis as SurveyAnalysis;
    },
    enabled: !!analysisId,
    refetchInterval: refetchInterval,
  });
}

/**
 * List all survey analyses
 */
export function useSurveyAnalyses(filters?: {
  status?: string;
  analysisType?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['survey-analyses', filters],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/survey-experiments`, {
        params: filters,
      });
      return response.data.analyses as SurveyAnalysis[];
    },
  });
}

/**
 * Delete survey analysis
 */
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const response = await axios.delete(`${API_BASE_URL}/survey-experiments/${analysisId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-analyses'] });
    },
  });
}
