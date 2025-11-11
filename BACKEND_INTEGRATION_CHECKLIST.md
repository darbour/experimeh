# Backend Integration Verification Checklist

**Purpose**: Verify that the dashboard frontend integrates correctly with the backend API

**Prerequisites**:
- Backend API running and accessible
- Dashboard build completed successfully
- All unit tests passing

---

## Pre-Integration Checks

### ✅ Code Review

- [x] API client configuration verified (dashboard/src/api/client.ts)
- [x] Base URL configured correctly (`/api` for same-origin, or full URL for different origin)
- [x] Timeout set appropriately (30 seconds)
- [x] Error handling implemented
- [x] Request/response interceptors configured
- [x] TypeScript types match backend response structure

### ✅ Type Definitions

- [x] `Experiment` type matches backend model
- [x] `FeatureFlag` type matches backend model
- [x] `VariantAllocation` type matches backend model
- [x] `CreateExperimentForm` type includes all required fields
- [x] `PaginatedResponse` structure matches backend pagination format
- [x] API response transformation layer implemented (for pagination)

### ✅ Environment Configuration

- [ ] **TODO**: Create `.env` file in dashboard directory
- [ ] **TODO**: Set `VITE_API_URL` environment variable
- [ ] **TODO**: Verify CORS configuration on backend allows dashboard origin

**Example `.env` file**:
```bash
# Dashboard environment variables
VITE_API_URL=http://localhost:3000/api
# or in production:
# VITE_API_URL=https://api.production.com/api
```

---

## API Endpoint Verification

### 1. Feature Flags Endpoints

#### GET /api/v1/flags
**Purpose**: Fetch list of feature flags with filters

**Frontend Usage**: `dashboard/src/hooks/useFeatureFlags.ts`

**Test with curl**:
```bash
curl -X GET http://localhost:3000/api/v1/flags \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "flag-123",
      "name": "Test Flag",
      "key": "test-flag",
      "description": "Test description",
      "environment": "development",
      "status": "active",
      "variants": [
        {
          "id": "var-1",
          "key": "control",
          "name": "Control",
          "value": {"color": "blue"}
        },
        {
          "id": "var-2",
          "key": "treatment",
          "name": "Treatment",
          "value": {"color": "green"}
        }
      ],
      "createdAt": "2025-11-11T00:00:00.000Z",
      "updatedAt": "2025-11-11T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Verification Checklist**:
- [ ] Endpoint returns 200 status
- [ ] Response structure matches expected format
- [ ] `success: true` in response
- [ ] `data` array contains flag objects
- [ ] Each flag has required fields: id, name, key, variants
- [ ] `variants` array has correct structure
- [ ] `pagination` object present
- [ ] Frontend transformation layer converts pagination correctly

#### GET /api/v1/flags/:id
**Purpose**: Fetch single feature flag by ID

**Test**:
```bash
curl -X GET http://localhost:3000/api/v1/flags/flag-123 \
  -H "Content-Type: application/json"
```

**Verification**:
- [ ] Returns single flag object
- [ ] Includes all variants
- [ ] 404 for non-existent flag

#### POST /api/v1/flags
**Purpose**: Create new feature flag

**Test**:
```bash
curl -X POST http://localhost:3000/api/v1/flags \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Test Flag",
    "key": "new-test-flag",
    "description": "Test",
    "environment": "development",
    "status": "active",
    "variants": [
      {
        "key": "control",
        "name": "Control",
        "value": {"test": true}
      },
      {
        "key": "treatment",
        "name": "Treatment",
        "value": {"test": false}
      }
    ]
  }'
```

**Verification**:
- [ ] Returns 201 Created
- [ ] Response includes created flag with ID
- [ ] Variants assigned IDs
- [ ] Flag retrievable with GET request

### 2. Experiments Endpoints

#### GET /api/v1/experiments
**Purpose**: Fetch list of experiments

**Frontend Usage**: `dashboard/src/hooks/useExperiments.ts`

**Test**:
```bash
curl -X GET http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "exp-123",
      "name": "Test Experiment",
      "key": "test-experiment",
      "description": "Test description",
      "featureFlagId": "flag-123",
      "designType": "ab",
      "status": "draft",
      "primaryMetric": "conversion_rate",
      "secondaryMetrics": ["revenue", "clicks"],
      "variantAllocations": [
        {
          "id": "alloc-1",
          "flagVariantId": "var-1",
          "flagVariantKey": "control",
          "experimentRole": "control",
          "allocationPercentage": 50,
          "description": "Control variant"
        },
        {
          "id": "alloc-2",
          "flagVariantId": "var-2",
          "flagVariantKey": "treatment",
          "experimentRole": "treatment",
          "allocationPercentage": 50,
          "description": "Treatment variant"
        }
      ],
      "powerAnalysis": {
        "baselineValue": 0.1,
        "minimumDetectableEffect": 0.02,
        "alpha": 0.05,
        "power": 0.8,
        "requiredSampleSize": 3840
      },
      "createdAt": "2025-11-11T00:00:00.000Z",
      "updatedAt": "2025-11-11T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Verification Checklist**:
- [ ] Endpoint returns 200 status
- [ ] Response structure matches expected format
- [ ] Each experiment has all required fields
- [ ] `variantAllocations` array present and correct
- [ ] Allocations sum to 100%
- [ ] `designType` is valid enum value
- [ ] Feature flag reference correct

#### POST /api/v1/experiments
**Purpose**: Create new experiment

**Frontend Usage**: `dashboard/src/hooks/useExperiments.ts` → `useCreateExperiment`

**Test A/B Experiment**:
```bash
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test A/B Experiment",
    "key": "test-ab-experiment",
    "description": "Testing A vs B",
    "featureFlagId": "flag-123",
    "designType": "ab",
    "primaryMetric": "conversion_rate",
    "secondaryMetrics": ["revenue", "clicks"],
    "variantAllocations": [
      {
        "flagVariantId": "var-1",
        "flagVariantKey": "control",
        "experimentRole": "control",
        "allocationPercentage": 50,
        "description": "Control"
      },
      {
        "flagVariantId": "var-2",
        "flagVariantKey": "treatment",
        "experimentRole": "treatment",
        "allocationPercentage": 50,
        "description": "Treatment"
      }
    ],
    "powerAnalysis": {
      "baselineValue": 0.1,
      "minimumDetectableEffect": 0.02,
      "alpha": 0.05,
      "power": 0.8,
      "requiredSampleSize": 3840,
      "estimatedRuntimeDays": 14
    }
  }'
```

**Verification**:
- [ ] Returns 201 Created
- [ ] Response includes experiment with ID
- [ ] Variant allocations saved correctly
- [ ] Design type saved correctly
- [ ] Power analysis saved correctly
- [ ] Experiment retrievable with GET

**Test Factorial Experiment**:
```bash
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Factorial",
    "key": "test-factorial",
    "featureFlagId": "flag-456",
    "designType": "factorial",
    "primaryMetric": "conversion_rate",
    "factorialConfig": {
      "factors": [
        {"name": "Color", "levels": ["red", "blue"]},
        {"name": "Size", "levels": ["small", "large"]}
      ]
    },
    "variantAllocations": [
      {
        "flagVariantId": "var-1",
        "flagVariantKey": "v1",
        "experimentRole": "control",
        "allocationPercentage": 25,
        "description": "Red-Small"
      },
      {
        "flagVariantId": "var-2",
        "flagVariantKey": "v2",
        "experimentRole": "treatment",
        "allocationPercentage": 25,
        "description": "Red-Large"
      },
      {
        "flagVariantId": "var-3",
        "flagVariantKey": "v3",
        "experimentRole": "treatment_1",
        "allocationPercentage": 25,
        "description": "Blue-Small"
      },
      {
        "flagVariantId": "var-4",
        "flagVariantKey": "v4",
        "experimentRole": "treatment_2",
        "allocationPercentage": 25,
        "description": "Blue-Large"
      }
    ]
  }'
```

**Verification**:
- [ ] Factorial config saved correctly
- [ ] All 4 variants present
- [ ] Allocations sum to 100%
- [ ] Descriptions show factorial combinations

#### GET /api/v1/experiments/:id
**Purpose**: Fetch single experiment

**Verification**:
- [ ] Returns complete experiment object
- [ ] Includes variant allocations
- [ ] Includes power analysis if present
- [ ] Includes design-specific config
- [ ] 404 for non-existent experiment

---

## Validation Integration

### Backend Validation

**Verify backend validates**:
- [ ] Experiment key format (should match frontend regex)
- [ ] Variant allocation percentages sum to 100%
- [ ] Feature flag exists
- [ ] Variant IDs exist in the feature flag
- [ ] Design type is valid enum
- [ ] Required fields present

**Test Invalid Data**:

```bash
# Test invalid experiment key
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -d '{"key": "Invalid_Key", ...}'
# Expected: 400 Bad Request with validation error

# Test allocations don't sum to 100
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -d '{"variantAllocations": [{"allocationPercentage": 40}, {"allocationPercentage": 50}], ...}'
# Expected: 400 Bad Request with validation error

# Test non-existent feature flag
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -d '{"featureFlagId": "non-existent", ...}'
# Expected: 404 Not Found or 400 Bad Request
```

**Verification**:
- [ ] Backend returns appropriate error codes (400, 404)
- [ ] Error messages are clear and actionable
- [ ] Frontend displays backend validation errors correctly
- [ ] Frontend validation matches backend validation (same rules)

### Frontend Validation

**Verify frontend prevents**:
- [ ] Invalid experiment keys (tested in Step 3 Configure)
- [ ] Empty required fields
- [ ] Variant count mismatches (via validateVariantCount)
- [ ] Invalid allocation percentages

**Double Validation**:
- [ ] Frontend validates BEFORE sending to backend
- [ ] Backend validates as secondary defense
- [ ] Frontend handles backend validation errors gracefully

---

## Error Handling Integration

### Network Errors

**Test Scenarios**:

1. **Backend Offline**:
   - Stop backend server
   - Try to create experiment in dashboard
   - **Expected**: Error message displayed, user notified

2. **Timeout**:
   - Set artificially slow backend response (>30s)
   - Try to create experiment
   - **Expected**: Timeout error after 30s, clear message

3. **Network Interruption**:
   - Disconnect network mid-request
   - **Expected**: Network error, user can retry

**Verification**:
- [ ] Errors caught by axios interceptor
- [ ] Error messages displayed to user (not just console)
- [ ] User can retry failed operations
- [ ] Loading states handled correctly

### HTTP Error Codes

**Test Each**:
- [ ] **400 Bad Request**: Validation error → Show specific field errors
- [ ] **401 Unauthorized**: Auth expired → Redirect to login
- [ ] **403 Forbidden**: Permission denied → Show permission error
- [ ] **404 Not Found**: Resource missing → Show not found message
- [ ] **409 Conflict**: Duplicate key → Show conflict error
- [ ] **500 Internal Server Error**: Server error → Show generic error, log details

**Verification**:
- [ ] Each error code handled appropriately
- [ ] User sees helpful, non-technical message
- [ ] Technical details logged to console for debugging
- [ ] Request ID included in error (if available)

---

## CORS Configuration

### Backend CORS Settings

**Verify backend allows**:
- Dashboard origin (e.g., `http://localhost:5173` for dev)
- Required methods: GET, POST, PUT, DELETE, OPTIONS
- Required headers: Content-Type, Authorization, X-API-Key

**Test CORS**:
```bash
# Preflight request
curl -X OPTIONS http://localhost:3000/api/v1/experiments \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected Response Headers**:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Max-Age: 86400
```

**Verification**:
- [ ] CORS headers present
- [ ] Dashboard origin allowed
- [ ] All required methods allowed
- [ ] Credentials allowed (if using cookies)

### Production CORS

**For Production**:
```typescript
// Backend CORS config
app.use(cors({
  origin: [
    'https://dashboard.production.com',
    'https://dashboard-staging.production.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400
}));
```

**Verification**:
- [ ] Only production URLs allowed
- [ ] No wildcard (`*`) in production
- [ ] HTTPS enforced

---

## Authentication Integration

### Token Handling

**Verify**:
- [ ] Auth token stored in localStorage (key: `auth_token`)
- [ ] Token included in Authorization header (axios interceptor)
- [ ] Token refresh handled (if applicable)
- [ ] Token expiry handled (401 → redirect to login)

**Test Flow**:
1. User logs in → Token saved to localStorage
2. Dashboard makes API request → Token sent in header
3. Token expires → 401 response → Redirect to login
4. User logs in again → New token saved → Can continue

### API Key (Alternative)

**If using API keys**:
- [ ] API key stored securely (environment variable, not hardcoded)
- [ ] Key included in X-API-Key header
- [ ] Key rotation supported

---

## Data Flow Verification

### End-to-End Flow

**Test Complete Flow**:

1. **Create Feature Flag**:
   ```
   User Input → Frontend Form → Validation → API POST /flags → Database → Response → UI Update
   ```
   - [ ] Flag appears in list immediately
   - [ ] Flag details correct

2. **Create Experiment**:
   ```
   Step 1: Select Flag → API GET /flags → Display options
   Step 2: Choose Design → Local state update
   Step 3: Configure → Real-time validation → Local state
   Step 4: Power Analysis → Calculate → Local state
   Step 5: Review → API POST /experiments → Database → Response → Redirect
   ```
   - [ ] Each step preserves state
   - [ ] Navigation works (Next/Back)
   - [ ] Final submission creates experiment
   - [ ] Experiment appears in list

3. **View Experiment**:
   ```
   Click Experiment → API GET /experiments/:id → Display details
   ```
   - [ ] All fields displayed correctly
   - [ ] Variant allocations shown
   - [ ] Design config shown

### State Management

**Verify**:
- [ ] Wizard state persists during navigation (Next/Back)
- [ ] Wizard state cleared on cancel/completion
- [ ] React Query cache updates after mutations
- [ ] Optimistic updates work (if implemented)
- [ ] List refreshes after create/update/delete

---

## Performance Integration

### Response Times

**Measure with Browser DevTools**:
- [ ] GET /api/v1/flags: < 100ms
- [ ] GET /api/v1/experiments: < 200ms
- [ ] POST /api/v1/experiments: < 500ms
- [ ] Total wizard completion time: < 30s (user dependent)

### Caching

**Verify React Query caching**:
- [ ] Feature flags cached (staleTime configured)
- [ ] Experiments list cached
- [ ] Cache invalidated on mutation
- [ ] Background refetch works

**Test**:
1. Load experiments list → Network request
2. Navigate away and back → No network request (cache hit)
3. Create new experiment → List auto-updates

---

## Browser Compatibility

**Test in Each Browser**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest) - macOS only
- [ ] Edge (latest)

**Verify for Each**:
- [ ] API requests work
- [ ] Validation displays correctly
- [ ] Wizard navigation works
- [ ] No console errors

---

## Production Checklist

**Before Going Live**:

- [ ] Environment variables configured for production
- [ ] API URL points to production backend
- [ ] CORS configured for production domain
- [ ] Authentication configured
- [ ] HTTPS enforced
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Analytics enabled (if applicable)
- [ ] Performance monitoring enabled
- [ ] Build optimized (`npm run build`)
- [ ] Assets minified and compressed
- [ ] Source maps generated (for debugging)
- [ ] Health check endpoint working
- [ ] Database migrations applied
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Monitoring dashboards created
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Team trained on new features

---

## Troubleshooting Common Issues

### Issue 1: CORS Errors

**Symptom**: Browser console shows CORS error, requests fail

**Diagnosis**:
```bash
# Check backend CORS headers
curl -X OPTIONS http://localhost:3000/api/v1/flags \
  -H "Origin: http://localhost:5173" \
  -v
```

**Solution**:
- Add dashboard origin to backend CORS allowlist
- Restart backend after config change
- Clear browser cache

### Issue 2: 404 Not Found

**Symptom**: API requests return 404

**Diagnosis**:
- Check API base URL in dashboard config
- Check backend routes are registered
- Check backend is running on expected port

**Solution**:
- Verify `VITE_API_URL` environment variable
- Verify backend route paths match frontend expectations
- Check for typos in endpoint URLs

### Issue 3: Validation Mismatch

**Symptom**: Frontend validation passes but backend rejects

**Diagnosis**:
- Compare frontend validation rules to backend rules
- Check regex patterns match exactly
- Check numeric ranges match

**Solution**:
- Synchronize validation rules
- Add backend validation error display in frontend
- Document validation rules in shared location

### Issue 4: Slow Requests

**Symptom**: API requests take >5 seconds

**Diagnosis**:
- Check database query performance
- Check network latency
- Check backend logs for slow operations

**Solution**:
- Add database indexes
- Enable query caching
- Optimize N+1 queries
- Add connection pooling

### Issue 5: TypeScript Type Errors

**Symptom**: TypeScript errors about mismatched types

**Diagnosis**:
- Compare frontend types to actual backend responses
- Check for missing fields or renamed fields

**Solution**:
- Update type definitions to match backend
- Add response transformation if needed
- Consider auto-generating types from backend schema

---

## Integration Test Results Log

| Date | Tester | Backend Version | Frontend Version | Result | Issues Found |
|------|--------|----------------|------------------|--------|--------------|
| 2025-11-11 | Claude | main | Phase 3.1 | Pass | 0 (pending manual test) |

---

## Sign-Off

**Integration Verified By**: __________________ Date: __________

**Backend Lead Approval**: __________________ Date: __________

**Frontend Lead Approval**: __________________ Date: __________

**QA Approval**: __________________ Date: __________

**Ready for Production**: ☐ Yes  ☐ No

**If No, Blockers**:
- [ ] Issue 1: _____________________
- [ ] Issue 2: _____________________
- [ ] Issue 3: _____________________

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
