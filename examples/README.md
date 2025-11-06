# Experimentation System Examples

This directory contains comprehensive, runnable examples demonstrating the feature flag and experimentation system. Each example is self-contained, educational, and based on real-world use cases.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run any example
npx ts-node examples/01-simple-ab-test.ts
npx ts-node examples/02-factorial-design.ts
# ... etc
```

## Examples Overview

### 01. Simple A/B Test ([01-simple-ab-test.ts](./01-simple-ab-test.ts))

**Difficulty:** Beginner
**Time to read:** 10 minutes
**Concepts:** Basic A/B testing, power analysis, statistical significance

A classic A/B test comparing two variants. Demonstrates:
- Creating an experiment with control and treatment
- User assignment with consistent hashing
- Power analysis and sample size calculation
- Tracking exposures and conversions
- Statistical analysis (t-test, proportion test)
- Making data-driven decisions

**Use Case:** Testing a new call-to-action button on a checkout page

**Key Learning:**
- Always calculate required sample size before running
- Use appropriate statistical tests for your metrics
- Consider both statistical and practical significance

---

### 02. Factorial Design (2×2) ([02-factorial-design.ts](./02-factorial-design.ts))

**Difficulty:** Intermediate
**Time to read:** 15 minutes
**Concepts:** Factorial experiments, main effects, interaction effects

Test multiple factors simultaneously in one experiment. Demonstrates:
- 2×2 factorial design (button color × button text)
- Main effect analysis for each factor
- Interaction effect detection
- Two-way ANOVA
- Efficiency gains vs. sequential testing

**Use Case:** Testing button color AND button text together

**Key Learning:**
- Factorial designs test multiple factors efficiently
- Interaction effects reveal when factors work synergistically
- More powerful than running separate experiments

---

### 03. Switchback Experiment ([03-switchback-experiment.ts](./03-switchback-experiment.ts))

**Difficulty:** Advanced
**Time to read:** 20 minutes
**Concepts:** Time-based randomization, network effects, paired analysis

Switchback experiments alternate treatments over time periods. Demonstrates:
- Temporal assignment (switch every hour)
- Handling network effects and spillover
- Paired statistical analysis
- Temporal pattern analysis
- Marketplace experimentation

**Use Case:** Testing surge pricing in a rideshare marketplace

**Key Learning:**
- Use switchback when network effects exist
- Analyze with paired tests (time periods are matched)
- Account for day-of-week and time-of-day patterns

---

### 04. Within-Subjects Design ([04-within-subjects-design.ts](./04-within-subjects-design.ts))

**Difficulty:** Intermediate
**Time to read:** 15 minutes
**Concepts:** Repeated measures, counterbalancing, order effects

Each user experiences multiple treatments over time. Demonstrates:
- Within-subjects experiment design
- Counterbalancing to control order effects
- Paired t-tests and repeated measures ANOVA
- Higher statistical power with fewer participants
- Checking for learning/fatigue effects

**Use Case:** Testing recommendation algorithms where users try each

**Key Learning:**
- Within-subjects needs ~50% of between-subjects sample
- Essential to counterbalance presentation order
- Each user is their own control (higher power)

---

### 05. Feature Flags ([05-feature-flags.ts](./05-feature-flags.ts))

**Difficulty:** Beginner
**Time to read:** 12 minutes
**Concepts:** Feature flags, gradual rollout, targeting, kill switches

Feature flag patterns for controlled releases. Demonstrates:
- Boolean flags with simple on/off
- Gradual percentage rollout (5% → 10% → 50% → 100%)
- Targeted rollout (premium users, specific countries)
- Multivariate flags (A/B/C testing)
- Kill switch for emergency disable

**Use Case:** Rolling out a new payment method feature

**Key Learning:**
- Feature flags enable safe, gradual releases
- Kill switches provide instant rollback capability
- Combine percentage and targeting for sophisticated control

---

### 06. Advanced Targeting ([06-advanced-targeting.ts](./06-advanced-targeting.ts))

**Difficulty:** Advanced
**Time to read:** 18 minutes
**Concepts:** Complex rules, logical operators, nested conditions

Build sophisticated targeting rules for experiments. Demonstrates:
- Simple conditions (equals, in, gt, contains, etc.)
- Composite conditions (AND, OR, NOT)
- Nested logic for complex criteria
- Rule validation and debugging
- Performance considerations

**Use Case:** Complex eligibility criteria for experiment participation

**Key Learning:**
- Build complex targeting with composable rules
- Test rules against representative user sets
- Balance precision vs. reach in targeting

---

### 07. Power Analysis ([07-power-analysis.ts](./07-power-analysis.ts))

**Difficulty:** Intermediate
**Time to read:** 20 minutes
**Concepts:** Statistical power, sample size, effect size, MDE

Essential power analysis before and after experiments. Demonstrates:
- Sample size calculation before experiment
- Power calculation with constrained runtime
- Minimum detectable effect (MDE)
- Post-experiment power analysis
- Runtime and traffic allocation planning
- Effect size interpretation

**Use Case:** Planning experiments with realistic sample size requirements

**Key Learning:**
- ALWAYS run power analysis before experiment
- Small effects require large samples (months of data)
- Understand four interconnected parameters: n, δ, α, power

---

### 08. CUPED Variance Reduction ([08-cuped-variance-reduction.ts](./08-cuped-variance-reduction.ts))

**Difficulty:** Advanced
**Time to read:** 25 minutes
**Concepts:** CUPED, variance reduction, covariates, sensitivity improvement

Use pre-experiment data to reduce variance by 20-50%. Demonstrates:
- Standard analysis (high variance)
- Checking pre/post metric correlation
- Applying CUPED adjustment
- Comparing standard vs. CUPED results
- Effective sample size increase
- When to use variance reduction

**Use Case:** E-commerce A/B test with historical purchase data

**Key Learning:**
- CUPED can increase effective sample size by 1.5-2×
- Requires correlation (ρ > 0.3) between pre and post metrics
- Preserves mean while reducing variance (unbiased)

---

### 09. Guardrail Metrics ([09-guardrail-metrics.ts](./09-guardrail-metrics.ts))

**Difficulty:** Intermediate
**Time to read:** 15 minutes
**Concepts:** Guardrails, safety metrics, trade-off analysis

Protect against unintended negative consequences. Demonstrates:
- Defining critical and non-critical guardrails
- Setting thresholds for acceptable degradation
- Automated guardrail monitoring
- Decision framework (ship/don't ship)
- Alert levels and escalation

**Use Case:** Testing aggressive growth tactics while protecting UX

**Key Learning:**
- Guardrails prevent shipping harmful changes
- Critical guardrails are hard gates (must pass)
- Balance optimization with user experience

---

### 10. Stepped Wedge Design ([10-stepped-wedge-design.ts](./10-stepped-wedge-design.ts))

**Difficulty:** Advanced
**Time to read:** 30 minutes
**Concepts:** Cluster-randomized trials, time trends, ICC, mixed-effects analysis

Stepped wedge cluster-randomized trial for sequential rollout. Demonstrates:
- Creating randomized switching schedule
- Unidirectional treatment assignment over time
- Visualizing rollout schedule with ASCII tables
- Simulating cluster-level data with time trends
- Adjusting for temporal confounding with regression
- Calculating intraclass correlation coefficient (ICC)
- Proper vs. naive analysis comparison
- Design effect and power considerations

**Use Case:** Rolling out hand hygiene protocol across 20 hospitals in 5 steps

**Key Learning:**
- Use stepped wedge when everyone should eventually receive treatment
- Must adjust for both time trends AND clustering
- Randomize ORDER of switching, not timing
- More ethical and practical than permanent control groups

---

## Running the Examples

### Prerequisites

- Node.js 18+
- npm 9+
- TypeScript (installed via npm)

### Installation

```bash
# From the project root
npm install
```

### Running Individual Examples

```bash
# Simple A/B test
npx ts-node examples/01-simple-ab-test.ts

# Factorial design
npx ts-node examples/02-factorial-design.ts

# Switchback experiment
npx ts-node examples/03-switchback-experiment.ts

# Within-subjects design
npx ts-node examples/04-within-subjects-design.ts

# Feature flags
npx ts-node examples/05-feature-flags.ts

# Advanced targeting
npx ts-node examples/06-advanced-targeting.ts

# Power analysis
npx ts-node examples/07-power-analysis.ts

# CUPED variance reduction
npx ts-node examples/08-cuped-variance-reduction.ts

# Guardrail metrics
npx ts-node examples/09-guardrail-metrics.ts

# Stepped wedge design
npx ts-node examples/10-stepped-wedge-design.ts
```

### Running All Examples

```bash
# Run all examples sequentially
for file in examples/*.ts; do
  echo "Running $file..."
  npx ts-node "$file"
  echo ""
done
```

## Example Output

Each example produces rich console output including:
- **Scenario setup** - Context and parameters
- **Simulation** - Generated data and metrics
- **Statistical analysis** - Test results and p-values
- **Visualizations** - ASCII tables and charts
- **Interpretation** - What the results mean
- **Recommendations** - Action items
- **Key takeaways** - Lessons and best practices

## Learning Path

### Beginner Path

1. **01-simple-ab-test.ts** - Start here! Foundational concepts
2. **05-feature-flags.ts** - Practical feature flag patterns
3. **07-power-analysis.ts** - Essential for planning experiments

### Intermediate Path

1. **02-factorial-design.ts** - Test multiple factors efficiently
2. **04-within-subjects-design.ts** - Higher power designs
3. **09-guardrail-metrics.ts** - Prevent shipping bad changes

### Advanced Path

1. **03-switchback-experiment.ts** - Marketplace and network effects
2. **06-advanced-targeting.ts** - Complex targeting rules
3. **08-cuped-variance-reduction.ts** - Statistical optimization
4. **10-stepped-wedge-design.ts** - Cluster-randomized trials with sequential rollout

## Concepts by Example

### Statistical Tests
- **t-test:** 01, 08, 09
- **Proportion test:** 01, 07, 09
- **ANOVA:** 02, 04
- **Paired t-test:** 03, 04, 08

### Experimental Designs
- **Between-subjects:** 01, 02, 07
- **Factorial:** 02
- **Switchback:** 03
- **Within-subjects:** 04
- **Stepped wedge:** 10

### Analysis Techniques
- **Power analysis:** 01, 07
- **Effect size:** 02, 07
- **Variance reduction:** 08
- **Multiple comparisons:** 02, 07
- **Regression adjustment:** 08, 10
- **Cluster analysis (ICC):** 10
- **Time trend adjustment:** 10

### Practical Considerations
- **Feature flags:** 05
- **Targeting:** 06
- **Guardrails:** 09
- **Sample size:** 01, 07

## Common Patterns

### Experiment Workflow

```typescript
// 1. Power analysis (before experiment)
const sampleSize = proportionTestSampleSize(
  baselineRate,
  minimumDetectableEffect,
  alpha,
  power
);

// 2. User assignment
const variant = assignUser(userId, experiment);

// 3. Track exposure
trackExposure(experimentId, userId, variant);

// 4. Track outcome
trackMetric(experimentId, userId, metricName, value);

// 5. Analyze results
const results = tTest(controlData, treatmentData, alpha);

// 6. Check guardrails
const guardrailsPassed = checkGuardrails(results);

// 7. Make decision
if (results.significant && guardrailsPassed) {
  shipToProduction();
}
```

### Feature Flag Workflow

```typescript
// 1. Define flag
const flag: FeatureFlag = {
  key: 'new_feature',
  enabled: true,
  rolloutPercentage: 10, // Start at 10%
  targetingRules: [
    {
      condition: (ctx) => ctx.isPremium === true,
      rolloutPercentage: 100, // 100% for premium
    },
  ],
};

// 2. Evaluate flag
const isEnabled = evaluateFlag(flag, userContext);

// 3. Gradual rollout
flag.rolloutPercentage = 25; // Increase to 25%
flag.rolloutPercentage = 50; // Increase to 50%
flag.rolloutPercentage = 100; // Full rollout

// 4. Kill switch if needed
flag.enabled = false; // Instantly disable
```

## Tips for Using Examples

### Modifying Parameters

Each example has clearly commented parameters you can modify:

```typescript
// Change these to experiment with different scenarios
const baselineRate = 0.05;        // Try 0.10 or 0.20
const minimumDetectableEffect = 0.01; // Try 0.005 or 0.02
const numUsers = 10000;           // Try 5000 or 20000
```

### Understanding Output

Examples produce three types of output:

1. **Setup**: Parameters and configuration
2. **Results**: Data, statistics, and tests
3. **Interpretation**: What it means and what to do

### Common Issues

**TypeScript errors:**
```bash
# Make sure dependencies are installed
npm install

# Check TypeScript is installed
npx tsc --version
```

**Module not found:**
```bash
# Ensure you're running from project root
cd /path/to/experimeh
npx ts-node examples/01-simple-ab-test.ts
```

**Import errors:**
```bash
# Build the project first
npm run build
```

## Additional Resources

### Documentation
- [Main README](../README.md) - Project overview
- [API Documentation](../API_DOCUMENTATION.md) - Full API reference
- [SDK Documentation](../SDK_README.md) - Client SDK guide
- [Statistical Analysis](../STATISTICAL_ANALYSIS_SUMMARY.md) - Statistical methods

### External Resources
- **Books:**
  - "Trustworthy Online Controlled Experiments" by Kohavi, Tang, Xu
  - "Statistical Methods in Online A/B Testing" by Georgi Georgiev

- **Papers:**
  - Deng et al. (2013) - "Improving the Sensitivity of Online Controlled Experiments by Utilizing Pre-Experiment Data"
  - Kohavi et al. (2012) - "Online Controlled Experiments at Large Scale"

- **Websites:**
  - [Evan Miller's A/B Testing Resources](https://www.evanmiller.org/ab-testing/)
  - [Optimizely's Experimentation Hub](https://www.optimizely.com/optimization-glossary/)

## Contributing

Have ideas for new examples? Found issues? Contributions welcome!

1. Follow existing example structure
2. Include detailed comments
3. Add real-world use cases
4. Provide interpretation and key takeaways
5. Test thoroughly before submitting

## Questions?

- Check the [main documentation](../README.md)
- Review the [API docs](../API_DOCUMENTATION.md)
- Look at similar examples
- Read the inline comments - they're extensive!

## License

MIT - See [LICENSE](../LICENSE) for details

---

**Happy Experimenting!** 🚀

Remember: Good experimentation is about learning, not just winning. Every experiment teaches you something about your users and your product.
