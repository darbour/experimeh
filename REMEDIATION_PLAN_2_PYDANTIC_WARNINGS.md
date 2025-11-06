# Remediation Plan: Pydantic V2 Migration

**Issue ID**: PYDANTIC-001
**Severity**: Low (11 deprecation warnings)
**Component**: Python SDK
**Status**: 🟡 Non-Breaking, Future-Proofing Required

---

## Executive Summary

The Python SDK uses Pydantic V1-style syntax which is deprecated in Pydantic V2 and will be removed in V3.

**Impact**: No current functional impact. Will break when Pydantic V3 is released.
**Risk**: Low immediate, High future
**Timeline**: Should complete before Pydantic V3 release (estimated 2026)

---

## Warning Analysis

### All 11 Warnings

```python
# Warning 1-11: Class-based config (8 occurrences)
PydanticDeprecatedSince20: Support for class-based `config` is deprecated,
use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0.

Files affected:
- experimeh/models.py:39  (Variant)
- experimeh/models.py:54  (Assignment)
- experimeh/models.py:79  (ExposureEvent)
- experimeh/models.py:95  (MetricEvent)
- experimeh/models.py:125 (FeatureFlag)
- experimeh/models.py:144 (FeatureFlagEvaluation)
- experimeh/models.py:159 (Experiment)
- experimeh/models.py:192 (PaginationInfo)
- experimeh/models.py:206 (APIResponse)
- experimeh/models.py:221 (APIErrorResponse)

# Warning 11: V1 validator (1 occurrence)
PydanticDeprecatedSince20: Pydantic V1 style `@validator` validators are
deprecated. You should migrate to Pydantic V2 style `@field_validator`
validators. Deprecated in Pydantic V2.0 to be removed in V3.0.

File affected:
- experimeh/models.py:117 (FeatureFlag.type validator)
```

---

## Root Cause Analysis

### Why V1 Syntax Was Used

1. **SDK Creation Date**: Created during Pydantic V2 transition period
2. **Documentation**: Many examples still show V1 syntax
3. **Migration Tool**: V1 syntax still works in V2 (deprecated but functional)
4. **No CI Check**: No automated check for deprecated syntax

### Technical Debt Assessment

| Aspect | Current | After Migration |
|--------|---------|-----------------|
| Functionality | ✅ Works | ✅ Works |
| Maintainability | 🟡 Deprecated | ✅ Modern |
| Future-proof | ❌ Will break in V3 | ✅ V3-ready |
| Performance | ✅ Good | ✅ Potentially better |
| Type safety | ✅ Good | ✅ Better |

---

## Migration Strategy

### Phase 1: Analysis & Planning (1 day)

**Tasks**:
1. Audit all Pydantic models in codebase
2. Review Pydantic V2 migration guide
3. Identify V1 patterns used
4. Create comprehensive test plan
5. Set up parallel testing environment

**Acceptance Criteria**:
- [ ] All V1 patterns cataloged
- [ ] Migration guide reviewed
- [ ] Test plan created
- [ ] Test environment ready

---

### Phase 2: Code Migration (2 days)

#### Pattern 1: Class-based Config → ConfigDict

**Before** (V1 style):
```python
from pydantic import BaseModel

class Variant(BaseModel):
    id: str
    key: str
    name: str

    class Config:
        allow_population_by_field_name = True
        use_enum_values = True
```

**After** (V2 style):
```python
from pydantic import BaseModel, ConfigDict

class Variant(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,  # Renamed from allow_population_by_field_name
        use_enum_values=True,
    )

    id: str
    key: str
    name: str
```

**Changes Required**:
- Replace `class Config:` with `model_config = ConfigDict(...)`
- Rename config keys (see mapping below)
- Import `ConfigDict` from pydantic

**Config Key Mapping**:
```python
# V1 → V2
allow_population_by_field_name → populate_by_name
allow_mutation → frozen (inverted: frozen=not allow_mutation)
use_enum_values → use_enum_values (unchanged)
json_encoders → json_schema_extra (for custom serialization)
```

#### Pattern 2: @validator → @field_validator

**Before** (V1 style):
```python
from pydantic import BaseModel, validator

class FeatureFlag(BaseModel):
    type: str
    enabled: bool

    @validator("type")
    def validate_type(cls, v):
        allowed = ["boolean", "string", "number"]
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v
```

**After** (V2 style):
```python
from pydantic import BaseModel, field_validator

class FeatureFlag(BaseModel):
    type: str
    enabled: bool

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        allowed = ["boolean", "string", "number"]
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v
```

**Changes Required**:
- Replace `@validator` with `@field_validator`
- Add `@classmethod` decorator (explicit in V2)
- Import `field_validator` instead of `validator`

#### Pattern 3: Model Validation Improvements

**Optional but Recommended**:
```python
from pydantic import BaseModel, Field, ConfigDict

class Assignment(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        # V2 improvements
        strict=False,  # Allow type coercion
        validate_assignment=True,  # Validate on attribute assignment
        validate_default=True,  # Validate default values
    )

    experiment_id: str = Field(..., description="Experiment ID")
    unit_id: str = Field(..., description="Unit ID")
    variant_key: str = Field(..., description="Assigned variant")
```

---

### Phase 3: Testing & Validation (1-2 days)

#### Test Strategy

**1. Existing Tests (Regression)**
```bash
# Must pass without changes
cd sdks/python
pytest tests/ -v

# Expected: 28/28 passing
# Coverage should remain ≥61%
```

**2. Model Validation Tests**
```python
# tests/test_models_migration.py
import pytest
from pydantic import ValidationError
from experimeh.models import Variant, Assignment, FeatureFlag

class TestPydanticV2Migration:
    """Ensure V2 migration maintains compatibility"""

    def test_variant_creation(self):
        """Test Variant model with V2 syntax"""
        variant = Variant(
            id="v1",
            key="control",
            name="Control Group",
            description="Original version",
            allocation=50.0,
            isControl=True,
        )
        assert variant.id == "v1"
        assert variant.key == "control"

    def test_variant_field_alias(self):
        """Test populate_by_name works"""
        # Should accept both snake_case and camelCase
        variant = Variant(
            id="v1",
            key="control",
            name="Test",
            allocation=50.0,
            is_control=True,  # snake_case
        )
        assert variant.isControl == True

    def test_feature_flag_validation(self):
        """Test field_validator works"""
        # Valid type
        flag = FeatureFlag(
            id="f1",
            key="new_feature",
            name="New Feature",
            type="boolean",
            enabled=True,
        )
        assert flag.type == "boolean"

        # Invalid type should raise
        with pytest.raises(ValidationError):
            FeatureFlag(
                id="f1",
                key="new_feature",
                name="New Feature",
                type="invalid",  # Not in allowed list
                enabled=True,
            )

    def test_assignment_immutability(self):
        """Test model config works"""
        assignment = Assignment(
            experiment_id="exp1",
            unit_id="user123",
            variant_key="control",
            assigned=True,
        )

        # Should allow mutation if not frozen
        assignment.cached = True
        assert assignment.cached == True

    def test_model_serialization(self):
        """Test JSON serialization unchanged"""
        variant = Variant(
            id="v1",
            key="control",
            name="Control",
            allocation=50.0,
            isControl=True,
        )

        json_data = variant.model_dump(mode='json')
        assert "id" in json_data
        assert "key" in json_data

        # Test deserialization
        variant2 = Variant(**json_data)
        assert variant2.id == variant.id
```

**3. Backward Compatibility Tests**
```python
def test_old_api_still_works():
    """Ensure existing SDK usage patterns still work"""
    from experimeh import ExperimentClient

    # Test existing client code
    client = ExperimentClient(
        api_url="http://localhost:3000",
        api_key="test",
    )

    # Models should serialize/deserialize correctly
    # ... test real usage patterns
```

**4. Type Checking**
```bash
# Mypy should pass with no new errors
mypy experimeh/ --strict
```

**Acceptance Criteria**:
- [ ] All 28 existing tests pass
- [ ] 15+ new migration validation tests pass
- [ ] Coverage remains ≥61%
- [ ] Mypy type checking passes
- [ ] Zero Pydantic warnings
- [ ] Serialization/deserialization unchanged

---

### Phase 4: Documentation & Deployment (1 day)

#### Documentation Updates

**1. CHANGELOG.md**
```markdown
## [1.1.0] - 2025-XX-XX

### Changed
- **BREAKING (Minor)**: Migrated to Pydantic V2 style syntax
  - Replaced class-based `Config` with `model_config = ConfigDict()`
  - Replaced `@validator` with `@field_validator`
  - No functional changes to SDK API
  - All existing code continues to work

### Migration Guide
If you're using custom Pydantic models that inherit from our models:
- Update `class Config:` to `model_config = ConfigDict(...)`
- Update `@validator` to `@field_validator` + `@classmethod`
- See migration guide: docs/PYDANTIC_V2_MIGRATION.md
```

**2. Create Migration Guide**
```markdown
# docs/PYDANTIC_V2_MIGRATION.md

# Pydantic V2 Migration Guide

## Overview
Version 1.1.0 migrates to Pydantic V2 syntax. This is a **non-breaking change**
for SDK users, but may affect custom models.

## Changes for SDK Users

### No Changes Required
If you're using the SDK normally:
```python
from experimeh import ExperimentClient

client = ExperimentClient(api_url="...")
assignment = client.get_assignment(...)  # Works unchanged
```

### Changes Required
Only if you're creating custom models that inherit from SDK models:
[... detailed migration guide ...]
```

**3. Update README.md**
```markdown
## Requirements
- Python 3.8+
- Pydantic >=2.0.0
```

**Acceptance Criteria**:
- [ ] CHANGELOG.md updated
- [ ] Migration guide created
- [ ] README.md updated
- [ ] API docs regenerated if needed

---

## Alternative Approaches

### Option 1: Full Migration (Recommended)
**Effort**: 4-5 days
**Risk**: Low
**Benefits**: Future-proof, best practices, performance improvements
**Recommendation**: ✅ **RECOMMENDED**

### Option 2: Pin Pydantic < V3
**Effort**: 5 minutes
**Risk**: High long-term
**Benefits**: Zero effort now
**Cons**: Technical debt, security issues, no new features
**Recommendation**: ❌ Not acceptable for production

### Option 3: Gradual Migration
**Effort**: 6-8 days (slower)
**Risk**: Medium (mixed V1/V2 code)
**Benefits**: Can spread over multiple sprints
**Cons**: Inconsistent codebase, longer timeline
**Recommendation**: 🟡 Acceptable if resource-constrained

### Option 4: Automated Migration Tool
**Effort**: 2-3 days
**Risk**: Medium
**Benefits**: Fast, consistent
**Cons**: Tool may not handle all cases
**Process**:
```bash
# Pydantic provides migration tool
pip install bump-pydantic
bump-pydantic sdks/python/experimeh/
```
**Recommendation**: ✅ Good for initial pass, manual review needed

---

## Detailed File-by-File Changes

### File: experimeh/models.py

#### Class 1: Variant (lines 39-50)
```python
# BEFORE
class Variant(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    allocation: float
    isControl: bool = Field(default=False, alias="is_control")
    config: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True

# AFTER
class Variant(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    key: str
    name: str
    description: Optional[str] = None
    allocation: float
    isControl: bool = Field(default=False, alias="is_control")
    config: Optional[Dict[str, Any]] = None
```

#### Class 2: Assignment (lines 54-76)
```python
# BEFORE
class Assignment(BaseModel):
    experiment_id: str
    experiment_key: str
    unit_id: str
    variant_key: str
    variant_name: str
    assigned: bool
    cached: bool = False
    reason: str = ""
    factors: Optional[Dict[str, str]] = None
    stepped_wedge_metadata: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True

# AFTER
class Assignment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    experiment_id: str
    experiment_key: str
    unit_id: str
    variant_key: str
    variant_name: str
    assigned: bool
    cached: bool = False
    reason: str = ""
    factors: Optional[Dict[str, str]] = None
    stepped_wedge_metadata: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
```

#### Classes 3-10: Similar Pattern
Apply same transformation to:
- ExposureEvent (line 79)
- MetricEvent (line 95)
- FeatureFlag (line 125) - also has validator
- FeatureFlagEvaluation (line 144)
- Experiment (line 159)
- PaginationInfo (line 192)
- APIResponse (line 206)
- APIErrorResponse (line 221)

#### Validator Migration (FeatureFlag, line 117)
```python
# BEFORE
@validator("type")
def validate_type(cls, v):
    allowed = ["boolean", "string", "number", "json"]
    if v not in allowed:
        raise ValueError(f"type must be one of {allowed}")
    return v

# AFTER
@field_validator("type")
@classmethod
def validate_type(cls, v):
    allowed = ["boolean", "string", "number", "json"]
    if v not in allowed:
        raise ValueError(f"type must be one of {allowed}")
    return v
```

---

## Testing Matrix

| Test Category | Test Count | Pass Criteria |
|---------------|------------|---------------|
| Existing unit tests | 28 | 28/28 pass |
| Model creation | 10 | All models instantiate |
| Field validation | 15 | Validators work correctly |
| Serialization | 10 | JSON dump/load works |
| Type checking | 1 | Mypy passes |
| Backward compat | 8 | Old patterns still work |
| **Total** | **72** | **100% pass rate** |

---

## Risk Assessment

### Low Risk Items ✅
- Config dict migration (straightforward)
- Field validator migration (well-documented)
- Existing tests cover behavior

### Medium Risk Items 🟡
- Custom serialization (json_encoders → json_schema_extra)
- Complex validators with multiple fields
- Third-party code using our models

### Mitigation
- Comprehensive test suite
- Beta release for testing
- Detailed migration guide
- Gradual rollout

---

## Performance Impact

### Expected Improvements
Pydantic V2 is 5-50x faster than V1 for validation.

**Benchmarks** (approximate):
```python
# V1 (current)
10,000 Assignment creations: ~500ms

# V2 (after migration)
10,000 Assignment creations: ~100ms (5x faster)
```

**Validation**: Create benchmark script before and after:
```python
# benchmarks/pydantic_performance.py
import time
from experimeh.models import Assignment

def benchmark_assignment_creation(n=10000):
    start = time.time()
    for i in range(n):
        Assignment(
            experiment_id=f"exp{i}",
            experiment_key="test",
            unit_id=f"user{i}",
            variant_key="control",
            variant_name="Control",
            assigned=True,
        )
    elapsed = time.time() - start
    print(f"{n} assignments in {elapsed:.2f}s ({n/elapsed:.0f} ops/sec)")

if __name__ == "__main__":
    benchmark_assignment_creation()
```

**Acceptance Criteria**:
- [ ] V2 performance ≥ V1 performance (should be much better)
- [ ] No regressions in real-world usage

---

## Timeline & Resources

| Phase | Duration | Resources | Dependencies |
|-------|----------|-----------|--------------|
| Phase 1: Planning | 1 day | 1 engineer | None |
| Phase 2: Migration | 2 days | 1 engineer | Phase 1 |
| Phase 3: Testing | 1-2 days | 1 engineer + 1 QA | Phase 2 |
| Phase 4: Documentation | 1 day | 1 engineer | Phase 3 |
| **Total** | **5-6 days** | **1 engineer + 1 QA** | |

**Critical Path**: Planning → Migration → Testing → Docs

---

## Rollback Plan

### If Issues Found Post-Deployment

**Symptoms**:
- Model validation errors
- Serialization failures
- Type checking errors
- Performance degradation

**Rollback**:
```bash
# 1. Revert to previous version
pip install experimeh==1.0.0

# 2. If using from source
git revert <commit-hash>
pip install -e .

# 3. Verify rollback
pytest tests/
```

**Prevention**: Release as v1.1.0 (minor version), allow time for testing

---

## Success Metrics

### Pre-Migration
```bash
pytest tests/ 2>&1 | grep -i warning
# 11 PydanticDeprecatedSince20 warnings
```

### Post-Migration
```bash
pytest tests/ 2>&1 | grep -i warning
# 0 PydanticDeprecatedSince20 warnings
# May have other warnings (acceptable)
```

### Additional Metrics
- ✅ All 28 tests pass
- ✅ Coverage ≥61%
- ✅ Mypy passes
- ✅ Performance improved or unchanged
- ✅ Zero functional regressions

---

## Continuous Improvement

### Post-Migration

**1. CI Integration**
```yaml
# .github/workflows/test.yml
- name: Check for Pydantic deprecations
  run: |
    pytest tests/ 2>&1 | grep -i "PydanticDeprecated" && exit 1 || exit 0
```

**2. Pre-commit Hook**
```python
# .pre-commit-config.yaml
  - repo: local
    hooks:
      - id: no-pydantic-v1
        name: No Pydantic V1 syntax
        entry: check for class Config
        language: system
        files: \.py$
```

**3. Documentation**
Add to CONTRIBUTING.md:
```markdown
## Pydantic Models
- Always use V2 syntax: `model_config = ConfigDict(...)`
- Use `@field_validator` not `@validator`
- See: docs/PYDANTIC_V2_MIGRATION.md
```

---

## Sign-off & Approval

**Plan Created By**: AI Assistant
**Date**: 2025-11-06
**Review Required By**: Tech Lead, Python Team
**Priority**: Medium (complete before Pydantic V3)
**Estimated Start**: Next sprint
**Estimated Completion**: [Start + 6 days]

---

**Status**: 📋 **PLAN READY FOR REVIEW**

**Recommended Approach**:
Use automated tool (`bump-pydantic`) for initial migration, then manual review and testing.
