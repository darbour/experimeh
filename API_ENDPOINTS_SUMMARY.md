# REST API Endpoints Summary

## Overview
Comprehensive REST API for the experimentation system with full CRUD operations, event tracking, and assignment management.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All endpoints require `X-API-Key` header unless specified as public.

---

## Health & Info Endpoints

### GET /health
**Public endpoint** - Check API health status

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

### GET /api/v1
**Public endpoint** - API information and available endpoints

---

## Experiments API

### POST /api/v1/experiments
Create a new experiment

**Authentication:** Required
**Rate Limit:** 30 requests/minute
**Request Body:** See createExperimentSchema

**Key Fields:**
- `key` - Unique experiment identifier (lowercase, alphanumeric, underscores)
- `name` - Human-readable name
- `designType` - ab | multivariate | factorial | within_subjects | switchback
- `variants` - Array of variants with allocations (must sum to 100)
- `primaryMetric` - Main metric to measure
- `randomizationUnit` - user | session | device | other

**Response:** 201 Created

---

### GET /api/v1/experiments
List all experiments with filtering and pagination

**Authentication:** Required
**Rate Limit:** 1000 requests/minute

**Query Parameters:**
- `status` - Filter by status (draft|running|paused|completed)
- `designType` - Filter by design type
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Sort field (createdAt|updatedAt|name|startDate)
- `sortOrder` - Sort order (asc|desc)

**Response:** 200 OK with pagination metadata

---

### GET /api/v1/experiments/:id
Get a specific experiment by ID

**Authentication:** Required
**Rate Limit:** 1000 requests/minute
**URL Parameters:** `id` - UUID of experiment

**Response:** 200 OK

---

### PUT /api/v1/experiments/:id
Update an experiment

**Authentication:** Required
**Rate Limit:** 30 requests/minute
**URL Parameters:** `id` - UUID of experiment

**Restrictions:**
- Cannot modify core configuration (variants, designType, randomizationUnit) of running experiments

**Response:** 200 OK

---

### DELETE /api/v1/experiments/:id
Delete an experiment

**Authentication:** Required
**Rate Limit:** 30 requests/minute
**URL Parameters:** `id` - UUID of experiment

**Restrictions:**
- Cannot delete running experiments (must pause first)

**Response:** 200 OK

---

### GET /api/v1/experiments/:id/results
Get analysis results for an experiment

**Authentication:** Required
**Rate Limit:** 1000 requests/minute
**URL Parameters:** `id` - UUID of experiment

**Response:** 200 OK with analysis results including:
- Sample size
- Main effects (for factorial designs)
- Interaction effects
- Statistical significance
- Confidence intervals

---

## Feature Flags API

### POST /api/v1/flags
Create a new feature flag

**Authentication:** Required
**Rate Limit:** 30 requests/minute

**Key Fields:**
- `key` - Unique flag identifier
- `enabled` - Boolean flag status
- `defaultValue` - Default value when disabled
- `variants` - Optional array of variants with weights (must sum to 100)

**Response:** 201 Created

---

### GET /api/v1/flags
List all feature flags with filtering and pagination

**Authentication:** Required
**Rate Limit:** 1000 requests/minute

**Query Parameters:**
- `enabled` - Filter by enabled status (true|false)
- `page`, `limit`, `sortBy`, `sortOrder` - Pagination parameters

**Response:** 200 OK with pagination metadata

---

### GET /api/v1/flags/:id
Get a specific feature flag by ID

**Authentication:** Required
**Rate Limit:** 1000 requests/minute
**URL Parameters:** `id` - UUID of flag

**Response:** 200 OK

---

### PUT /api/v1/flags/:id
Update a feature flag

**Authentication:** Required
**Rate Limit:** 30 requests/minute
**URL Parameters:** `id` - UUID of flag

**Response:** 200 OK

---

### DELETE /api/v1/flags/:id
Delete a feature flag

**Authentication:** Required
**Rate Limit:** 30 requests/minute
**URL Parameters:** `id` - UUID of flag

**Response:** 200 OK

---

### GET /api/v1/flags/:key/evaluate
Evaluate a feature flag for a specific unit

**Authentication:** Optional
**Rate Limit:** 1000 requests/minute
**URL Parameters:** `key` - Flag key

**Query Parameters:**
- `unitId` (required) - User or unit ID
- `context` (optional) - Additional context object

**Response:** 200 OK
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

## Assignments API

### GET /api/v1/assignments
Get experiment assignment for a unit

**Authentication:** Optional
**Rate Limit:** 1000 requests/minute

**Query Parameters:**
- `unitId` (required) - User or unit ID
- `experimentId` (optional) - Specific experiment ID
- `experimentKey` (optional) - Specific experiment key
- `context[key]` (optional) - Context parameters (e.g., context[platform]=mobile)

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "unitId": "user123",
    "context": { "platform": "mobile" },
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

---

### POST /api/v1/assignments/bulk
Get assignments for multiple units at once

**Authentication:** Optional
**Rate Limit:** 1000 requests/minute

**Request Body:**
```json
{
  "units": [
    { "unitId": "user123", "context": {} },
    { "unitId": "user456", "context": {} }
  ],
  "experimentIds": ["exp-123"],
  "experimentKeys": ["checkout_optimization"]
}
```

**Response:** 200 OK with array of assignments

---

## Events API

### POST /api/v1/events/exposures
Track when a user is exposed to an experiment variant

**Authentication:** Optional
**Rate Limit:** 30 requests/minute

**Request Body:**
```json
{
  "experimentId": "exp-123",
  "unitId": "user123",
  "variantKey": "treatment",
  "exposurePoint": "checkout_page",
  "context": { "platform": "mobile" }
}
```

**Response:** 202 Accepted (async processing)

---

### POST /api/v1/events/metrics
Track a metric event

**Authentication:** Optional
**Rate Limit:** 30 requests/minute

**Request Body:**
```json
{
  "eventName": "checkout_completed",
  "unitId": "user123",
  "value": 1,
  "properties": { "cart_value": 99.99 },
  "experimentIds": ["exp-123"]
}
```

**Response:** 202 Accepted (async processing)

---

### POST /api/v1/events/batch
Track multiple events in a single request

**Authentication:** Optional
**Rate Limit:** 30 requests/minute

**Request Body:**
```json
{
  "events": [
    {
      "type": "exposure",
      "data": { "experimentId": "exp-123", "unitId": "user123", "variantKey": "treatment" }
    },
    {
      "type": "metric",
      "data": { "eventName": "button_clicked", "unitId": "user123", "value": 1 }
    }
  ]
}
```

**Limits:**
- Min: 1 event
- Max: 1000 events per request

**Response:** 202 Accepted with array of event IDs

---

### GET /api/v1/events/health
Check health of event tracking system

**Authentication:** Not required
**Response:** 200 OK with system health status

---

## Middleware Features

### 1. Authentication (auth.ts)
- **apiKeyAuth**: Requires valid API key
- **optionalAuth**: Optional authentication for public endpoints
- **adminAuth**: Requires admin-level API key

### 2. Validation (validation.ts)
- Joi-based schema validation
- Validates request body, query params, and URL params
- Detailed error messages on validation failure

### 3. Rate Limiting (rateLimit.ts)
- In-memory rate limiter (Redis-backed recommended for production)
- Different limits for different endpoint types:
  - General: 100 req/min
  - Read: 1000 req/min
  - Write: 30 req/min
  - Expensive: 10 req/min

### 4. Request Logging (logger.ts)
- Winston-based logging
- Logs all incoming requests with timing
- Structured logging with metadata
- Separate error logging

### 5. Error Handling (errorHandler.ts)
- Global error handler
- Custom ApiError class
- Consistent error response format
- 404 handler for unknown routes
- Async error wrapper for route handlers

### 6. Security
- **Helmet**: Security headers
- **CORS**: Configurable CORS support
- **Compression**: Response compression

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": {}
}
```

### Common Status Codes
- `200 OK` - Successful GET, PUT, DELETE
- `201 Created` - Successful POST (resource created)
- `202 Accepted` - Request accepted for async processing
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid API key
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1699264800000
```

When rate limited (429 response):

```
Retry-After: 45
```

---

## Environment Configuration

Required environment variables (see .env.example):

```bash
# Server
NODE_ENV=development
PORT=3000

# API
CORS_ORIGIN=*
VALID_API_KEYS=key1,key2
ADMIN_API_KEYS=admin_key

# Logging
LOG_LEVEL=info

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=experimeh

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092
```

---

## Graceful Shutdown

The API implements graceful shutdown on:
- SIGTERM
- SIGINT
- Uncaught exceptions
- Unhandled promise rejections

Shutdown process:
1. Stop accepting new connections
2. Wait for existing requests to complete
3. Close database connections
4. Close Redis connections
5. Disconnect from Kafka
6. Exit process

Timeout: 30 seconds (forced shutdown)

---

## Files Created

### Core Files
- `/home/user/experimeh/src/api/app.ts` - Express application setup
- `/home/user/experimeh/src/api/index.ts` - Module exports

### Middleware
- `/home/user/experimeh/src/api/middleware/auth.ts` - Authentication
- `/home/user/experimeh/src/api/middleware/validation.ts` - Request validation
- `/home/user/experimeh/src/api/middleware/rateLimit.ts` - Rate limiting
- `/home/user/experimeh/src/api/middleware/logger.ts` - Request logging
- `/home/user/experimeh/src/api/middleware/errorHandler.ts` - Error handling

### Routes
- `/home/user/experimeh/src/api/routes/experiments.ts` - Experiment CRUD
- `/home/user/experimeh/src/api/routes/feature-flags.ts` - Feature flag CRUD
- `/home/user/experimeh/src/api/routes/assignments.ts` - Assignment logic
- `/home/user/experimeh/src/api/routes/events.ts` - Event tracking

### Validators
- `/home/user/experimeh/src/api/validators/experiment.ts` - Experiment schemas
- `/home/user/experimeh/src/api/validators/featureFlag.ts` - Feature flag schemas
- `/home/user/experimeh/src/api/validators/assignment.ts` - Assignment schemas
- `/home/user/experimeh/src/api/validators/event.ts` - Event schemas

### Documentation
- `/home/user/experimeh/API_DOCUMENTATION.md` - Full API documentation
- `/home/user/experimeh/API_ENDPOINTS_SUMMARY.md` - This file

---

## Starting the Server

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# With Docker
npm run docker:build
npm run docker:run
```

---

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Create experiment (with API key)
curl -X POST http://localhost:3000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_key" \
  -d '{"key":"test","name":"Test","designType":"ab",...}'

# Get assignment
curl "http://localhost:3000/api/v1/assignments?unitId=user123"
```

---

## Production Considerations

1. **Database**: Replace in-memory storage with PostgreSQL
2. **Cache**: Implement Redis for:
   - Rate limiting (distributed)
   - Assignment caching
   - Feature flag caching
3. **Events**: Connect to Kafka for async event processing
4. **Monitoring**: Add Prometheus metrics
5. **Logging**: Configure external logging service
6. **Security**:
   - Use HTTPS
   - Implement proper API key management
   - Add request signing
7. **Scalability**:
   - Horizontal scaling with load balancer
   - Database connection pooling
   - Redis cluster

---

**Total Endpoints:** 22
**Total Files Created:** 15
**Languages:** TypeScript
**Framework:** Express.js
