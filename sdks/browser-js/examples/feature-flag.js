/**
 * Feature Flag Example
 * Demonstrates using the Browser SDK for feature flags
 */

import { ExperimentClient } from '@experimeh/browser';

const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  cacheEnabled: true,
});

/**
 * Check if a feature is enabled for a user
 */
async function isFeatureEnabled(featureKey, userId) {
  try {
    const assignment = await client.getAssignment(featureKey, userId);
    const enabled = assignment.variantKey === 'enabled';

    // Track exposure
    await client.trackExposure(featureKey, userId, assignment.variantKey);

    return enabled;
  } catch (error) {
    console.error(`Failed to check feature ${featureKey}:`, error);
    // Fail closed (feature disabled on error)
    return false;
  }
}

/**
 * Example usage
 */
async function main() {
  const userId = 'user-123';

  // Check dark mode feature
  if (await isFeatureEnabled('dark-mode', userId)) {
    document.body.classList.add('dark-mode');
    console.log('Dark mode enabled');
  }

  // Check beta features
  if (await isFeatureEnabled('beta-features', userId)) {
    showBetaFeatures();
    console.log('Beta features enabled');
  }

  // Check new checkout
  if (await isFeatureEnabled('new-checkout', userId)) {
    loadNewCheckout();
    console.log('New checkout enabled');
  } else {
    loadOldCheckout();
    console.log('Old checkout (control)');
  }
}

function showBetaFeatures() {
  // Show beta features
}

function loadNewCheckout() {
  // Load new checkout flow
}

function loadOldCheckout() {
  // Load old checkout flow
}

main();
