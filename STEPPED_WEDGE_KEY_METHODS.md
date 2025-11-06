# Stepped Wedge Design: Key Methods Reference

## Core Assignment Functions

### 1. `assignSteppedWedge()`
**Location**: `src/core/assignment.ts`

```typescript
export function assignSteppedWedge(
  experiment: ExperimentConfig,
  clusterId: string,
  currentTime: Date = new Date()
): SteppedWedgeAssignmentResult

// Returns:
// {
//   variantKey: 'control' | 'treatment',
//   inExperiment: boolean,
//   reason: string,
//   currentStep: number,
//   stepStart: Date,
//   stepEnd: Date,
//   clusterId: string,
//   switchStep: number,
//   inTreatment: boolean,
//   metadata: { ... }
// }
```

**Purpose**: Main assignment algorithm for stepped wedge designs
- Calculates current step from elapsed time
- Looks up cluster's switch step from schedule
- Returns control/treatment based on step comparison
- O(1) time complexity

---

### 2. `generateSteppedWedgeSchedule()`
**Location**: `src/core/assignment.ts`

```typescript
export function generateSteppedWedgeSchedule(
  numClusters: number,
  numSteps: number,
  seed: string,
  clusterIds?: string[]
): SteppedWedgeSchedule

// Returns:
// {
//   stepToClusters: { [step: number]: string[] },
//   clusterToStep: { [clusterId: string]: number },
//   seed: string
// }
```

**Purpose**: Generates randomized cluster switching schedule
- Shuffles clusters deterministically using seed
- Distributes evenly across steps (starting from step 1)
- Returns bidirectional mapping for efficient lookup

---

## Service Layer Methods

### 3. `DefaultAssignmentAlgorithm.assignSteppedWedge()`
**Location**: `src/services/assignment-service.ts`

```typescript
class DefaultAssignmentAlgorithm implements IAssignmentAlgorithm {
  assignSteppedWedge(
    experiment: Experiment,
    clusterId: string,
    timestamp: Date
  ): {
    variantKey: string;
    currentStep: number;
    stepStart: Date;
    stepEnd: Date;
    switchStep: number;
    inTreatment: boolean;
  }
}
```

**Purpose**: Service-level wrapper for stepped wedge assignment
- Validates configuration (numSteps, stepDurationMinutes)
- Generates or retrieves schedule
- Calculates step boundaries
- Returns structured assignment result

---

### 4. `AssignmentService.performAssignment()`
**Location**: `src/services/assignment-service.ts`

```typescript
private async performAssignment(
  experiment: Experiment,
  context: EvaluationContext
): Promise<AssignmentResult>
```

**Stepped Wedge Case**:
```typescript
case 'stepped_wedge':
  // Extract cluster ID from context attributes
  const clusterId = context.attributes?.[config.clusterKey];
  
  // Call algorithm
  const result = this.algorithm.assignSteppedWedge(
    experiment,
    clusterId,
    timestamp
  );
  
  // Return enriched AssignmentResult
  return {
    variantKey: result.variantKey,
    assigned: true,
    currentStep: result.currentStep,
    stepStart: result.stepStart,
    stepEnd: result.stepEnd,
    switchStep: result.switchStep,
    inTreatment: result.inTreatment,
    clusterId: clusterId
  };
```

---

### 5. `AssignmentService.getAssignment()`
**Location**: `src/services/assignment-service.ts`

**Enhanced Caching for Stepped Wedge**:
```typescript
// Build cache key based on experiment type
let cacheKey = `assignment:${experimentKey}:${unitId}`;

// For stepped wedge, include cluster ID and current step
if (experiment.designType === 'stepped_wedge') {
  const clusterId = context.attributes?.[config.clusterKey];
  const currentStep = calculateCurrentStep(experiment);
  cacheKey = `assignment:${experimentKey}:${clusterId}:step:${currentStep}`;
}
```

**Purpose**: Ensures cache invalidation when step changes

---

### 6. `ConfigurationService.validateDesignConfig()`
**Location**: `src/services/configuration-service.ts`

```typescript
private validateDesignConfig(experiment: any): void {
  // ...
  case 'stepped_wedge':
    // Required fields
    if (!designConfig.numSteps) throw new ValidationError(...);
    if (!designConfig.stepDurationMinutes) throw new ValidationError(...);
    if (!designConfig.clusterKey) throw new ValidationError(...);
    
    // Must have either numClusters or schedule
    if (!designConfig.numClusters && !designConfig.schedule) {
      throw new ValidationError(...);
    }
    
    // Must have exactly 2 variants
    if (variants.length !== 2) throw new ValidationError(...);
    
    // Validate schedule if provided
    if (designConfig.schedule) {
      // Check max step <= numSteps
      // Verify consistency between mappings
    }
}
```

**Purpose**: Comprehensive validation of stepped wedge configuration

---

### 7. `ConfigurationService.updateExperiment()`
**Location**: `src/services/configuration-service.ts`

**Stepped Wedge Protections**:
```typescript
// Prevent schedule changes on running experiments
if (existing.status === 'running' && 
    existing.designType === 'stepped_wedge' && 
    updates.designConfig?.schedule) {
  throw new ConflictError(
    'Cannot modify stepped wedge schedule on a running experiment'
  );
}

// Allow schedule regeneration for draft experiments
if (existing.status === 'draft' && 
    existing.designType === 'stepped_wedge' && 
    updates.designConfig) {
  // Schedule will be auto-generated during assignment
}
```

**Purpose**: Prevents breaking changes to running experiments

---

### 8. `AnalysisService.analyzeSteppedWedge()`
**Location**: `src/services/analysis-service.ts`

```typescript
private async analyzeSteppedWedge(
  experiment: Experiment,
  data: ExperimentAnalysisData,
  alpha: number
): Promise<AnalysisResult>
```

**Process**:
1. Groups data by cluster and step
2. Analyzes primary and secondary metrics
3. Calculates ICC (intracluster correlation)
4. Generates warnings about:
   - Need for mixed effects models
   - High ICC values
   - Insufficient clusters
   - Time trends

**Helper Methods**:
```typescript
private groupByCluster(data: ExperimentAnalysisData): Record<string, any>
private calculateICC(clusterData: Record<string, any>, metric: string): number
private detectTimeTrend(clusterData: Record<string, any>, metric: string): boolean
```

---

## Type Definitions

### ExperimentConfig (Core)
```typescript
interface ExperimentConfig {
  designType: 'stepped_wedge';
  designConfig?: SteppedWedgeConfig;
  // ...
}

interface SteppedWedgeConfig {
  numSteps: number;
  stepDurationMinutes: number;
  numClusters: number;
  clusterKey: string;
  schedule?: SteppedWedgeSchedule;
  clusterIds?: string[];
}
```

### DesignConfig (Types)
```typescript
interface DesignConfig {
  numSteps?: number;
  stepDurationMinutes?: number;
  numClusters?: number;
  clusterKey?: string;
  schedule?: SteppedWedgeSchedule;
  permanentControlClusters?: string[];
}
```

### AssignmentResult (Types)
```typescript
interface AssignmentResult {
  variantKey: string;
  assigned: boolean;
  reason?: string;
  // Stepped wedge specific
  currentStep?: number;
  stepStart?: Date;
  stepEnd?: Date;
  clusterId?: string;
  switchStep?: number;
  inTreatment?: boolean;
}
```

---

## Error Handling

### Common Errors
1. **Missing Configuration**
   - `AssignmentError('Stepped wedge requires numSteps and stepDurationMinutes')`
   - `AssignmentError('Stepped wedge requires clusterKey in designConfig')`

2. **Missing Cluster ID**
   - `AssignmentError('Cluster key "hospital_id" not found in context attributes')`
   - Includes list of available attributes for debugging

3. **Cluster Not in Schedule**
   - `Error('Cluster "hospital-7" not found in schedule')`
   - Lists available clusters for debugging

4. **Validation Errors**
   - `ValidationError('Stepped wedge designs must specify clusterKey')`
   - `ValidationError('Schedule contains step 6 which exceeds numSteps (5)')`
   - `ValidationError('Inconsistent schedule: cluster count mismatch')`

5. **Running Experiment Protection**
   - `ConflictError('Cannot modify stepped wedge schedule on a running experiment')`

---

## Usage Flow

### 1. Create Experiment
```typescript
const experiment = await configService.createExperiment({
  designType: 'stepped_wedge',
  designConfig: {
    numSteps: 5,
    stepDurationMinutes: 10080,
    numClusters: 20,
    clusterKey: 'hospital_id'
  },
  variants: [
    { key: 'control', allocation: 50 },
    { key: 'treatment', allocation: 50 }
  ]
});
// Validation runs automatically
```

### 2. Get Assignment
```typescript
const assignment = await assignmentService.getAssignment(
  'experiment-key',
  {
    unitId: 'user-123',
    attributes: {
      hospital_id: 'hospital-7'  // Cluster ID
    }
  }
);
// Returns: { variantKey, currentStep, switchStep, inTreatment, ... }
```

### 3. Cache Behavior
- **First request**: Computes assignment, caches with key `assignment:exp:hospital-7:step:2`
- **Subsequent requests in same step**: Cache hit, returns immediately
- **Next step**: Cache miss (different key), recomputes, caches with new step

### 4. Analysis
```typescript
const analysis = await analysisService.analyzeExperiment(experimentId, data);
// Returns results with stepped wedge warnings
// Includes recommendations for proper mixed effects analysis
```

---

## Implementation Notes

1. **Determinism**: All randomization uses hash-based seeding for reproducibility
2. **Performance**: O(1) assignment lookup, O(1) cache operations
3. **Flexibility**: Auto-generates schedule or accepts pre-defined
4. **Safety**: Immutable schedules for running experiments
5. **Guidance**: Analysis includes warnings about proper statistical methods

---

## Testing Checklist

- [ ] Core assignment logic with various step/cluster combinations
- [ ] Schedule generation determinism (same seed → same schedule)
- [ ] Cache key generation for stepped wedge
- [ ] Cluster ID extraction from context
- [ ] Error handling for missing cluster ID
- [ ] Validation of complete stepped wedge configs
- [ ] Validation rejection of invalid configs
- [ ] Schedule consistency validation
- [ ] Running experiment immutability enforcement
- [ ] Analysis execution with stepped wedge data
- [ ] Warning generation in analysis
