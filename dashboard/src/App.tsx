import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ExperimentList from './components/ExperimentList';
import ExperimentDetail from './components/ExperimentDetail';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';

// Feature Flags (NEW: Foundation layer)
import FeatureFlagsList from './pages/FeatureFlags';

// Enhanced Experiment Wizard (NEW: Multi-step with visual design selection)
import CreateExperimentWizard from './pages/CreateExperiment';

// Survey Analysis (RENAMED from SurveyExperiments)
import SurveyAnalysisPage from './pages/SurveyAnalysis';
import NewSurveyAnalysis from './pages/NewSurveyAnalysis';
import SurveyAnalysisDetail from './pages/SurveyAnalysisDetail';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />

            {/* Feature Flags - Foundation layer */}
            <Route path="/flags" element={<FeatureFlagsList />} />

            {/* Experiments - Enhanced wizard with visual design selection */}
            <Route path="/experiments" element={<ExperimentList />} />
            <Route path="/experiments/new" element={<CreateExperimentWizard />} />
            <Route path="/experiments/:id" element={<ExperimentDetail />} />

            {/* Analytics */}
            <Route path="/analytics" element={<Analytics />} />

            {/* Survey Analysis - Post-hoc analysis tools */}
            <Route path="/survey-experiments" element={<SurveyAnalysisPage />} />
            <Route path="/survey-experiments/new" element={<NewSurveyAnalysis />} />
            <Route path="/survey-experiments/:id" element={<SurveyAnalysisDetail />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
