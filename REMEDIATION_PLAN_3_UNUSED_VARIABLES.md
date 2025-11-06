# Remediation Plan: Unused Variables Cleanup

**Issue ID**: LINT-001
**Severity**: Low (44 TypeScript warnings)
**Component**: Core TypeScript Library
**Status**: 🟡 Code Quality Issue, Zero Functional Impact

---

## Executive Summary

44 unused variables/imports exist in the TypeScript codebase, currently suppressed via tsconfig.json.

**Impact**: Zero functional impact. Code quality and maintainability concern only.
**Risk**: Low. Indicates incomplete refactoring or over-importing.
**Timeline**: Should complete within 1-2 sprints for code hygiene.

---

## Warning Breakdown

### Total: 44 Warnings (all TS6133)

**TS6133**: `'X' is declared but its value is never read.`

#### By File:

| File | Count | Type |
|------|-------|------|
| src/analysis/analyzer.ts | 9 | Unused imports/functions |
| src/analysis/bayesian.ts | 2 | Unused functions |
| src/analysis/corrections.ts | 2 | Unused variables |
| src/analysis/power.ts | 3 | Unused functions/variables |
| src/analysis/variance-reduction.ts | 2 | Unused variables |
| src/core/bandits/index.ts | 2 | Export conflicts |
| src/core/stepped-wedge-utils.ts | 1 | Unused import |
| src/services/analysis-service.ts | 11 | Unused variables |
| src/services/assignment-service.ts | 2 | Unused parameters |
| src/services/bandit-service.ts | 2 | Unused imports |
| src/services/configuration-service.ts | 1 | Unused import |
| src/services/event-service.ts | 1 | Unused import |
| src/storage/postgres-store.ts | 4 | Unused imports |
| src/storage/redis-adapter.ts | 1 | Unused variable |
| src/types/interfaces.ts | 3 | Unused imports |
| **Total** | **44** | |

---

## Root Cause Analysis

### Why This Happened

1. **Rapid Development**: Features implemented quickly, imports added preemptively
2. **Refactoring**: Code refactored but imports not cleaned up
3. **Copy-Paste**: Code copied from examples with all imports
4. **Future Use**: Variables declared for future features
5. **TypeScript Config**: Warnings suppressed to unblock builds

### Categories of Issues

#### Category 1: Unused Imports (60%)
```typescript
// Imported but never used
import { ExperimentStatus } from '../models/experiment';
import { EventBatch } from '../models/event';
```

#### Category 2: Unused Function Parameters (15%)
```typescript
// Parameter declared but not used in function body
function assignUser(experimentId: string, context: Context) {
  // context is never used
  return hash(experimentId);
}
```

#### Category 3: Unused Helper Functions (15%)
```typescript
// Function defined but never called
function calculateHelper() {
  // Implementation
}
```

#### Category 4: Unused Variables (10%)
```typescript
// Variable assigned but never read
const subjects = experiment.participants.length;
const variants = experiment.variants;
// Never used after this
```

---

## Impact Assessment

### Positive Impacts of Cleanup ✅

1. **Code Clarity**: Easier to understand what's actually used
2. **Bundle Size**: Slight reduction in compiled output
3. **Maintainability**: Clearer dependencies
4. **IDE Performance**: Fewer symbols to track
5. **Code Reviews**: Cleaner diffs

### Risks of Cleanup ⚠️

1. **Breaking Future Code**: Removing function that was planned for use
2. **Breaking Tests**: Removing something used only in tests
3. **Breaking Examples**: Removing something used in examples but not core
4. **Dead Code Removal**: Might remove intentionally kept code

### Mitigation
- Careful review of each removal
- Check test coverage before removal
- Check example usage before removal
- Keep functions with clear future intent

---

## Cleanup Strategy

### Phase 1: Automated Detection & Categorization (0.5 days)

**Tools**:
1. **ts-prune**: Find truly dead code
2. **eslint**: Detect unused variables
3. **depcheck**: Find unused dependencies

```bash
# Install tools
npm install --save-dev ts-prune eslint-plugin-unused-imports

# Run detection
npx ts-prune | tee unused-exports.txt

# Count by file
npx ts-prune | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

**Create categorized list**:
```typescript
// scripts/analyze-unused.ts
import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const unusedMap = {
  imports: [],
  variables: [],
  functions: [],
  parameters: [],
};

// Analyze each file
project.getSourceFiles().forEach(sourceFile => {
  // Find unused imports
  const imports = sourceFile.getImportDeclarations();
  imports.forEach(imp => {
    const refs = imp.getNameNode()?.findReferences();
    if (refs?.length === 0) {
      unusedMap.imports.push({
        file: sourceFile.getFilePath(),
        line: imp.getStartLineNumber(),
        name: imp.getModuleSpecifierValue(),
      });
    }
  });

  // Similar for variables, functions, parameters
});

// Output report
fs.writeFileSync('UNUSED_ANALYSIS.json', JSON.stringify(unusedMap, null, 2));
```

**Acceptance Criteria**:
- [ ] All 44 unused items cataloged
- [ ] Categorized by type (import/variable/function/parameter)
- [ ] Prioritized by safety (safe/risky/unsafe to remove)
- [ ] Usage checked in tests and examples

---

### Phase 2: Safe Removals (1 day)

#### Safe Category: Unused Imports

**Process**:
1. Use automated tool: `eslint --fix`
2. Manual review of removals
3. Run tests after each file
4. Commit per file or per module

**Configuration**:
```json
// .eslintrc.json
{
  "extends": ["eslint:recommended"],
  "plugins": ["unused-imports"],
  "rules": {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        "vars": "all",
        "varsIgnorePattern": "^_",
        "args": "after-used",
        "argsIgnorePattern": "^_"
      }
    ]
  }
}
```

**Example Fix**:
```typescript
// BEFORE
import {
  ExperimentStatus,  // Unused
  ExperimentDesignType,
  Experiment
} from '../models/experiment';

// AFTER
import {
  ExperimentDesignType,
  Experiment
} from '../models/experiment';
```

**Affected Files** (23 unused imports):
- src/analysis/analyzer.ts (6 imports)
- src/services/analysis-service.ts (4 imports)
- src/services/bandit-service.ts (2 imports)
- src/storage/postgres-store.ts (4 imports)
- src/core/stepped-wedge-utils.ts (1 import)
- src/services/configuration-service.ts (1 import)
- src/services/event-service.ts (1 import)
- src/types/interfaces.ts (3 imports)
- src/core/bandits/index.ts (1 import)

**Acceptance Criteria**:
- [ ] All unused imports removed
- [ ] Tests still pass (446/479 or better)
- [ ] TypeScript compilation successful
- [ ] No functionality broken

---

#### Medium Safety: Unused Variables

**Process**:
1. Review each variable individually
2. Check if it's debugging code
3. Check if it's commented-out feature
4. Check if it's used in comments/docs
5. Remove or add underscore prefix

**Convention**: Use underscore for intentionally unused
```typescript
// BEFORE
const subjects = experiment.participants.length;
const variants = experiment.variants;
// Never used

// OPTION 1: Remove completely
// (removed)

// OPTION 2: Prefix with _ if keeping for clarity
const _subjects = experiment.participants.length;  // For documentation
const _variants = experiment.variants;  // Used in comments
```

**Affected Files** (13 unused variables):
- src/analysis/analyzer.ts (2 variables)
- src/analysis/bayesian.ts (1 variable)
- src/analysis/corrections.ts (2 variables)
- src/analysis/power.ts (2 variables)
- src/analysis/variance-reduction.ts (2 variables)
- src/services/analysis-service.ts (3 variables)
- src/storage/redis-adapter.ts (1 variable)

**Acceptance Criteria**:
- [ ] All unused variables reviewed
- [ ] Truly unused ones removed
- [ ] Intentionally unused ones prefixed with `_`
- [ ] Tests pass
- [ ] Documentation updated if needed

---

#### Low Safety: Unused Functions

**Process**:
1. Search codebase for function calls
2. Check tests for usage
3. Check examples for usage
4. Check documentation/comments for references
5. Mark as deprecated before removing, or add `@internal` tag

**Example**:
```typescript
// BEFORE
function multipleRegression(data: number[][]): RegressionResult {
  // Implementation
}

// Was this planned for future use?
// Check git history for context

// OPTION 1: Remove if truly unused
// (removed)

// OPTION 2: Mark as internal/deprecated if keeping
/**
 * @internal
 * @deprecated Planned for future use in advanced analysis
 */
function multipleRegression(data: number[][]): RegressionResult {
  // Implementation
}

// OPTION 3: Move to separate "future" file
// src/analysis/future-features.ts
```

**Affected Files** (6 unused functions):
- src/analysis/analyzer.ts (3 functions)
- src/analysis/bayesian.ts (1 function)
- src/analysis/power.ts (1 function)
- src/analysis/corrections.ts (1 function - appears twice)

**List of Functions to Review**:
1. `multipleRegression` (analyzer.ts:23)
2. `sequentialTest` (analyzer.ts:48)
3. `applyCUPED` (analyzer.ts:63)
4. `stratifiedABTest` (analyzer.ts:65)
5. `betaVariance` (bayesian.ts:150)
6. `normalPDF` (bayesian.ts:223)
7. `nonCentralTPower` (power.ts:118)

**Acceptance Criteria**:
- [ ] Each function reviewed with tech lead
- [ ] Decision made: remove, deprecate, or keep
- [ ] If keeping: documented why
- [ ] If removing: verified no future plans
- [ ] Tests pass

---

#### Risky: Unused Function Parameters

**Process**:
1. Check if parameter might be used in future
2. Check if it's part of interface/callback signature
3. Consider if removing would break API compatibility
4. Prefix with `_` instead of removing if unsure

**Example**:
```typescript
// BEFORE - Parameter required by interface but not used
function assignUser(experimentId: string, context: Context) {
  return hash(experimentId);
  // context never used but might be needed later
}

// AFTER - Prefix with _ to indicate intentionally unused
function assignUser(experimentId: string, _context: Context) {
  return hash(experimentId);
  // _context available if needed in future
}
```

**Affected Files** (2 unused parameters):
- src/services/assignment-service.ts:37 (context parameter)
- src/services/assignment-service.ts:554 (context parameter)

**Acceptance Criteria**:
- [ ] Parameters reviewed
- [ ] Decision: remove or prefix with `_`
- [ ] API compatibility maintained
- [ ] Tests pass

---

### Phase 3: Re-enable Strict Linting (0.5 days)

**Update tsconfig.json**:
```json
{
  "compilerOptions": {
    // Re-enable strict checking
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Even stricter (optional)
    "noUnusedLabels": true,
    "allowUnusedLabels": false
  }
}
```

**Update .eslintrc.json**:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "caughtErrorsIgnorePattern": "^_"
    }]
  }
}
```

**Acceptance Criteria**:
- [ ] TypeScript compiles with no warnings
- [ ] ESLint passes with no errors
- [ ] Build succeeds
- [ ] CI passes

---

### Phase 4: Prevention & Monitoring (1 day)

#### 1. Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

#### 2. CI Integration
```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]

jobs:
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  unused-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx ts-prune --error
```

#### 3. Monthly Audit
```bash
# scripts/monthly-audit.sh
#!/bin/bash

echo "Running unused code detection..."
npx ts-prune > unused-report.txt

if [ -s unused-report.txt ]; then
  echo "⚠️  Unused code detected:"
  cat unused-report.txt
  exit 1
else
  echo "✅ No unused code found"
  exit 0
fi
```

**Acceptance Criteria**:
- [ ] Pre-commit hooks configured
- [ ] CI checks for unused code
- [ ] Monthly audit scheduled
- [ ] Team trained on avoiding unused code

---

## File-by-File Cleanup Guide

### Priority 1: analysis/analyzer.ts (9 warnings)

```typescript
// Line 23: multipleRegression
// ACTION: Check if planned feature
// If yes: Add @internal tag and TODO
// If no: Remove

// Line 27: RegressionResult
// ACTION: Remove if multipleRegression removed

// Line 33: SteppedWedgeAnalysisResult
// ACTION: Check if used in stepped-wedge code
// Likely used - verify imports

// Line 48: sequentialTest
// ACTION: Check future roadmap
// Sequential testing is valuable - keep with @internal

// Line 50: SequentialTestResult
// ACTION: Keep if sequentialTest kept

// Line 63: applyCUPED
// ACTION: CUPED is important variance reduction
// Should be used - check if incomplete implementation

// Line 65: stratifiedABTest
// ACTION: Check if stratification is implemented
// May be incomplete feature

// Line 834: subjects
// ACTION: Remove or use in calculation

// Line 835: variants
// ACTION: Remove or use in calculation
```

### Priority 2: services/analysis-service.ts (11 warnings)

```typescript
// Review each unused variable
// Most likely intermediate calculations
// Either use them or remove them
```

### Priority 3: All Other Files (24 warnings)

Similar systematic review for each file.

---

## Testing Strategy

### For Each Cleanup

```bash
# 1. Before cleanup
npm run build
npm test

# 2. Make changes to one file
# Remove unused import/variable

# 3. After cleanup
npm run build  # Must succeed
npm test       # Must maintain 446+ passing

# 4. If tests fail
git diff       # Review changes
git restore .  # Rollback
# Investigate why removal broke something
```

### Regression Test Suite
```bash
# Full test suite
npm run test:unit
npm run test:integration  # If services running
npm run test:statistical

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build
npm run build
```

**Acceptance Criteria**:
- [ ] All tests pass (446+/479)
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] No new warnings

---

## Risk Mitigation

### Low Risk ✅
- Removing unused imports
- Removing unused local variables
- Adding underscore prefix

### Medium Risk 🟡
- Removing unused functions
- Removing parameters

### High Risk ⚠️
- Removing exported functions (breaking change)
- Removing types (breaking change)

### Mitigation Strategy
1. **Never remove exports** without version bump
2. **Always check tests** before removing
3. **Check examples** for usage
4. **Review git history** for context
5. **Incremental commits** - easy to rollback

---

## Alternative Approaches

### Option 1: Full Cleanup (Recommended)
**Effort**: 3 days
**Risk**: Low with careful review
**Benefits**: Clean codebase, strict linting
**Recommendation**: ✅ **RECOMMENDED**

### Option 2: Partial Cleanup (Imports Only)
**Effort**: 1 day
**Risk**: Very low
**Benefits**: Easy wins, some improvement
**Recommendation**: 🟡 Acceptable as Phase 1

### Option 3: Suppress Indefinitely
**Effort**: 0
**Risk**: Code quality degrades over time
**Benefits**: None
**Recommendation**: ❌ Not acceptable

### Option 4: Automated Tool Only
**Effort**: 0.5 days
**Risk**: Medium (might remove needed code)
**Benefits**: Fast
**Recommendation**: 🟡 Use with manual review

---

## Timeline & Resources

| Phase | Duration | Resources | Cumulative |
|-------|----------|-----------|------------|
| Phase 1: Detection | 0.5 days | 1 engineer | 0.5 days |
| Phase 2: Cleanup | 1 day | 1 engineer | 1.5 days |
| Phase 3: Re-enable Linting | 0.5 days | 1 engineer | 2 days |
| Phase 4: Prevention | 1 day | 1 engineer | 3 days |
| **Total** | **3 days** | **1 engineer** | |

**Can be spread across sprints**: Yes, by phase

---

## Success Metrics

### Before Cleanup
```bash
# TypeScript warnings suppressed in config
"noUnusedLocals": false
"noUnusedParameters": false

# Build succeeds but with warnings
tsc 2>&1 | grep "TS6133" | wc -l
# 44 warnings
```

### After Cleanup
```bash
# TypeScript warnings enabled
"noUnusedLocals": true
"noUnusedParameters": true

# Build succeeds with zero warnings
tsc 2>&1 | grep "TS6133" | wc -l
# 0 warnings
```

### Additional Metrics
- ✅ Bundle size: Unchanged or smaller
- ✅ Tests: 446+/479 passing (no regression)
- ✅ Build time: Unchanged or faster
- ✅ Code clarity: Improved (subjective)

---

## Rollback Plan

### If Cleanup Causes Issues

```bash
# Rollback specific file
git checkout HEAD~1 src/analysis/analyzer.ts

# Rollback entire cleanup
git revert <commit-hash>

# Re-suppress warnings temporarily
# Edit tsconfig.json
"noUnusedLocals": false
"noUnusedParameters": false

# Rebuild
npm run build
```

---

## Continuous Improvement

### Post-Cleanup Practices

1. **Code Review Checklist**:
   - [ ] No unused imports
   - [ ] No unused variables
   - [ ] Parameters prefixed with `_` if unused

2. **Editor Configuration**:
```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll.eslint": true
  }
}
```

3. **Team Guidelines**:
   - Remove imports when removing code
   - Use `_` prefix for intentionally unused parameters
   - Run `eslint --fix` before committing

---

## Sign-off & Approval

**Plan Created By**: AI Assistant
**Date**: 2025-11-06
**Priority**: Low (code quality, no functional impact)
**Estimated Start**: Next sprint
**Estimated Duration**: 3 days (can be split across sprints)

---

**Status**: 📋 **PLAN READY FOR REVIEW**

**Recommendation**: Start with Phase 1 (detection) and Phase 2a (imports only) for quick wins.
