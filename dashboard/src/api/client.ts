import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Experiment,
  AnalysisResult,
  Assignment,
  AssignmentDistribution,
  CreateExperimentForm,
  PaginatedResponse,
  ApiResponse,
  DashboardStats,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api', apiKey?: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey }),
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error
          console.error('API Error:', error.response.status, error.response.data);

          if (error.response.status === 401) {
            // Unauthorized - clear token and redirect to login
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
        } else if (error.request) {
          // Request made but no response
          console.error('Network Error:', error.message);
        } else {
          // Something else happened
          console.error('Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // Experiments API

  async getExperiments(params?: {
    status?: string[];
    design_type?: string[];
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Experiment>> {
    const response = await this.client.get<PaginatedResponse<Experiment>>('/experiments', {
      params,
    });
    return response.data;
  }

  async getExperiment(id: string): Promise<Experiment> {
    const response = await this.client.get<ApiResponse<Experiment>>(`/experiments/${id}`);
    return response.data.data;
  }

  async createExperiment(data: CreateExperimentForm): Promise<Experiment> {
    const response = await this.client.post<ApiResponse<Experiment>>('/experiments', data);
    return response.data.data;
  }

  async updateExperiment(id: string, data: Partial<Experiment>): Promise<Experiment> {
    const response = await this.client.put<ApiResponse<Experiment>>(
      `/experiments/${id}`,
      data
    );
    return response.data.data;
  }

  async deleteExperiment(id: string): Promise<void> {
    await this.client.delete(`/experiments/${id}`);
  }

  async startExperiment(id: string): Promise<Experiment> {
    const response = await this.client.post<ApiResponse<Experiment>>(
      `/experiments/${id}/start`
    );
    return response.data.data;
  }

  async pauseExperiment(id: string): Promise<Experiment> {
    const response = await this.client.post<ApiResponse<Experiment>>(
      `/experiments/${id}/pause`
    );
    return response.data.data;
  }

  async stopExperiment(id: string): Promise<Experiment> {
    const response = await this.client.post<ApiResponse<Experiment>>(
      `/experiments/${id}/stop`
    );
    return response.data.data;
  }

  async archiveExperiment(id: string): Promise<Experiment> {
    const response = await this.client.post<ApiResponse<Experiment>>(
      `/experiments/${id}/archive`
    );
    return response.data.data;
  }

  // Analysis API

  async getAnalysisResults(experimentId: string): Promise<AnalysisResult[]> {
    const response = await this.client.get<ApiResponse<AnalysisResult[]>>(
      `/experiments/${experimentId}/analysis`
    );
    return response.data.data;
  }

  async getLatestAnalysis(experimentId: string): Promise<AnalysisResult | null> {
    const response = await this.client.get<ApiResponse<AnalysisResult>>(
      `/experiments/${experimentId}/analysis/latest`
    );
    return response.data.data;
  }

  async runAnalysis(experimentId: string): Promise<AnalysisResult> {
    const response = await this.client.post<ApiResponse<AnalysisResult>>(
      `/experiments/${experimentId}/analysis`
    );
    return response.data.data;
  }

  // Assignments API

  async getAssignments(
    experimentId: string,
    params?: { page?: number; page_size?: number }
  ): Promise<PaginatedResponse<Assignment>> {
    const response = await this.client.get<PaginatedResponse<Assignment>>(
      `/experiments/${experimentId}/assignments`,
      { params }
    );
    return response.data;
  }

  async getAssignmentDistribution(experimentId: string): Promise<AssignmentDistribution[]> {
    const response = await this.client.get<ApiResponse<AssignmentDistribution[]>>(
      `/experiments/${experimentId}/assignments/distribution`
    );
    return response.data.data;
  }

  async assignUser(experimentId: string, userId: string, context?: Record<string, any>): Promise<Assignment> {
    const response = await this.client.post<ApiResponse<Assignment>>(
      `/experiments/${experimentId}/assign`,
      { user_id: userId, context }
    );
    return response.data.data;
  }

  // Dashboard API

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.client.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data.data;
  }

  // Metrics API

  async trackMetric(
    experimentId: string,
    userId: string,
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.client.post(`/metrics/track`, {
      experiment_id: experimentId,
      user_id: userId,
      metric_name: metricName,
      value,
      metadata,
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

// Create default instance
const apiClient = new ApiClient(
  import.meta.env.VITE_API_URL || '/api',
  import.meta.env.VITE_API_KEY
);

export default apiClient;
export { ApiClient };
