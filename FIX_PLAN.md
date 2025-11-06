# Fix Plan for Build Errors

## Summary
Both core and dashboard TypeScript builds have errors that prevent compilation.

## Core Build Errors (46 errors)

### Critical Errors (Must Fix)
1. **src/core/bandits/index.ts** - Duplicate export `getArmStatistics`
2. **src/services/bandit-service.ts:156** - Property 'algorithm' does not exist on type 'never'

### Non-Critical Errors (Can suppress or fix quickly)
- 44 unused variable warnings (TS6133)

## Dashboard Build Errors (13 errors)

### Critical Errors (Must Fix)
1. **src/api/client.ts:214-215** - Property 'env' does not exist on type 'ImportMeta' (Vite env vars)
2. **src/components/MetricsChart.tsx:204** - Missing 'dataKey' prop on Bar component

### Non-Critical Errors (Can suppress or fix quickly)
- 11 unused variable/import warnings (TS6133)

## Fix Strategy

### Option 1: Fix Critical Errors Only (Fastest)
- Fix the 4 critical errors
- Add `"noUnusedLocals": false, "noUnusedParameters": false` to tsconfig temporarily

### Option 2: Fix All Errors (Best Practice)
- Fix critical errors
- Remove all unused imports/variables
- Ensure code quality

**Recommendation**: Option 1 for speed, then Option 2 if time permits.

## Execution Order
1. Fix core critical errors
2. Fix dashboard critical errors
3. Test builds
4. If builds pass, continue testing
5. If time permits, clean up unused variables
