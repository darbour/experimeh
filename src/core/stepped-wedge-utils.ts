/**
 * Stepped Wedge Utility Functions
 *
 * This module provides utility functions for working with stepped wedge
 * cluster-randomized trials, including:
 * - Schedule validation
 * - Step calculation and boundaries
 * - Cluster distribution analysis
 * - Schedule export for documentation
 *
 * References:
 * - "The Stepped Wedge Trial Design" - Hussey & Hughes (2007)
 * - "Design and analysis of stepped wedge cluster randomized trials" - Hemming et al. (2015)
 */

import { SteppedWedgeSchedule, SteppedWedgeConfig } from './assignment';

/**
 * Validate Stepped Wedge Schedule
 * Ensures schedule is correctly formed and internally consistent
 *
 * Validation Checks:
 * 1. All clusters appear in both clusterToStep and stepToClusters
 * 2. No duplicate cluster assignments
 * 3. All steps are in valid range [1, numSteps]
 * 4. Bidirectional mappings are consistent
 * 5. Each step has at least one cluster (if balanced)
 *
 * Time Complexity: O(c) where c = number of clusters
 * Space Complexity: O(1)
 *
 * @param schedule - Schedule to validate
 * @param numSteps - Expected number of steps
 * @returns Array of validation error messages (empty if valid)
 *
 * @example
 * ```typescript
 * const schedule = generateSteppedWedgeSchedule(10, 4, 'seed');
 * const errors = validateSteppedWedgeSchedule(schedule, 4);
 * if (errors.length > 0) {
 *   console.error('Invalid schedule:', errors);
 * }
 * ```
 */
export function validateSteppedWedgeSchedule(
  schedule: SteppedWedgeSchedule,
  numSteps: number
): string[] {
  const errors: string[] = [];

  if (!schedule.clusterToStep || typeof schedule.clusterToStep !== 'object') {
    errors.push('Schedule missing clusterToStep mapping');
    return errors;
  }

  if (!schedule.stepToClusters || typeof schedule.stepToClusters !== 'object') {
    errors.push('Schedule missing stepToClusters mapping');
    return errors;
  }

  // Get all clusters from both mappings
  const clustersInClusterToStep = new Set(Object.keys(schedule.clusterToStep));
  const clustersInStepToClusters = new Set<string>();

  // Validate stepToClusters and collect cluster IDs
  for (const [stepStr, clusters] of Object.entries(schedule.stepToClusters)) {
    const step = parseInt(stepStr, 10);

    if (isNaN(step)) {
      errors.push(`Invalid step number: ${stepStr}`);
      continue;
    }

    if (step < 1 || step > numSteps) {
      errors.push(`Step ${step} out of range [1, ${numSteps}]`);
    }

    if (!Array.isArray(clusters)) {
      errors.push(`stepToClusters[${step}] is not an array`);
      continue;
    }

    if (clusters.length === 0) {
      errors.push(`Step ${step} has no clusters assigned`);
    }

    for (const clusterId of clusters) {
      if (clustersInStepToClusters.has(clusterId)) {
        errors.push(`Cluster ${clusterId} appears multiple times in stepToClusters`);
      }
      clustersInStepToClusters.add(clusterId);
    }
  }

  // Validate clusterToStep values
  for (const [clusterId, step] of Object.entries(schedule.clusterToStep)) {
    if (typeof step !== 'number' || isNaN(step)) {
      errors.push(`Cluster ${clusterId} has invalid step: ${step}`);
      continue;
    }

    if (step < 1 || step > numSteps) {
      errors.push(`Cluster ${clusterId} assigned to invalid step ${step} (must be 1-${numSteps})`);
    }
  }

  // Check bidirectional consistency
  if (clustersInClusterToStep.size !== clustersInStepToClusters.size) {
    errors.push(
      `Cluster count mismatch: ${clustersInClusterToStep.size} in clusterToStep, ` +
      `${clustersInStepToClusters.size} in stepToClusters`
    );
  }

  // Check all clusters appear in both mappings
  for (const clusterId of Array.from(clustersInClusterToStep)) {
    if (!clustersInStepToClusters.has(clusterId)) {
      errors.push(`Cluster ${clusterId} in clusterToStep but not in stepToClusters`);
    }
  }

  for (const clusterId of Array.from(clustersInStepToClusters)) {
    if (!clustersInClusterToStep.has(clusterId)) {
      errors.push(`Cluster ${clusterId} in stepToClusters but not in clusterToStep`);
    }
  }

  // Verify bidirectional mapping consistency
  for (const [clusterId, step] of Object.entries(schedule.clusterToStep)) {
    const clustersAtStep = schedule.stepToClusters[step];
    if (!clustersAtStep || !clustersAtStep.includes(clusterId)) {
      errors.push(
        `Inconsistent mapping: cluster ${clusterId} maps to step ${step}, ` +
        `but step ${step} doesn't list this cluster`
      );
    }
  }

  return errors;
}

/**
 * Get Cluster Switch Step
 * Retrieves the step at which a cluster switches to treatment
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 *
 * @param schedule - Stepped wedge schedule
 * @param clusterId - Cluster identifier
 * @returns Step number when cluster switches, or undefined if not found
 *
 * @example
 * ```typescript
 * const switchStep = getClusterSwitchStep(schedule, 'hospital-5');
 * console.log(`Hospital 5 switches at step ${switchStep}`);
 * ```
 */
export function getClusterSwitchStep(
  schedule: SteppedWedgeSchedule,
  clusterId: string
): number | undefined {
  return schedule.clusterToStep[clusterId];
}

/**
 * Get Current Step from Time
 * Calculates which step an experiment is currently in
 *
 * Algorithm:
 * 1. Calculate elapsed time since experiment start
 * 2. Divide by step duration to get step number
 * 3. Floor to get current step (0-indexed)
 * 4. Clamp to valid range [0, numSteps]
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 *
 * Step Numbering:
 * - Step 0: Baseline (all clusters in control)
 * - Steps 1-N: Progressive switching
 * - After step N: All clusters in treatment
 *
 * @param startDate - Experiment start date
 * @param currentTime - Current timestamp
 * @param stepDurationMinutes - Duration of each step in minutes
 * @param numSteps - Total number of steps
 * @returns Current step number (clamped to [0, numSteps])
 *
 * @example
 * ```typescript
 * const step = getCurrentStep(
 *   new Date('2025-01-01'),
 *   new Date('2025-01-15'),
 *   10080, // 1 week
 *   4
 * );
 * // Returns 2 (in third week, so step 2)
 * ```
 */
export function getCurrentStep(
  startDate: Date,
  currentTime: Date,
  stepDurationMinutes: number,
  numSteps: number
): number {
  const startTime = startDate.getTime();
  const currentTimeMs = currentTime.getTime();
  const elapsedMinutes = (currentTimeMs - startTime) / (1000 * 60);
  const rawStep = Math.floor(elapsedMinutes / stepDurationMinutes);

  // Clamp to valid range [0, numSteps]
  return Math.max(0, Math.min(rawStep, numSteps));
}

/**
 * Get Step Boundaries
 * Calculates start and end times for a specific step
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 *
 * @param startDate - Experiment start date
 * @param stepNumber - Step number (0-indexed)
 * @param stepDurationMinutes - Duration of each step
 * @returns Object with stepStart and stepEnd dates
 *
 * @example
 * ```typescript
 * const boundaries = getStepBoundaries(
 *   new Date('2025-01-01'),
 *   2,
 *   10080 // 1 week
 * );
 * console.log(`Step 2: ${boundaries.stepStart} to ${boundaries.stepEnd}`);
 * ```
 */
export function getStepBoundaries(
  startDate: Date,
  stepNumber: number,
  stepDurationMinutes: number
): { stepStart: Date; stepEnd: Date } {
  const startTime = startDate.getTime();

  const stepStart = new Date(
    startTime + stepNumber * stepDurationMinutes * 60 * 1000
  );

  const stepEnd = new Date(
    startTime + (stepNumber + 1) * stepDurationMinutes * 60 * 1000
  );

  return { stepStart, stepEnd };
}

/**
 * Calculate Balanced Distribution
 * Determines how many clusters should be assigned to each step
 *
 * Algorithm:
 * 1. Divide total clusters by number of steps
 * 2. Distribute evenly using ceiling division
 * 3. Ensure total equals numClusters
 *
 * Time Complexity: O(s) where s = number of steps
 * Space Complexity: O(s)
 *
 * Distribution Strategy:
 * - Spreads clusters as evenly as possible
 * - First steps may have one more cluster if not evenly divisible
 * - Sum of all step allocations equals total clusters
 *
 * @param numClusters - Total number of clusters
 * @param numSteps - Number of steps
 * @returns Array where index i contains number of clusters for step i+1
 *
 * @example
 * ```typescript
 * const distribution = calculateBalancedDistribution(10, 4);
 * // Returns [3, 3, 2, 2] - first two steps get 3 clusters, last two get 2
 * ```
 */
export function calculateBalancedDistribution(
  numClusters: number,
  numSteps: number
): number[] {
  if (numClusters <= 0 || numSteps <= 0) {
    throw new Error('numClusters and numSteps must be positive');
  }

  if (numSteps > numClusters) {
    throw new Error('numSteps cannot exceed numClusters');
  }

  const distribution: number[] = [];
  const basePerStep = Math.floor(numClusters / numSteps);
  const remainder = numClusters % numSteps;

  for (let step = 0; step < numSteps; step++) {
    // First 'remainder' steps get one extra cluster
    const clustersInStep = step < remainder ? basePerStep + 1 : basePerStep;
    distribution.push(clustersInStep);
  }

  return distribution;
}

/**
 * Export Schedule to CSV Format
 * Generates CSV representation of schedule for documentation and auditing
 *
 * CSV Format:
 * - Header: ClusterId,SwitchStep,StepStart,StepEnd
 * - One row per cluster
 * - Sorted by switch step, then cluster ID
 *
 * Time Complexity: O(c log c) where c = number of clusters (for sorting)
 * Space Complexity: O(c)
 *
 * @param schedule - Stepped wedge schedule
 * @param startDate - Experiment start date
 * @param stepDurationMinutes - Duration of each step
 * @returns CSV string with cluster switching schedule
 *
 * @example
 * ```typescript
 * const csv = exportScheduleToCSV(
 *   schedule,
 *   new Date('2025-01-01'),
 *   10080
 * );
 * fs.writeFileSync('schedule.csv', csv);
 * ```
 */
export function exportScheduleToCSV(
  schedule: SteppedWedgeSchedule,
  startDate: Date,
  stepDurationMinutes: number
): string {
  const rows: string[] = ['ClusterId,SwitchStep,StepStart,StepEnd'];

  // Create array of cluster entries and sort by switch step, then cluster ID
  const entries = Object.entries(schedule.clusterToStep).sort((a, b) => {
    const stepDiff = a[1] - b[1];
    if (stepDiff !== 0) return stepDiff;
    return a[0].localeCompare(b[0]);
  });

  for (const [clusterId, switchStep] of entries) {
    const boundaries = getStepBoundaries(startDate, switchStep, stepDurationMinutes);
    const stepStart = boundaries.stepStart.toISOString();
    const stepEnd = boundaries.stepEnd.toISOString();

    rows.push(`${clusterId},${switchStep},${stepStart},${stepEnd}`);
  }

  return rows.join('\n');
}

/**
 * Get Schedule Statistics
 * Calculates summary statistics about the stepped wedge schedule
 *
 * Time Complexity: O(c) where c = number of clusters
 * Space Complexity: O(s) where s = number of steps
 *
 * Statistics Returned:
 * - Total clusters
 * - Number of steps
 * - Clusters per step (min, max, average)
 * - Distribution across steps
 * - Balance metric (0 = perfectly balanced, higher = more imbalanced)
 *
 * @param schedule - Stepped wedge schedule
 * @param numSteps - Total number of steps
 * @returns Object with schedule statistics
 *
 * @example
 * ```typescript
 * const stats = getScheduleStatistics(schedule, 4);
 * console.log(`Average clusters per step: ${stats.avgClustersPerStep}`);
 * console.log(`Balance: ${stats.balanceMetric}`);
 * ```
 */
export function getScheduleStatistics(
  schedule: SteppedWedgeSchedule,
  numSteps: number
): {
  totalClusters: number;
  numSteps: number;
  minClustersPerStep: number;
  maxClustersPerStep: number;
  avgClustersPerStep: number;
  distributionByStep: Record<number, number>;
  balanceMetric: number;
} {
  const totalClusters = Object.keys(schedule.clusterToStep).length;
  const distributionByStep: Record<number, number> = {};

  // Initialize all steps with 0 clusters
  for (let step = 1; step <= numSteps; step++) {
    distributionByStep[step] = 0;
  }

  // Count clusters per step
  for (const step of Object.values(schedule.clusterToStep)) {
    distributionByStep[step] = (distributionByStep[step] || 0) + 1;
  }

  const counts = Object.values(distributionByStep);
  const minClustersPerStep = Math.min(...counts);
  const maxClustersPerStep = Math.max(...counts);
  const avgClustersPerStep = totalClusters / numSteps;

  // Calculate balance metric (standard deviation of cluster counts)
  const variance = counts.reduce(
    (sum, count) => sum + Math.pow(count - avgClustersPerStep, 2),
    0
  ) / numSteps;
  const balanceMetric = Math.sqrt(variance);

  return {
    totalClusters,
    numSteps,
    minClustersPerStep,
    maxClustersPerStep,
    avgClustersPerStep,
    distributionByStep,
    balanceMetric,
  };
}

/**
 * Get Clusters in Treatment at Step
 * Returns list of cluster IDs that have switched to treatment by given step
 *
 * Time Complexity: O(c) where c = number of clusters
 * Space Complexity: O(c)
 *
 * @param schedule - Stepped wedge schedule
 * @param currentStep - Current step number
 * @returns Array of cluster IDs currently in treatment
 *
 * @example
 * ```typescript
 * const treatedClusters = getClustersInTreatmentAtStep(schedule, 2);
 * console.log(`${treatedClusters.length} clusters in treatment at step 2`);
 * ```
 */
export function getClustersInTreatmentAtStep(
  schedule: SteppedWedgeSchedule,
  currentStep: number
): string[] {
  const treatedClusters: string[] = [];

  for (const [clusterId, switchStep] of Object.entries(schedule.clusterToStep)) {
    if (currentStep >= switchStep) {
      treatedClusters.push(clusterId);
    }
  }

  return treatedClusters;
}

/**
 * Get Clusters in Control at Step
 * Returns list of cluster IDs still in control at given step
 *
 * Time Complexity: O(c) where c = number of clusters
 * Space Complexity: O(c)
 *
 * @param schedule - Stepped wedge schedule
 * @param currentStep - Current step number
 * @returns Array of cluster IDs currently in control
 *
 * @example
 * ```typescript
 * const controlClusters = getClustersInControlAtStep(schedule, 2);
 * console.log(`${controlClusters.length} clusters in control at step 2`);
 * ```
 */
export function getClustersInControlAtStep(
  schedule: SteppedWedgeSchedule,
  currentStep: number
): string[] {
  const controlClusters: string[] = [];

  for (const [clusterId, switchStep] of Object.entries(schedule.clusterToStep)) {
    if (currentStep < switchStep) {
      controlClusters.push(clusterId);
    }
  }

  return controlClusters;
}

/**
 * Format Schedule as Table
 * Creates human-readable table representation of stepped wedge design
 *
 * Table Format:
 * ```
 * Step | Clusters Switching | Total Control | Total Treatment
 * -----|-------------------|---------------|----------------
 *  0   | -                 | 12            | 0
 *  1   | C1, C2, C3        | 9             | 3
 *  2   | C4, C5, C6        | 6             | 6
 *  ...
 * ```
 *
 * Time Complexity: O(s * c) where s = steps, c = clusters
 * Space Complexity: O(s * c)
 *
 * @param schedule - Stepped wedge schedule
 * @param numSteps - Total number of steps
 * @returns Formatted table string
 *
 * @example
 * ```typescript
 * const table = formatScheduleAsTable(schedule, 4);
 * console.log(table);
 * ```
 */
export function formatScheduleAsTable(
  schedule: SteppedWedgeSchedule,
  numSteps: number
): string {
  const totalClusters = Object.keys(schedule.clusterToStep).length;
  const lines: string[] = [];

  // Header
  lines.push('Step | Clusters Switching        | Total Control | Total Treatment');
  lines.push('-----|---------------------------|---------------|----------------');

  // Step 0 (baseline)
  lines.push(` 0   | (baseline)                | ${totalClusters.toString().padStart(13)} | ${0..toString().padStart(15)}`);

  // Steps 1 to numSteps
  for (let step = 1; step <= numSteps; step++) {
    const switchingClusters = schedule.stepToClusters[step] || [];
    const clustersStr = switchingClusters.length > 0
      ? switchingClusters.slice(0, 3).join(', ') + (switchingClusters.length > 3 ? '...' : '')
      : '-';

    const totalTreated = Object.values(schedule.clusterToStep)
      .filter(s => s <= step).length;
    const totalControl = totalClusters - totalTreated;

    const stepStr = step.toString().padStart(2);
    const clustersStrPadded = clustersStr.padEnd(25);
    const controlStr = totalControl.toString().padStart(13);
    const treatmentStr = totalTreated.toString().padStart(15);

    lines.push(` ${stepStr}  | ${clustersStrPadded} | ${controlStr} | ${treatmentStr}`);
  }

  return lines.join('\n');
}
