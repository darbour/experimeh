import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ExperimentList from './components/ExperimentList';
import ExperimentDetail from './components/ExperimentDetail';
import CreateExperiment from './components/CreateExperiment';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';

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
            <Route path="/experiments" element={<ExperimentList />} />
            <Route path="/experiments/new" element={<CreateExperiment />} />
            <Route path="/experiments/:id" element={<ExperimentDetail />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
