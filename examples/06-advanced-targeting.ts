/**
 * Example 06: Advanced Targeting Rules
 *
 * This example demonstrates complex targeting logic for experiments and feature flags:
 * - Multiple condition types (AND, OR, NOT)
 * - Nested conditions
 * - Custom attribute matching
 * - Time-based targeting
 * - Version-based targeting
 * - Composite rules
 *
 * Use case: Complex eligibility criteria for experiment participation
 *
 * Run: npx ts-node examples/06-advanced-targeting.ts
 */

import { hashAssignment } from '../src/core/hash';

// ============================================================================
// Step 1: Define Targeting Rule System
// ============================================================================

interface UserContext {
  userId: string;
  email?: string;
  country?: string;
  region?: string;
  city?: string;
  isPremium?: boolean;
  accountAge?: number; // days
  platform?: string;
  appVersion?: string;
  deviceType?: string;
  language?: string;
  timeZone?: string;
  customAttributes?: Record<string, any>;
  timestamp?: Date;
}

type ConditionOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'matches' | 'exists' | 'not_exists';

type LogicalOperator = 'AND' | 'OR' | 'NOT';

interface SimpleCondition {
  type: 'simple';
  attribute: string;
  operator: ConditionOperator;
  value: any;
}

interface CompositeCondition {
  type: 'composite';
  operator: LogicalOperator;
  conditions: TargetingCondition[];
}

type TargetingCondition = SimpleCondition | CompositeCondition;

interface TargetingRule {
  name: string;
  description: string;
  condition: TargetingCondition;
}

console.log('='.repeat(80));
console.log('ADVANCED TARGETING RULES EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// Step 2: Targeting Rule Evaluator
// ============================================================================

/**
 * Evaluate a targeting condition against user context
 */
function evaluateCondition(condition: TargetingCondition, context: UserContext): boolean {
  if (condition.type === 'simple') {
    return evaluateSimpleCondition(condition, context);
  } else {
    return evaluateCompositeCondition(condition, context);
  }
}

/**
 * Evaluate simple conditions
 */
function evaluateSimpleCondition(condition: SimpleCondition, context: UserContext): boolean {
  // Get attribute value from context (supports nested attributes)
  const value = getAttributeValue(context, condition.attribute);

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;

    case 'not_equals':
      return value !== condition.value;

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);

    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);

    case 'gt':
      return typeof value === 'number' && value > condition.value;

    case 'gte':
      return typeof value === 'number' && value >= condition.value;

    case 'lt':
      return typeof value === 'number' && value < condition.value;

    case 'lte':
      return typeof value === 'number' && value <= condition.value;

    case 'contains':
      return typeof value === 'string' && value.includes(condition.value);

    case 'not_contains':
      return typeof value === 'string' && !value.includes(condition.value);

    case 'matches':
      return typeof value === 'string' && new RegExp(condition.value).test(value);

    case 'exists':
      return value !== undefined && value !== null;

    case 'not_exists':
      return value === undefined || value === null;

    default:
      return false;
  }
}

/**
 * Evaluate composite conditions (AND, OR, NOT)
 */
function evaluateCompositeCondition(condition: CompositeCondition, context: UserContext): boolean {
  switch (condition.operator) {
    case 'AND':
      return condition.conditions.every(c => evaluateCondition(c, context));

    case 'OR':
      return condition.conditions.some(c => evaluateCondition(c, context));

    case 'NOT':
      // NOT should have exactly one condition
      return !evaluateCondition(condition.conditions[0], context);

    default:
      return false;
  }
}

/**
 * Get attribute value from context (supports dot notation)
 */
function getAttributeValue(context: UserContext, attribute: string): any {
  const parts = attribute.split('.');
  let value: any = context;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

// ============================================================================
// Step 3: Example Targeting Rules
// ============================================================================

// Rule 1: Premium US Users
const premiumUSUsersRule: TargetingRule = {
  name: 'Premium US Users',
  description: 'Users with premium subscription in the United States',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      { type: 'simple', attribute: 'isPremium', operator: 'equals', value: true },
      { type: 'simple', attribute: 'country', operator: 'equals', value: 'US' },
    ],
  },
};

// Rule 2: Mobile Users in Major Markets
const mobileInMajorMarketsRule: TargetingRule = {
  name: 'Mobile Users in Major Markets',
  description: 'iOS or Android users in US, UK, or Canada',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      {
        type: 'simple',
        attribute: 'platform',
        operator: 'in',
        value: ['ios', 'android'],
      },
      {
        type: 'simple',
        attribute: 'country',
        operator: 'in',
        value: ['US', 'GB', 'CA'],
      },
    ],
  },
};

// Rule 3: Long-term Free Users (potential upsell candidates)
const longTermFreeUsersRule: TargetingRule = {
  name: 'Long-term Free Users',
  description: 'Free users with accounts older than 6 months',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      { type: 'simple', attribute: 'isPremium', operator: 'equals', value: false },
      { type: 'simple', attribute: 'accountAge', operator: 'gte', value: 180 },
    ],
  },
};

// Rule 4: Complex Nested Rule - High Value Segment
const highValueSegmentRule: TargetingRule = {
  name: 'High Value Segment',
  description: 'Premium users in tier 1 markets OR long-term engaged free users',
  condition: {
    type: 'composite',
    operator: 'OR',
    conditions: [
      // Branch 1: Premium in tier 1 markets
      {
        type: 'composite',
        operator: 'AND',
        conditions: [
          { type: 'simple', attribute: 'isPremium', operator: 'equals', value: true },
          {
            type: 'simple',
            attribute: 'country',
            operator: 'in',
            value: ['US', 'GB', 'DE', 'FR', 'CA', 'AU'],
          },
        ],
      },
      // Branch 2: Long-term engaged free users
      {
        type: 'composite',
        operator: 'AND',
        conditions: [
          { type: 'simple', attribute: 'isPremium', operator: 'equals', value: false },
          { type: 'simple', attribute: 'accountAge', operator: 'gte', value: 365 },
          { type: 'simple', attribute: 'customAttributes.sessionCount', operator: 'gte', value: 100 },
        ],
      },
    ],
  },
};

// Rule 5: Version-based Targeting
const modernAppVersionRule: TargetingRule = {
  name: 'Modern App Versions',
  description: 'Users on app version 2.0 or higher',
  condition: {
    type: 'simple',
    attribute: 'appVersion',
    operator: 'matches',
    value: '^[2-9]\\.|^[1-9][0-9]+\\.',
  },
};

// Rule 6: Time-based Targeting (Weekday Business Hours)
const businessHoursRule: TargetingRule = {
  name: 'Weekday Business Hours',
  description: 'Monday-Friday, 9 AM - 5 PM in user timezone',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      // This would need custom evaluation based on timestamp
      { type: 'simple', attribute: 'timestamp', operator: 'exists', value: true },
    ],
  },
};

// Rule 7: Exclusion Rule
const excludeTestAccountsRule: TargetingRule = {
  name: 'Exclude Test Accounts',
  description: 'Exclude internal test accounts',
  condition: {
    type: 'composite',
    operator: 'NOT',
    conditions: [
      {
        type: 'simple',
        attribute: 'email',
        operator: 'matches',
        value: '@(test|example|internal)\\.com$',
      },
    ],
  },
};

// Rule 8: Custom Attribute Rule
const powerUsersRule: TargetingRule = {
  name: 'Power Users',
  description: 'Users with high engagement metrics',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      { type: 'simple', attribute: 'customAttributes.sessionCount', operator: 'gte', value: 50 },
      { type: 'simple', attribute: 'customAttributes.avgSessionDuration', operator: 'gte', value: 300 },
      { type: 'simple', attribute: 'customAttributes.lastActiveDate', operator: 'exists', value: true },
    ],
  },
};

const rules: TargetingRule[] = [
  premiumUSUsersRule,
  mobileInMajorMarketsRule,
  longTermFreeUsersRule,
  highValueSegmentRule,
  modernAppVersionRule,
  businessHoursRule,
  excludeTestAccountsRule,
  powerUsersRule,
];

console.log('\nDefined Targeting Rules:');
rules.forEach((rule, i) => {
  console.log(`\n${i + 1}. ${rule.name}`);
  console.log(`   ${rule.description}`);
});

// ============================================================================
// Step 4: Generate Test Users
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('GENERATING TEST USERS');
console.log('='.repeat(80));

const testUsers: UserContext[] = [
  {
    userId: 'user_1',
    email: 'premium.us@example.com',
    country: 'US',
    isPremium: true,
    accountAge: 400,
    platform: 'web',
    appVersion: '2.5.0',
    customAttributes: { sessionCount: 150, avgSessionDuration: 450 },
  },
  {
    userId: 'user_2',
    email: 'free.uk@example.com',
    country: 'GB',
    isPremium: false,
    accountAge: 500,
    platform: 'ios',
    appVersion: '3.1.0',
    customAttributes: { sessionCount: 120, avgSessionDuration: 380 },
  },
  {
    userId: 'user_3',
    email: 'new.user@example.com',
    country: 'US',
    isPremium: false,
    accountAge: 30,
    platform: 'android',
    appVersion: '2.0.1',
    customAttributes: { sessionCount: 5, avgSessionDuration: 120 },
  },
  {
    userId: 'user_4',
    email: 'test.account@test.com',
    country: 'US',
    isPremium: true,
    accountAge: 1000,
    platform: 'web',
    appVersion: '3.0.0',
    customAttributes: { sessionCount: 500, avgSessionDuration: 600 },
  },
  {
    userId: 'user_5',
    email: 'premium.de@example.com',
    country: 'DE',
    isPremium: true,
    accountAge: 200,
    platform: 'web',
    appVersion: '1.9.5',
    customAttributes: { sessionCount: 80, avgSessionDuration: 350 },
  },
  {
    userId: 'user_6',
    email: 'mobile.ca@example.com',
    country: 'CA',
    isPremium: false,
    accountAge: 100,
    platform: 'android',
    appVersion: '2.8.0',
    customAttributes: { sessionCount: 40, avgSessionDuration: 200 },
  },
];

console.log(`\nGenerated ${testUsers.length} test users with varying attributes`);

// ============================================================================
// Step 5: Evaluate Rules Against Users
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RULE EVALUATION RESULTS');
console.log('='.repeat(80));

interface EvaluationResult {
  user: UserContext;
  ruleResults: { rule: string; matched: boolean }[];
  matchCount: number;
}

const evaluationResults: EvaluationResult[] = testUsers.map(user => {
  const ruleResults = rules.map(rule => ({
    rule: rule.name,
    matched: evaluateCondition(rule.condition, user),
  }));

  return {
    user,
    ruleResults,
    matchCount: ruleResults.filter(r => r.matched).length,
  };
});

// Display results in a matrix
console.log('\nUser-Rule Match Matrix:');
console.log('(✓ = matched, ✗ = not matched)\n');

// Header
const header = 'User'.padEnd(25) + ' | ' + rules.map((_, i) => `R${i + 1}`).join(' | ');
console.log(header);
console.log('-'.repeat(header.length));

// Rows
evaluationResults.forEach(result => {
  const userLabel = result.user.email?.substring(0, 23).padEnd(25);
  const matches = result.ruleResults.map(r => r.matched ? '✓' : '✗').join(' | ');
  const matchSummary = `(${result.matchCount}/${rules.length})`;

  console.log(`${userLabel} | ${matches} ${matchSummary}`);
});

// Legend
console.log('\nLegend:');
rules.forEach((rule, i) => {
  console.log(`  R${i + 1}: ${rule.name}`);
});

// ============================================================================
// Step 6: Rule Performance Analysis
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RULE PERFORMANCE ANALYSIS');
console.log('='.repeat(80));

const ruleStats = rules.map((rule, i) => {
  const matches = evaluationResults.filter(r => r.ruleResults[i].matched).length;
  const matchRate = (matches / testUsers.length) * 100;

  return {
    rule: rule.name,
    matches,
    total: testUsers.length,
    matchRate,
  };
});

console.log('\nRule Match Rates:');
console.log('-'.repeat(60));
console.log('Rule'.padEnd(35) + ' | Matches | Rate');
console.log('-'.repeat(60));

ruleStats.forEach(stat => {
  const ruleLabel = stat.rule.padEnd(35);
  const matchLabel = `${stat.matches}/${stat.total}`.padStart(7);
  const rateLabel = `${stat.matchRate.toFixed(1)}%`;

  console.log(`${ruleLabel} | ${matchLabel} | ${rateLabel}`);
});

// ============================================================================
// Step 7: Combining Rules for Experiment Eligibility
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT ELIGIBILITY - COMBINED RULES');
console.log('='.repeat(80));

// Define experiment with multiple targeting criteria
const experimentEligibility: TargetingRule = {
  name: 'Feature X Experiment Eligibility',
  description: 'Complex eligibility for experimental feature',
  condition: {
    type: 'composite',
    operator: 'AND',
    conditions: [
      // Must be a non-test account
      excludeTestAccountsRule.condition,
      // Must be using modern app version
      modernAppVersionRule.condition,
      // Must be either premium OR high engagement
      {
        type: 'composite',
        operator: 'OR',
        conditions: [
          { type: 'simple', attribute: 'isPremium', operator: 'equals', value: true },
          {
            type: 'composite',
            operator: 'AND',
            conditions: [
              { type: 'simple', attribute: 'customAttributes.sessionCount', operator: 'gte', value: 50 },
              { type: 'simple', attribute: 'accountAge', operator: 'gte', value: 90 },
            ],
          },
        ],
      },
    ],
  },
};

console.log(`\nExperiment: ${experimentEligibility.name}`);
console.log(`Description: ${experimentEligibility.description}\n`);
console.log('Eligibility Criteria:');
console.log('  1. Not a test account');
console.log('  2. Using app version 2.0+');
console.log('  3. Either:');
console.log('     a) Premium subscriber, OR');
console.log('     b) Free user with 50+ sessions AND 90+ days account age');

console.log('\nEligibility Results:');
console.log('-'.repeat(60));

let eligibleCount = 0;
testUsers.forEach(user => {
  const isEligible = evaluateCondition(experimentEligibility.condition, user);
  if (isEligible) eligibleCount++;

  const symbol = isEligible ? '✓' : '✗';
  console.log(`${symbol} ${user.email?.padEnd(30)} ${isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
});

console.log(`\nTotal Eligible: ${eligibleCount}/${testUsers.length} (${((eligibleCount / testUsers.length) * 100).toFixed(1)}%)`);

// ============================================================================
// Step 8: Performance Considerations
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PERFORMANCE CONSIDERATIONS');
console.log('='.repeat(80));

console.log(`
1. Rule Complexity:
   - Simple conditions are fastest (single attribute check)
   - Composite conditions have overhead (multiple evaluations)
   - Deep nesting increases evaluation time
   - Consider caching frequently evaluated rules

2. Evaluation Order:
   - Place most selective conditions first in AND operations
   - Place most likely conditions first in OR operations
   - This enables short-circuit evaluation

3. Attribute Access:
   - Direct attribute access is fastest
   - Nested attributes (dot notation) have overhead
   - Custom attributes may require additional lookups

4. Best Practices:
   - Keep rules as simple as possible
   - Cache rule evaluation results with TTL
   - Pre-compute complex conditions when possible
   - Monitor rule evaluation performance
   - Use indexes for frequently queried attributes

5. Scale Considerations:
   - Evaluate rules on client side when possible
   - Pre-filter users by simple criteria before complex rules
   - Consider bloom filters for large-scale inclusion checks
   - Batch rule evaluations when processing many users
`);

// ============================================================================
// Step 9: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Advanced Targeting');
console.log('='.repeat(80));

console.log(`
1. Condition Types:
   - Simple: Single attribute comparison
   - Composite: Combine multiple conditions with AND/OR/NOT
   - Nested: Build complex logic trees

2. Common Operators:
   - Equality: equals, not_equals
   - Set: in, not_in
   - Numeric: gt, gte, lt, lte
   - String: contains, not_contains, matches (regex)
   - Existence: exists, not_exists

3. Use Cases:
   - Geographic targeting (country, region, city)
   - User segment targeting (premium, account age, engagement)
   - Platform/device targeting (iOS, Android, web)
   - Version targeting (app version, API version)
   - Time-based targeting (day of week, time of day)
   - Behavioral targeting (session count, purchase history)

4. Rule Design Principles:
   - Start simple, add complexity only when needed
   - Test rules with representative user sets
   - Document business logic clearly
   - Version control rule definitions
   - Monitor rule match rates

5. Experiment Eligibility:
   - Combine multiple criteria for precise targeting
   - Exclude test/internal accounts
   - Ensure minimum viable audience size
   - Balance precision vs. reach

6. Debugging:
   - Log rule evaluation steps
   - Test with known user scenarios
   - Visualize rule logic (decision trees)
   - A/B test rule changes themselves

7. Maintenance:
   - Regular audit of active rules
   - Remove obsolete rules
   - Consolidate duplicate logic
   - Keep rule library organized

8. Advanced Patterns:
   - Allowlist/Blocklist combinations
   - Progressive rollout with segments
   - Risk-based targeting (new vs. established users)
   - Cohort analysis rules
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  UserContext,
  TargetingRule,
  TargetingCondition,
  evaluateCondition,
  rules,
  testUsers,
  evaluationResults,
};
