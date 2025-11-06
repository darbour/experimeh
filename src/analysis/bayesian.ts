/**
 * Bayesian Statistical Analysis for Experimentation
 *
 * Implements Bayesian methods for A/B testing including:
 * - Beta-Binomial conjugate model for conversion rates
 * - Normal-Normal conjugate model for continuous metrics
 * - Posterior distributions and credible intervals
 * - Probability of superiority/improvement
 *
 * References:
 * - Gelman, A., et al. (2013). "Bayesian Data Analysis" (3rd ed.)
 * - VanderPlas, J. (2014). "Frequentism and Bayesianism: A Python-driven Primer"
 * - Kruschke, J. K. (2014). "Doing Bayesian Data Analysis" (2nd ed.)
 */

/**
 * Beta distribution parameters
 */
export interface BetaDistribution {
  alpha: number; // Shape parameter (successes + prior)
  beta: number;  // Shape parameter (failures + prior)
}

/**
 * Normal distribution parameters
 */
export interface NormalDistribution {
  mean: number;
  variance: number;
  standardDeviation: number;
}

/**
 * Bayesian A/B test result for proportions
 */
export interface BayesianProportionResult {
  control: {
    posterior: BetaDistribution;
    posteriorMean: number;
    posteriorMode: number;
    credibleInterval: [number, number];
  };
  treatment: {
    posterior: BetaDistribution;
    posteriorMean: number;
    posteriorMode: number;
    credibleInterval: [number, number];
  };
  probabilityTreatmentBetter: number;
  probabilityControlBetter: number;
  expectedLift: number; // E[p_treatment - p_control]
  liftCredibleInterval: [number, number];
  riskOfAdopting: number; // Expected loss if treatment is worse
  riskOfNotAdopting: number; // Expected loss if control is worse
}

/**
 * Bayesian A/B test result for continuous metrics
 */
export interface BayesianContinuousResult {
  control: {
    posterior: NormalDistribution;
    credibleInterval: [number, number];
  };
  treatment: {
    posterior: NormalDistribution;
    credibleInterval: [number, number];
  };
  probabilityTreatmentBetter: number;
  probabilityControlBetter: number;
  expectedDifference: number;
  differenceCredibleInterval: [number, number];
  effectSize: number; // Standardized difference
}

// ============================================================================
// Beta Distribution Functions
// ============================================================================

/**
 * Beta distribution probability density function
 *
 * PDF: f(x; α, β) = [x^(α-1) * (1-x)^(β-1)] / B(α, β)
 * where B(α, β) is the beta function
 *
 * @param x - Value between 0 and 1
 * @param alpha - Shape parameter
 * @param beta - Shape parameter
 */
function betaPDF(x: number, alpha: number, beta: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return alpha > 1 ? 0 : Infinity;
  if (x === 1) return beta > 1 ? 0 : Infinity;

  // log(PDF) = (α-1)log(x) + (β-1)log(1-x) - log(B(α,β))
  // B(α,β) = Γ(α)Γ(β)/Γ(α+β)
  const logBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  const logPDF = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta;

  return Math.exp(logPDF);
}

/**
 * Beta distribution cumulative distribution function
 * Uses numerical integration (Simpson's rule)
 */
function betaCDF(x: number, alpha: number, beta: number, steps: number = 1000): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Simpson's rule for numerical integration
  const h = x / steps;
  let sum = betaPDF(0, alpha, beta) + betaPDF(x, alpha, beta);

  for (let i = 1; i < steps; i++) {
    const xi = i * h;
    const weight = i % 2 === 0 ? 2 : 4;
    sum += weight * betaPDF(xi, alpha, beta);
  }

  return (h / 3) * sum;
}

/**
 * Beta distribution mean
 * E[X] = α / (α + β)
 */
function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

/**
 * Beta distribution mode
 * Mode = (α - 1) / (α + β - 2) for α,β > 1
 */
function betaMode(alpha: number, beta: number): number {
  if (alpha <= 1 || beta <= 1) {
    // Mode is at boundary for α or β ≤ 1
    if (alpha < 1 && beta < 1) return NaN;
    if (alpha <= 1) return 0;
    if (beta <= 1) return 1;
  }
  return (alpha - 1) / (alpha + beta - 2);
}

/**
 * Beta distribution variance
 * Var[X] = αβ / ((α + β)² (α + β + 1))
 */
function betaVariance(alpha: number, beta: number): number {
  const sum = alpha + beta;
  return (alpha * beta) / (sum * sum * (sum + 1));
}

/**
 * Find beta distribution quantile (inverse CDF) using binary search
 */
function betaQuantile(p: number, alpha: number, beta: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  // Binary search for quantile
  let low = 0;
  let high = 1;
  const tolerance = 1e-6;

  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const cdf = betaCDF(mid, alpha, beta);

    if (cdf < p) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

// ============================================================================
// Gamma Function (for Beta function calculation)
// ============================================================================

/**
 * Log-gamma function using Stirling's approximation
 * More numerically stable than computing gamma directly
 *
 * Formula: ln(Γ(x)) ≈ (x-0.5)ln(x) - x + 0.5*ln(2π) + corrections
 */
function logGamma(x: number): number {
  if (x <= 0) throw new Error('Gamma function undefined for x <= 0');

  // Use Lanczos approximation for better accuracy
  const coef = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);

  let ser = 1.000000000190015;
  for (let i = 0; i < 6; i++) {
    ser += coef[i] / ++y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ============================================================================
// Normal Distribution Functions
// ============================================================================

/**
 * Normal distribution PDF
 */
function normalPDF(x: number, mean: number, stdDev: number): number {
  const variance = stdDev * stdDev;
  const coefficient = 1 / Math.sqrt(2 * Math.PI * variance);
  const exponent = -Math.pow(x - mean, 2) / (2 * variance);
  return coefficient * Math.exp(exponent);
}

/**
 * Normal distribution CDF using error function approximation
 */
function normalCDF(x: number, mean: number = 0, stdDev: number = 1): number {
  const z = (x - mean) / stdDev;

  // Use complementary error function approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return z > 0 ? 1 - prob : prob;
}

/**
 * Find normal distribution quantile using binary search
 */
function normalQuantile(p: number, mean: number = 0, stdDev: number = 1): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Binary search
  let low = mean - 10 * stdDev;
  let high = mean + 10 * stdDev;
  const tolerance = 1e-6;

  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const cdf = normalCDF(mid, mean, stdDev);

    if (cdf < p) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

// ============================================================================
// Bayesian A/B Test for Proportions (Beta-Binomial Model)
// ============================================================================

/**
 * Bayesian A/B test for conversion rates using Beta-Binomial conjugate prior
 *
 * Model:
 *   Prior: p ~ Beta(α, β)
 *   Likelihood: x ~ Binomial(n, p)
 *   Posterior: p | x ~ Beta(α + x, β + n - x)
 *
 * With non-informative prior (Jeffreys prior): Beta(0.5, 0.5)
 * or uniform prior: Beta(1, 1)
 *
 * Reference: Gelman et al. (2013), Chapter 2
 *
 * @param controlSuccesses - Number of conversions in control
 * @param controlTotal - Total observations in control
 * @param treatmentSuccesses - Number of conversions in treatment
 * @param treatmentTotal - Total observations in treatment
 * @param priorAlpha - Prior alpha (default: 1 for uniform prior)
 * @param priorBeta - Prior beta (default: 1 for uniform prior)
 * @param credibleLevel - Credible interval level (default: 0.95)
 * @param nSamples - Number of Monte Carlo samples for lift calculation
 */
export function bayesianProportionTest(
  controlSuccesses: number,
  controlTotal: number,
  treatmentSuccesses: number,
  treatmentTotal: number,
  priorAlpha: number = 1,
  priorBeta: number = 1,
  credibleLevel: number = 0.95,
  nSamples: number = 100000
): BayesianProportionResult {
  // Posterior distributions (Beta distribution is conjugate prior for Binomial)
  const controlPosterior: BetaDistribution = {
    alpha: priorAlpha + controlSuccesses,
    beta: priorBeta + (controlTotal - controlSuccesses)
  };

  const treatmentPosterior: BetaDistribution = {
    alpha: priorAlpha + treatmentSuccesses,
    beta: priorBeta + (treatmentTotal - treatmentSuccesses)
  };

  // Posterior statistics
  const controlMean = betaMean(controlPosterior.alpha, controlPosterior.beta);
  const treatmentMean = betaMean(treatmentPosterior.alpha, treatmentPosterior.beta);

  const controlMode = betaMode(controlPosterior.alpha, controlPosterior.beta);
  const treatmentMode = betaMode(treatmentPosterior.alpha, treatmentPosterior.beta);

  // Credible intervals
  const lowerTail = (1 - credibleLevel) / 2;
  const upperTail = 1 - lowerTail;

  const controlCI: [number, number] = [
    betaQuantile(lowerTail, controlPosterior.alpha, controlPosterior.beta),
    betaQuantile(upperTail, controlPosterior.alpha, controlPosterior.beta)
  ];

  const treatmentCI: [number, number] = [
    betaQuantile(lowerTail, treatmentPosterior.alpha, treatmentPosterior.beta),
    betaQuantile(upperTail, treatmentPosterior.alpha, treatmentPosterior.beta)
  ];

  // Monte Carlo sampling to calculate probability treatment is better
  // and expected lift distribution
  const controlSamples = sampleBeta(controlPosterior.alpha, controlPosterior.beta, nSamples);
  const treatmentSamples = sampleBeta(treatmentPosterior.alpha, treatmentPosterior.beta, nSamples);

  let countTreatmentBetter = 0;
  const liftSamples: number[] = [];

  for (let i = 0; i < nSamples; i++) {
    if (treatmentSamples[i] > controlSamples[i]) {
      countTreatmentBetter++;
    }
    liftSamples.push(treatmentSamples[i] - controlSamples[i]);
  }

  const probTreatmentBetter = countTreatmentBetter / nSamples;
  const probControlBetter = 1 - probTreatmentBetter;

  // Expected lift (difference in means)
  const expectedLift = treatmentMean - controlMean;

  // Credible interval for lift
  liftSamples.sort((a, b) => a - b);
  const liftCI: [number, number] = [
    liftSamples[Math.floor(nSamples * lowerTail)],
    liftSamples[Math.floor(nSamples * upperTail)]
  ];

  // Risk analysis: Expected loss if we make the wrong decision
  // Risk of adopting treatment = E[max(0, p_control - p_treatment)]
  // Risk of not adopting = E[max(0, p_treatment - p_control)]
  let riskAdopting = 0;
  let riskNotAdopting = 0;

  for (let i = 0; i < nSamples; i++) {
    const diff = treatmentSamples[i] - controlSamples[i];
    if (diff < 0) {
      riskAdopting += -diff; // Loss if treatment is actually worse
    } else {
      riskNotAdopting += diff; // Loss if we don't adopt better treatment
    }
  }

  riskAdopting /= nSamples;
  riskNotAdopting /= nSamples;

  return {
    control: {
      posterior: controlPosterior,
      posteriorMean: controlMean,
      posteriorMode: controlMode,
      credibleInterval: controlCI
    },
    treatment: {
      posterior: treatmentPosterior,
      posteriorMean: treatmentMean,
      posteriorMode: treatmentMode,
      credibleInterval: treatmentCI
    },
    probabilityTreatmentBetter: probTreatmentBetter,
    probabilityControlBetter: probControlBetter,
    expectedLift,
    liftCredibleInterval: liftCI,
    riskOfAdopting: riskAdopting,
    riskOfNotAdopting: riskNotAdopting
  };
}

/**
 * Sample from Beta distribution using acceptance-rejection method
 */
function sampleBeta(alpha: number, beta: number, n: number): number[] {
  const samples: number[] = [];

  // Use Gamma distribution method: Beta(α,β) = Gamma(α) / (Gamma(α) + Gamma(β))
  for (let i = 0; i < n; i++) {
    const x = sampleGamma(alpha);
    const y = sampleGamma(beta);
    samples.push(x / (x + y));
  }

  return samples;
}

/**
 * Sample from Gamma distribution using Marsaglia and Tsang method (2000)
 */
function sampleGamma(shape: number, scale: number = 1): number {
  if (shape < 1) {
    // Use rejection method for shape < 1
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }

  // Marsaglia and Tsang's method for shape >= 1
  const d = shape - 1/3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x, v;

    do {
      x = randomNormal();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * x * x * x * x) {
      return scale * d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return scale * d * v;
    }
  }
}

/**
 * Generate random normal variable using Box-Muller transform
 */
function randomNormal(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// ============================================================================
// Bayesian A/B Test for Continuous Metrics (Normal-Normal Model)
// ============================================================================

/**
 * Bayesian A/B test for continuous metrics using Normal-Normal conjugate prior
 *
 * Model (with known variance):
 *   Prior: μ ~ Normal(μ₀, σ₀²)
 *   Likelihood: x ~ Normal(μ, σ²)
 *   Posterior: μ | x ~ Normal(μ_post, σ_post²)
 *
 * With non-informative prior: σ₀² → ∞
 *
 * Posterior parameters:
 *   μ_post = (n * σ₀² * x̄ + σ² * μ₀) / (n * σ₀² + σ²)
 *   σ_post² = (σ² * σ₀²) / (n * σ₀² + σ²)
 *
 * For unknown variance, this becomes more complex (Student's t distribution).
 * We use a simplified approach with plug-in estimates.
 *
 * Reference: Gelman et al. (2013), Chapter 3
 *
 * @param controlData - Array of observations for control
 * @param treatmentData - Array of observations for treatment
 * @param credibleLevel - Credible interval level
 * @param nSamples - Number of Monte Carlo samples
 */
export function bayesianContinuousTest(
  controlData: number[],
  treatmentData: number[],
  credibleLevel: number = 0.95,
  nSamples: number = 100000
): BayesianContinuousResult {
  if (controlData.length < 2 || treatmentData.length < 2) {
    throw new Error('Need at least 2 observations per group');
  }

  // Sample statistics
  const controlMean = mean(controlData);
  const treatmentMean = mean(treatmentData);
  const controlVar = variance(controlData, controlMean);
  const treatmentVar = variance(treatmentData, treatmentMean);
  const nControl = controlData.length;
  const nTreatment = treatmentData.length;

  // Posterior distributions (approximating with normal)
  // Standard error of the mean
  const controlSE = Math.sqrt(controlVar / nControl);
  const treatmentSE = Math.sqrt(treatmentVar / nTreatment);

  const controlPosterior: NormalDistribution = {
    mean: controlMean,
    variance: controlVar / nControl,
    standardDeviation: controlSE
  };

  const treatmentPosterior: NormalDistribution = {
    mean: treatmentMean,
    variance: treatmentVar / nTreatment,
    standardDeviation: treatmentSE
  };

  // Credible intervals
  const lowerTail = (1 - credibleLevel) / 2;
  const upperTail = 1 - lowerTail;

  const controlCI: [number, number] = [
    normalQuantile(lowerTail, controlMean, controlSE),
    normalQuantile(upperTail, controlMean, controlSE)
  ];

  const treatmentCI: [number, number] = [
    normalQuantile(lowerTail, treatmentMean, treatmentSE),
    normalQuantile(upperTail, treatmentMean, treatmentSE)
  ];

  // Monte Carlo sampling for probability calculations
  const controlSamples: number[] = [];
  const treatmentSamples: number[] = [];

  for (let i = 0; i < nSamples; i++) {
    controlSamples.push(randomNormal(controlMean, controlSE));
    treatmentSamples.push(randomNormal(treatmentMean, treatmentSE));
  }

  let countTreatmentBetter = 0;
  const differenceSamples: number[] = [];

  for (let i = 0; i < nSamples; i++) {
    const diff = treatmentSamples[i] - controlSamples[i];
    differenceSamples.push(diff);
    if (diff > 0) {
      countTreatmentBetter++;
    }
  }

  const probTreatmentBetter = countTreatmentBetter / nSamples;
  const probControlBetter = 1 - probTreatmentBetter;

  // Expected difference
  const expectedDifference = treatmentMean - controlMean;

  // Credible interval for difference
  differenceSamples.sort((a, b) => a - b);
  const differenceCI: [number, number] = [
    differenceSamples[Math.floor(nSamples * lowerTail)],
    differenceSamples[Math.floor(nSamples * upperTail)]
  ];

  // Effect size (Cohen's d approximation)
  const pooledSD = Math.sqrt((controlVar + treatmentVar) / 2);
  const effectSize = (treatmentMean - controlMean) / pooledSD;

  return {
    control: {
      posterior: controlPosterior,
      credibleInterval: controlCI
    },
    treatment: {
      posterior: treatmentPosterior,
      credibleInterval: treatmentCI
    },
    probabilityTreatmentBetter: probTreatmentBetter,
    probabilityControlBetter: probControlBetter,
    expectedDifference,
    differenceCredibleInterval: differenceCI,
    effectSize
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function mean(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function variance(values: number[], sampleMean?: number): number {
  const m = sampleMean ?? mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - m, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
}

// ============================================================================
// Multi-Armed Bandit (Thompson Sampling)
// ============================================================================

/**
 * Thompson Sampling for Beta-Binomial bandits
 *
 * Dynamically allocates traffic based on posterior probabilities.
 * Each arm is sampled from its posterior Beta distribution, and the arm
 * with the highest sample is selected.
 *
 * Reference: Chapelle, O., & Li, L. (2011). "An Empirical Evaluation of
 * Thompson Sampling"
 *
 * @param variants - Array of variant results {successes, total}
 * @param priorAlpha - Prior alpha
 * @param priorBeta - Prior beta
 * @returns Index of selected variant
 */
export function thompsonSampling(
  variants: Array<{ successes: number; total: number }>,
  priorAlpha: number = 1,
  priorBeta: number = 1
): number {
  const samples: number[] = [];

  for (const variant of variants) {
    const alpha = priorAlpha + variant.successes;
    const beta = priorBeta + (variant.total - variant.successes);

    // Sample from posterior
    const sample = sampleBeta(alpha, beta, 1)[0];
    samples.push(sample);
  }

  // Return index of maximum sample
  return samples.indexOf(Math.max(...samples));
}

/**
 * Calculate regret bounds for multi-armed bandit
 *
 * @param variants - Variant performance data
 * @returns Expected regret
 */
export function calculateRegret(
  variants: Array<{ successes: number; total: number }>,
  priorAlpha: number = 1,
  priorBeta: number = 1
): { totalRegret: number; regretPerArm: number[] } {
  // Calculate posterior means
  const posteriorMeans = variants.map(v => {
    const alpha = priorAlpha + v.successes;
    const beta = priorBeta + (v.total - v.successes);
    return betaMean(alpha, beta);
  });

  const bestMean = Math.max(...posteriorMeans);

  // Calculate regret: difference from optimal
  const regretPerArm = variants.map((v, i) => {
    return v.total * (bestMean - posteriorMeans[i]);
  });

  const totalRegret = regretPerArm.reduce((sum, r) => sum + r, 0);

  return { totalRegret, regretPerArm };
}
