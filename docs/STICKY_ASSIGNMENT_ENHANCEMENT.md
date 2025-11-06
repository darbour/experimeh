# Sticky Assignment Enhancement Guide

## Current State

The system implements **sticky assignment via deterministic hashing**, which means:
- Same user + same experiment version = same variant (always)
- No database persistence required for consistency
- Works across servers and restarts

## Enhancement: Database-Persisted Assignments

For **guaranteed stickiness even if experiment configuration changes**, add database persistence.

### Why You Might Want This

1. **Configuration changes don't affect existing users**
   - Change variant weights mid-experiment → existing users keep their variant
   - Add new variants → only new users get them

2. **Audit trail**
   - Know exactly when each user was assigned
   - Debug assignment issues with historical data

3. **Override capability**
   - Manually assign specific users to variants
   - Support for QA testing

### Implementation

**Step 1: Update AssignmentService to persist assignments**

In `src/services/assignment-service.ts`, modify the `getAssignment` method:

```typescript
async getAssignment(
  experimentKey: string,
  context: EvaluationContext
): Promise<AssignmentResult> {
  const unitId = this.getUnitId(context);

  // 1. Check cache first (fast path)
  const cacheKey = `assignment:${experimentKey}:${unitId}`;
  const cached = await this.cache.get<AssignmentResult>(cacheKey);
  if (cached) return cached;

  const experiment = await this.configService.getExperimentByKey(experimentKey);

  // 2. Check database for persisted assignment
  const persisted = await this.getPersistedAssignment(experiment.id, unitId);
  if (persisted) {
    // Cache it and return
    await this.cache.set(cacheKey, persisted, this.assignmentCacheTtlSeconds);
    return persisted;
  }

  // 3. No existing assignment - compute new one
  const assignment = await this.performAssignment(experiment, context);

  // 4. Persist to database (this is the key addition)
  await this.persistAssignment(experiment.id, unitId, assignment);

  // 5. Cache it
  await this.cache.set(cacheKey, assignment, this.assignmentCacheTtlSeconds);

  return assignment;
}

private async persistAssignment(
  experimentId: string,
  unitId: string,
  assignment: AssignmentResult
): Promise<void> {
  // INSERT INTO assignments (experiment_id, unit_id, variant_key, factors, context)
  // VALUES ($1, $2, $3, $4, $5)
  // ON CONFLICT (experiment_id, unit_id) DO NOTHING
  //
  // The ON CONFLICT ensures first assignment wins (true stickiness)
}

private async getPersistedAssignment(
  experimentId: string,
  unitId: string
): Promise<AssignmentResult | null> {
  // SELECT variant_key, factors FROM assignments
  // WHERE experiment_id = $1 AND unit_id = $2
}
```

### Trade-offs

**Deterministic Hashing (Current)**
- ✅ Zero database queries for assignment
- ✅ Works offline/distributed
- ✅ Scales infinitely
- ⚠️ Configuration changes affect all future assignments
- ⚠️ No audit trail

**Database Persistence (Enhancement)**
- ✅ True stickiness even with config changes
- ✅ Full audit trail
- ✅ Support for manual overrides
- ⚠️ Database query on cache miss
- ⚠️ More complex deployment (need DB)
- ⚠️ Infinite data growth (need retention policy)

## Best Practice: Hybrid Approach

Many production systems (Optimizely, LaunchDarkly, Statsig) use **deterministic hashing by default** and only persist when:

1. **Manual overrides** are used
2. **Experiment configuration changes** during running experiment
3. **Regulatory/compliance** requires audit trail

This gives you the best of both worlds:
- Fast, scalable assignment
- Stickiness when it matters
- Optional audit trail

### Configuration Flag

Add to `.env`:
```bash
# Assignment persistence mode
# - "hash_only": Deterministic hashing only (fastest)
# - "hash_with_cache": Hash + Redis cache (default)
# - "hash_with_db": Hash + database persistence (strongest guarantees)
ASSIGNMENT_PERSISTENCE_MODE=hash_with_cache
```

## Current Recommendation

For most use cases, the **current deterministic hashing approach is sufficient** because:

1. Experiment configurations shouldn't change mid-flight (best practice)
2. If you must change, increment version and analyze separately
3. Performance is critical for assignment (<10ms requirement)
4. Scales to millions of users without database

Only add database persistence if you have specific requirements around audit trails or mid-experiment configuration changes.
