/**
 * Basic Usage Example
 * Demonstrates basic usage of the React SDK
 */

import React from 'react';
import {
  ExperimentProvider,
  useAssignment,
  useTrackMetric,
} from '@experimeh/react';

function App() {
  return (
    <ExperimentProvider
      apiUrl="https://api.example.com"
      apiKey="your-api-key"
      userId="user-123"
    >
      <HomePage />
    </ExperimentProvider>
  );
}

function HomePage() {
  return (
    <div>
      <h1>My App</h1>
      <HeroSection />
      <CheckoutButton />
    </div>
  );
}

// Example 1: Basic A/B test with auto-tracking
function HeroSection() {
  const { variantKey, loading } = useAssignment('hero-test', {
    autoTrackExposure: true,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <section>
      {variantKey === 'treatment' ? (
        <NewHero />
      ) : (
        <OldHero />
      )}
    </section>
  );
}

function NewHero() {
  return (
    <div style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
      <h2>New Hero Design</h2>
      <p>Better conversion rate!</p>
    </div>
  );
}

function OldHero() {
  return (
    <div style={{ background: '#f5f5f5' }}>
      <h2>Old Hero Design</h2>
      <p>Original version</p>
    </div>
  );
}

// Example 2: Button test with metric tracking
function CheckoutButton() {
  const { variantKey, loading } = useAssignment('button-color', {
    autoTrackExposure: true,
  });
  const trackMetric = useTrackMetric();

  const handleClick = async () => {
    // Track button click
    await trackMetric('button_click', 1);

    // Navigate to checkout
    window.location.href = '/checkout';
  };

  if (loading) return <button disabled>Loading...</button>;

  const colors = {
    control: '#757575',
    red: '#f44336',
    green: '#4caf50',
    blue: '#2196f3',
  };

  const color = colors[variantKey as keyof typeof colors] || colors.control;

  return (
    <button
      onClick={handleClick}
      style={{
        backgroundColor: color,
        color: 'white',
        padding: '12px 24px',
        fontSize: '16px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Checkout Now
    </button>
  );
}

export default App;
