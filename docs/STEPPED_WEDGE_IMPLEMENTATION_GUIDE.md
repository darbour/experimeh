# Stepped Wedge Design Implementation Guide

## What is a Stepped Wedge Design?

A **stepped wedge cluster-randomized trial** is a design where:

1. **All clusters start in control** (baseline)
2. **At regular intervals (steps)**, a subset of clusters switches from control to treatment
3. **Switches are unidirectional** - once in treatment, clusters stay in treatment
4. **The ORDER of switching is randomized**, not the timing
5. **By the end, all clusters receive the treatment**

### Visual Example

```
Time →     Step 0   Step 1   Step 2   Step 3   Step 4
Cluster 1:   C        C        T        T        T
Cluster 2:   C        T        T        T        T
Cluster 3:   C        C        C        T        T
Cluster 4:   C        C        C        C        T
Cluster 5:   C        C        T        T        T

C = Control, T = Treatment
```

### Common Use Cases

- **Healthcare**: Rolling out new clinical protocols across hospital units
- **Education**: Implementing new curriculum across schools
- **Public Health**: Deploying interventions where everyone should eventually receive treatment
- **Policy**: Implementing new regulations across regions
- **Infrastructure**: Deploying new systems where full rollback isn't feasible

---

## Difficulty Assessment: **MODERATE** ⭐⭐⭐☆☆

### Why It's Manageable

The current system already has components that make this easier:

✅ **Time-based assignment** - Switchback design already does this
✅ **Cluster support** - Can use `randomizationUnit: 'other'` with cluster IDs
✅ **Deterministic hashing** - Can create stable cluster-to-step mappings
✅ **Flexible configuration** - JSONB design config supports custom structures
✅ **Mixed effects analysis** - Framework exists for complex statistical models

### What Needs to Be Added

1. **New design type**: `'stepped_wedge'`
2. **Configuration model**: Step schedule, cluster definitions
3. **Assignment algorithm**: Cluster-aware, time-aware, unidirectional
4. **Analysis methods**: Mixed effects models accounting for time trends
5. **Validation**: Ensure cluster assignment is stable

---

## Implementation Plan

### Phase 1: Data Models (1-2 hours)

#### 1. Add Design Type Enum

**File**: `src/models/experiment.ts`

```typescript
export enum ExperimentDesignType {
  AB = 'ab',
  MULTIVARIATE = 'multivariate',
  FACTORIAL = 'factorial',
  WITHIN_SUBJECTS = 'within_subjects',
  SWITCHBACK = 'switchback',
  STEPPED_WEDGE = 'stepped_wedge',  // ← NEW
}
```

#### 2. Add Configuration Interface

```typescript
export interface SteppedWedgeConfig {
  /** Number of time steps (periods) */
  numSteps: number;

  /** Duration of each step in minutes */
  stepDurationMinutes: number;

  /** Total number of clusters */
  numClusters: number;

  /** Cluster assignment schedule (auto-generated if not provided) */
  schedule?: SteppedWedgeSchedule;

  /** How to determine cluster membership */
  clusterKey: string; // e.g., 'hospital_id', 'school_id', 'region'

  /** Optional: Control clusters that never switch */
  permanentControlClusters?: string[];
}

export interface SteppedWedgeSchedule {
  /** Map of step number → cluster IDs that switch at this step */
  stepToClusters: Record<number, string[]>;

  /** Map of cluster ID → step at which it switches */
  clusterToStep: Record<string, number>;

  /** Randomization seed for reproducibility */
  seed: string;
}
```

#### 3. Add Assignment Result Type

```typescript
export interface SteppedWedgeAssignmentResult extends AssignmentResult {
  currentStep: number;
  stepStart: Date;
  stepEnd: Date;
  clusterId: string;
  switchStep: number; // Which step this cluster switches (or Infinity for permanent control)
  inTreatment: boolean; // True if currentStep >= switchStep
}
```

---

### Phase 2: Assignment Algorithm (2-3 hours)

**File**: `src/core/assignment.ts`

```typescript
/**
 * Stepped Wedge Assignment
 * Cluster-level unidirectional switching from control to treatment
 *
 * Algorithm:
 * 1. Determine current step based on elapsed time
 * 2. Identify cluster from context
 * 3. Look up when this cluster should switch
 * 4. Assign control if currentStep < switchStep, treatment otherwise
 *
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 *
 * Statistical Properties:
 * - Cluster-level randomization
 * - Within-cluster correlation must be accounted for in analysis
 * - Time trends controlled by design
 * - Unidirectional treatment effect
 *
 * @param experiment - Experiment with stepped wedge config
 * @param clusterId - Cluster identifier from context
 * @param currentTime - Current timestamp
 * @returns Assignment with step and cluster information
 */
export function assignSteppedWedge(
  experiment: ExperimentConfig,
  clusterId: string,
  currentTime: Date = new Date()
): SteppedWedgeAssignmentResult {
  const config = experiment.designConfig as SteppedWedgeConfig;

  if (!config || !config.numSteps || !config.stepDurationMinutes) {
    throw new Error('Stepped wedge requires numSteps and stepDurationMinutes');
  }

  // Calculate current step
  const startTime = experiment.startDate.getTime();
  const currentTimeMs = currentTime.getTime();
  const elapsedMinutes = (currentTimeMs - startTime) / (1000 * 60);
  const currentStep = Math.floor(elapsedMinutes / config.stepDurationMinutes);

  // Clamp to valid range [0, numSteps]
  const validStep = Math.max(0, Math.min(currentStep, config.numSteps));

  // Calculate step boundaries
  const stepStart = new Date(
    startTime + validStep * config.stepDurationMinutes * 60 * 1000
  );
  const stepEnd = new Date(
    startTime + (validStep + 1) * config.stepDurationMinutes * 60 * 1000
  );

  // Generate or retrieve switching schedule
  const schedule = config.schedule || generateSteppedWedgeSchedule(
    config.numClusters,
    config.numSteps,
    experiment.id // Use as seed for deterministic randomization
  );

  // Determine when this cluster switches
  const switchStep = schedule.clusterToStep[clusterId];

  if (switchStep === undefined) {
    throw new Error(`Cluster ${clusterId} not found in schedule`);
  }

  // Check if in treatment (switched already)
  const inTreatment = validStep >= switchStep;

  return {
    variantKey: inTreatment ? 'treatment' : 'control',
    inExperiment: true,
    reason: `stepped_wedge_step_${validStep}_cluster_${clusterId}`,
    currentStep: validStep,
    stepStart,
    stepEnd,
    clusterId,
    switchStep,
    inTreatment,
    metadata: {
      totalSteps: config.numSteps,
      stepDurationMinutes: config.stepDurationMinutes,
    },
  };
}

/**
 * Generate stepped wedge switching schedule
 * Randomly assigns clusters to steps while ensuring balance
 *
 * @param numClusters - Total number of clusters
 * @param numSteps - Total number of steps (excluding baseline)
 * @param seed - Random seed for reproducibility
 * @returns Schedule mapping clusters to switching steps
 */
export function generateSteppedWedgeSchedule(
  numClusters: number,
  numSteps: number,
  seed: string
): SteppedWedgeSchedule {
  // Create cluster IDs
  const clusterIds = Array.from({ length: numClusters }, (_, i) => `cluster-${i + 1}`);

  // Shuffle clusters deterministically based on seed
  const shuffled = shuffleWithSeed(clusterIds, seed);

  // Distribute clusters evenly across steps
  const clustersPerStep = Math.ceil(numClusters / numSteps);

  const stepToClusters: Record<number, string[]> = {};
  const clusterToStep: Record<string, number> = {};

  shuffled.forEach((clusterId, index) => {
    // Step 0 is baseline (all control), so switching starts at step 1
    const switchStep = Math.floor(index / clustersPerStep) + 1;
    const cappedStep = Math.min(switchStep, numSteps);

    if (!stepToClusters[cappedStep]) {
      stepToClusters[cappedStep] = [];
    }
    stepToClusters[cappedStep].push(clusterId);
    clusterToStep[clusterId] = cappedStep;
  });

  return {
    stepToClusters,
    clusterToStep,
    seed,
  };
}

/**
 * Deterministic shuffle using seed
 */
function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  const hash = hashExperiment(seed, 'shuffle', '');

  // Seeded random using hash
  let currentHash = hash;

  for (let i = arr.length - 1; i > 0; i--) {
    // Generate next "random" number
    currentHash = hashExperiment(seed, 'shuffle', currentHash.toString());
    const j = currentHash % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
```

---

### Phase 3: Service Integration (1 hour)

**File**: `src/services/assignment-service.ts`

Update `performAssignment` to handle stepped wedge:

```typescript
private async performAssignment(
  experiment: Experiment,
  context: EvaluationContext
): Promise<AssignmentResult> {
  switch (experiment.designType) {
    case 'stepped_wedge': {
      // Extract cluster ID from context
      const config = experiment.designConfig as SteppedWedgeConfig;
      const clusterId = context.attributes?.[config.clusterKey];

      if (!clusterId) {
        throw new AssignmentError(
          `Cluster key '${config.clusterKey}' not found in context`
        );
      }

      return assignSteppedWedge(experiment, clusterId, new Date());
    }

    // ... existing cases ...
  }
}
```

---

### Phase 4: Statistical Analysis (3-4 hours)

**File**: `src/analysis/stepped-wedge-analysis.ts`

```typescript
/**
 * Stepped Wedge Analysis
 * Uses mixed effects model or GEE to account for:
 * - Cluster-level randomization
 * - Within-cluster correlation
 * - Time trends
 * - Treatment effects
 *
 * Model: Y_ij = β₀ + β₁(time) + β₂(treatment) + u_i + ε_ij
 *
 * Where:
 * - Y_ij = outcome for individual j in cluster i
 * - time = step number (controls for secular trends)
 * - treatment = 0 (control) or 1 (treatment)
 * - u_i = random intercept for cluster i
 * - ε_ij = individual-level error
 */

export interface SteppedWedgeAnalysisResult {
  treatmentEffect: {
    estimate: number;      // β₂ coefficient
    standardError: number;
    pValue: number;
    confidenceInterval: [number, number];
  };

  timeEffect: {
    estimate: number;      // β₁ coefficient
    standardError: number;
    pValue: number;
  };

  intraclusterCorrelation: number; // ICC

  clusterEffects: Array<{
    clusterId: string;
    randomIntercept: number;
    sampleSize: number;
  }>;

  modelFit: {
    aic: number;
    bic: number;
    logLikelihood: number;
  };

  assumptions: {
    normalityOfResiduals: boolean;
    homoscedasticity: boolean;
    warnings: string[];
  };
}

export async function analyzeSteppedWedge(
  experimentId: string,
  data: SteppedWedgeDataPoint[]
): Promise<SteppedWedgeAnalysisResult> {
  // Implementation would use:
  // 1. Linear mixed effects model (REML or ML estimation)
  // 2. Cluster as random effect
  // 3. Time as fixed effect
  // 4. Treatment as fixed effect
  // 5. Robust standard errors

  // This is complex - could integrate with R or Python for mixed models
  // Or implement REML estimation from scratch

  // Placeholder showing structure
  throw new Error('Not yet implemented - requires mixed effects modeling');
}
```

---

### Phase 5: Validation & Testing (2-3 hours)

**File**: `tests/unit/core/stepped-wedge.test.ts`

```typescript
describe('Stepped Wedge Assignment', () => {
  test('should assign control before switch step', () => {
    // Test that clusters in early steps get control
  });

  test('should assign treatment after switch step', () => {
    // Test that clusters switch to treatment at right time
  });

  test('should maintain cluster stickiness', () => {
    // Same cluster always switches at same step
  });

  test('should generate balanced schedule', () => {
    // Clusters distributed evenly across steps
  });

  test('should handle edge cases', () => {
    // Before start, after end, etc.
  });
});
```

---

## Effort Estimate

| Component | Effort | Priority |
|-----------|--------|----------|
| Data models & types | 1-2 hours | High |
| Assignment algorithm | 2-3 hours | High |
| Service integration | 1 hour | High |
| Basic analysis (time trends) | 2 hours | Medium |
| Mixed effects analysis | 4-6 hours | Low* |
| Testing | 2-3 hours | High |
| Documentation & examples | 2 hours | Medium |
| **TOTAL** | **14-19 hours** | |

*Mixed effects modeling is complex - could use external R/Python integration initially

---

## Comparison to Existing Designs

| Feature | Switchback | Stepped Wedge |
|---------|-----------|---------------|
| Randomization level | Time periods | Clusters |
| Direction | Bidirectional | Unidirectional |
| All units treated? | No | Yes |
| Stickiness | None (switches) | Sticky after switch |
| Analysis | Clustered SE | Mixed effects |
| Use case | Network effects | Ethical requirement to treat all |

**Similarity**: Both are time-based and require tracking periods/steps

**Key Difference**: Switchback switches EVERYONE at the same time, Stepped Wedge switches DIFFERENT CLUSTERS at different times

---

## Recommended Approach

### Option 1: Full Implementation (2-3 days)
Implement all components including mixed effects analysis

**Pros**: Complete feature, publication-ready
**Cons**: Significant effort, especially statistical modeling

### Option 2: MVP Implementation (1 day)
Implement assignment logic, basic time-trend analysis, defer advanced stats

**Pros**: Get feature working quickly
**Cons**: Users need to export data for proper analysis

### Option 3: External Analysis (4-6 hours)
Implement assignment, export data in format for R/Stata analysis

**Pros**: Leverage existing statistical packages
**Cons**: Less integrated experience

---

## Recommendation: **Option 2 (MVP)** ✅

Start with:
1. ✅ Assignment algorithm (3 hours)
2. ✅ Service integration (1 hour)
3. ✅ Basic time-series analysis (2 hours)
4. ✅ Testing (2 hours)
5. ✅ Documentation (1 hour)

**Total: ~9 hours (1 day)**

Then add mixed effects modeling later when needed, or provide:
- Data export in format for R's `lme4` package
- Python script using `statsmodels` for mixed effects
- Integration with external analysis services

This gets stepped wedge working quickly while deferring the most complex statistical component.

---

## Example Configuration

```typescript
const steppedWedgeExperiment = {
  key: 'hospital-handwashing-rollout',
  name: 'Hand Hygiene Protocol Rollout',
  designType: 'stepped_wedge',
  randomizationUnit: 'other', // Clusters, not individuals

  designConfig: {
    numSteps: 5,
    stepDurationMinutes: 10080, // 1 week
    numClusters: 20,
    clusterKey: 'hospital_id',
    // Schedule auto-generated or can specify:
    schedule: {
      clusterToStep: {
        'hospital-1': 1,
        'hospital-2': 1,
        'hospital-3': 2,
        // ... etc
      }
    }
  },

  variants: [
    { key: 'control', name: 'Standard Protocol', allocation: 50 },
    { key: 'treatment', name: 'Enhanced Protocol', allocation: 50 }
  ],

  primaryMetric: 'hand_hygiene_compliance_rate',
  guardrailMetrics: ['patient_satisfaction', 'staff_compliance_time']
};
```

---

## Conclusion

**Difficulty: MODERATE** - About 1-2 days of focused work for MVP

The existing architecture makes this feasible:
- ✅ Already have time-based switching (switchback)
- ✅ Already have flexible configuration
- ✅ Already have deterministic assignment
- ✅ Already have statistical framework

Main additions needed:
- Cluster-aware assignment logic
- Schedule generation
- Time-series analysis with cluster effects

This is definitely achievable and would be a valuable addition for healthcare, education, and policy experiments!
