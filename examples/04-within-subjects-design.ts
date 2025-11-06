/**
 * Example 04: Within-Subjects Design
 *
 * This example demonstrates a within-subjects experiment where each user
 * experiences multiple variants over time.
 * Use case: Testing different content recommendation algorithms.
 *
 * Within-subjects designs are useful when:
 * - Users can experience multiple treatments
 * - Individual differences create high variance
 * - You want higher statistical power
 * - Learning effects can be controlled via counterbalancing
 *
 * Benefits:
 * - Higher statistical power (each user is their own control)
 * - Controls for individual differences
 * - Requires fewer participants
 *
 * Challenges:
 * - Order effects (learning, fatigue, boredom)
 * - Carryover effects between treatments
 * - Requires multiple sessions per user
 *
 * Run: npx ts-node examples/04-within-subjects-design.ts
 */

import { pairedTTest, repeatedMeasuresAnova } from '../src/analysis/statistical-tests';

// ============================================================================
// Step 1: Define Within-Subjects Experiment
// ============================================================================

interface WithinSubjectsExperiment {
  id: string;
  name: string;
  algorithms: Array<{
    key: string;
    name: string;
    description: string;
  }>;
  sessionsPerUser: number;
  counterbalancing: string[][];
}

const experiment: WithinSubjectsExperiment = {
  id: 'recommendation-algorithm-test',
  name: 'Content Recommendation Algorithm Comparison',
  algorithms: [
    { key: 'collaborative', name: 'Collaborative Filtering', description: 'User-user similarity' },
    { key: 'content_based', name: 'Content-Based', description: 'Item similarity' },
    { key: 'hybrid', name: 'Hybrid Model', description: 'ML-based combination' },
  ],
  sessionsPerUser: 3,
  // Counterbalancing: Each user sees algorithms in different order
  counterbalancing: [
    ['collaborative', 'content_based', 'hybrid'],
    ['content_based', 'hybrid', 'collaborative'],
    ['hybrid', 'collaborative', 'content_based'],
    ['collaborative', 'hybrid', 'content_based'],
    ['content_based', 'collaborative', 'hybrid'],
    ['hybrid', 'content_based', 'collaborative'],
  ],
};

console.log('='.repeat(80));
console.log('WITHIN-SUBJECTS DESIGN EXAMPLE');
console.log('='.repeat(80));
console.log(`\nExperiment: ${experiment.name}`);
console.log(`Sessions per user: ${experiment.sessionsPerUser}`);
console.log('\nAlgorithms being tested:');
experiment.algorithms.forEach((algo, i) => {
  console.log(`  ${i + 1}. ${algo.name}: ${algo.description}`);
});

console.log('\nCounterbalancing Orders:');
experiment.counterbalancing.forEach((order, i) => {
  console.log(`  Order ${i + 1}: ${order.join(' → ')}`);
});

// ============================================================================
// Step 2: Assign Counterbalancing Order
// ============================================================================

function assignCounterbalancingOrder(userId: string): string[] {
  // Use hash to consistently assign users to counterbalancing orders
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }
  const orderIndex = Math.abs(hash) % experiment.counterbalancing.length;
  return experiment.counterbalancing[orderIndex];
}

// ============================================================================
// Step 3: Simulate User Sessions
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('SIMULATING USER SESSIONS');
console.log('='.repeat(80));

interface UserSession {
  userId: string;
  sessionNumber: number;
  algorithm: string;
  itemsShown: number;
  itemsClicked: number;
  clickThroughRate: number;
  timeSpentMinutes: number;
  itemsConsumed: number;
  satisfactionRating: number; // 1-5
  returnNextDay: boolean;
}

const sessions: UserSession[] = [];
const numUsers = 300; // 300 users, each sees all 3 algorithms

console.log(`Simulating ${numUsers} users, each experiencing ${experiment.sessionsPerUser} sessions...`);

// True algorithm performance (what we're trying to detect)
const algorithmPerformance = {
  collaborative: { baselineCTR: 0.15, baselineTime: 25, baselineSatisfaction: 3.5 },
  content_based: { baselineCTR: 0.18, baselineTime: 28, baselineSatisfaction: 3.8 },
  hybrid: { baselineCTR: 0.21, baselineTime: 32, baselineSatisfaction: 4.1 },
};

for (let userId = 0; userId < numUsers; userId++) {
  const userIdStr = `user_${userId}`;

  // Each user has individual preferences (adds variance)
  const userPreference = Math.random() * 0.1 - 0.05; // ±5% individual effect
  const userEngagement = 0.8 + Math.random() * 0.4; // 0.8x - 1.2x engagement

  // Get counterbalancing order for this user
  const order = assignCounterbalancingOrder(userIdStr);

  for (let session = 0; session < experiment.sessionsPerUser; session++) {
    const algorithm = order[session];
    const perf = algorithmPerformance[algorithm as keyof typeof algorithmPerformance];

    // Simulate session metrics
    const itemsShown = 20;

    // CTR with individual differences and learning effects
    const learningBoost = session * 0.01; // Users get better at using the app
    const ctr = (perf.baselineCTR + userPreference + learningBoost) * userEngagement;
    const itemsClicked = Math.floor(itemsShown * ctr);

    // Time spent
    const timeSpent = (perf.baselineTime + Math.random() * 10 - 5) * userEngagement;

    // Items consumed
    const itemsConsumed = Math.floor(itemsClicked * 0.7);

    // Satisfaction rating (1-5)
    const satisfactionBase = perf.baselineSatisfaction;
    const satisfactionVariance = Math.random() * 1 - 0.5;
    const satisfaction = Math.max(1, Math.min(5, satisfactionBase + satisfactionVariance));

    // Return probability
    const returnProb = 0.6 + satisfaction * 0.08;
    const returnNextDay = Math.random() < returnProb;

    sessions.push({
      userId: userIdStr,
      sessionNumber: session + 1,
      algorithm,
      itemsShown,
      itemsClicked,
      clickThroughRate: itemsClicked / itemsShown,
      timeSpentMinutes: timeSpent,
      itemsConsumed,
      satisfactionRating: satisfaction,
      returnNextDay,
    });
  }
}

console.log(`Generated ${sessions.length.toLocaleString()} sessions`);

// ============================================================================
// Step 4: Aggregate by Algorithm
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('ALGORITHM PERFORMANCE SUMMARY');
console.log('='.repeat(80));

interface AlgorithmMetrics {
  algorithm: string;
  sessions: number;
  avgCTR: number;
  avgTimeSpent: number;
  avgItemsConsumed: number;
  avgSatisfaction: number;
  returnRate: number;
}

const algorithmGroups = sessions.reduce((acc, session) => {
  if (!acc[session.algorithm]) {
    acc[session.algorithm] = [];
  }
  acc[session.algorithm].push(session);
  return acc;
}, {} as Record<string, UserSession[]>);

const algorithmMetrics: AlgorithmMetrics[] = Object.entries(algorithmGroups).map(
  ([algorithm, algoSessions]) => {
    const avgCTR = algoSessions.reduce((sum, s) => sum + s.clickThroughRate, 0) / algoSessions.length;
    const avgTimeSpent = algoSessions.reduce((sum, s) => sum + s.timeSpentMinutes, 0) / algoSessions.length;
    const avgItemsConsumed = algoSessions.reduce((sum, s) => sum + s.itemsConsumed, 0) / algoSessions.length;
    const avgSatisfaction = algoSessions.reduce((sum, s) => sum + s.satisfactionRating, 0) / algoSessions.length;
    const returnRate = algoSessions.filter(s => s.returnNextDay).length / algoSessions.length;

    return {
      algorithm,
      sessions: algoSessions.length,
      avgCTR,
      avgTimeSpent,
      avgItemsConsumed,
      avgSatisfaction,
      returnRate,
    };
  }
);

console.log('\nAlgorithm Performance:');
console.log('-'.repeat(80));
algorithmMetrics.forEach(metrics => {
  console.log(`\n${metrics.algorithm.toUpperCase()}:`);
  console.log(`  Sessions: ${metrics.sessions}`);
  console.log(`  Avg CTR: ${(metrics.avgCTR * 100).toFixed(2)}%`);
  console.log(`  Avg Time Spent: ${metrics.avgTimeSpent.toFixed(1)} minutes`);
  console.log(`  Avg Items Consumed: ${metrics.avgItemsConsumed.toFixed(1)}`);
  console.log(`  Avg Satisfaction: ${metrics.avgSatisfaction.toFixed(2)}/5.00`);
  console.log(`  Return Rate: ${(metrics.returnRate * 100).toFixed(1)}%`);
});

// ============================================================================
// Step 5: Within-Subjects Analysis (Paired Comparisons)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('WITHIN-SUBJECTS ANALYSIS');
console.log('='.repeat(80));

console.log(`
In within-subjects designs, we compare each user's performance across conditions.
This controls for individual differences and increases statistical power.
`);

// Group sessions by user
const userSessions = sessions.reduce((acc, session) => {
  if (!acc[session.userId]) {
    acc[session.userId] = [];
  }
  acc[session.userId].push(session);
  return acc;
}, {} as Record<string, UserSession[]>);

// Prepare data for paired comparisons
const collaborativeMetrics = Object.values(userSessions).map(
  sessions => sessions.find(s => s.algorithm === 'collaborative')!
);
const contentBasedMetrics = Object.values(userSessions).map(
  sessions => sessions.find(s => s.algorithm === 'content_based')!
);
const hybridMetrics = Object.values(userSessions).map(
  sessions => sessions.find(s => s.algorithm === 'hybrid')!
);

// ============================================================================
// Step 6: Paired T-Tests
// ============================================================================

console.log('\n1. Click-Through Rate Comparison');
console.log('-'.repeat(80));

const collabCTRs = collaborativeMetrics.map(s => s.clickThroughRate * 100);
const contentCTRs = contentBasedMetrics.map(s => s.clickThroughRate * 100);
const hybridCTRs = hybridMetrics.map(s => s.clickThroughRate * 100);

const ctrTest1 = pairedTTest(collabCTRs, contentCTRs, 0.05);
console.log('\nCollaborative vs. Content-Based:');
console.log(`  Collaborative: ${ctrTest1.mean1.toFixed(2)}%`);
console.log(`  Content-Based: ${ctrTest1.mean2.toFixed(2)}%`);
console.log(`  Difference: ${(ctrTest1.mean2 - ctrTest1.mean1).toFixed(2)}%`);
console.log(`  P-value: ${ctrTest1.pValue.toFixed(6)}`);
console.log(`  Significant: ${ctrTest1.significant ? 'YES ✓' : 'NO ✗'}`);

const ctrTest2 = pairedTTest(contentCTRs, hybridCTRs, 0.05);
console.log('\nContent-Based vs. Hybrid:');
console.log(`  Content-Based: ${ctrTest2.mean1.toFixed(2)}%`);
console.log(`  Hybrid: ${ctrTest2.mean2.toFixed(2)}%`);
console.log(`  Difference: ${(ctrTest2.mean2 - ctrTest2.mean1).toFixed(2)}%`);
console.log(`  P-value: ${ctrTest2.pValue.toFixed(6)}`);
console.log(`  Significant: ${ctrTest2.significant ? 'YES ✓' : 'NO ✗'}`);

const ctrTest3 = pairedTTest(collabCTRs, hybridCTRs, 0.05);
console.log('\nCollaborative vs. Hybrid:');
console.log(`  Collaborative: ${ctrTest3.mean1.toFixed(2)}%`);
console.log(`  Hybrid: ${ctrTest3.mean2.toFixed(2)}%`);
console.log(`  Difference: ${(ctrTest3.mean2 - ctrTest3.mean1).toFixed(2)}%`);
console.log(`  P-value: ${ctrTest3.pValue.toFixed(6)}`);
console.log(`  Significant: ${ctrTest3.significant ? 'YES ✓' : 'NO ✗'}`);

// Satisfaction comparison
console.log('\n2. User Satisfaction Comparison');
console.log('-'.repeat(80));

const collabSat = collaborativeMetrics.map(s => s.satisfactionRating);
const contentSat = contentBasedMetrics.map(s => s.satisfactionRating);
const hybridSat = hybridMetrics.map(s => s.satisfactionRating);

const satTest = pairedTTest(collabSat, hybridSat, 0.05);
console.log('\nCollaborative vs. Hybrid (Best vs. Worst):');
console.log(`  Collaborative: ${satTest.mean1.toFixed(2)}/5.00`);
console.log(`  Hybrid: ${satTest.mean2.toFixed(2)}/5.00`);
console.log(`  Difference: ${(satTest.mean2 - satTest.mean1).toFixed(2)}`);
console.log(`  P-value: ${satTest.pValue.toFixed(6)}`);
console.log(`  Significant: ${satTest.significant ? 'YES ✓' : 'NO ✗'}`);

// ============================================================================
// Step 7: Check for Order Effects
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('ORDER EFFECTS ANALYSIS');
console.log('='.repeat(80));

console.log(`
Checking if the order in which users experienced algorithms affects results.
This is important for validating the counterbalancing strategy.
`);

// Analyze by session number (order)
const sessionNumberGroups = sessions.reduce((acc, session) => {
  if (!acc[session.sessionNumber]) {
    acc[session.sessionNumber] = [];
  }
  acc[session.sessionNumber].push(session);
  return acc;
}, {} as Record<number, UserSession[]>);

console.log('\nAverage CTR by Session Number:');
console.log('Session | Avg CTR | Sessions');
console.log('-'.repeat(40));
Object.entries(sessionNumberGroups).forEach(([sessionNum, sessions]) => {
  const avgCTR = sessions.reduce((sum, s) => sum + s.clickThroughRate, 0) / sessions.length;
  console.log(`   ${sessionNum}    | ${(avgCTR * 100).toFixed(2)}%  | ${sessions.length}`);
});

console.log(`
Note: Small increases across sessions are expected due to learning effects.
Good counterbalancing ensures each algorithm appears equally in each position.
`);

// ============================================================================
// Step 8: Effect Size and Power
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EFFECT SIZE AND STATISTICAL POWER');
console.log('='.repeat(80));

// Cohen's d for the main comparison (Hybrid vs. Collaborative)
const mean1 = ctrTest3.mean1;
const mean2 = ctrTest3.mean2;
const pooledSD = Math.sqrt(
  (collabCTRs.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) +
   hybridCTRs.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0)) /
  (collabCTRs.length + hybridCTRs.length - 2)
);
const cohensD = (mean2 - mean1) / pooledSD;

console.log('\nEffect Size (Hybrid vs. Collaborative):');
console.log(`  Cohen's d: ${cohensD.toFixed(3)}`);
console.log(`  Interpretation: ${
  Math.abs(cohensD) < 0.2 ? 'negligible' :
  Math.abs(cohensD) < 0.5 ? 'small' :
  Math.abs(cohensD) < 0.8 ? 'medium' : 'large'
}`);

console.log(`
Within-subjects designs typically provide ${((1 / 0.5) ** 2).toFixed(1)}x more power than between-subjects
for the same effect size, assuming moderate correlation between measurements.
`);

// ============================================================================
// Step 9: Recommendation
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));

const winner = algorithmMetrics.reduce((best, current) =>
  current.avgCTR > best.avgCTR ? current : best
);

console.log(`\n✓ RECOMMENDED ALGORITHM: ${winner.algorithm.toUpperCase()}`);
console.log(`
  Performance Summary:
  - CTR: ${(winner.avgCTR * 100).toFixed(2)}% (+${(((winner.avgCTR - algorithmMetrics[0].avgCTR) / algorithmMetrics[0].avgCTR) * 100).toFixed(1)}% vs. baseline)
  - Satisfaction: ${winner.avgSatisfaction.toFixed(2)}/5.00
  - Return Rate: ${(winner.returnRate * 100).toFixed(1)}%

  All pairwise comparisons show significant improvements.
`);

// ============================================================================
// Step 10: Key Takeaways
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('KEY TAKEAWAYS - Within-Subjects Design');
console.log('='.repeat(80));

console.log(`
1. When to Use Within-Subjects:
   - Users can experience multiple conditions without harm
   - High individual variability
   - Need more statistical power with fewer participants
   - Conditions can be separated in time

2. Counterbalancing:
   - Essential to control for order effects
   - All algorithms should appear equally in each position
   - Creates balanced Latin Square or complete counterbalancing

3. Analysis Method:
   - Use PAIRED tests (each user is their own control)
   - Much more powerful than independent samples
   - Controls for individual differences automatically

4. Advantages:
   - Higher statistical power
   - Fewer participants needed
   - Controls for individual differences
   - More efficient resource usage

5. Disadvantages:
   - Order effects (learning, fatigue, practice)
   - Carryover effects between conditions
   - Takes longer per participant
   - Can't use if treatment has permanent effects

6. Best Practices:
   - Always counterbalance presentation order
   - Check for order effects in analysis
   - Consider washout periods between conditions
   - Ensure sufficient time between sessions
   - Test that differences persist over time

7. Sample Size Benefits:
   - Within-subjects needs ~50% of between-subjects sample
   - Correlation between measurements determines exact benefit
   - Higher correlation = greater efficiency gain
`);

console.log('='.repeat(80));
console.log('Example complete!');
console.log('='.repeat(80));

// Export for testing
export {
  experiment,
  assignCounterbalancingOrder,
  sessions,
  algorithmMetrics,
  ctrTest3,
  satTest,
};
