/**
 * Feature Flags Example
 * Demonstrates using feature flags with the React SDK
 */

import React from 'react';
import {
  ExperimentProvider,
  FeatureFlag,
  ExperimentGate,
} from '@experimeh/react';

function App() {
  return (
    <ExperimentProvider
      apiUrl="https://api.example.com"
      apiKey="your-api-key"
      userId="user-123"
    >
      <Dashboard />
    </ExperimentProvider>
  );
}

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Simple feature flag */}
      <FeatureFlag flag="dark-mode">
        <DarkModeToggle />
      </FeatureFlag>

      {/* Feature flag with fallback */}
      <FeatureFlag flag="new-navigation" fallback={<OldNav />}>
        <NewNav />
      </FeatureFlag>

      {/* Nested feature flags */}
      <FeatureFlag flag="beta-features">
        <div className="beta-section">
          <h2>Beta Features</h2>

          <FeatureFlag flag="advanced-analytics">
            <AdvancedAnalytics />
          </FeatureFlag>

          <FeatureFlag flag="ai-assistant">
            <AIAssistant />
          </FeatureFlag>
        </div>
      </FeatureFlag>

      {/* Experiment gate for A/B test */}
      <ExperimentGate
        experiment="pricing-test"
        variant={['premium', 'deluxe']}
        fallback={<StandardPricing />}
      >
        <PremiumPricing />
      </ExperimentGate>

      {/* Main content */}
      <MainContent />
    </div>
  );
}

function DarkModeToggle() {
  const [enabled, setEnabled] = React.useState(true);

  return (
    <button onClick={() => setEnabled(!enabled)}>
      {enabled ? '🌙 Dark Mode' : '☀️ Light Mode'}
    </button>
  );
}

function OldNav() {
  return (
    <nav style={{ background: '#f5f5f5', padding: '10px' }}>
      <a href="/">Home</a> | <a href="/about">About</a>
    </nav>
  );
}

function NewNav() {
  return (
    <nav style={{ background: '#2196f3', padding: '10px', color: 'white' }}>
      <a href="/" style={{ color: 'white' }}>Home</a>
      {' | '}
      <a href="/about" style={{ color: 'white' }}>About</a>
      {' | '}
      <a href="/products" style={{ color: 'white' }}>Products</a>
    </nav>
  );
}

function AdvancedAnalytics() {
  return (
    <div className="analytics">
      <h3>Advanced Analytics</h3>
      <p>Premium analytics dashboard with real-time insights</p>
    </div>
  );
}

function AIAssistant() {
  return (
    <div className="ai-assistant">
      <h3>AI Assistant</h3>
      <p>Get help from our AI-powered assistant</p>
    </div>
  );
}

function StandardPricing() {
  return (
    <div className="pricing">
      <h2>Standard Pricing</h2>
      <p>$9.99/month</p>
    </div>
  );
}

function PremiumPricing() {
  return (
    <div className="pricing premium">
      <h2>Premium Pricing</h2>
      <p>$19.99/month - Best Value!</p>
      <ul>
        <li>All standard features</li>
        <li>Advanced analytics</li>
        <li>Priority support</li>
      </ul>
    </div>
  );
}

function MainContent() {
  return (
    <div className="content">
      <h2>Welcome to Dashboard</h2>
      <p>Your personalized dashboard</p>
    </div>
  );
}

export default App;
