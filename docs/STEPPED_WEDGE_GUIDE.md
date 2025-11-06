# Stepped Wedge Cluster-Randomized Trial User Guide

A comprehensive guide for planning, implementing, and analyzing stepped wedge experiments.

## Table of Contents

1. [What is a Stepped Wedge Design?](#what-is-a-stepped-wedge-design)
2. [When to Use Stepped Wedge](#when-to-use-stepped-wedge)
3. [Planning Your Stepped Wedge Experiment](#planning-your-stepped-wedge-experiment)
4. [Implementation Guide](#implementation-guide)
5. [Analysis and Interpretation](#analysis-and-interpretation)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)
7. [Real-World Examples](#real-world-examples)
8. [References and Further Reading](#references-and-further-reading)

---

## What is a Stepped Wedge Design?

### Core Concept

A **stepped wedge design** is a type of cluster-randomized trial where:

1. **All clusters start in the control condition** (baseline period)
2. **Clusters progressively switch from control to treatment** at regular time intervals (steps)
3. **The ORDER of switching is randomized**, not whether they switch
4. **Switching is unidirectional** - once a cluster receives treatment, it stays in treatment
5. **By the end, all clusters have received the treatment**

### Visual Representation

```
Time →        Week 0   Week 1   Week 2   Week 3   Week 4
Hospital A:      C        C        T        T        T
Hospital B:      C        T        T        T        T
Hospital C:      C        C        C        T        T
Hospital D:      C        C        C        C        T

C = Control (standard protocol)
T = Treatment (enhanced protocol)
```

### Key Characteristics

**What Makes It Different**:
- **vs. Parallel Group**: All clusters eventually get treatment (not just some)
- **vs. Crossover**: Unidirectional (don't switch back and forth)
- **vs. Before-After**: Controls for time trends through randomized switching
- **vs. Individual Randomization**: Randomizes at cluster level (not individual)

**The "Wedge" Name**:
When you plot treatment status over time for all clusters, it creates a wedge shape as more clusters progressively adopt treatment.

---

## When to Use Stepped Wedge

### Ideal Scenarios

#### 1. Ethical Imperative for Universal Treatment

**Use When**: It's unethical to permanently withhold treatment from any group.

**Example**:
```
Scenario: New hand hygiene protocol that reduces infections
Problem: Can't deny some hospitals the improved protocol forever
Solution: Stepped wedge - all hospitals eventually get it
```

#### 2. Operational Constraints

**Use When**: You can't implement treatment everywhere simultaneously.

**Examples**:
- Limited implementation resources (staff, equipment, training)
- Logistical challenges in rolling out complex interventions
- Need to learn from early adopters before wider rollout

#### 3. Cluster-Level Interventions

**Use When**: Treatment naturally operates at group level, not individual level.

**Examples**:
- Hospital-wide policy changes
- School district curriculum changes
- Regional infrastructure upgrades
- Community-level public health interventions

#### 4. Irreversible Interventions

**Use When**: Treatment can't be easily withdrawn once implemented.

**Examples**:
- Training programs (can't "untrain" people)
- System infrastructure changes
- Policy implementations
- Educational interventions

### When NOT to Use Stepped Wedge

❌ **Small Number of Clusters**: Need at least 12 clusters; < 8 is underpowered

❌ **Individual-Level Treatment**: If you CAN randomize individuals, do that instead (more power)

❌ **No Ethical Requirement**: If it's okay to have a permanent control group, parallel design is simpler

❌ **Need Quick Results**: Stepped wedge takes longer than parallel designs

❌ **Rapidly Changing Context**: If environment changes quickly, time trends become problematic

❌ **Very High ICC**: If ICC > 0.20, clustering effect is so strong that stepped wedge becomes inefficient

---

## Planning Your Stepped Wedge Experiment

### Step 1: Define Your Clusters

#### What Makes a Good Cluster?

**Key Criteria**:
1. **Clear Boundaries**: Easy to determine who belongs to which cluster
2. **Meaningful Grouping**: Natural administrative or geographic units
3. **Reasonable Size**: 30-200 individuals per cluster typically
4. **Independent**: Minimal interaction between clusters
5. **Stable**: Cluster membership doesn't change during study

**Examples of Good Clusters**:
- Hospitals or hospital units
- Schools or school districts
- Geographic regions
- Franchises or branches
- Teams or departments

**Examples of Poor Clusters**:
- Arbitrary groupings with no meaning
- Overlapping memberships
- Highly interconnected units
- Very small (< 10 individuals) or very large (> 500)

#### How Many Clusters Do You Need?

**Minimum**: 12 clusters (absolute minimum for adequate power)

**Recommended**: 20-30 clusters for typical effects

**Rule of Thumb**:
```
More clusters needed if:
- Higher ICC (more clustering)
- Smaller effect size
- Need higher power
- More time steps
```

**Calculator Example**:
```typescript
// For 80% power to detect 10% relative change
// Baseline rate: 50%
// ICC: 0.05
// Cluster size: 100

Needed: ~24 clusters
With only 12 clusters: Power drops to ~60%
```

### Step 2: Determine Number of Steps

#### Trade-offs

**Fewer Steps (e.g., 3-4)**:
- ✅ More clusters switch per step (more power per comparison)
- ✅ Simpler analysis
- ✅ Shorter overall duration
- ❌ Less granular rollout
- ❌ Fewer time points for trend analysis

**More Steps (e.g., 6-8)**:
- ✅ More gradual rollout (operationally easier)
- ✅ More time points (better trend estimation)
- ✅ Flexibility in implementation
- ❌ Fewer clusters per step (less power)
- ❌ Longer overall duration

**Recommended**: 4-6 steps for most experiments

**Formula**:
```
Clusters per step = Total clusters / Number of steps

Example: 20 clusters, 5 steps
→ 4 clusters switch at each step
```

### Step 3: Set Step Duration

#### Considerations

**Minimum Duration**: Long enough to observe treatment effects

**Maximum Duration**: Short enough to complete study in reasonable time

**Factors to Consider**:
1. **Treatment lag time**: How long until effects appear?
2. **Outcome measurement frequency**: How often can you measure?
3. **Seasonal patterns**: Avoid confounding with seasons
4. **Operational logistics**: Training, deployment, monitoring

**Examples by Context**:

| Context | Typical Step Duration | Rationale |
|---------|----------------------|-----------|
| Hospital protocol | 1-2 weeks | Rapid effect, frequent measurement |
| Education curriculum | 1 semester | Aligned with academic calendar |
| Policy implementation | 1-3 months | Time for adoption and effects |
| Infrastructure | 1-6 months | Long implementation, delayed effects |

**Practical Guidelines**:
```
Step duration should be:
- ≥ 2 × expected treatment lag
- ≥ 1 × outcome measurement period
- < 1/5 × total acceptable study duration
```

### Step 4: Sample Size and Power Calculation

#### Understanding Design Effect

**Key Concept**: Clustering reduces effective sample size

**Formula**:
```
Design Effect (DE) = 1 + (m - 1) × ICC

Where:
  m = average cluster size
  ICC = intracluster correlation
```

**Example**:
```
Cluster size: 100 individuals
ICC: 0.05

DE = 1 + (100 - 1) × 0.05 = 5.95

Effective sample size:
- Actual: 2,000 individuals
- Effective: 2,000 / 5.95 = 336 individuals
- Power loss: 83%!
```

#### Estimating ICC

**If You Have Historical Data**:
```typescript
// Calculate ICC from previous data
const icc = calculateICCFromData(historicalData);
console.log(`Estimated ICC: ${icc}`);
```

**If No Data Available, Use Published Estimates**:

| Context | Typical ICC Range | Use for Planning |
|---------|------------------|------------------|
| Primary care clinics | 0.01 - 0.05 | 0.03 |
| Hospital units | 0.03 - 0.08 | 0.05 |
| Schools (student outcomes) | 0.10 - 0.20 | 0.15 |
| Workplaces | 0.02 - 0.10 | 0.05 |
| Communities | 0.01 - 0.05 | 0.03 |

**Conservative Approach**: Use upper end of range for planning

#### Power Calculation Tool

```typescript
import { calculateSteppedWedgePower } from 'experimeh';

const power = calculateSteppedWedgePower({
  numClusters: 20,
  clusterSize: 100,
  numSteps: 5,
  icc: 0.05,
  effectSize: 0.5,  // Cohen's d or proportion difference
  alpha: 0.05
});

console.log(`Statistical power: ${(power * 100).toFixed(1)}%`);
```

### Step 5: Create Switching Schedule

#### Randomization Principles

**Key**: Randomize the ORDER of switching, not WHETHER to switch

**Process**:
1. List all clusters
2. Randomly shuffle cluster order
3. Distribute evenly across steps
4. Generate schedule

**Automated Schedule Generation**:
```typescript
import { generateSteppedWedgeSchedule } from 'experimeh';

const schedule = generateSteppedWedgeSchedule({
  clusterIds: ['hospital-1', 'hospital-2', ..., 'hospital-20'],
  numSteps: 5,
  seed: 'experiment-2025-001'  // For reproducibility
});

console.log(schedule.clusterToStep);
// {
//   'hospital-1': 1,  // Switches at step 1
//   'hospital-2': 1,
//   'hospital-3': 2,  // Switches at step 2
//   ...
// }
```

#### Manual Schedule Example

```
Study Design:
- 20 hospitals
- 5 steps
- 4 hospitals per step
- Baseline: Week 0 (all control)
- Steps: Weeks 1-5

Randomized Schedule:
Step 1 (Week 1): Hospitals A, F, K, Q
Step 2 (Week 2): Hospitals C, H, L, S
Step 3 (Week 3): Hospitals B, G, M, T
Step 4 (Week 4): Hospitals D, I, N, P
Step 5 (Week 5): Hospitals E, J, O, R
```

#### Stratified Randomization (Optional)

**When**: Clusters differ on important characteristics

**How**: Ensure balance on key variables

**Example**:
```typescript
// Balance by hospital size
const schedule = generateSteppedWedgeSchedule({
  clusterIds: hospitals,
  numSteps: 5,
  stratifyBy: 'bed_count',  // Ensure size balance across steps
  seed: 'experiment-2025-001'
});
```

---

## Implementation Guide

### Step 1: Pre-Launch Checklist

**One Month Before Launch**:
- [ ] IRB/ethics approval obtained
- [ ] All clusters recruited and consented
- [ ] Baseline data collection plan finalized
- [ ] Training materials prepared
- [ ] Technical infrastructure tested
- [ ] Data collection systems validated
- [ ] Communication plan for clusters
- [ ] Contingency plans for delays

**One Week Before Launch**:
- [ ] Switching schedule finalized and communicated
- [ ] All clusters aware of their switching time
- [ ] Baseline data collection initiated
- [ ] Monitoring dashboard set up
- [ ] Analysis scripts prepared and tested

### Step 2: Baseline Period (Step 0)

**Purpose**: Establish pre-intervention levels across all clusters

**Key Activities**:
1. Collect outcome data from all clusters
2. Document current practices
3. Verify cluster assignments
4. Test measurement systems
5. Establish data quality checks

**Duration**: Typically same length as one step

**Data Collection**:
```typescript
// Example: Baseline data collection
const baselineData = {
  step: 0,
  treatment: 'control',
  clusters: [
    {
      clusterId: 'hospital-1',
      outcome: 82.5,
      sampleSize: 150,
      measurementDate: '2025-01-01'
    },
    // ... all clusters
  ]
};
```

### Step 3: Sequential Rollout

**At Each Step**:

1. **Switch assigned clusters** to treatment
2. **Train staff** in switching clusters
3. **Monitor implementation** fidelity
4. **Continue data collection** in all clusters
5. **Track compliance** with protocol

**Implementation Checklist Per Step**:
```markdown
Step X Checklist:
- [ ] Notify switching clusters 1 week prior
- [ ] Conduct training for switching clusters
- [ ] Verify readiness before go-live
- [ ] Implement treatment on schedule
- [ ] Document any implementation issues
- [ ] Continue measuring outcomes in ALL clusters
- [ ] Monitor for adverse events
- [ ] Check data quality
```

**API Integration Example**:
```typescript
// Check assignment for user in cluster
const assignment = await client.getAssignment({
  experimentKey: 'hospital_protocol_rollout',
  unitId: 'patient-123',
  context: {
    hospital_unit_id: 'hospital-5'
  }
});

// assignment.variantKey will be 'control' or 'treatment'
// based on current step and cluster's switching schedule
```

### Step 4: Data Collection Throughout

**Critical**: Measure outcomes in ALL clusters at ALL steps

**Data Requirements**:
- Cluster ID
- Individual ID (if applicable)
- Step number (time period)
- Treatment status (control or treatment)
- Outcome measure
- Covariates (age, gender, baseline values, etc.)

**Data Structure**:
```typescript
interface ObservationRecord {
  clusterId: string;
  individualId: string;
  step: number;              // 0, 1, 2, ..., numSteps
  treatment: 'control' | 'treatment';
  outcome: number;
  outcomeType: 'binary' | 'continuous' | 'count';
  measurementDate: Date;
  covariates?: {
    age?: number;
    gender?: string;
    baseline?: number;
  };
}
```

### Step 5: Monitoring and Quality Control

**Real-Time Monitoring**:
```typescript
// Monitor experiment progress
const status = await client.getExperimentStatus('hospital_protocol_rollout');

console.log(`Current step: ${status.currentStep}`);
console.log(`Clusters in treatment: ${status.clustersInTreatment}`);
console.log(`Total observations: ${status.totalObservations}`);
console.log(`Data quality score: ${status.dataQualityScore}`);
```

**Key Metrics to Monitor**:
1. **Implementation fidelity**: Are clusters actually implementing treatment?
2. **Data completeness**: Are all clusters reporting data?
3. **Sample sizes**: Sufficient n in each cluster-step?
4. **Adverse events**: Any safety concerns?
5. **Secular trends**: Large unexpected changes over time?

**Warning Signs**:
- Missing data from clusters
- Uneven cluster sizes (some much smaller)
- Implementation delays
- Strong time trends (larger than treatment effect)
- Contamination (control clusters adopting treatment)

---

## Analysis and Interpretation

### Understanding the Statistical Model

**Basic Model**:
```
Y_ij = β₀ + β₁(time) + β₂(treatment) + u_i + ε_ij

Where:
  Y_ij     = outcome for individual j in cluster i
  β₀       = overall intercept
  β₁       = time trend (secular changes)
  β₂       = treatment effect (WHAT WE WANT!)
  time     = step number (0, 1, 2, ...)
  treatment = 0 (control) or 1 (treatment)
  u_i      = random effect for cluster i
  ε_ij     = individual-level error
```

**What This Means**:
- **β₂**: Treatment effect AFTER controlling for time trends
- **β₁**: Natural changes over time (unrelated to treatment)
- **u_i**: Some clusters naturally higher/lower than others

### Running the Analysis

```typescript
import { analyzeSteppedWedge } from 'experimeh';

const results = await analyzeSteppedWedge({
  experimentId: 'hospital_protocol_rollout',
  outcomeType: 'continuous',
  adjustCovariates: ['age', 'gender', 'baseline']
});

console.log('Treatment Effect:', results.treatmentEffect);
console.log('Time Trend:', results.timeEffect);
console.log('ICC:', results.icc);
```

### Interpreting Results

#### 1. Treatment Effect (β₂)

**Example Output**:
```
Treatment Effect:
  Estimate: 3.2% increase
  95% CI: [1.8%, 4.6%]
  P-value: < 0.001
  Effect size (Cohen's d): 0.42
```

**Interpretation**:
> "The enhanced protocol increased hand hygiene compliance by 3.2 percentage
> points (95% CI: 1.8% to 4.6%, p < 0.001) after adjusting for natural time
> trends and hospital-level differences."

**Questions to Ask**:
- Is the effect clinically/practically meaningful?
- Is the confidence interval narrow enough?
- Does the effect vary by subgroup?
- Is the effect consistent across clusters?

#### 2. Time Effect (β₁)

**Example Output**:
```
Time Effect:
  Estimate: 0.8% per week
  95% CI: [0.1%, 1.5%]
  P-value: 0.023
```

**Interpretation**:
> "There was a natural improvement of 0.8% per week (p = 0.023), independent
> of the treatment. This represents secular trends (e.g., increased awareness
> due to ongoing campaigns)."

**Important**:
- Large time trends can indicate issues with design
- Treatment effect is estimated AFTER removing time trends
- If time trend > treatment effect, consider extending baseline

#### 3. Intracluster Correlation (ICC)

**Example Output**:
```
ICC: 0.048 (4.8%)
```

**Interpretation**:
> "4.8% of the total variance in outcomes is attributable to hospital-level
> factors. This indicates moderate clustering."

**Implications**:
```
ICC = 0.01-0.03: Low clustering (good for power)
ICC = 0.03-0.08: Moderate clustering (typical)
ICC = 0.08-0.15: High clustering (need many clusters)
ICC > 0.15: Very high clustering (design may be inefficient)
```

#### 4. Cluster-Specific Effects

**Example Output**:
```
Random Intercepts:
  Hospital A: +4.2% (naturally high compliance)
  Hospital B: -1.8% (naturally low)
  Hospital C: +2.5% (above average)
  ...
```

**Use**: Understanding which clusters differ and why

### Sensitivity Analyses

**Essential Checks**:

1. **Model with covariates** vs. without
2. **Different functional forms** for time (linear, quadratic)
3. **Excluding outlier clusters**
4. **Subgroup analyses** (if pre-specified)
5. **Different ICC assumptions**

**Example**:
```typescript
// Sensitivity: Quadratic time trend
const sensitivity = await analyzeSteppedWedge({
  experimentId: 'hospital_protocol_rollout',
  timeModel: 'quadratic',  // vs. 'linear'
});

// Compare to primary analysis
console.log('Primary (linear time):', primaryResults.treatmentEffect);
console.log('Sensitivity (quadratic time):', sensitivity.treatmentEffect);
```

---

## Troubleshooting Common Issues

### Issue 1: High ICC (> 0.15)

**Problem**: Large clustering effect reduces power dramatically

**Diagnosis**:
```typescript
const results = await analyzeSteppedWedge(...);
if (results.icc > 0.15) {
  console.warn('High ICC detected');
  console.log(`Design effect: ${1 + (clusterSize - 1) * results.icc}`);
}
```

**Solutions**:
1. **Add more clusters** (most effective)
2. **Include cluster-level covariates** to explain variance
3. **Accept lower power** or larger MDE
4. **Consider if stepped wedge is appropriate**

**Prevention**: Estimate ICC during planning; recruit sufficient clusters

### Issue 2: Missing Data

**Problem**: Some clusters or time periods have missing data

**Types**:
- **Cluster dropout**: Entire cluster stops participating
- **Intermittent missing**: Some time periods missing
- **Outcome missingness**: Some individuals unmeasured

**Solutions**:
```typescript
// Check for missing data patterns
const missing = await checkMissingData(experimentId);

if (missing.clusterDropouts.length > 0) {
  // Use last-observation-carried-forward or imputation
  console.warn(`Clusters with dropout: ${missing.clusterDropouts}`);
}

// Sensitivity analysis excluding problematic clusters
const sensitivityResults = await analyzeSteppedWedge({
  experimentId,
  excludeClusters: missing.clusterDropouts
});
```

**Prevention**: Over-recruit clusters; maintain engagement; monitor compliance

### Issue 3: Implementation Delays

**Problem**: Clusters don't switch on schedule

**Example**:
```
Hospital C scheduled to switch at Step 3 (Week 3)
Actually switched at Week 5 (Step 5)
```

**Solutions**:
- **Intention-to-treat**: Analyze based on scheduled switch time
- **As-treated**: Analyze based on actual switch time (secondary)
- **Document and report** all deviations

**In Analysis**:
```typescript
const results = await analyzeSteppedWedge({
  experimentId,
  analysisType: 'intention-to-treat',  // Primary
  reportDeviations: true
});

// Also run as-treated for sensitivity
const sensitivity = await analyzeSteppedWedge({
  experimentId,
  analysisType: 'as-treated'  // Secondary
});
```

### Issue 4: Contamination

**Problem**: Control clusters adopt treatment before their scheduled time

**Examples**:
- Staff from treatment clusters share practices
- Media coverage leads to adoption
- External mandates require early adoption

**Detection**:
```typescript
// Check for unusual patterns in control clusters
const contamination = await detectContamination(experimentId);

if (contamination.suspectedClusters.length > 0) {
  console.warn('Possible contamination detected');
}
```

**Solutions**:
- **Physical/operational separation** of clusters
- **Restrict information flow** between clusters
- **Document contamination** and adjust analysis
- **Sensitivity analysis** excluding contaminated clusters

### Issue 5: Strong Time Trends

**Problem**: Time effect is as large or larger than treatment effect

**Example**:
```
Time effect (β₁): 2.5% per step
Treatment effect (β₂): 1.2%
```

**Implications**:
- Hard to separate treatment from trend
- May indicate external factors
- Reduces confidence in treatment estimate

**Solutions**:
```typescript
// Model non-linear time trends
const results = await analyzeSteppedWedge({
  experimentId,
  timeModel: 'spline',  // More flexible than linear
  knotsPerStep: 2
});

// Extend baseline period for more pre-trend data
// Consider if context is too dynamic for stepped wedge
```

### Issue 6: Unbalanced Cluster Sizes

**Problem**: Some clusters much larger/smaller than others

**Example**:
```
Hospital A: 250 patients
Hospital B: 45 patients  ← Very small
Hospital C: 180 patients
```

**Impact**:
- Small clusters have less influence
- Large clusters dominate results
- Increases variability

**Solutions**:
```typescript
// Mixed models handle naturally, but can weight
const results = await analyzeSteppedWedge({
  experimentId,
  clusterWeighting: 'size',  // or 'equal'
});
```

**Prevention**: Screen clusters for minimum size; provide resources to smaller clusters

---

## Real-World Examples

### Example 1: Hospital Hand Hygiene Protocol

**Context**:
- 20 hospital units implementing enhanced hand hygiene protocol
- Primary outcome: Hand hygiene compliance rate
- Baseline: 72% compliance
- Target: 85% compliance

**Design**:
```typescript
const experiment = {
  key: 'hand_hygiene_2025',
  name: 'Enhanced Hand Hygiene Protocol Rollout',
  designType: 'stepped_wedge',
  designConfig: {
    numSteps: 5,
    stepDurationMinutes: 10080,  // 1 week
    clusterKey: 'hospital_unit_id',
    numClusters: 20
  },
  primaryMetric: 'hand_hygiene_compliance_rate',
  expectedEffect: 0.10  // 10 percentage points
};
```

**Results**:
```
Treatment Effect: +12.3% [95% CI: 9.1%, 15.5%]
Time Trend: +0.8% per week (p = 0.023)
ICC: 0.048
Conclusion: Protocol significantly effective
```

**Visualization** (ASCII):
```
Compliance Rate Over Time by Hospital

90% │                                    ████████
85% │                            ████████████████
80% │                    ████████████████████████
75% │            ████████████████████████████████
70% │    ████████████████████████████████████████
65% │████████████████████████████████████████████
    └─────────────────────────────────────────────
     Week0  Week1  Week2  Week3  Week4  Week5

Blue bars = Treatment | Gray = Control
```

### Example 2: School Curriculum Implementation

**Context**:
- 24 schools implementing new math curriculum
- Primary outcome: Standardized test scores
- Baseline: Mean score 72
- Design respects semester boundaries

**Design**:
```typescript
const experiment = {
  key: 'math_curriculum_2025',
  name: 'New Math Curriculum Implementation',
  designType: 'stepped_wedge',
  designConfig: {
    numSteps: 4,
    stepDurationMinutes: 43200,  // 1 month
    clusterKey: 'school_id',
    numClusters: 24,
    stratifyBy: 'school_size'  // Balance small/large schools
  },
  primaryMetric: 'standardized_test_score'
};
```

**Challenges**:
- High ICC (0.18) due to school-level factors
- Seasonal effects (holidays, testing periods)
- Different implementation speeds across schools

**Results**:
```
Treatment Effect: +4.2 points [95% CI: 1.8, 6.6]
Time Trend: +1.1 points per month
ICC: 0.18 (high clustering)
Conclusion: Curriculum effective but high variance between schools
```

### Example 3: Regional Public Health Intervention

**Context**:
- 15 health districts implementing smoke-free public spaces policy
- Primary outcome: Smoking prevalence
- Long timeline due to policy implementation

**Design**:
```typescript
const experiment = {
  key: 'smoke_free_policy_2025',
  name: 'Smoke-Free Public Spaces Rollout',
  designType: 'stepped_wedge',
  designConfig: {
    numSteps: 5,
    stepDurationMinutes: 129600,  // 3 months
    clusterKey: 'health_district_id',
    numClusters: 15
  },
  primaryMetric: 'smoking_prevalence_percent'
};
```

**Special Considerations**:
- Very long duration (15 months total)
- External events (e.g., tobacco tax changes)
- Geographic spillover between adjacent districts
- Media coverage potential contamination

---

## References and Further Reading

### Key Papers on Stepped Wedge Design

1. **Hemming K, Haines TP, Chilton PJ, Girling AJ, Lilford RJ**. "The stepped wedge cluster randomised trial: rationale, design, analysis, and reporting." *BMJ* 2015;350:h391.
   - Comprehensive introduction to stepped wedge designs
   - Practical guidance on design and analysis

2. **Hussey MA, Hughes JP**. "Design and analysis of stepped wedge cluster randomized trials." *Contemporary Clinical Trials* 2007;28(2):182-191.
   - Original statistical framework
   - Power calculations and sample size

3. **Copas AJ, Lewis JJ, Thompson JA, Davey C, Baio G, Hargreaves JR**. "Designing a stepped wedge trial: three main designs, carry-over effects and randomisation approaches." *Trials* 2015;16:352.
   - Different stepped wedge variants
   - Handling carry-over effects

4. **Barker D, McElduff P, D'Este C, Campbell MJ**. "Stepped wedge cluster randomised trials: a review of the statistical methodology used and available." *BMC Medical Research Methodology* 2016;16:69.
   - Review of analysis methods
   - Comparison of approaches

### Books

1. **Hayes RJ, Moulton LH**. *Cluster Randomised Trials*. 2nd ed. Chapman & Hall/CRC, 2017.
   - Chapter on stepped wedge designs
   - General cluster-randomized trial methodology

2. **Donner A, Klar N**. *Design and Analysis of Cluster Randomization Trials in Health Research*. Arnold, 2000.
   - Foundational text on cluster trials
   - ICC estimation and power

### Statistical Software

**R Packages**:
- `lme4`: Mixed effects models
- `nlme`: Alternative mixed models package
- `swCRTdesign`: Stepped wedge-specific tools
- `CRTSize`: Sample size calculations

**Stata**:
- `mixed`: Mixed effects regression
- `melogit`: Mixed effects logistic regression
- `steppedwedge`: Specific stepped wedge tools

**Python**:
- `statsmodels.formula.api`: Mixed linear models
- `pymer4`: Interface to lme4

### Online Resources

1. **CONSORT Extension for Stepped Wedge Trials**:
   http://www.consort-statement.org/extensions/stepped-wedge
   - Reporting guidelines
   - Checklist for publications

2. **WHO Guide to Cluster Randomized Trials**:
   - Practical implementation guidance
   - Ethical considerations

3. **Experimeh Documentation**:
   - [Statistical Guide](./STATISTICAL_GUIDE.md)
   - [Best Practices](./BEST_PRACTICES.md)
   - [Implementation Guide](../STEPPED_WEDGE_IMPLEMENTATION_GUIDE.md)

### Getting Help

**Within this System**:
- Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Check [API Documentation](../API_DOCUMENTATION.md)
- Read [Design Patterns](./DESIGN_PATTERNS.md)

**External Support**:
- Consult with biostatistician familiar with cluster trials
- Reach out to authors of stepped wedge papers
- Join methodological research networks

---

## Conclusion

Stepped wedge designs offer a powerful approach when:
- All units must eventually receive treatment
- Gradual rollout is necessary or desirable
- You want to control for time trends
- You're working with cluster-level interventions

**Success Factors**:
1. ✅ Adequate number of clusters (12+ minimum, 20+ recommended)
2. ✅ Clear cluster boundaries and stable membership
3. ✅ Reasonable ICC (< 0.15 preferred)
4. ✅ Thoughtful step duration and number
5. ✅ Strong implementation fidelity
6. ✅ Complete data collection across all clusters and time points
7. ✅ Appropriate statistical analysis (mixed effects models)
8. ✅ Careful interpretation accounting for time trends

**Remember**:
- Stepped wedge is more complex than parallel group designs
- Requires larger sample sizes due to clustering
- Takes longer to complete
- But provides ethical and practical advantages when appropriate

Good luck with your stepped wedge experiment!
