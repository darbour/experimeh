/**
 * Example 09: Guardrail Metrics
 *
 * This example demonstrates guardrail metrics - metrics that protect
 * against unintended negative consequences of experiments.
 *
 * Guardrails help you:
 * - Catch regressions in critical metrics
 * - Prevent shipping harmful changes
 * - Balance trade-offs between metrics
 * - Automate experiment health monitoring
 *
 * Use case: Testing aggressive growth tactics while protecting user experience
 *
 * Run: npx ts-node examples/09-guardrail-metrics.ts
 */

import { proportionTest, tTest } from '../src/analysis/statistical-tests';

console.log('='.repeat(80));
console.log('GUARDRAIL METRICS EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// Step 1: Define Experiment with Guardrails
// ============================================================================

interface Experiment {
  id: string;
  name: string;
  description: string;
  primaryMetric: string;
  guardrailMetrics: GuardrailMetric[];
}

interface GuardrailMetric {
  name: string;
  type: 'proportion' | 'continuous';
  direction: 'increase' | 'decrease' | 'flat';
  description: string;
  threshold?: number; // Maximum acceptable degradation
  critical: boolean; // If true, must pass to ship
}

const experiment: Experiment = {
  id: 'email-notification-frequency',
  name: 'Increase Email Notification Frequency',
  description: 'Send 2× more product recommendation emails to drive engagement',
  primaryMetric: 'Click-through rate on emails',
  guardrailMetrics: [
    {
      name: 'Unsubscribe Rate',
      type: 'proportion',
      direction: 'flat',
      description: 'Users unsubscribing from emails',
      threshold: 0.001, // Max +0.1% absolute increase allowed
      critical: true,
    },
    {
      name: 'App Retention (7-day)',
      type: 'proportion',
      direction: 'flat',
      description: 'Users returning after 7 days',
      threshold: -0.02, // Max 2% relative decrease allowed
      critical: true,
    },
    {
      name: 'Session Duration',
      type: 'continuous',
      direction: 'flat',
      description: 'Average session length in minutes',
      threshold: -2, // Max 2 minute decrease allowed
      critical: false,
    },
    {
      name: 'Customer Support Tickets',
      type: 'continuous',
      direction: 'flat',
      description: 'Support tickets per user',
      threshold: 0.05, // Max 0.05 tickets per user increase
      critical: false,
    },
    {
      name: 'Revenue per User',
      type: 'continuous',
      direction: 'flat',
      description: 'Average revenue per user',
      threshold: -1, // Max $1 decrease allowed
      critical: true,
    },
  ],
};

console.log(`\nExperiment: ${experiment.name}`);
console.log(`Description: ${experiment.description}`);
console.log(`Primary Metric: ${experiment.primaryMetric}`);
console.log(`\nGuardrail Metrics (${experiment.guardrailMetrics.length}):`);

experiment.guardrailMetrics.forEach((metric, i) => {
  const criticalLabel = metric.critical ? ' [CRITICAL]' : '';
  console.log(`  ${i + 1}. ${metric.name}${criticalLabel}`);
  console.log(`     ${metric.description}`);
  console.log(`     Expected: ${metric.direction}, Threshold: ${metric.threshold}`);
});

// ============================================================================
// Step 2: Simulate Experiment Results
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING EXPERIMENT RESULTS');
console.log('='.repeat(80));

interface UserMetrics {
  userId: string;
  variant: string;
  clickedEmail: boolean;
  unsubscribed: boolean;
  retained7day: boolean;
  sessionDuration: number;
  supportTickets: number;
  revenue: number;
}

const numUsers = 10000;
const users: UserMetrics[] = [];

console.log(`\nSimulating ${numUsers.toLocaleString()} users...`);

for (let i = 0; i < numUsers; i++) {
  const variant = i < numUsers / 2 ? 'control' : 'treatment';

  // Control rates/values
  let emailClickRate = 0.12;
  let unsubscribeRate = 0.005;
  let retention7dayRate = 0.65;
  let avgSessionDuration = 18;
  let avgSupportTickets = 0.08;
  let avgRevenue = 25;

  // Treatment effects
  if (variant === 'treatment') {
    // Primary metric improves (goal)
    emailClickRate = 0.15; // +25% relative improvement

    // Guardrail violations:
    unsubscribeRate = 0.008; // +0.003 absolute (60% increase) - VIOLATES threshold!
    retention7dayRate = 0.63; // -0.02 absolute (3% decrease) - AT threshold
    avgSessionDuration = 16.5; // -1.5 minutes - Within threshold
    avgSupportTickets = 0.11; // +0.03 increase - Within threshold
    avgRevenue = 24.5; // -$0.50 - Within threshold
  }

  // Simulate individual user metrics
  const clickedEmail = Math.random() < emailClickRate;
  const unsubscribed = Math.random() < unsubscribeRate;
  const retained7day = Math.random() < retention7dayRate;
  const sessionDuration = Math.max(1, avgSessionDuration + (Math.random() - 0.5) * 10);
  const supportTickets = Math.random() < avgSupportTickets ? 1 : 0;
  const revenue = Math.max(0, avgRevenue + (Math.random() - 0.5) * 30);

  users.push({
    userId: `user_${i}`,
    variant,
    clickedEmail,
    unsubscribed,
    retained7day,
    sessionDuration,
    supportTickets,
    revenue,
  });
}

const controlUsers = users.filter(u => u.variant === 'control');
const treatmentUsers = users.filter(u => u.variant === 'treatment');

console.log(`Control: ${controlUsers.length.toLocaleString()} users`);
console.log(`Treatment: ${treatmentUsers.length.toLocaleString()} users`);

// ============================================================================
// Step 3: Analyze Primary Metric
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PRIMARY METRIC ANALYSIS');
console.log('='.repeat(80));

const controlClicks = controlUsers.filter(u => u.clickedEmail).length;
const treatmentClicks = treatmentUsers.filter(u => u.clickedEmail).length;

const primaryTest = proportionTest(
  { successes: controlClicks, total: controlUsers.length },
  { successes: treatmentClicks, total: treatmentUsers.length },
  0.05
);

console.log(`\nMetric: ${experiment.primaryMetric}`);
console.log(`  Control: ${(primaryTest.rate1 * 100).toFixed(2)}%`);
console.log(`  Treatment: ${(primaryTest.rate2 * 100).toFixed(2)}%`);
console.log(`  Absolute Difference: ${((primaryTest.rate2 - primaryTest.rate1) * 100).toFixed(2)}%`);
console.log(`  Relative Lift: ${(((primaryTest.rate2 - primaryTest.rate1) / primaryTest.rate1) * 100).toFixed(1)}%`);
console.log(`  P-value: ${primaryTest.pValue.toFixed(6)}`);
console.log(`  Significant: ${primaryTest.significant ? 'YES ✓' : 'NO ✗'}`);

if (primaryTest.significant && primaryTest.rate2 > primaryTest.rate1) {
  console.log(`\n✓ Primary metric shows significant improvement!`);
} else {
  console.log(`\n✗ Primary metric did not improve significantly.`);
}

// ============================================================================
// Step 4: Analyze Guardrail Metrics
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('GUARDRAIL METRICS ANALYSIS');
console.log('='.repeat(80));

interface GuardrailResult {
  metric: GuardrailMetric;
  controlValue: number;
  treatmentValue: number;
  difference: number;
  relativeDifference: number;
  pValue: number;
  significant: boolean;
  violatesThreshold: boolean;
  critical: boolean;
  status: 'PASS' | 'WARNING' | 'FAIL';
}

const guardrailResults: GuardrailResult[] = [];

// 1. Unsubscribe Rate
const controlUnsubs = controlUsers.filter(u => u.unsubscribed).length;
const treatmentUnsubs = treatmentUsers.filter(u => u.unsubscribed).length;
const unsubTest = proportionTest(
  { successes: controlUnsubs, total: controlUsers.length },
  { successes: treatmentUnsubs, total: treatmentUsers.length },
  0.05
);

const unsubDiff = unsubTest.rate2 - unsubTest.rate1;
const unsubViolation = unsubDiff > (experiment.guardrailMetrics[0].threshold || 0);

guardrailResults.push({
  metric: experiment.guardrailMetrics[0],
  controlValue: unsubTest.rate1 * 100,
  treatmentValue: unsubTest.rate2 * 100,
  difference: unsubDiff * 100,
  relativeDifference: (unsubDiff / unsubTest.rate1) * 100,
  pValue: unsubTest.pValue,
  significant: unsubTest.significant,
  violatesThreshold: unsubViolation,
  critical: experiment.guardrailMetrics[0].critical,
  status: unsubViolation ? 'FAIL' : (unsubTest.significant ? 'WARNING' : 'PASS'),
});

// 2. App Retention
const controlRetained = controlUsers.filter(u => u.retained7day).length;
const treatmentRetained = treatmentUsers.filter(u => u.retained7day).length;
const retentionTest = proportionTest(
  { successes: controlRetained, total: controlUsers.length },
  { successes: treatmentRetained, total: treatmentUsers.length },
  0.05
);

const retentionRelativeDiff = ((retentionTest.rate2 - retentionTest.rate1) / retentionTest.rate1);
const retentionViolation = retentionRelativeDiff < (experiment.guardrailMetrics[1].threshold || 0);

guardrailResults.push({
  metric: experiment.guardrailMetrics[1],
  controlValue: retentionTest.rate1 * 100,
  treatmentValue: retentionTest.rate2 * 100,
  difference: (retentionTest.rate2 - retentionTest.rate1) * 100,
  relativeDifference: retentionRelativeDiff * 100,
  pValue: retentionTest.pValue,
  significant: retentionTest.significant,
  violatesThreshold: retentionViolation,
  critical: experiment.guardrailMetrics[1].critical,
  status: retentionViolation ? 'FAIL' : (retentionTest.significant && retentionTest.rate2 < retentionTest.rate1 ? 'WARNING' : 'PASS'),
});

// 3. Session Duration
const controlDurations = controlUsers.map(u => u.sessionDuration);
const treatmentDurations = treatmentUsers.map(u => u.sessionDuration);
const durationTest = tTest(controlDurations, treatmentDurations, 0.05);

const durationDiff = durationTest.mean2 - durationTest.mean1;
const durationViolation = durationDiff < (experiment.guardrailMetrics[2].threshold || 0);

guardrailResults.push({
  metric: experiment.guardrailMetrics[2],
  controlValue: durationTest.mean1,
  treatmentValue: durationTest.mean2,
  difference: durationDiff,
  relativeDifference: (durationDiff / durationTest.mean1) * 100,
  pValue: durationTest.pValue,
  significant: durationTest.significant,
  violatesThreshold: durationViolation,
  critical: experiment.guardrailMetrics[2].critical,
  status: durationViolation ? (experiment.guardrailMetrics[2].critical ? 'FAIL' : 'WARNING') : 'PASS',
});

// 4. Support Tickets
const controlTickets = controlUsers.map(u => u.supportTickets);
const treatmentTickets = treatmentUsers.map(u => u.supportTickets);
const ticketTest = tTest(controlTickets, treatmentTickets, 0.05);

const ticketDiff = ticketTest.mean2 - ticketTest.mean1;
const ticketViolation = ticketDiff > (experiment.guardrailMetrics[3].threshold || 0);

guardrailResults.push({
  metric: experiment.guardrailMetrics[3],
  controlValue: ticketTest.mean1,
  treatmentValue: ticketTest.mean2,
  difference: ticketDiff,
  relativeDifference: (ticketDiff / ticketTest.mean1) * 100,
  pValue: ticketTest.pValue,
  significant: ticketTest.significant,
  violatesThreshold: ticketViolation,
  critical: experiment.guardrailMetrics[3].critical,
  status: ticketViolation ? (experiment.guardrailMetrics[3].critical ? 'FAIL' : 'WARNING') : 'PASS',
});

// 5. Revenue per User
const controlRevenues = controlUsers.map(u => u.revenue);
const treatmentRevenues = treatmentUsers.map(u => u.revenue);
const revenueTest = tTest(controlRevenues, treatmentRevenues, 0.05);

const revenueDiff = revenueTest.mean2 - revenueTest.mean1;
const revenueViolation = revenueDiff < (experiment.guardrailMetrics[4].threshold || 0);

guardrailResults.push({
  metric: experiment.guardrailMetrics[4],
  controlValue: revenueTest.mean1,
  treatmentValue: revenueTest.mean2,
  difference: revenueDiff,
  relativeDifference: (revenueDiff / revenueTest.mean1) * 100,
  pValue: revenueTest.pValue,
  significant: revenueTest.significant,
  violatesThreshold: revenueViolation,
  critical: experiment.guardrailMetrics[4].critical,
  status: revenueViolation ? 'FAIL' : (revenueTest.significant && revenueDiff < 0 ? 'WARNING' : 'PASS'),
});

// Display results
console.log('\nGuardrail Results:');
console.log('='.repeat(80));

guardrailResults.forEach((result, i) => {
  const statusSymbol = result.status === 'PASS' ? '✓' :
                       result.status === 'WARNING' ? '⚠' : '✗';
  const criticalLabel = result.critical ? ' [CRITICAL]' : '';

  console.log(`\n${i + 1}. ${result.metric.name}${criticalLabel} ${statusSymbol} ${result.status}`);

  if (result.metric.type === 'proportion') {
    console.log(`   Control: ${result.controlValue.toFixed(3)}%`);
    console.log(`   Treatment: ${result.treatmentValue.toFixed(3)}%`);
    console.log(`   Difference: ${result.difference >= 0 ? '+' : ''}${result.difference.toFixed(3)}%`);
  } else {
    console.log(`   Control: ${result.controlValue.toFixed(2)}`);
    console.log(`   Treatment: ${result.treatmentValue.toFixed(2)}`);
    console.log(`   Difference: ${result.difference >= 0 ? '+' : ''}${result.difference.toFixed(2)}`);
  }

  console.log(`   Relative: ${result.relativeDifference >= 0 ? '+' : ''}${result.relativeDifference.toFixed(1)}%`);
  console.log(`   P-value: ${result.pValue.toFixed(6)}`);
  console.log(`   Threshold: ${result.metric.threshold}`);

  if (result.violatesThreshold) {
    console.log(`   ⚠ VIOLATION: Exceeds threshold!`);
  }
});

// ============================================================================
// Step 5: Overall Decision
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT DECISION');
console.log('='.repeat(80));

const criticalFailures = guardrailResults.filter(r => r.critical && r.status === 'FAIL');
const criticalWarnings = guardrailResults.filter(r => r.critical && r.status === 'WARNING');
const nonCriticalIssues = guardrailResults.filter(r => !r.critical && r.status !== 'PASS');

console.log('\nSummary:');
console.log(`  Primary Metric: ${primaryTest.significant && primaryTest.rate2 > primaryTest.rate1 ? '✓ Improved' : '✗ No improvement'}`);
console.log(`  Critical Guardrail Failures: ${criticalFailures.length}`);
console.log(`  Critical Guardrail Warnings: ${criticalWarnings.length}`);
console.log(`  Non-Critical Issues: ${nonCriticalIssues.length}`);

console.log('\nDecision Logic:');

if (criticalFailures.length > 0) {
  console.log('\n✗ DO NOT SHIP');
  console.log('\nReason: Critical guardrail violations detected:');
  criticalFailures.forEach(failure => {
    console.log(`  - ${failure.metric.name}: ${failure.difference >= 0 ? '+' : ''}${failure.difference.toFixed(2)} (threshold: ${failure.metric.threshold})`);
  });
  console.log('\nRecommendations:');
  console.log('  1. Investigate root cause of guardrail violations');
  console.log('  2. Consider less aggressive variant');
  console.log('  3. Add protections (e.g., frequency caps)');
  console.log('  4. Re-test with modified approach');
} else if (criticalWarnings.length > 0) {
  console.log('\n⚠ CAUTION - REQUIRE SIGN-OFF');
  console.log('\nReason: Critical metrics showing negative trends:');
  criticalWarnings.forEach(warning => {
    console.log(`  - ${warning.metric.name}: ${warning.difference >= 0 ? '+' : ''}${warning.difference.toFixed(2)}`);
  });
  console.log('\nRecommendations:');
  console.log('  1. Conduct deeper analysis of affected users');
  console.log('  2. Evaluate trade-offs: Is primary gain worth the cost?');
  console.log('  3. Consider gradual rollout with monitoring');
  console.log('  4. Get approval from leadership before shipping');
} else if (nonCriticalIssues.length > 0) {
  console.log('\n✓ SHIP WITH MONITORING');
  console.log('\nNon-critical metrics show some degradation but within acceptable bounds.');
  console.log('\nRecommendations:');
  console.log('  1. Ship to production');
  console.log('  2. Monitor non-critical metrics closely');
  console.log('  3. Set up alerts for continued degradation');
  console.log('  4. Plan iteration to address secondary issues');
} else {
  console.log('\n✓ SHIP IT!');
  console.log('\nAll guardrails passed. Primary metric improved with no significant negative effects.');
}

// ============================================================================
// Step 6: Automated Alerting
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('AUTOMATED ALERTING SYSTEM');
console.log('='.repeat(80));

console.log(`
Guardrail metrics should trigger automated alerts:

ALERT LEVELS:

1. INFO (Green):
   - All guardrails passing
   - No action needed
   - Send summary email

2. WARNING (Yellow):
   - Non-critical guardrail violations
   - Significant changes in critical metrics (but within threshold)
   - Notify experiment owner
   - Schedule review meeting

3. CRITICAL (Red):
   - Critical guardrail violations
   - Send immediate alert to team
   - Trigger kill switch consideration
   - Escalate to leadership

ALERT CONFIGURATION:
`);

interface AlertRule {
  metric: string;
  condition: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  action: string;
}

const alertRules: AlertRule[] = [
  {
    metric: 'Unsubscribe Rate',
    condition: 'Increase > 0.1%',
    level: 'CRITICAL',
    action: 'Pause experiment, notify leadership',
  },
  {
    metric: 'App Retention',
    condition: 'Decrease > 2%',
    level: 'CRITICAL',
    action: 'Pause experiment, investigate immediately',
  },
  {
    metric: 'Revenue per User',
    condition: 'Decrease > $1',
    level: 'CRITICAL',
    action: 'Escalate to product & finance teams',
  },
  {
    metric: 'Session Duration',
    condition: 'Decrease > 2 min',
    level: 'WARNING',
    action: 'Monitor closely, analyze user segments',
  },
  {
    metric: 'Support Tickets',
    condition: 'Increase > 0.05 per user',
    level: 'WARNING',
    action: 'Notify support team, review tickets',
  },
];

console.log('\nAlert Rules:');
alertRules.forEach(rule => {
  console.log(`\n${rule.metric}:`);
  console.log(`  Condition: ${rule.condition}`);
  console.log(`  Level: ${rule.level}`);
  console.log(`  Action: ${rule.action}`);
});

// ============================================================================
// Step 7: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Guardrail Metrics');
console.log('='.repeat(80));

console.log(`
1. Why Guardrail Metrics?
   - Prevent shipping harmful changes
   - Catch unintended consequences early
   - Balance optimization with user experience
   - Enable faster experimentation with safety nets

2. Types of Guardrail Metrics:
   - User Experience: satisfaction, session time, bounce rate
   - Business Critical: revenue, retention, conversion
   - Operational: error rates, latency, cost
   - Ecosystem: partner metrics, platform health

3. Setting Guardrail Thresholds:
   - Absolute thresholds: Fixed acceptable change
   - Relative thresholds: Percentage change allowed
   - Context-dependent: Varies by metric importance
   - Conservative by default, loosen with data

4. Critical vs. Non-Critical:
   - Critical: Must pass to ship (hard gates)
   - Non-Critical: Monitor and investigate (soft gates)
   - Document rationale for each classification
   - Review classification periodically

5. Decision Framework:
   - Primary improves + all guardrails pass = Ship it!
   - Primary improves + critical violation = Do not ship
   - Primary improves + non-critical issues = Ship with monitoring
   - Primary flat + guardrails pass = Iterate
   - Primary regresses = Stop experiment

6. Common Guardrails by Domain:
   E-commerce:
     - Revenue per user
     - Purchase rate
     - Cart abandonment
   Content:
     - Session duration
     - Bounce rate
     - Return rate
   Social:
     - DAU/MAU
     - Content creation rate
     - Reports/blocks
   SaaS:
     - Free-to-paid conversion
     - Churn rate
     - Support tickets

7. Avoiding False Alarms:
   - Use appropriate statistical tests
   - Account for multiple comparisons
   - Set realistic thresholds based on variance
   - Trend over time, not single data points
   - Segment analysis for heterogeneous effects

8. Automation Best Practices:
   - Real-time monitoring dashboards
   - Automated alerts with clear escalation
   - Kill switch for critical violations
   - Post-experiment guardrail reports
   - Historical tracking of guardrail trends

9. Trade-off Analysis:
   - Quantify costs and benefits
   - Calculate "worth it" threshold
   - Consider long-term vs. short-term effects
   - Involve stakeholders in trade-off decisions
   - Document decision rationale

10. Continuous Improvement:
    - Review guardrail effectiveness quarterly
    - Add new guardrails as product evolves
    - Remove guardrails that never trigger
    - Update thresholds based on experience
    - Share learnings across organization
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  users,
  primaryTest,
  guardrailResults,
  criticalFailures,
};
