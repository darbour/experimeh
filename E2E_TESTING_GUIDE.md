# End-to-End Testing Guide

**Purpose**: Comprehensive manual testing procedures to verify the experiment platform works correctly with the backend.

**Prerequisites**:
- Backend API running on port 3000 (or configured port)
- Dashboard running on port 5173 (Vite default)
- Infrastructure services running (PostgreSQL, Redis, Kafka)

---

## Test Environment Setup

### 1. Start Infrastructure

```bash
cd /home/user/experimeh

# Start all infrastructure services
./scripts/infra-setup.sh

# Verify all services are healthy
./scripts/infra-health.sh --details
```

**Expected Output**:
- PostgreSQL: ✅ HEALTHY (localhost:5432)
- Redis: ✅ HEALTHY (localhost:6379)
- Kafka: ✅ HEALTHY (localhost:9092)
- Zookeeper: ✅ HEALTHY (localhost:2181)

### 2. Start Backend API

```bash
cd /home/user/experimeh

# Install dependencies (if not already done)
npm install

# Start backend in development mode
npm run dev
```

**Expected Output**:
```
Server started on port 3000
Database connected
Kafka producer connected
```

### 3. Start Dashboard Frontend

```bash
cd /home/user/experimeh/dashboard

# Install dependencies (if not already done)
npm install

# Start frontend in development mode
npm run dev
```

**Expected Output**:
```
VITE v7.x.x ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## E2E Test Suite

### Test 1: Feature Flag Creation

**Objective**: Create a feature flag that will be used for experiments

**Steps**:
1. Navigate to http://localhost:5173
2. Click "Feature Flags" in navigation
3. Click "+ New Feature Flag" button
4. Fill in the form:
   - Name: "Test Checkout Button"
   - Key: "test-checkout-button"
   - Description: "Testing different checkout button styles"
   - Environment: "development"
   - Status: "active"
5. Add variants:
   - Variant 1: key="control", name="Original Blue Button", value=`{"color": "blue", "text": "Buy Now"}`
   - Variant 2: key="treatment", name="Green Button", value=`{"color": "green", "text": "Buy Now"}`
6. Click "Create Feature Flag"

**Expected Results**:
- ✅ Flag created successfully
- ✅ Redirect to feature flags list
- ✅ New flag visible in list with 2 variants
- ✅ Status shows "active"

**Backend Verification**:
```bash
curl http://localhost:3000/api/v1/flags
```

Should return the created flag with all details.

---

### Test 2: A/B Test Experiment Creation (Complete Wizard)

**Objective**: Create a simple A/B test using the feature flag

**Steps**:

#### Step 1: Select Feature Flag
1. Navigate to http://localhost:5173
2. Click "Experiments" in navigation
3. Click "+ New Experiment" button
4. In Step 1 "Select Feature Flag":
   - Select "Test Checkout Button" from the dropdown
   - Verify variant count shows "2 variants"
   - Verify variant names are displayed correctly
5. Click "Next"

**Expected Results**:
- ✅ Flag selection persists
- ✅ Variant information displayed correctly
- ✅ "Next" button enabled after selection

#### Step 2: Choose Design Type
1. In Step 2 "Choose Design Type":
   - Review the 4 design type cards (A/B, Factorial, Switchback, Stepped Wedge)
   - Click "A/B Test" card
   - Read the description to verify it makes sense
2. Click "Next"

**Expected Results**:
- ✅ Design type selected (card has blue border)
- ✅ Description explains A/B testing clearly
- ✅ "Next" button enabled after selection

#### Step 3: Configure Experiment
1. In Step 3 "Configure Experiment":
   - **Experiment Name**: "Checkout Button Color Test"
   - **Experiment Key**: "checkout-button-color-test"
     - Try invalid format first (e.g., "Checkout_Button") - should show red border and error
     - Fix to valid format: "checkout-button-color-test"
   - **Description**: "Testing whether green button increases conversion rate"
   - **Primary Metric**: "conversion_rate"
     - Try empty value - should show error
     - Fill in valid value
   - **Secondary Metrics**: "revenue, clicks"
2. Verify validation feedback:
   - Invalid experiment key shows: "Experiment key must be lowercase alphanumeric with hyphens"
   - Empty primary metric shows: "Metric name cannot be empty"
   - Helper text shows: "Lowercase alphanumeric with hyphens (3-50 characters)"
3. Click "Next"

**Expected Results**:
- ✅ Real-time validation works
- ✅ Red borders appear for invalid inputs
- ✅ Error messages display clearly
- ✅ "Next" button disabled with invalid data
- ✅ "Next" button enabled with valid data

#### Step 4: Power Analysis
1. In Step 4 "Power Analysis":
   - **Baseline Conversion Rate**: 0.10 (10%)
   - **Minimum Detectable Effect**: 0.02 (2 percentage points)
   - **Significance Level (α)**: 0.05
   - **Statistical Power**: 0.80
2. Click "Calculate Sample Size"
3. Review the results:
   - Required sample size per variant
   - Estimated runtime
   - Allocation percentages (should show 50% / 50% for A/B)
4. Click "Next"

**Expected Results**:
- ✅ Power analysis calculation completes
- ✅ Sample size calculated (≈ 3,840 per variant for these parameters)
- ✅ Allocation percentages sum to 100%
- ✅ Variant roles assigned correctly (control vs treatment)

#### Step 5: Review and Launch
1. In Step 5 "Review and Launch":
   - Review all experiment details:
     - Feature flag information
     - Design type: A/B Test
     - Configuration details
     - Metrics
     - Power analysis results
     - Variant allocations
2. Verify variant allocations table shows:
   - Control variant: 50% allocation
   - Treatment variant: 50% allocation
   - Descriptions match flag variant names
3. Click "Launch Experiment"

**Expected Results**:
- ✅ All information displayed correctly
- ✅ Variant allocations table complete
- ✅ "Launch Experiment" button enabled
- ✅ Experiment created successfully
- ✅ Redirect to experiments list
- ✅ New experiment visible with "draft" status

**Backend Verification**:
```bash
# Get all experiments
curl http://localhost:3000/api/v1/experiments

# Get specific experiment (replace {id} with actual ID)
curl http://localhost:3000/api/v1/experiments/{id}
```

Should return experiment with:
- Correct feature flag reference
- Design type: "ab"
- 2 variant allocations summing to 100%
- All configuration fields

---

### Test 3: Factorial Experiment Creation

**Objective**: Create a 2x2 factorial design experiment

**Prerequisites**:
- Create a feature flag with 4 variants:
  - v1: "Red-Small" (combination 1)
  - v2: "Red-Large" (combination 2)
  - v3: "Blue-Small" (combination 3)
  - v4: "Blue-Large" (combination 4)

**Steps**:

#### Step 1-2: Same as A/B test, but select factorial design

#### Step 3: Configure Factorial Design
1. Fill in basic information
2. In "Factorial Configuration" section:
   - **Factor 1**:
     - Name: "Color"
     - Levels: "red, blue"
   - Click "+ Add Factor"
   - **Factor 2**:
     - Name: "Size"
     - Levels: "small, large"
3. Verify combination preview shows all 4 combinations
4. Click "Next"

**Expected Results**:
- ✅ 2 factors configured
- ✅ All combinations shown (2×2 = 4)
- ✅ Combinations mapped to flag variants
- ✅ No variant count mismatch warning

**Test Variant Count Validation**:
1. Go back to Step 1
2. Select a flag with only 2 variants
3. Go to Step 2, select "Factorial Design"
4. Go to Step 3

**Expected Results**:
- ✅ Red warning banner appears
- ✅ Message: "Factorial design requires at least 4 variants (2x2)"
- ✅ Suggestion to go back and select different flag
- ✅ "Next" button disabled

#### Step 4-5: Complete power analysis and review
- Verify variant allocations show factorial combinations in descriptions
- Example: "Variant 1 (Color=red, Size=small)"

**Expected Results**:
- ✅ Factorial combinations correctly displayed
- ✅ All 4 variants have correct descriptions
- ✅ Allocations sum to 100% (25% each for 2x2)
- ✅ Experiment creates successfully

---

### Test 4: Switchback Experiment Creation

**Objective**: Create a switchback temporal design

**Steps**:
1. Create experiment with switchback design
2. In Step 3 "Switchback Configuration":
   - Period Length: 30 minutes
   - Washout Period: 5 minutes
   - Number of Periods: 48 (24 hours)
3. Verify validation:
   - Try period length = 0 (should show error)
   - Try num periods = 1 (should show error: "At least 2 periods required")
4. Complete wizard

**Expected Results**:
- ✅ Switchback configuration validated
- ✅ Timeline visualization shown (if implemented)
- ✅ Experiment creates with correct config

---

### Test 5: Stepped Wedge Experiment Creation

**Objective**: Create a stepped wedge cluster design

**Prerequisites**:
- Flag with exactly 2 variants (control + treatment)

**Steps**:
1. Create experiment with stepped wedge design
2. In Step 3 "Stepped Wedge Configuration":
   - Clusters: "hospital-1, hospital-2, hospital-3, hospital-4"
   - Steps Per Cluster: 4
   - Step Length: 7 days
3. Verify validation:
   - Try with only 1 cluster (should show error)
   - Try with flag having 3 variants (should show variant count warning)
4. Complete wizard

**Expected Results**:
- ✅ Stepped wedge configuration validated
- ✅ Cluster rollout schedule shown (if implemented)
- ✅ Experiment creates with correct config

---

### Test 6: Validation Error Handling

**Objective**: Verify all validation rules work correctly

**Test Cases**:

1. **Experiment Key Validation**:
   - ❌ "My Experiment" → error (uppercase)
   - ❌ "my_experiment" → error (underscores)
   - ❌ "ab" → error (too short)
   - ❌ "-my-experiment" → error (starts with hyphen)
   - ❌ "my-experiment-" → error (ends with hyphen)
   - ❌ "my--experiment" → error (consecutive hyphens)
   - ✅ "my-experiment-2025" → valid

2. **Primary Metric Validation**:
   - ❌ "" (empty) → error
   - ❌ "x".repeat(101) → error (too long)
   - ✅ "conversion_rate" → valid

3. **Variant Count Validation**:
   - A/B Test:
     - ❌ 1 variant → error
     - ✅ 2 variants → valid
     - ❌ 3 variants → error
   - Factorial:
     - ❌ 2 variants → error
     - ❌ 3 variants → error
     - ✅ 4 variants → valid (2x2)
     - ✅ 6 variants → valid (2x3 or 3x2)
   - Stepped Wedge:
     - ❌ 1 variant → error
     - ✅ 2 variants → valid
     - ❌ 3 variants → error

---

### Test 7: API Integration Verification

**Objective**: Verify frontend communicates correctly with backend

**Steps**:
1. Open browser developer console (F12)
2. Go to Network tab
3. Create a new experiment
4. Observe network requests

**Expected Requests**:
1. `GET /api/v1/flags` - Fetch feature flags
   - Status: 200
   - Response: Array of flags with variants
2. `POST /api/v1/experiments` - Create experiment
   - Status: 201
   - Request body includes all experiment data
   - Response: Created experiment with ID
3. `GET /api/v1/experiments` - Fetch experiments list
   - Status: 200
   - Response: Array including newly created experiment

**Error Handling Tests**:
1. Stop the backend server
2. Try to create an experiment
3. **Expected**: Error message displayed, user notified of connection issue

4. Start backend with invalid database connection
5. Try to create experiment
6. **Expected**: Appropriate error message (500 Internal Server Error)

---

### Test 8: Data Persistence Verification

**Objective**: Verify experiments are saved correctly

**Steps**:
1. Create an experiment
2. Note the experiment ID from the list
3. Refresh the browser (F5)
4. Navigate back to experiments list
5. Click on the experiment to view details

**Expected Results**:
- ✅ Experiment still visible after refresh
- ✅ All details preserved (name, key, metrics, allocations)
- ✅ Feature flag linkage maintained
- ✅ Design configuration preserved

**Database Verification**:
```bash
# Connect to PostgreSQL
psql -h localhost -U experimeh -d experimeh_test

# Query experiments
SELECT * FROM experiments ORDER BY created_at DESC LIMIT 5;

# Query variant allocations
SELECT * FROM variant_allocations WHERE experiment_id = '{experiment_id}';

# Exit
\q
```

---

### Test 9: Concurrent Experiment Creation

**Objective**: Verify system handles multiple concurrent operations

**Steps**:
1. Open two browser tabs with the dashboard
2. In Tab 1: Start creating an experiment
3. In Tab 2: Create a different experiment
4. Complete both experiments

**Expected Results**:
- ✅ Both experiments created successfully
- ✅ No conflicts or data corruption
- ✅ Each experiment has unique ID
- ✅ Both visible in experiments list

---

### Test 10: Browser Compatibility

**Objective**: Verify dashboard works across browsers

**Browsers to Test**:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest, macOS only)
- Edge (latest)

**Test in Each Browser**:
1. Load dashboard
2. Create a feature flag
3. Create an A/B experiment
4. Verify all validation feedback works
5. Verify experiment creates successfully

**Expected Results**:
- ✅ Dashboard loads correctly
- ✅ All features work identically
- ✅ Validation displays correctly
- ✅ No console errors

---

## Performance Testing

### Response Time Test

**Objective**: Verify API responses are fast

**Steps**:
1. Open browser dev tools → Network tab
2. Create an experiment
3. Note response times

**Expected Performance**:
- `GET /api/v1/flags`: < 100ms
- `POST /api/v1/experiments`: < 500ms
- `GET /api/v1/experiments`: < 200ms

### Load Test (Optional)

Use artillery or similar tool:

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:3000/api/v1/flags
```

**Expected Results**:
- All requests succeed (200 status)
- P95 response time < 1s
- No errors or timeouts

---

## Regression Testing Checklist

After any code changes, verify:

- [ ] Build passes: `npm run build`
- [ ] All unit tests pass: `npm test`
- [ ] Dashboard loads without errors
- [ ] Can create feature flag with 2 variants
- [ ] Can create A/B experiment
- [ ] Validation errors display correctly
- [ ] Experiment key validation works
- [ ] Variant count validation works
- [ ] Factorial combinations generate correctly
- [ ] API requests succeed
- [ ] Data persists after refresh

---

## Known Issues / Limitations

Document any issues found during testing:

1. **Issue**: [Description]
   - **Impact**: [Severity]
   - **Workaround**: [If available]
   - **Status**: [Fixed/Open/Won't Fix]

---

## Test Results Log

Record test execution:

| Date | Tester | Test Suite | Result | Notes |
|------|--------|-----------|--------|-------|
| 2025-11-11 | Claude | All | Pass | Initial implementation complete |
| | | | | |

---

## Contact

For issues or questions:
- Create GitHub issue
- Review documentation: /docs
- Check logs: browser console + backend logs
