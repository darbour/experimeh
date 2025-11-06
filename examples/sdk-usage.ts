/**
 * Example SDK usage
 */

import { createClient, ExperimentClient } from '../src/index';

async function main() {
  // Create SDK client
  const client: ExperimentClient = createClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key-here',
    cacheEnabled: true,
    cacheTTL: 300, // 5 minutes
    batchSize: 100,
    flushInterval: 10000, // 10 seconds
  });

  // Initialize client
  await client.initialize();
  console.log('Client initialized');

  // Get assignment for a user
  const assignment = await client.getAssignment(
    'exp-homepage-redesign',
    'user-12345',
    {
      userAttributes: {
        country: 'US',
        isPremium: true,
      },
    }
  );

  console.log('Assignment:', {
    experimentId: assignment.experimentId,
    variantId: assignment.variantId,
    variantName: assignment.variantName,
    cached: assignment.cached,
  });

  // Track exposure
  if (assignment.assigned) {
    await client.trackExposure(
      assignment.experimentId,
      'user-12345',
      assignment.variantId
    );
    console.log('Exposure tracked');
  }

  // Track metrics
  await client.trackMetric(
    'exp-homepage-redesign',
    'user-12345',
    'page_load_time',
    234.5
  );
  console.log('Metric tracked');

  await client.trackMetric(
    'exp-homepage-redesign',
    'user-12345',
    'conversion',
    1
  );
  console.log('Conversion tracked');

  // Flush events immediately (optional - auto-flushes on interval)
  await client.flush();
  console.log('Events flushed');

  // Shutdown gracefully
  await client.shutdown();
  console.log('Client shutdown');
}

// Run example
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { main };
