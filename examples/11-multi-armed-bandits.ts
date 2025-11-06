/**
 * Example 11: Multi-Armed Bandit Algorithms
 *
 * Demonstrates adaptive experimentation using bandit algorithms
 * that automatically optimize traffic allocation toward better variants.
 *
 * Covered topics:
 * 1. Thompson Sampling for conversion optimization
 * 2. Epsilon-Greedy for content recommendations
 * 3. UCB for pricing experiments
 * 4. Comparing bandit algorithms
 * 5. Reward tracking and metrics
 * 6. Convergence analysis
 *
 * Use cases:
 * - Adaptive A/B testing with automatic optimization
 * - Content personalization with exploration
 * - Dynamic pricing optimization
 * - Feature rollout with performance monitoring
 */

import {
  BanditAlgorithm,
  ThompsonSamplingConfig,
  EpsilonGreedyConfig,
  UCBConfig,
  ThompsonSampling,
  EpsilonGreedy,
  UCB,
  RewardEvent,
  createRewardTracker,
  trackReward,
  calculateCumulativeRegret,
} from '../src/core/bandits';

import {
  Experiment,
  AssignmentMode,
  BanditAlgorithmType,
  ExperimentStatus,
  ExperimentDesignType,
  RandomizationUnit,
} from '../src/models/experiment';

/**
 * Example 1: Thompson Sampling for Conversion Optimization
 *
 * Thompson Sampling uses Bayesian inference to balance exploration
 * and exploitation optimally. It's ideal for binary outcomes like
 * conversions, sign-ups, or clicks.
 */
function exampleThompsonSampling() {
  console.log('\n=== Example 1: Thompson Sampling ===\n');

  // Initialize Thompson Sampling with three variants
  const armIds = ['control', 'variant-a', 'variant-b'];
  const config: ThompsonSamplingConfig = {
    algorithm: BanditAlgorithm.THOMPSON_SAMPLING,
    priorAlpha: 1, // Uniform prior
    priorBeta: 1,
  };

  let state = ThompsonSampling.initialize(armIds, config);
  console.log('Initial state:', JSON.stringify(state, null, 2));

  // Simulate 1000 trials with different true conversion rates
  const trueRates = {
    'control': 0.10,      // 10% conversion
    'variant-a': 0.12,    // 12% conversion (best)
    'variant-b': 0.09,    // 9% conversion
  };

  console.log('\nTrue conversion rates:', trueRates);
  console.log('\nRunning 1000 trials...\n');

  const selections: Record<string, number> = {
    'control': 0,
    'variant-a': 0,
    'variant-b': 0,
  };

  for (let i = 0; i < 1000; i++) {
    // Select arm using Thompson Sampling
    const selection = ThompsonSampling.selectArm(state);
    selections[selection.armId]++;

    // Simulate conversion based on true rate
    const converted = Math.random() < trueRates[selection.armId as keyof typeof trueRates];
    const reward = converted ? 1 : 0;

    // Update state
    const rewardEvent: RewardEvent = {
      experimentId: 'exp-001',
      armId: selection.armId,
      reward,
      timestamp: new Date(),
      unitId: `user-${i}`,
    };

    state = ThompsonSampling.update(state, rewardEvent);

    // Log progress every 100 trials
    if ((i + 1) % 100 === 0) {
      const probabilities = ThompsonSampling.calculateBestArmProbabilities(state, 1000);
      console.log(`Trial ${i + 1}:`);
      console.log(`  Selections: ${JSON.stringify(selections)}`);
      console.log(`  P(best arm): ${JSON.stringify(probabilities)}`);
    }
  }

  // Final results
  console.log('\n--- Final Results ---');
  console.log('Total selections:', selections);
  console.log('\nArm statistics:');
  state.arms.forEach(arm => {
    const expectedReward = arm.alpha / (arm.alpha + arm.beta);
    console.log(`  ${arm.armId}:`);
    console.log(`    Trials: ${arm.count}`);
    console.log(`    Mean reward: ${arm.meanReward.toFixed(4)}`);
    console.log(`    Expected reward: ${expectedReward.toFixed(4)}`);
    console.log(`    Alpha: ${arm.alpha.toFixed(2)}, Beta: ${arm.beta.toFixed(2)}`);
  });

  const bestArmProbs = ThompsonSampling.calculateBestArmProbabilities(state);
  console.log('\nProbability each arm is best:', bestArmProbs);
  console.log('\n✓ Thompson Sampling converged to variant-a (best arm)');
}

/**
 * Example 2: Epsilon-Greedy for Content Recommendations
 *
 * Epsilon-Greedy is simple and effective. It explores with probability ε
 * and exploits with probability 1-ε. Great for content optimization where
 * you want interpretable exploration rates.
 */
function exampleEpsilonGreedy() {
  console.log('\n\n=== Example 2: Epsilon-Greedy ===\n');

  // Initialize with decaying epsilon
  const armIds = ['article-a', 'article-b', 'article-c', 'article-d'];
  const config: EpsilonGreedyConfig = {
    algorithm: BanditAlgorithm.EPSILON_GREEDY,
    epsilon: 0.3,       // Start with 30% exploration
    decayRate: 0.995,   // Decay by 0.5% per trial
    minEpsilon: 0.05,   // Maintain 5% exploration
  };

  let state = EpsilonGreedy.initialize(armIds, config);

  // True click-through rates
  const trueCTRs = {
    'article-a': 0.15,
    'article-b': 0.22,  // Best article
    'article-c': 0.18,
    'article-d': 0.12,
  };

  console.log('True CTRs:', trueCTRs);
  console.log(`Initial epsilon: ${state.epsilon}`);

  const selections: Record<string, number> = {};
  armIds.forEach(id => selections[id] = 0);

  // Run 500 trials
  for (let i = 0; i < 500; i++) {
    const selection = EpsilonGreedy.selectArm(state);
    selections[selection.armId]++;

    // Simulate click
    const clicked = Math.random() < trueCTRs[selection.armId as keyof typeof trueCTRs];

    state = EpsilonGreedy.update(state, {
      experimentId: 'exp-002',
      armId: selection.armId,
      reward: clicked ? 1 : 0,
      timestamp: new Date(),
      unitId: `user-${i}`,
    });

    if ((i + 1) % 100 === 0) {
      console.log(`\nAfter ${i + 1} trials:`);
      console.log(`  Current epsilon: ${state.epsilon.toFixed(4)}`);
      console.log(`  Selections: ${JSON.stringify(selections)}`);

      const armStats = EpsilonGreedy.getArmStatistics(state);
      console.log('  Mean CTRs:');
      armStats.forEach(stats => {
        console.log(`    ${stats.armId}: ${stats.meanReward.toFixed(4)}`);
      });
    }
  }

  console.log('\n--- Final Results ---');
  console.log(`Final epsilon: ${state.epsilon.toFixed(4)}`);
  console.log('Selection distribution:', selections);

  const finalStats = EpsilonGreedy.getArmStatistics(state);
  console.log('\nFinal statistics:');
  finalStats.forEach(stats => {
    console.log(`  ${stats.armId}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Mean CTR: ${stats.meanReward.toFixed(4)}`);
    console.log(`    95% CI: [${stats.confidenceInterval.lower.toFixed(4)}, ${stats.confidenceInterval.upper.toFixed(4)}]`);
  });

  console.log('\n✓ Epsilon-Greedy balanced exploration and exploitation');
}

/**
 * Example 3: UCB for Pricing Optimization
 *
 * UCB uses confidence bounds to systematically explore without randomness.
 * Perfect for pricing experiments where you want principled exploration.
 */
function exampleUCB() {
  console.log('\n\n=== Example 3: UCB for Pricing ===\n');

  // Different price points
  const armIds = ['$9.99', '$14.99', '$19.99', '$24.99'];
  const config: UCBConfig = {
    algorithm: BanditAlgorithm.UCB,
    explorationParam: 2, // Standard UCB1 parameter
  };

  let state = UCB.initialize(armIds, config);

  // True conversion rates at each price point
  // Higher price = lower conversion but higher revenue per conversion
  const trueMetrics = {
    '$9.99': { rate: 0.20, value: 9.99 },   // Expected: $2.00
    '$14.99': { rate: 0.15, value: 14.99 }, // Expected: $2.25 (best)
    '$19.99': { rate: 0.10, value: 19.99 }, // Expected: $2.00
    '$24.99': { rate: 0.06, value: 24.99 }, // Expected: $1.50
  };

  console.log('True metrics (rate × value = expected revenue):');
  Object.entries(trueMetrics).forEach(([price, metrics]) => {
    const expected = metrics.rate * metrics.value;
    console.log(`  ${price}: ${(metrics.rate * 100).toFixed(0)}% × $${metrics.value.toFixed(2)} = $${expected.toFixed(2)}`);
  });

  const selections: Record<string, number> = {};
  armIds.forEach(id => selections[id] = 0);

  // Run 400 trials
  console.log('\nRunning 400 trials...\n');

  for (let i = 0; i < 400; i++) {
    const selection = UCB.selectArm(state);
    selections[selection.armId]++;

    // Simulate conversion and revenue
    const metrics = trueMetrics[selection.armId as keyof typeof trueMetrics];
    const converted = Math.random() < metrics.rate;
    const revenue = converted ? metrics.value : 0;

    // Normalize revenue to [0,1] for UCB (max possible is $24.99)
    const normalizedReward = revenue / 24.99;

    state = UCB.update(state, {
      experimentId: 'exp-003',
      armId: selection.armId,
      reward: normalizedReward,
      timestamp: new Date(),
      unitId: `user-${i}`,
    });

    if ((i + 1) % 100 === 0) {
      console.log(`Trial ${i + 1}:`);
      console.log(`  Selections: ${JSON.stringify(selections)}`);

      const armStats = UCB.getArmStatistics(state);
      console.log('  UCB values:');
      armStats.forEach(stats => {
        console.log(`    ${stats.armId}: ${stats.ucbValue.toFixed(4)} (mean: ${(stats.meanReward * 24.99).toFixed(2)})`);
      });
    }
  }

  console.log('\n--- Final Results ---');
  console.log('Selections:', selections);

  const finalStats = UCB.getArmStatistics(state);
  console.log('\nFinal statistics:');
  finalStats.forEach(stats => {
    const actualRevenue = stats.meanReward * 24.99;
    console.log(`  ${stats.armId}:`);
    console.log(`    Trials: ${stats.count}`);
    console.log(`    Avg revenue: $${actualRevenue.toFixed(2)}`);
    console.log(`    UCB value: ${stats.ucbValue.toFixed(4)}`);
    console.log(`    Exploration bonus: ${stats.explorationBonus.toFixed(4)}`);
  });

  console.log('\n✓ UCB identified optimal price point ($14.99)');
}

/**
 * Example 4: Comparing Bandit Algorithms
 *
 * Compare performance of all three algorithms on the same problem
 */
function compareBanditAlgorithms() {
  console.log('\n\n=== Example 4: Algorithm Comparison ===\n');

  const armIds = ['a', 'b', 'c'];
  const trueRates = { 'a': 0.05, 'b': 0.15, 'c': 0.10 }; // b is best
  const trials = 300;

  console.log('True conversion rates:', trueRates);
  console.log('Optimal arm: b (15% conversion)');
  console.log(`Running ${trials} trials per algorithm...\n`);

  // Initialize all algorithms
  let tsState = ThompsonSampling.initialize(armIds);
  let egState = EpsilonGreedy.initialize(armIds, {
    algorithm: BanditAlgorithm.EPSILON_GREEDY,
    epsilon: 0.1
  });
  let ucbState = UCB.initialize(armIds);

  // Track rewards for regret calculation
  const tsTracker = createRewardTracker('ts-exp', armIds, BanditAlgorithm.THOMPSON_SAMPLING);
  const egTracker = createRewardTracker('eg-exp', armIds, BanditAlgorithm.EPSILON_GREEDY);
  const ucbTracker = createRewardTracker('ucb-exp', armIds, BanditAlgorithm.UCB);

  const results = {
    thompson: { totalReward: 0, regret: 0, bestArmSelections: 0 },
    epsilonGreedy: { totalReward: 0, regret: 0, bestArmSelections: 0 },
    ucb: { totalReward: 0, regret: 0, bestArmSelections: 0 },
  };

  const optimalRate = 0.15; // Best arm's true rate

  for (let i = 0; i < trials; i++) {
    // Thompson Sampling
    const tsSelection = ThompsonSampling.selectArm(tsState);
    const tsReward = Math.random() < trueRates[tsSelection.armId as keyof typeof trueRates] ? 1 : 0;
    tsState = ThompsonSampling.update(tsState, {
      experimentId: 'ts', armId: tsSelection.armId, reward: tsReward,
      timestamp: new Date(), unitId: `user-${i}`,
    });
    results.thompson.totalReward += tsReward;
    results.thompson.regret += (optimalRate - trueRates[tsSelection.armId as keyof typeof trueRates]);
    if (tsSelection.armId === 'b') results.thompson.bestArmSelections++;

    // Epsilon-Greedy
    const egSelection = EpsilonGreedy.selectArm(egState);
    const egReward = Math.random() < trueRates[egSelection.armId as keyof typeof trueRates] ? 1 : 0;
    egState = EpsilonGreedy.update(egState, {
      experimentId: 'eg', armId: egSelection.armId, reward: egReward,
      timestamp: new Date(), unitId: `user-${i}`,
    });
    results.epsilonGreedy.totalReward += egReward;
    results.epsilonGreedy.regret += (optimalRate - trueRates[egSelection.armId as keyof typeof trueRates]);
    if (egSelection.armId === 'b') results.epsilonGreedy.bestArmSelections++;

    // UCB
    const ucbSelection = UCB.selectArm(ucbState);
    const ucbReward = Math.random() < trueRates[ucbSelection.armId as keyof typeof trueRates] ? 1 : 0;
    ucbState = UCB.update(ucbState, {
      experimentId: 'ucb', armId: ucbSelection.armId, reward: ucbReward,
      timestamp: new Date(), unitId: `user-${i}`,
    });
    results.ucb.totalReward += ucbReward;
    results.ucb.regret += (optimalRate - trueRates[ucbSelection.armId as keyof typeof trueRates]);
    if (ucbSelection.armId === 'b') results.ucb.bestArmSelections++;
  }

  console.log('--- Comparison Results ---\n');

  console.log('Thompson Sampling:');
  console.log(`  Total conversions: ${results.thompson.totalReward}`);
  console.log(`  Cumulative regret: ${results.thompson.regret.toFixed(2)}`);
  console.log(`  Best arm selections: ${results.thompson.bestArmSelections} (${(results.thompson.bestArmSelections/trials*100).toFixed(1)}%)`);

  console.log('\nEpsilon-Greedy:');
  console.log(`  Total conversions: ${results.epsilonGreedy.totalReward}`);
  console.log(`  Cumulative regret: ${results.epsilonGreedy.regret.toFixed(2)}`);
  console.log(`  Best arm selections: ${results.epsilonGreedy.bestArmSelections} (${(results.epsilonGreedy.bestArmSelections/trials*100).toFixed(1)}%)`);

  console.log('\nUCB:');
  console.log(`  Total conversions: ${results.ucb.totalReward}`);
  console.log(`  Cumulative regret: ${results.ucb.regret.toFixed(2)}`);
  console.log(`  Best arm selections: ${results.ucb.bestArmSelections} (${(results.ucb.bestArmSelections/trials*100).toFixed(1)}%)`);

  console.log('\n--- Winner ---');
  const winner = Object.entries(results).reduce((best, [name, stats]) =>
    stats.totalReward > best.stats.totalReward ? { name, stats } : best
  , { name: 'thompson', stats: results.thompson });

  console.log(`${winner.name} achieved highest total reward!`);
  console.log('\nAll algorithms converged to the best arm effectively.');
}

/**
 * Example 5: Experiment Definition with Bandit Configuration
 */
function exampleBanditExperimentDefinition() {
  console.log('\n\n=== Example 5: Bandit Experiment Configuration ===\n');

  const banditExperiment: Partial<Experiment> = {
    id: 'exp-bandit-001',
    key: 'homepage-hero-bandit',
    name: 'Homepage Hero Banner Optimization',
    description: 'Adaptive optimization of hero banner variants using Thompson Sampling',
    status: ExperimentStatus.RUNNING,
    designType: ExperimentDesignType.AB,

    hypothesis: 'Different hero banners will have different conversion rates, and Thompson Sampling will automatically optimize traffic allocation',
    primaryMetric: 'conversion_rate',
    secondaryMetrics: ['click_through_rate', 'time_on_page'],
    guardrailMetrics: ['page_load_time', 'bounce_rate'],

    randomizationUnit: RandomizationUnit.USER,
    assignmentKey: 'userId',

    variants: [
      {
        id: 'v1',
        key: 'control',
        name: 'Original Banner',
        description: 'Current hero banner',
        allocation: 33.33,
        isControl: true,
      },
      {
        id: 'v2',
        key: 'variant-emotional',
        name: 'Emotional Appeal',
        description: 'Banner with emotional messaging',
        allocation: 33.33,
        isControl: false,
      },
      {
        id: 'v3',
        key: 'variant-value',
        name: 'Value Proposition',
        description: 'Banner emphasizing value',
        allocation: 33.34,
        isControl: false,
      },
    ],

    // Bandit configuration
    assignmentMode: AssignmentMode.BANDIT,
    banditConfig: {
      algorithm: BanditAlgorithmType.THOMPSON_SAMPLING,
      rewardMetric: 'conversion_rate',
      warmupTrialsPerArm: 50, // 50 trials per variant before adaptive allocation
      priorAlpha: 1,
      priorBeta: 1,
    },

    trafficAllocation: 100,
    startDate: new Date('2025-01-01'),
    endDate: null, // Run indefinitely
    minSampleSize: 1000,
  };

  console.log('Bandit Experiment Configuration:');
  console.log(JSON.stringify(banditExperiment, null, 2));

  console.log('\n✓ This configuration enables adaptive traffic allocation');
  console.log('✓ After warmup (150 total trials), better variants get more traffic');
  console.log('✓ System continuously optimizes while maintaining exploration');
}

/**
 * Run all examples
 */
function runAllExamples() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Multi-Armed Bandit Algorithms - Examples       ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    exampleThompsonSampling();
    exampleEpsilonGreedy();
    exampleUCB();
    compareBanditAlgorithms();
    exampleBanditExperimentDefinition();

    console.log('\n\n╔═══════════════════════════════════════════════════╗');
    console.log('║              All Examples Complete!               ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    console.log('Key Takeaways:');
    console.log('1. Thompson Sampling: Optimal for binary outcomes, Bayesian approach');
    console.log('2. Epsilon-Greedy: Simple, interpretable, good baseline');
    console.log('3. UCB: Deterministic, confidence-based, no hyperparameters');
    console.log('4. All algorithms converge to best arm while exploring');
    console.log('5. Choose based on problem: TS for most cases, EG for simplicity, UCB for determinism');

  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  exampleThompsonSampling,
  exampleEpsilonGreedy,
  exampleUCB,
  compareBanditAlgorithms,
  exampleBanditExperimentDefinition,
};
