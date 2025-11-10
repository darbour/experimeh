# Feature Flag-Based Experimentation System - Implementation Guide

## 🎯 Vision

Transform the experimentation platform from three disconnected systems into a unified, statistically rigorous platform where:
- **Feature flags are the foundation** (the mechanism)
- **Experiments are the methodology** (the design)
- **Analysis ensures validity** (the rigor)

## ✅ What's Been Built (Phase 1)

### 1. Data Models & Type System
**Location**: `src/models/`

**Key Changes**:
- ✅ `Experiment` now requires `featureFlagId` (enforces flag-first architecture)
- ✅ `VariantAllocation` type maps flag variants to experiment roles (control/treatment)
- ✅ `FeatureFlag.linkedExperiments` replaces single `experimentId` (supports multiple experiments)
- ✅ `UnifiedAssignmentResult` bridges flags and experiments
- ✅ Enhanced `AssignmentReason` enum with flag-specific reasons

**Impact**: Establishes proper relationships at the type level. Experiments MUST link to flags.

### 2. Unified Assignment Service
**Location**: `src/services/unified-assignment-service.ts`

**How It Works**:
```
1. evaluate(flagKey, unitId) called
2. Fetch feature flag
3. Check for active linked experiments
4. IF experiment active:
   - Use experiment allocation logic
   - Apply experiment targeting rules
   - Log exposure with experiment context
5. ELSE:
   - Use feature flag rollout logic
   - Apply flag targeting rules
   - Log exposure without experiment
6. Return UnifiedAssignmentResult
```

**Key Methods**:
- `evaluate()`: Main evaluation (single flag)
- `evaluateBatch()`: Batch evaluation (multiple flags)
- `evaluateWithExperiment()`: Experiment-based allocation
- `evaluateWithFlagRollout()`: Standard flag rollout

**Performance**:
- Caching with configurable TTL
- Consistent hashing for bucketing
- Batch evaluation support

### 3. Analysis Engines
**Location**: `src/analysis/analysis-engine.ts`

**Engines Implemented**:

#### A/B Test Engine
- Two-sample t-test (continuous metrics)
- Welch's correction for unequal variances
- Proper confidence intervals
- Effect size (Cohen's d)
- Power analysis

#### Factorial Engine
- ANOVA for main effects
- Interaction effect testing
- Multiple comparison correction (Bonferroni/BH)
- Partial eta-squared effect sizes

#### Switchback Engine
- Cluster-robust standard errors
- Temporal correlation handling
- Washout period consideration

#### Stepped Wedge Engine
- Mixed-effects models
- ICC estimation
- Time trend adjustment
- Hussey-Hughes sample size formula

**Usage**:
```typescript
const factory = new AnalysisEngineFactory();
const engine = factory.getEngine(ExperimentDesignType.AB);
const result = await engine.analyze(data);
```

### 4. Quality Check Framework
**Location**: `src/analysis/quality-checks.ts`

**Checks Implemented**:

#### Sample Ratio Mismatch (CRITICAL)
- Chi-square goodness of fit test
- Detects allocation bugs
- **Severity**: ERROR (stops experiment if failed)

#### Guardrail Metrics
- Ensures critical metrics haven't degraded
- Configurable thresholds per metric
- **Severity**: ERROR

**Usage**:
```typescript
const runner = new QualityCheckRunner();
const report = await runner.runAll(data, metadata);
if (!report.overallPassed) {
  // Stop experiment, investigate issues
}
```

## 🚧 What's Next (Phase 2)

### 5. API Route Updates
**Location**: `src/api/routes/`

**Required Changes**:

#### A. `/api/v1/experiments` (POST)
```typescript
// BEFORE: No flag validation
export async function createExperiment(req, res) {
  const experiment = await experimentStore.create(req.body);
  return res.json(experiment);
}

// AFTER: Enforce flag existence
export async function createExperiment(req, res) {
  const { featureFlagId, variantAllocations } = req.body;

  // Validate flag exists
  const flag = await featureFlagStore.get(featureFlagId);
  if (!flag) {
    return res.status(400).json({ error: 'Feature flag not found' });
  }

  // Validate variant allocations match flag variants
  const flagVariantIds = flag.variants.map(v => v.id);
  const allocationIds = variantAllocations.map(a => a.flagVariantId);
  const invalidIds = allocationIds.filter(id => !flagVariantIds.includes(id));

  if (invalidIds.length > 0) {
    return res.status(400).json({
      error: 'Invalid flag variant IDs in allocations',
      invalidIds
    });
  }

  // Create experiment
  const experiment = await experimentStore.create(req.body);

  // Update flag's linkedExperiments
  await featureFlagStore.addLinkedExperiment(featureFlagId, {
    experimentId: experiment.id,
    experimentKey: experiment.key,
    status: 'draft',
    priority: 1,
    linkedAt: new Date(),
  });

  return res.json(experiment);
}
```

#### B. `/api/v1/flags/:key/evaluate` (GET)
```typescript
// BEFORE: Simple flag evaluation
export async function evaluateFlag(req, res) {
  const { key } = req.params;
  const { unitId } = req.query;

  const flag = await featureFlagStore.getByKey(key);
  // ... simple allocation logic
}

// AFTER: Use UnifiedAssignmentService
import { UnifiedAssignmentService } from '../services/unified-assignment-service';

const assignmentService = new UnifiedAssignmentService({
  enableCache: true,
  enableExposureLogging: true,
});

export async function evaluateFlag(req, res) {
  const { key } = req.params;
  const { unitId } = req.query;

  const result = await assignmentService.evaluate({
    flagKey: key,
    unitId,
    context: {
      ...req.query.context,
      customAttributes: req.body?.attributes || {},
    },
  });

  return res.json({
    flagKey: result.flagKey,
    variant: result.variantKey,
    value: result.value,
    experiment: result.experiment,  // null if no active experiment
    exposureId: result.exposureId,
    reason: result.reason,
  });
}
```

#### C. New route: `/api/v1/experiments/create-with-flag` (POST)
```typescript
// Creates both flag and experiment in one transaction
export async function createExperimentWithFlag(req, res) {
  const { flag, experiment } = req.body;

  // Create flag first
  const createdFlag = await featureFlagStore.create(flag);

  // Create experiment with flag ID
  const createdExperiment = await experimentStore.create({
    ...experiment,
    featureFlagId: createdFlag.id,
  });

  // Link them
  await featureFlagStore.addLinkedExperiment(createdFlag.id, {
    experimentId: createdExperiment.id,
    experimentKey: createdExperiment.key,
    status: 'draft',
    priority: 1,
    linkedAt: new Date(),
  });

  return res.json({
    flag: createdFlag,
    experiment: createdExperiment,
  });
}
```

### 6. Frontend Components
**Location**: `dashboard/src/`

#### A. Feature Flag Management (`pages/FeatureFlags.tsx`)
```tsx
export default function FeatureFlagsList() {
  const { data: flags } = useFeatureFlags();

  return (
    <div>
      <h1>Feature Flags</h1>
      <button onClick={() => navigate('/flags/new')}>
        Create Feature Flag
      </button>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Status</th>
            <th>Variants</th>
            <th>Linked Experiments</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(flag => (
            <FlagRow key={flag.id} flag={flag} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### B. Enhanced Experiment Wizard (`pages/CreateExperiment/`)

**Structure**:
```
CreateExperiment/
├── index.tsx                    (Main wizard controller)
├── Step1_SelectFlag.tsx         (Flag selection)
├── Step2_DesignType.tsx         (Design type with visual diagrams)
├── Step3_Configure.tsx          (Design-specific configuration)
├── Step4_PowerAnalysis.tsx      (Sample size calculator)
├── Step5_Review.tsx             (Summary and launch)
└── components/
    ├── DesignTypeCard.tsx       (Visual card for each design)
    ├── FactorialMatrix.tsx      (Visual factorial combination matrix)
    ├── SwitchbackTimeline.tsx   (Timeline visualization)
    └── SteppedWedgeSchedule.tsx (Cluster rollout visualization)
```

**Step 2: Design Type Selection (The Key UX Improvement)**
```tsx
export function Step2_DesignType({ designType, setDesignType, flag }: Props) {
  return (
    <div className="space-y-6">
      <h2>Select Experiment Design</h2>

      <div className="grid grid-cols-2 gap-4">
        <DesignTypeCard
          type="ab"
          selected={designType === 'ab'}
          onClick={() => setDesignType('ab')}
          title="A/B Test"
          description="Standard two-variant test"
          diagram={<ABTestDiagram />}
          stats={{
            sampleMultiplier: '1x',
            power: 'Standard',
            complexity: 'Simple',
            runtime: 'Fast',
          }}
          bestFor={[
            'Single feature changes',
            'Clear winner needed',
            'Fast decisions',
          ]}
        />

        <DesignTypeCard
          type="factorial"
          selected={designType === 'factorial'}
          onClick={() => setDesignType('factorial')}
          title="Factorial Design"
          description="Test multiple factors simultaneously"
          diagram={<FactorialDiagram />}
          stats={{
            sampleMultiplier: '2-4x',
            power: 'Reduced',
            complexity: 'Complex',
            runtime: 'Longer',
          }}
          bestFor={[
            'Multiple interacting factors',
            'Interaction effects matter',
            'Optimize combinations',
          ]}
        />

        {/* Similar cards for switchback, stepped_wedge, etc. */}
      </div>

      <DesignExplainer designType={designType} />
    </div>
  );
}
```

**Visual Diagrams** (Critical for Clarity):
```tsx
function ABTestDiagram() {
  return (
    <svg viewBox="0 0 200 100" className="w-full h-auto">
      {/* Users flow */}
      <rect x="10" y="40" width="40" height="20" fill="#ddd" />
      <text x="30" y="55" textAnchor="middle">Users</text>

      {/* Split arrow */}
      <path d="M 50 50 L 80 30" stroke="#333" />
      <path d="M 50 50 L 80 70" stroke="#333" />

      {/* Control */}
      <rect x="80" y="20" width="60" height="20" fill="#blue" />
      <text x="110" y="35" textAnchor="middle">Control (50%)</text>

      {/* Treatment */}
      <rect x="80" y="60" width="60" height="20" fill="#green" />
      <text x="110" y="75" textAnchor="middle">Treatment (50%)</text>
    </svg>
  );
}

function FactorialDiagram() {
  return (
    <svg viewBox="0 0 200 100" className="w-full h-auto">
      {/* 2x2 grid showing Factor A x Factor B */}
      <rect x="50" y="20" width="40" height="30" fill="#blue" />
      <text x="70" y="40">A₀B₀</text>

      <rect x="110" y="20" width="40" height="30" fill="#green" />
      <text x="130" y="40">A₀B₁</text>

      <rect x="50" y="60" width="40" height="30" fill="#yellow" />
      <text x="70" y="80">A₁B₀</text>

      <rect x="110" y="60" width="40" height="30" fill="#red" />
      <text x="130" y="80">A₁B₁</text>
    </svg>
  );
}
```

#### C. Design-Specific Configuration

**Factorial Configuration**:
```tsx
export function FactorialConfiguration({ config, setConfig, flag }: Props) {
  const [factors, setFactors] = useState<Factor[]>([
    { name: 'button_color', levels: ['blue', 'green'] },
    { name: 'cta_text', levels: ['Buy Now', 'Get Started'] },
  ]);

  // Auto-generate combinations
  const combinations = useMemo(() => {
    return generateFactorialCombinations(factors);
  }, [factors]);

  return (
    <div className="space-y-6">
      <h3>Define Factors</h3>

      {factors.map((factor, i) => (
        <FactorEditor
          key={i}
          factor={factor}
          onChange={(updated) => updateFactor(i, updated)}
          onRemove={() => removeFactor(i)}
        />
      ))}

      <button onClick={addFactor}>Add Factor</button>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4>Generated Combinations ({combinations.length})</h4>
        <FactorialMatrix combinations={combinations} />
        <p className="text-sm text-gray-600 mt-2">
          Each combination will receive {(100 / combinations.length).toFixed(1)}% of traffic
        </p>
      </div>
    </div>
  );
}
```

**Switchback Timeline Editor**:
```tsx
export function SwitchbackConfiguration({ config, setConfig }: Props) {
  const periods = useMemo(() => {
    return generateSwitchbackPeriods(
      config.periodLengthMinutes,
      config.numPeriods
    );
  }, [config.periodLengthMinutes, config.numPeriods]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>Period Length (minutes)</label>
          <input
            type="number"
            value={config.periodLengthMinutes}
            onChange={(e) => setConfig({
              ...config,
              periodLengthMinutes: Number(e.target.value)
            })}
          />
        </div>

        <div>
          <label>Washout Period (minutes)</label>
          <input
            type="number"
            value={config.washoutPeriodMinutes}
            onChange={(e) => setConfig({
              ...config,
              washoutPeriodMinutes: Number(e.target.value)
            })}
          />
        </div>
      </div>

      <SwitchbackTimeline periods={periods} />

      <div className="bg-blue-50 p-4 rounded">
        <h4>How Switchback Works</h4>
        <p>
          All users experience BOTH variants over time. The system switches
          between variants every {config.periodLengthMinutes} minutes.
          This design controls for marketplace interference.
        </p>
      </div>
    </div>
  );
}
```

#### D. Power Analysis Calculator
```tsx
export function PowerAnalysisCalculator({
  designType,
  onCalculated
}: Props) {
  const [config, setConfig] = useState({
    baselineValue: 10,
    minimumDetectableEffect: 5,
    alpha: 0.05,
    power: 0.80,
  });

  const result = useMemo(() => {
    const factory = new AnalysisEngineFactory();
    const engine = factory.getEngine(designType);
    return engine.calculateSampleSize(config);
  }, [config, designType]);

  return (
    <div className="space-y-6">
      <h3>Statistical Power Calculation</h3>

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Baseline Conversion Rate (%)"
          value={config.baselineValue}
          onChange={(v) => setConfig({ ...config, baselineValue: v })}
        />

        <InputField
          label="Minimum Detectable Effect (%)"
          value={config.minimumDetectableEffect}
          onChange={(v) => setConfig({ ...config, minimumDetectableEffect: v })}
          tooltip="Smallest change you want to reliably detect"
        />

        <InputField
          label="Significance Level (α)"
          value={config.alpha}
          onChange={(v) => setConfig({ ...config, alpha: v })}
          tooltip="Probability of false positive (Type I error)"
        />

        <InputField
          label="Statistical Power (1-β)"
          value={config.power}
          onChange={(v) => setConfig({ ...config, power: v })}
          tooltip="Probability of detecting true effect"
        />
      </div>

      <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
        <h4 className="text-lg font-semibold mb-4">Required Sample Size</h4>

        <div className="text-4xl font-bold text-green-900 mb-2">
          {result.requiredSampleSizePerVariant.toLocaleString()}
        </div>
        <div className="text-sm text-gray-600">users per variant</div>

        {result.estimatedRuntimeDays && (
          <div className="mt-4">
            <div className="text-2xl font-semibold text-green-800">
              {result.estimatedRuntimeDays} days
            </div>
            <div className="text-sm text-gray-600">estimated runtime</div>
          </div>
        )}

        <div className="mt-4 space-y-1">
          {result.assumptions.map((assumption, i) => (
            <div key={i} className="text-xs text-gray-600">
              • {assumption}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 7. Rename Survey Experiments
**Changes**:
```
dashboard/src/pages/SurveyExperiments.tsx → SurveyAnalysis.tsx
dashboard/src/pages/NewSurveyAnalysis.tsx → NewSurveyAnalysis.tsx (keep name)
Update all navigation references
Update route paths: /survey-experiments → /survey-analysis
```

**Rationale**: Clarifies that these are post-hoc analysis tools, not live experiments.

### 8. Database Migrations
**Location**: `src/storage/migrations/`

```sql
-- Migration: 001_add_experiment_flag_relationship.sql

-- Add featureFlagId column to experiments
ALTER TABLE experiments
ADD COLUMN feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE RESTRICT;

CREATE INDEX idx_experiments_flag_id ON experiments(feature_flag_id);

-- Add variant_allocations table
CREATE TABLE experiment_variant_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  flag_variant_id UUID NOT NULL,
  flag_variant_key VARCHAR(255) NOT NULL,
  experiment_role VARCHAR(50) NOT NULL,
  allocation_percentage DECIMAL(5,2) NOT NULL CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variant_allocations_experiment ON experiment_variant_allocations(experiment_id);
CREATE INDEX idx_variant_allocations_flag_variant ON experiment_variant_allocations(flag_variant_id);

-- Add linked_experiments to feature flags (JSON column)
ALTER TABLE feature_flags
ADD COLUMN linked_experiments JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_flags_linked_experiments ON feature_flags USING GIN (linked_experiments);

-- Add exposure_logs table for tracking
CREATE TABLE exposure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id VARCHAR(255) NOT NULL,
  flag_id UUID NOT NULL REFERENCES feature_flags(id),
  flag_key VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  variant_key VARCHAR(255) NOT NULL,
  experiment_id UUID REFERENCES experiments(id),
  experiment_key VARCHAR(255),
  variant_role VARCHAR(50),
  assignment_reason VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  context JSONB,
  metadata JSONB,
  INDEX idx_exposure_unit_id (unit_id),
  INDEX idx_exposure_flag_id (flag_id),
  INDEX idx_exposure_experiment_id (experiment_id),
  INDEX idx_exposure_timestamp (timestamp)
);
```

### 9. Testing Strategy
**Location**: `src/__tests__/` and `dashboard/src/__tests__/`

#### Unit Tests

**Unified Assignment Service**:
```typescript
describe('UnifiedAssignmentService', () => {
  it('returns flag default when no experiment linked', async () => {
    const service = new UnifiedAssignmentService();
    service.setFeatureFlags([mockFlag]);

    const result = await service.evaluate({
      flagKey: 'test-flag',
      unitId: 'user-123',
    });

    expect(result.variantKey).toBe('default');
    expect(result.reason).toBe(AssignmentReason.DEFAULT);
    expect(result.experiment).toBeUndefined();
  });

  it('uses experiment allocation when experiment active', async () => {
    const service = new UnifiedAssignmentService();
    service.setFeatureFlags([mockFlagWithExperiment]);
    service.setExperiments([mockActiveExperiment]);

    const result = await service.evaluate({
      flagKey: 'test-flag',
      unitId: 'user-123',
    });

    expect(result.experiment).toBeDefined();
    expect(result.experiment!.id).toBe(mockActiveExperiment.id);
    expect(result.reason).toBe(AssignmentReason.EXPERIMENT_ALLOCATION);
  });
});
```

**Analysis Engines**:
```typescript
describe('ABTestEngine', () => {
  it('correctly calculates t-statistic and p-value', async () => {
    const engine = new ABTestEngine();
    const data = generateMockData({
      control: { n: 1000, mean: 10, std: 2 },
      treatment: { n: 1000, mean: 10.5, std: 2 },
    });

    const result = await engine.analyze(data);

    expect(result.mainEffects[0].pValue).toBeLessThan(0.05);
    expect(result.mainEffects[0].significant).toBe(true);
  });

  it('applies Bonferroni correction for multiple metrics', async () => {
    // Test that secondary metrics use adjusted alpha
  });
});
```

**Quality Checks**:
```typescript
describe('SampleRatioMismatchCheck', () => {
  it('detects allocation imbalance', async () => {
    const check = new SampleRatioMismatchCheck();
    const data = {
      observations: [
        ...Array(900).fill({ variantKey: 'control' }),
        ...Array(100).fill({ variantKey: 'treatment' }),
      ],
    };

    const result = await check.check(data, {
      expectedAllocation: { control: 50, treatment: 50 },
    });

    expect(result.passed).toBe(false);
    expect(result.recommendation).toContain('STOP');
  });
});
```

## 📊 Success Metrics

### Technical Metrics
- [ ] 100% of experiments linked to feature flags (enforced by API)
- [ ] <50ms p99 latency for flag evaluation
- [ ] >95% cache hit rate for assignments
- [ ] Zero SRM errors in production

### User Experience Metrics
- [ ] Users can explain what each design type does (measured via survey)
- [ ] 80% of experiments use correct design for their use case
- [ ] Time to launch experiment reduced by 50%
- [ ] Zero experiments launched with guardrail violations

### Statistical Rigor Metrics
- [ ] 100% of analyses use design-appropriate methods
- [ ] All experiments have documented power analysis
- [ ] Quality checks run on 100% of experiments before launch decision

## 🚀 Deployment Plan

### Phase 1: Backend (Week 1-2)
1. Deploy new data models (with migration)
2. Deploy unified assignment service
3. Update API routes to enforce flag-experiment linking
4. Run parallel evaluation (old + new logic) to validate consistency

### Phase 2: UI (Week 3-4)
1. Launch feature flag management pages
2. Launch new experiment wizard (opt-in beta)
3. Gather feedback, iterate
4. Full rollout of new wizard

### Phase 3: Analysis (Week 5-6)
1. Deploy analysis engines
2. Deploy quality check framework
3. Run retrospective analysis on past experiments
4. Document findings and improvements

## 📚 Documentation Requirements

1. **User Guide**: "How to Design an Experiment"
2. **Technical Docs**: API integration guide
3. **Statistical Reference**: When to use each design type
4. **Runbooks**: What to do when quality checks fail

## 🎓 Training Materials

1. **Video Tutorial**: "Feature Flags + Experiments 101"
2. **Interactive Demo**: Try each design type with sample data
3. **Decision Tree**: Which design should I use?
4. **Common Pitfalls**: What NOT to do

---

This implementation guide provides a complete roadmap from what's built to what's needed, with concrete code examples and clear success criteria.
