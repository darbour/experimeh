import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { AnalysisResult } from '../types';

// Query keys
const analysisKeys = {
  all: ['analysis'] as const,
  lists: () => [...analysisKeys.all, 'list'] as const,
  list: (experimentId: string) => [...analysisKeys.lists(), experimentId] as const,
  latest: (experimentId: string) => [...analysisKeys.all, 'latest', experimentId] as const,
};

// Fetch all analysis results for an experiment
export function useAnalysisResults(experimentId: string) {
  return useQuery({
    queryKey: analysisKeys.list(experimentId),
    queryFn: () => apiClient.getAnalysisResults(experimentId),
    enabled: !!experimentId,
    staleTime: 30000, // 30 seconds
  });
}

// Fetch latest analysis result with polling
export function useLatestAnalysis(experimentId: string, enablePolling: boolean = false) {
  return useQuery({
    queryKey: analysisKeys.latest(experimentId),
    queryFn: () => apiClient.getLatestAnalysis(experimentId),
    enabled: !!experimentId,
    staleTime: enablePolling ? 0 : 30000,
    refetchInterval: enablePolling ? 5000 : false, // Poll every 5 seconds if enabled
  });
}

// Run new analysis
export function useRunAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (experimentId: string) => apiClient.runAnalysis(experimentId),
    onSuccess: (_, experimentId) => {
      // Invalidate analysis queries
      queryClient.invalidateQueries({ queryKey: analysisKeys.list(experimentId) });
      queryClient.invalidateQueries({ queryKey: analysisKeys.latest(experimentId) });
    },
  });
}

// Helper to determine if analysis is still running
export function isAnalysisRunning(analysis?: AnalysisResult | null): boolean {
  return analysis?.status === 'running';
}

// Helper to check if guardrails are violated
export function hasGuardrailViolations(analysis?: AnalysisResult | null): boolean {
  if (!analysis) return false;
  return analysis.guardrail_results.some(result => result.is_guardrail_violated);
}

// Helper to get primary metric winner
export function getPrimaryMetricWinner(analysis?: AnalysisResult | null): string | null {
  if (!analysis || analysis.primary_metric_results.length === 0) return null;

  const significantResults = analysis.primary_metric_results.filter(
    result => result.is_significant && result.variant_name !== 'control'
  );

  if (significantResults.length === 0) return null;

  // Find variant with best effect size
  const winner = significantResults.reduce((best, current) => {
    if (!best) return current;
    if (!current.effect_size || !best.effect_size) return best;
    return Math.abs(current.effect_size) > Math.abs(best.effect_size) ? current : best;
  });

  return winner.variant_name;
}

// Helper to calculate summary statistics
export interface AnalysisSummary {
  totalVariants: number;
  significantResults: number;
  guardrailViolations: number;
  winner: string | null;
  recommendation: string | null;
  confidence: number;
}

export function getAnalysisSummary(analysis?: AnalysisResult | null): AnalysisSummary {
  if (!analysis) {
    return {
      totalVariants: 0,
      significantResults: 0,
      guardrailViolations: 0,
      winner: null,
      recommendation: null,
      confidence: 0,
    };
  }

  const significantResults = analysis.primary_metric_results.filter(
    result => result.is_significant
  ).length;

  const guardrailViolations = analysis.guardrail_results.filter(
    result => result.is_guardrail_violated
  ).length;

  return {
    totalVariants: analysis.primary_metric_results.length,
    significantResults,
    guardrailViolations,
    winner: getPrimaryMetricWinner(analysis),
    recommendation: analysis.recommendation?.action || null,
    confidence: analysis.recommendation?.confidence || 0,
  };
}
