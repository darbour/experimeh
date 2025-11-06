/**
 * Next.js Example
 * Demonstrates using the React SDK with Next.js
 */

import React from 'react';
import { ExperimentProvider, useAssignment } from '@experimeh/react';
import type { AppProps } from 'next/app';

// _app.tsx
function MyApp({ Component, pageProps }: AppProps) {
  // Get user ID from your auth system
  const userId = getUserId(); // Your auth logic here

  return (
    <ExperimentProvider
      apiUrl={process.env.NEXT_PUBLIC_API_URL!}
      apiKey={process.env.NEXT_PUBLIC_API_KEY!}
      userId={userId}
      cacheEnabled={true}
    >
      <Component {...pageProps} />
    </ExperimentProvider>
  );
}

// Helper to get user ID (implement your own logic)
function getUserId(): string {
  // Example: Get from cookie, session, or auth context
  if (typeof window !== 'undefined') {
    return localStorage.getItem('userId') || 'anonymous';
  }
  return 'anonymous';
}

// pages/index.tsx
export default function HomePage() {
  const { variantKey, loading } = useAssignment('homepage-test', {
    autoTrackExposure: true,
  });

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div>
      <h1>Home Page</h1>
      {variantKey === 'treatment' ? (
        <NewHeroSection />
      ) : (
        <OldHeroSection />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-content" />
    </div>
  );
}

function NewHeroSection() {
  return (
    <section className="hero new">
      <h2>New Hero Design</h2>
      <p>Improved conversion rate with better CTAs</p>
      <button className="cta-button">Get Started</button>
    </section>
  );
}

function OldHeroSection() {
  return (
    <section className="hero old">
      <h2>Welcome</h2>
      <p>Original hero section</p>
      <button>Learn More</button>
    </section>
  );
}

// pages/api/example.ts (Server-side example)
import type { NextApiRequest, NextApiResponse } from 'next';

// Note: For server-side, you would use @experimeh/node SDK (coming soon)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Server-side experiment logic
  res.status(200).json({ message: 'Server-side experiments coming soon' });
}

// Example with getServerSideProps
export async function getServerSideProps(context: any) {
  // You can pre-fetch experiments here if needed
  return {
    props: {
      // Your props
    },
  };
}

export { MyApp };
