# Experimentation API Documentation

## Overview

The Experimentation API provides a RESTful interface for managing feature flags, experiments, assignments, and event tracking. It supports complex experimental designs including A/B tests, multivariate tests, factorial designs, within-subjects designs, and switchback experiments.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All endpoints (except health checks and some public endpoints) require API key authentication.

Include your API key in the request header:

```
X-API-Key: your_api_key_here
```

## Rate Limiting

Rate limits are enforced per endpoint type:
- General endpoints: 100 requests/minute
- Read endpoints: 1000 requests/minute
- Write endpoints: 30 requests/minute
- Expensive operations: 10 requests/minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time when the rate limit resets

## API Endpoints

### Health Check

#### GET /health
Check API health status (no authentication required)

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-06T10:00:00Z",
  "uptime": 12345,
  "environment": "development",
  "version": "1.0.0"
}
```

---

## Experiments

### Create Experiment

#### POST /api/v1/experiments

Create a new experiment.

**Request Body:**
```json
{
  "key": "checkout_optimization",
  "name": "Checkout Flow Optimization",
  "description": "Testing different checkout button styles",
  "designType": "factorial",
  "primaryMetric": "checkout_completion_rate",
  "secondaryMetrics": ["time_to_checkout", "cart_abandonment_rate"],
  "guardrailMetrics": ["page_load_time", "error_rate"],
  "randomizationUnit": "user",
  "assignmentKey": "userId",
  "variants": [
    {
      "key": "blue_buy_now",
      "name": "Blue Buy Now",
      "description": "Blue button with Buy Now text",
      "allocation": 25
    },
    {
      "key": "blue_purchase",
      "name": "Blue Purchase",
      "allocation": 25
    },
    {
      "key": "green_buy_now",
      "name": "Green Buy Now",
      "allocation": 25
    },
    {
      "key": "green_purchase",
      "name": "Green Purchase",
      "allocation": 25
    }
  ],
  "designConfig": {
    "type": "factorial",
    "factors": [
      {
        "name": "button_color",
        "levels": ["blue", "green"]
      },
      {
        "name": "button_text",
        "levels": ["buy_now", "purchase"]
      }
    ]
  },
  "trafficAllocation": 100,
  "minSampleSize": 10000,
  "expectedEffect": 0.05
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "checkout_optimization",
    "name": "Checkout Flow Optimization",
    "status": "draft",
    "createdAt": "2025-11-06T10:00:00Z",
    "updatedAt": "2025-11-06T10:00:00Z",
    ...
  }
}
```

### List Experiments

#### GET /api/v1/experiments

List all experiments with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (draft|running|paused|completed)
- `designType` (optional): Filter by design type
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `sortBy` (optional): Sort field (createdAt|updatedAt|name|startDate)
- `sortOrder` (optional): Sort order (asc|desc)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Get Experiment

#### GET /api/v1/experiments/:id

Get a specific experiment by ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "checkout_optimization",
    ...
  }
}
```

### Update Experiment

#### PUT /api/v1/experiments/:id

Update an experiment. Cannot modify core configuration of running experiments.

**Request Body:**
```json
{
  "name": "Updated Experiment Name",
  "description": "Updated description",
  "status": "running"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { ... }
}
```

### Delete Experiment

#### DELETE /api/v1/experiments/:id

Delete an experiment. Cannot delete running experiments.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Experiment deleted successfully"
}
```

### Get Experiment Results

#### GET /api/v1/experiments/:id/results

Get analysis results for an experiment.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "experimentId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "sampleSize": 10000,
    "startDate": "2025-11-01T00:00:00Z",
    "mainEffects": [
      {
        "factor": "button_color",
        "metric": "checkout_completion_rate",
        "control": "blue",
        "treatment": "green",
        "controlMean": 0.45,
        "treatmentMean": 0.48,
        "relativeChange": 6.67,
        "pValue": 0.023,
        "confidenceInterval": [0.9, 12.4]
      }
    ],
    "interactions": []
  }
}
```

---

## Feature Flags

### Create Feature Flag

#### POST /api/v1/flags

Create a new feature flag.

**Request Body:**
```json
{
  "key": "new_checkout_flow",
  "name": "New Checkout Flow",
  "description": "Enable new checkout flow",
  "enabled": true,
  "defaultValue": false,
  "variants": [
    {
      "key": "enabled",
      "value": true,
      "weight": 50
    },
    {
      "key": "disabled",
      "value": false,
      "weight": 50
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "key": "new_checkout_flow",
    ...
  }
}
```

### List Feature Flags

#### GET /api/v1/flags

List all feature flags with filtering and pagination.

**Query Parameters:**
- `enabled` (optional): Filter by enabled status (true|false)
- `page`, `limit`, `sortBy`, `sortOrder`: Pagination parameters

### Get Feature Flag

#### GET /api/v1/flags/:id

Get a specific feature flag by ID.

### Update Feature Flag

#### PUT /api/v1/flags/:id

Update a feature flag.

### Delete Feature Flag

#### DELETE /api/v1/flags/:id

Delete a feature flag.

### Evaluate Feature Flag

#### GET /api/v1/flags/:key/evaluate

Evaluate a feature flag for a specific user/unit.

**Query Parameters:**
- `unitId` (required): User or unit ID
- `context` (optional): Additional context object

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "key": "new_checkout_flow",
    "value": true,
    "enabled": true,
    "variant": "enabled",
    "reason": "variant_assigned"
  }
}
```

---

## Assignments

### Get Assignment

#### GET /api/v1/assignments

Get experiment assignment for a unit.

**Query Parameters:**
- `unitId` (required): User or unit ID
- `experimentId` (optional): Specific experiment ID
- `experimentKey` (optional): Specific experiment key
- `context[key]` (optional): Context parameters (e.g., `context[platform]=mobile`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "unitId": "user123",
    "context": {
      "platform": "mobile"
    },
    "assignments": {
      "checkout_optimization": {
        "experimentId": "exp-123",
        "variantKey": "green_buy_now",
        "factors": {
          "button_color": "green",
          "button_text": "buy_now"
        },
        "assigned": true,
        "reason": "hash_assignment"
      }
    },
    "timestamp": "2025-11-06T10:00:00Z"
  }
}
```

### Bulk Assignment

#### POST /api/v1/assignments/bulk

Get assignments for multiple units at once.

**Request Body:**
```json
{
  "units": [
    {
      "unitId": "user123",
      "context": { "platform": "mobile" }
    },
    {
      "unitId": "user456",
      "context": { "platform": "web" }
    }
  ],
  "experimentIds": ["exp-123"],
  "experimentKeys": ["checkout_optimization"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [...],
  "count": 2,
  "timestamp": "2025-11-06T10:00:00Z"
}
```

---

## Events

### Track Exposure

#### POST /api/v1/events/exposures

Track when a user is exposed to an experiment variant.

**Request Body:**
```json
{
  "experimentId": "exp-123",
  "unitId": "user123",
  "variantKey": "green_buy_now",
  "exposurePoint": "checkout_page",
  "context": {
    "platform": "mobile",
    "version": "2.1.0"
  }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Exposure event queued for processing",
  "eventId": "exp_1699264800000_abc123",
  "timestamp": "2025-11-06T10:00:00Z"
}
```

### Track Metric

#### POST /api/v1/events/metrics

Track a metric event.

**Request Body:**
```json
{
  "eventName": "checkout_completed",
  "unitId": "user123",
  "value": 1,
  "properties": {
    "cart_value": 99.99,
    "items_count": 3
  },
  "experimentIds": ["exp-123"]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Metric event queued for processing",
  "eventId": "met_1699264800000_xyz789",
  "timestamp": "2025-11-06T10:00:00Z"
}
```

### Batch Event Tracking

#### POST /api/v1/events/batch

Track multiple events in a single request.

**Request Body:**
```json
{
  "events": [
    {
      "type": "exposure",
      "data": {
        "experimentId": "exp-123",
        "unitId": "user123",
        "variantKey": "treatment"
      }
    },
    {
      "type": "metric",
      "data": {
        "eventName": "button_clicked",
        "unitId": "user123",
        "value": 1
      }
    }
  ]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "2 events queued for processing",
  "results": [
    {
      "eventId": "exposure_1699264800000_abc",
      "type": "exposure",
      "status": "queued"
    },
    {
      "eventId": "metric_1699264800000_xyz",
      "type": "metric",
      "status": "queued"
    }
  ],
  "timestamp": "2025-11-06T10:00:00Z"
}
```

### Event System Health

#### GET /api/v1/events/health

Check health of event tracking system.

**Response (200 OK):**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-06T10:00:00Z",
  "checks": {
    "eventStream": "ok",
    "storage": "ok",
    "processing": "ok"
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": { /* Optional additional details */ }
}
```

### Common HTTP Status Codes

- `200 OK`: Successful GET, PUT, DELETE
- `201 Created`: Successful POST (resource created)
- `202 Accepted`: Request accepted for async processing
- `400 Bad Request`: Invalid request (validation error)
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Example Usage

### cURL Examples

**Create an experiment:**
```bash
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "key": "button_test",
    "name": "Button Color Test",
    "description": "Testing button colors",
    "designType": "ab",
    "primaryMetric": "click_rate",
    "randomizationUnit": "user",
    "assignmentKey": "userId",
    "variants": [
      {"key": "control", "name": "Control", "allocation": 50},
      {"key": "treatment", "name": "Treatment", "allocation": 50}
    ],
    "trafficAllocation": 100
  }'
```

**Get assignment:**
```bash
curl "http://localhost:3000/api/v1/assignments?unitId=user123&experimentKey=button_test" \
  -H "X-API-Key: your_api_key"
```

**Track exposure:**
```bash
curl -X POST http://localhost:3000/api/v1/events/exposures \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "experimentId": "exp-123",
    "unitId": "user123",
    "variantKey": "treatment"
  }'
```

### JavaScript/TypeScript Examples

```typescript
// Using fetch API
const apiKey = 'your_api_key';
const baseURL = 'http://localhost:3000/api/v1';

// Create experiment
const response = await fetch(`${baseURL}/experiments`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  },
  body: JSON.stringify({
    key: 'button_test',
    name: 'Button Color Test',
    // ... other fields
  }),
});

const result = await response.json();
console.log(result);

// Get assignment
const assignment = await fetch(
  `${baseURL}/assignments?unitId=user123&experimentKey=button_test`,
  {
    headers: { 'X-API-Key': apiKey },
  }
).then(r => r.json());

// Track metric
await fetch(`${baseURL}/events/metrics`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  },
  body: JSON.stringify({
    eventName: 'button_clicked',
    unitId: 'user123',
    value: 1,
  }),
});
```

---

## Best Practices

1. **Always track exposures**: Track when users are actually exposed to variants, not just assigned
2. **Use batch endpoints**: For high-volume tracking, use the batch events endpoint
3. **Handle rate limits**: Implement exponential backoff when rate limited
4. **Cache assignments**: Cache experiment assignments on the client side when possible
5. **Validate early**: Use the validation schemas to validate data before sending
6. **Monitor errors**: Track API error rates and investigate 4xx/5xx responses
7. **Use HTTPS**: Always use HTTPS in production

---

## Support

For issues, questions, or feature requests, please refer to the main project documentation.
