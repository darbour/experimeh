/**
 * Example 05: Feature Flags with Gradual Rollout
 *
 * This example demonstrates feature flag usage patterns including:
 * - Simple boolean flags
 * - Gradual percentage rollout
 * - Targeted rollout by user segments
 * - Kill switch functionality
 * - A/B testing with feature flags
 *
 * Use case: Rolling out a new payment method feature
 *
 * Run: npx ts-node examples/05-feature-flags.ts
 */

import { hashAssignment } from '../src/core/hash';

// ============================================================================
// Step 1: Define Feature Flags
// ============================================================================

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targetingRules: TargetingRule[];
  variants?: FlagVariant[];
}

interface TargetingRule {
  name: string;
  condition: (context: UserContext) => boolean;
  rolloutPercentage: number;
  priority: number; // Higher priority rules evaluated first
}

interface FlagVariant {
  key: string;
  value: any;
  weight: number; // 0-100
}

interface UserContext {
  userId: string;
  email?: string;
  country?: string;
  isPremium?: boolean;
  accountAge?: number; // days
  platform?: string;
}

console.log('='.repeat(80));
console.log('FEATURE FLAGS EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// Step 2: Feature Flag Examples
// ============================================================================

// Example 1: Simple Boolean Flag (with kill switch capability)
const newPaymentMethodFlag: FeatureFlag = {
  key: 'new_payment_method',
  name: 'New Payment Method',
  description: 'Apple Pay and Google Pay integration',
  enabled: true,
  rolloutPercentage: 100, // Will be controlled by targeting rules
  targetingRules: [],
};

// Example 2: Gradual Rollout Flag
const darkModeFlag: FeatureFlag = {
  key: 'dark_mode',
  name: 'Dark Mode UI',
  description: 'Dark theme for the application',
  enabled: true,
  rolloutPercentage: 25, // Roll out to 25% of users
  targetingRules: [],
};

// Example 3: Targeted Rollout Flag
const premiumFeaturesFlag: FeatureFlag = {
  key: 'premium_features_v2',
  name: 'Premium Features V2',
  description: 'New premium tier features',
  enabled: true,
  rolloutPercentage: 0, // Controlled entirely by targeting rules
  targetingRules: [
    {
      name: 'Premium Users',
      condition: (ctx) => ctx.isPremium === true,
      rolloutPercentage: 100,
      priority: 100,
    },
    {
      name: 'Long-term Users',
      condition: (ctx) => (ctx.accountAge || 0) > 365,
      rolloutPercentage: 50,
      priority: 50,
    },
  ],
};

// Example 4: Multivariate Flag (A/B/C test)
const recommendationAlgorithmFlag: FeatureFlag = {
  key: 'recommendation_algorithm',
  name: 'Recommendation Algorithm',
  description: 'Which recommendation algorithm to use',
  enabled: true,
  rolloutPercentage: 100,
  targetingRules: [],
  variants: [
    { key: 'baseline', value: 'collaborative_filtering', weight: 33 },
    { key: 'variant_a', value: 'content_based', weight: 33 },
    { key: 'variant_b', value: 'hybrid_ml', weight: 34 },
  ],
};

// Example 5: Geographic Rollout
const regionalFeatureFlag: FeatureFlag = {
  key: 'regional_payment_options',
  name: 'Regional Payment Options',
  description: 'Country-specific payment methods',
  enabled: true,
  rolloutPercentage: 0,
  targetingRules: [
    {
      name: 'US Users',
      condition: (ctx) => ctx.country === 'US',
      rolloutPercentage: 100,
      priority: 100,
    },
    {
      name: 'EU Users',
      condition: (ctx) => ['DE', 'FR', 'GB', 'ES', 'IT'].includes(ctx.country || ''),
      rolloutPercentage: 50,
      priority: 90,
    },
  ],
};

const flags: FeatureFlag[] = [
  newPaymentMethodFlag,
  darkModeFlag,
  premiumFeaturesFlag,
  recommendationAlgorithmFlag,
  regionalFeatureFlag,
];

console.log('\nConfigured Feature Flags:');
flags.forEach((flag, i) => {
  console.log(`\n${i + 1}. ${flag.name} (${flag.key})`);
  console.log(`   ${flag.description}`);
  console.log(`   Enabled: ${flag.enabled}`);
  console.log(`   Rollout: ${flag.rolloutPercentage}%`);
  if (flag.targetingRules.length > 0) {
    console.log(`   Targeting Rules: ${flag.targetingRules.length}`);
  }
  if (flag.variants) {
    console.log(`   Variants: ${flag.variants.length}`);
  }
});

// ============================================================================
// Step 3: Feature Flag Evaluation Logic
// ============================================================================

/**
 * Evaluate if a feature flag is enabled for a user
 */
function evaluateFlag(flag: FeatureFlag, context: UserContext): boolean {
  // Kill switch: if flag is disabled, return false immediately
  if (!flag.enabled) {
    return false;
  }

  // Check targeting rules (in priority order)
  const sortedRules = [...flag.targetingRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.condition(context)) {
      // Rule matched, check if user is in rollout percentage
      const hash = hashAssignment(context.userId, `${flag.key}_${rule.name}`);
      return hash * 100 < rule.rolloutPercentage;
    }
  }

  // No targeting rule matched, use default rollout percentage
  const hash = hashAssignment(context.userId, flag.key);
  return hash * 100 < flag.rolloutPercentage;
}

/**
 * Get variant for a multivariate flag
 */
function getFlagVariant(flag: FeatureFlag, context: UserContext): any {
  if (!flag.variants || flag.variants.length === 0) {
    return null;
  }

  if (!evaluateFlag(flag, context)) {
    return null;
  }

  // Assign to variant based on weights
  const hash = hashAssignment(context.userId, `${flag.key}_variant`);
  let cumulative = 0;

  for (const variant of flag.variants) {
    cumulative += variant.weight;
    if (hash * 100 < cumulative) {
      return variant.value;
    }
  }

  return flag.variants[0].value; // Fallback
}

// ============================================================================
// Step 4: Simulate Users and Flag Evaluations
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING FLAG EVALUATIONS');
console.log('='.repeat(80));

const countries = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'BR'];
const platforms = ['web', 'ios', 'android'];

// Generate test users
const users: UserContext[] = [];
for (let i = 0; i < 1000; i++) {
  users.push({
    userId: `user_${i}`,
    email: `user${i}@example.com`,
    country: countries[Math.floor(Math.random() * countries.length)],
    isPremium: Math.random() < 0.2, // 20% premium
    accountAge: Math.floor(Math.random() * 730), // 0-730 days
    platform: platforms[Math.floor(Math.random() * platforms.length)],
  });
}

console.log(`\nEvaluating flags for ${users.length} users...`);

// Evaluate each flag for each user
interface FlagEvaluation {
  flagKey: string;
  enabled: number;
  disabled: number;
  enablementRate: number;
  variantDistribution?: Record<string, number>;
}

const evaluations: FlagEvaluation[] = flags.map(flag => {
  let enabled = 0;
  let disabled = 0;
  const variantCounts: Record<string, number> = {};

  users.forEach(user => {
    const isEnabled = evaluateFlag(flag, user);

    if (isEnabled) {
      enabled++;

      // If multivariate, track variant distribution
      if (flag.variants) {
        const variant = getFlagVariant(flag, user);
        variantCounts[variant] = (variantCounts[variant] || 0) + 1;
      }
    } else {
      disabled++;
    }
  });

  return {
    flagKey: flag.key,
    enabled,
    disabled,
    enablementRate: (enabled / users.length) * 100,
    variantDistribution: flag.variants ? variantCounts : undefined,
  };
});

console.log('\nFlag Evaluation Results:');
console.log('-'.repeat(80));
evaluations.forEach(eval => {
  const flag = flags.find(f => f.key === eval.flagKey)!;
  console.log(`\n${flag.name}:`);
  console.log(`  Enabled: ${eval.enabled} users (${eval.enablementRate.toFixed(1)}%)`);
  console.log(`  Disabled: ${eval.disabled} users`);

  if (eval.variantDistribution) {
    console.log(`  Variant Distribution:`);
    Object.entries(eval.variantDistribution).forEach(([variant, count]) => {
      const pct = (count / eval.enabled) * 100;
      console.log(`    ${variant}: ${count} users (${pct.toFixed(1)}%)`);
    });
  }
});

// ============================================================================
// Step 5: Gradual Rollout Simulation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('GRADUAL ROLLOUT SIMULATION');
console.log('='.repeat(80));

console.log(`
Simulating gradual rollout of "${newPaymentMethodFlag.name}" over 7 days.
Starting at 5% and increasing to 100%.
`);

const rolloutSchedule = [
  { day: 1, percentage: 5 },
  { day: 2, percentage: 10 },
  { day: 3, percentage: 25 },
  { day: 4, percentage: 50 },
  { day: 5, percentage: 75 },
  { day: 6, percentage: 90 },
  { day: 7, percentage: 100 },
];

console.log('Rollout Schedule:');
console.log('Day | Rollout % | Enabled Users | New Users | Issues');
console.log('-'.repeat(70));

let previousEnabled = new Set<string>();

rolloutSchedule.forEach(stage => {
  // Update flag rollout percentage
  newPaymentMethodFlag.rolloutPercentage = stage.percentage;

  // Evaluate for all users
  const currentEnabled = new Set<string>();
  users.forEach(user => {
    if (evaluateFlag(newPaymentMethodFlag, user)) {
      currentEnabled.add(user.userId);
    }
  });

  // Calculate metrics
  const enabledCount = currentEnabled.size;
  const newUsers = [...currentEnabled].filter(id => !previousEnabled.has(id)).length;

  // Simulate issues (1% chance at each stage, higher early on)
  const issueRate = Math.max(0.001, 0.05 / stage.percentage);
  const hasIssue = Math.random() < issueRate;
  const issueText = hasIssue ? '⚠ Issue detected' : '✓ Stable';

  console.log(
    `${stage.day}   | ${stage.percentage.toString().padStart(5)}%   | ${enabledCount.toString().padStart(13)} | ${newUsers.toString().padStart(9)} | ${issueText}`
  );

  previousEnabled = currentEnabled;

  // Simulate rollback on issue
  if (hasIssue && stage.percentage < 100) {
    console.log(`     └─> Rolling back to ${Math.max(5, stage.percentage / 2)}%...`);
  }
});

// ============================================================================
// Step 6: Kill Switch Demonstration
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KILL SWITCH DEMONSTRATION');
console.log('='.repeat(80));

console.log(`
Kill switches allow immediately disabling a feature if critical issues arise.
No code deployment needed - just flip the flag to "enabled: false".
`);

// Before kill switch
const testUser: UserContext = {
  userId: 'user_500',
  country: 'US',
  isPremium: true,
  accountAge: 100,
  platform: 'web',
};

console.log('\nBefore Kill Switch:');
console.log(`  Flag enabled: ${newPaymentMethodFlag.enabled}`);
console.log(`  User access: ${evaluateFlag(newPaymentMethodFlag, testUser)}`);

// Activate kill switch
newPaymentMethodFlag.enabled = false;

console.log('\nAfter Kill Switch (enabled: false):');
console.log(`  Flag enabled: ${newPaymentMethodFlag.enabled}`);
console.log(`  User access: ${evaluateFlag(newPaymentMethodFlag, testUser)}`);
console.log('\n  ✓ Feature immediately disabled for ALL users');
console.log('  ✓ No code deployment required');
console.log('  ✓ Can re-enable once issue is fixed');

// ============================================================================
// Step 7: Targeting Rule Examples
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('TARGETING RULE EXAMPLES');
console.log('='.repeat(80));

// Re-enable flag for targeting examples
newPaymentMethodFlag.enabled = true;

const targetingExamples = [
  {
    name: 'VIP Users (Premium + Long-term)',
    context: { userId: 'user_vip', isPremium: true, accountAge: 500, country: 'US', platform: 'web' },
  },
  {
    name: 'New Free User',
    context: { userId: 'user_new', isPremium: false, accountAge: 5, country: 'US', platform: 'ios' },
  },
  {
    name: 'EU User',
    context: { userId: 'user_eu', isPremium: false, accountAge: 100, country: 'DE', platform: 'web' },
  },
  {
    name: 'Asian User',
    context: { userId: 'user_asia', isPremium: false, accountAge: 200, country: 'JP', platform: 'android' },
  },
];

console.log('\nFlag Access by User Segment:');
console.log('-'.repeat(80));
flags.forEach(flag => {
  console.log(`\n${flag.name}:`);
  targetingExamples.forEach(example => {
    const hasAccess = evaluateFlag(flag, example.context as UserContext);
    const symbol = hasAccess ? '✓' : '✗';
    console.log(`  ${symbol} ${example.name}: ${hasAccess}`);
  });
});

// ============================================================================
// Step 8: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Feature Flags');
console.log('='.repeat(80));

console.log(`
1. Types of Feature Flags:
   - Boolean flags: Simple on/off switches
   - Percentage rollout: Gradual exposure to increasing % of users
   - Targeted rollout: Rules-based access (premium, geography, etc.)
   - Multivariate flags: A/B/C testing with multiple variants
   - Kill switches: Emergency disable capability

2. Gradual Rollout Strategy:
   Day 1: 5% (early adopters, monitor closely)
   Day 2-3: 10-25% (watch for issues)
   Day 4: 50% (half of user base)
   Day 5-6: 75-90% (near full rollout)
   Day 7: 100% (complete rollout)

3. Targeting Rules:
   - Priority-based evaluation (highest priority first)
   - Can combine multiple conditions
   - Percentage within each segment
   - Examples: premium users, geography, account age, platform

4. Kill Switch Best Practices:
   - Always have ability to disable instantly
   - No code deployment required
   - Monitor metrics in real-time
   - Clear escalation process for issues
   - Document rollback procedures

5. A/B Testing with Flags:
   - Multivariate flags for experiments
   - Consistent assignment (same user = same variant)
   - Track variant exposure and outcomes
   - Can promote winning variant to 100%

6. Implementation Tips:
   - Use deterministic hashing for consistency
   - Cache flag evaluations (with TTL)
   - Log flag changes for audit trail
   - Separate flag data from code
   - Clean up old flags after full rollout

7. Monitoring:
   - Track enablement rates
   - Monitor error rates by flag
   - Alert on unexpected behavior
   - A/B test metrics in real-time
   - User feedback collection

8. Common Patterns:
   - Canary deployment: 5% → monitor → increase
   - Ring deployment: Internal → Beta → GA
   - Geographic rollout: Region by region
   - Segment rollout: Premium → Free
   - Percentage + targeting: Combine approaches
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  FeatureFlag,
  UserContext,
  evaluateFlag,
  getFlagVariant,
  flags,
  evaluations,
};
