# Comprehensive Test Plan and Acceptance Criteria

## Testing Philosophy
We uphold the highest standards in software engineering, experimental design, and statistical analysis. All implementations must be:
- **Functionally correct**: All features work as specified
- **Statistically sound**: All statistical computations are accurate
- **Production-ready**: Code is robust, handles errors, and performs well
- **Well-tested**: Unit and integration tests pass
- **Documented**: Clear usage examples and documentation

---

## 1. Dashboard Testing Plan

### Acceptance Criteria

#### A. Installation & Build
- [ ] `npm install` completes without errors
- [ ] No security vulnerabilities in dependencies (or only low-severity)
- [ ] `npm run build` completes successfully
- [ ] Build produces optimized production assets
- [ ] TypeScript compilation has zero errors
- [ ] No ESLint errors (warnings acceptable)

#### B. Development Server
- [ ] `npm run dev` starts successfully
- [ ] Server runs on expected port (typically 3000 or 5173)
- [ ] No console errors on startup
- [ ] Hot module replacement works

#### C. Functional Testing
- [ ] All routes render without errors:
  - Home dashboard
  - Experiments list
  - Experiment detail
  - Create experiment
  - Analytics
- [ ] No React errors or warnings in console
- [ ] API client is properly configured
- [ ] Error boundaries work (graceful degradation)

#### D. Code Quality
- [ ] All TypeScript types are properly defined
- [ ] No `any` types (or minimal with justification)
- [ ] Components follow React best practices
- [ ] Hooks are used correctly
- [ ] No memory leaks in useEffect

### Testing Procedure
1. Install dependencies and check for vulnerabilities
2. Run TypeScript compiler in strict mode
3. Build production bundle
4. Start dev server
5. Verify all routes load
6. Check console for errors
7. Run linter
8. Test responsive design (if time permits)

---

## 2. Python SDK Testing Plan

### Acceptance Criteria

#### A. Installation & Setup
- [ ] `pip install -e .` completes successfully
- [ ] All dependencies install without conflicts
- [ ] Package imports work: `from experimeh import ExperimentClient`
- [ ] No import errors or warnings

#### B. Unit Tests
- [ ] All unit tests pass: `pytest tests/test_*.py`
- [ ] Test coverage > 80% (target: 90%+)
- [ ] No skipped tests (unless marked intentionally)
- [ ] Async tests pass
- [ ] Cache tests pass

#### C. Example Scripts
- [ ] `simple_ab_test.py` runs without errors (with mock/test server)
- [ ] `factorial.py` runs successfully
- [ ] `async_usage.py` executes correctly
- [ ] `with_caching.py` demonstrates caching
- [ ] `stepped_wedge.py` works as expected

#### D. Code Quality
- [ ] Type hints are comprehensive (mypy passes)
- [ ] Pydantic models validate correctly
- [ ] Error handling is robust
- [ ] Logging works properly
- [ ] Documentation strings are clear

#### E. Statistical Correctness
- [ ] Assignment distribution is uniform (within statistical tolerance)
- [ ] Hashing is deterministic
- [ ] Cache behavior is correct
- [ ] Retry logic works with exponential backoff

### Testing Procedure
1. Install in development mode
2. Run pytest with coverage
3. Validate type hints with mypy
4. Run each example script
5. Test error handling scenarios
6. Verify API client behavior
7. Test caching mechanisms

---

## 3. Multi-Armed Bandits Testing Plan

### Acceptance Criteria

#### A. Compilation & Execution
- [ ] TypeScript compiles without errors
- [ ] Example runs: `npx ts-node examples/11-multi-armed-bandits.ts`
- [ ] All five examples execute successfully
- [ ] No runtime errors or exceptions

#### B. Statistical Validation - Thompson Sampling
- [ ] Converges to best arm (> 60% selection rate after 1000 trials)
- [ ] Posterior distributions are reasonable (beta distributions)
- [ ] P(best arm) calculation is statistically sound
- [ ] Alpha/beta parameters update correctly
- [ ] Mean reward estimates converge to true values (within ±0.02)

#### C. Statistical Validation - Epsilon-Greedy
- [ ] Epsilon decays as expected
- [ ] Exploration rate stays above minimum
- [ ] Selects best arm more frequently over time
- [ ] Confidence intervals are valid (use Wilson score or normal approximation)
- [ ] Mean rewards converge to true values

#### D. Statistical Validation - UCB
- [ ] UCB values calculated correctly: mean + exploration_bonus
- [ ] Exploration bonus: sqrt((2 * log(total_trials)) / arm_trials)
- [ ] Selects under-explored arms appropriately
- [ ] Converges to best arm deterministically
- [ ] No division by zero errors

#### E. Algorithm Comparison
- [ ] All algorithms tested on same problem
- [ ] Thompson Sampling achieves lowest regret (typically)
- [ ] Cumulative regret is calculated correctly: Σ(optimal_reward - actual_reward)
- [ ] Performance metrics are reasonable
- [ ] Best arm selection rates make sense (Thompson > UCB > Epsilon-Greedy typically)

#### F. Integration with Experiment System
- [ ] Bandit configuration types are correct
- [ ] Experiment model supports bandit mode
- [ ] Warmup trials work as expected
- [ ] Reward tracking is accurate
- [ ] State persistence would work (if implemented)

#### G. Code Quality
- [ ] No TypeScript errors or warnings
- [ ] Algorithms implement correct interfaces
- [ ] State management is immutable where appropriate
- [ ] Edge cases are handled (e.g., division by zero)
- [ ] Randomness is properly seeded (or uses good defaults)

### Statistical Correctness Checks

#### Thompson Sampling Validation
```
For true rates: control=0.10, variant-a=0.12, variant-b=0.09
After 1000 trials:
- variant-a should get ~40-70% of traffic
- Mean reward estimates should be within ±0.02 of true values
- P(variant-a is best) should be > 0.5
- Alpha and beta should increase (evidence accumulation)
```

#### Epsilon-Greedy Validation
```
For epsilon=0.3, decay=0.995, min=0.05
After 500 trials:
- Epsilon should decay to ~0.05-0.10
- Best arm should get ~70-90% of selections (depending on epsilon)
- Exploration should be random (uniform over non-greedy choices)
```

#### UCB Validation
```
For exploration_param=2
After 400 trials:
- All arms should be tried at least once
- Best arm should get majority of later selections
- UCB values should converge (exploration bonus shrinks)
- No arithmetic errors
```

#### Regret Analysis
```
Cumulative regret should be:
- Sublinear growth: O(log(T)) for Thompson and UCB
- Linear growth: O(T) for Epsilon-Greedy with constant ε
- Thompson Sampling typically lowest cumulative regret
- All < 50 for 300 trial comparison (given rates)
```

### Testing Procedure
1. Build TypeScript project: `npm run build`
2. Run bandit example: `npx ts-node examples/11-multi-armed-bandits.ts`
3. Capture full output
4. Validate each algorithm section:
   - Check convergence rates
   - Verify statistical properties
   - Validate formulas
   - Check for errors
5. Analyze final statistics
6. Verify algorithm comparison makes sense
7. Check experiment configuration example
8. Review code for quality and correctness

---

## 4. Core TypeScript Build Testing Plan

### Acceptance Criteria
- [ ] `npm install` completes successfully
- [ ] `npm run build` produces dist/ directory
- [ ] TypeScript compilation has zero errors
- [ ] All exports are correctly defined
- [ ] Unit tests pass: `npm test` or `npm run test:unit`
- [ ] Integration tests pass
- [ ] Statistical tests pass

### Testing Procedure
1. Install dependencies
2. Run build
3. Run all test suites
4. Check for any compilation warnings
5. Verify dist/ output

---

## Success Criteria Summary

### Dashboard: PASS if
- Builds without errors
- Dev server runs
- No critical console errors
- TypeScript types are sound

### Python SDK: PASS if
- Installs correctly
- Tests pass with > 80% coverage
- Examples run successfully
- Type hints are comprehensive

### Bandits: PASS if
- All algorithms execute
- Statistical properties are validated:
  - Thompson Sampling converges to best arm
  - Epsilon-Greedy explores and exploits correctly
  - UCB balances confidence bounds
- Regret is sublinear for Thompson/UCB
- Comparison shows reasonable performance

### Core Build: PASS if
- Builds successfully
- All tests pass
- No TypeScript errors

---

## Failure Response Protocol

If any test fails:
1. **Document**: Capture exact error message and context
2. **Diagnose**: Identify root cause
3. **Plan**: Create specific fix plan
4. **Execute**: Implement fix
5. **Validate**: Re-run test
6. **Iterate**: Repeat until all tests pass

**Zero tolerance for:**
- Statistical errors in calculations
- Race conditions or undefined behavior
- Unhandled errors or exceptions
- Type safety violations
- Data corruption or loss

**Acceptable with plan:**
- Missing tests (but must add them)
- Non-critical console warnings
- Performance issues (but must document)
- Missing documentation (but must add)

---

## Test Execution Order

**Phase 1: Parallel Setup** (can run concurrently)
1. Dashboard: `cd dashboard && npm install`
2. Python SDK: `cd sdks/python && pip install -e .`
3. Core: `npm install`

**Phase 2: Build Validation**
1. Core: `npm run build`
2. Dashboard: `npm run build`
3. Python SDK: Type checking with mypy

**Phase 3: Test Execution** (some parallel)
1. Core: `npm test`
2. Python SDK: `pytest`
3. Dashboard: `npm run dev` (manual validation)
4. Bandits: `npx ts-node examples/11-multi-armed-bandits.ts`
5. Python examples: Run each example script

**Phase 4: Statistical Validation**
1. Analyze bandit algorithm outputs
2. Verify convergence properties
3. Check regret bounds
4. Validate confidence intervals

**Phase 5: Fix & Re-validate**
1. Fix any failures
2. Re-run failed tests
3. Ensure all green

**Phase 6: Final Validation**
1. Clean install and rebuild everything
2. Run full test suite
3. Validate all examples
4. Check for any warnings

---

## Metrics to Track

- **Dashboard**: Build time, bundle size, TypeScript errors, console errors
- **Python SDK**: Test coverage %, tests passed/failed, type coverage
- **Bandits**: Convergence rate, regret values, selection distributions, statistical accuracy
- **Core**: Test coverage, build time, tests passed/failed

---

## Report Template

```
Component: [Dashboard/Python SDK/Bandits/Core]
Status: [PASS/FAIL/PARTIAL]

Installation: [PASS/FAIL]
Build: [PASS/FAIL]
Tests: [X/Y passed]
Examples: [PASS/FAIL]
Statistical Validation: [PASS/FAIL/N/A]

Critical Issues: [None or list]
Warnings: [None or list]
Improvements Needed: [list]

Overall Assessment: [Ready for production / Needs fixes / Major issues]
```
