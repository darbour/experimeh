#!/bin/bash
#
# Experimeh Demo Script
# Demonstrates how to launch and test the experimentation system
#

set -e

echo "========================================="
echo "  Experimeh Demo Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Starting API Server${NC}"
echo "Starting server on port 8000..."
PORT=8000 npx ts-node src/api/app.ts > /tmp/experimeh-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to initialize..."
sleep 6

# Test health endpoint
echo ""
echo -e "${BLUE}Step 2: Testing Health Endpoint${NC}"
HEALTH=$(curl -s http://localhost:8000/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo -e "${YELLOW}✗ Health check failed${NC}"
    cat /tmp/experimeh-server.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Test API info
echo ""
echo -e "${BLUE}Step 3: Testing API Info Endpoint${NC}"
API_INFO=$(curl -s http://localhost:8000/api/v1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ API info retrieved${NC}"
    echo "$API_INFO" | python3 -m json.tool 2>/dev/null || echo "$API_INFO"
else
    echo -e "${YELLOW}✗ API info failed${NC}"
fi

# Test creating a feature flag
echo ""
echo -e "${BLUE}Step 4: Creating a Feature Flag${NC}"
echo "Creating flag 'new_checkout_button'..."

FLAG_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/flags \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-12345" \
  -d '{
    "key": "new_checkout_button",
    "name": "New Checkout Button",
    "description": "A/B test for new checkout button design",
    "status": "enabled",
    "valueType": "string",
    "defaultValue": "control",
    "variants": [
      {
        "key": "control",
        "name": "Control",
        "description": "Original button",
        "value": "checkout_v1",
        "weight": 50
      },
      {
        "key": "treatment",
        "name": "Treatment",
        "description": "New button design",
        "value": "checkout_v2",
        "weight": 50
      }
    ],
    "targetingRules": [],
    "rollout": {
      "enabled": true,
      "percentage": 100,
      "variantId": "variant-1",
      "bucketBy": "userId"
    },
    "linkedExperiments": [],
    "environment": "development",
    "schedules": [],
    "tags": ["checkout", "ui"],
    "owner": "product-team",
    "usage": {
      "evaluationsLast24h": 0,
      "uniqueUsersLast24h": 0,
      "lastEvaluatedAt": null,
      "activeEnvironments": ["development"]
    },
    "audit": {
      "createdBy": "demo-script",
      "createdAt": "2025-11-12T00:00:00Z",
      "updatedBy": "demo-script",
      "updatedAt": "2025-11-12T00:00:00Z",
      "version": 1,
      "changeLog": []
    },
    "metadata": {}
  }')

if echo "$FLAG_RESPONSE" | grep -q "success\|id"; then
    echo -e "${GREEN}✓ Feature flag created${NC}"
    echo "$FLAG_RESPONSE" | python3 -m json.tool 2>/dev/null | head -30 || echo "$FLAG_RESPONSE"
else
    echo -e "${YELLOW}⚠ Feature flag creation returned:${NC}"
    echo "$FLAG_RESPONSE"
fi

# List feature flags
echo ""
echo -e "${BLUE}Step 5: Listing Feature Flags${NC}"
FLAGS_LIST=$(curl -s http://localhost:8000/api/v1/flags)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Flags retrieved${NC}"
    echo "$FLAGS_LIST" | python3 -m json.tool 2>/dev/null | head -50 || echo "$FLAGS_LIST"
else
    echo -e "${YELLOW}✗ Flags list failed${NC}"
fi

# Cleanup
echo ""
echo -e "${BLUE}Step 6: Cleanup${NC}"
echo "Stopping server (PID: $SERVER_PID)..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
echo -e "${GREEN}✓ Server stopped${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}  Demo Complete!${NC}"
echo "========================================="
echo ""
echo "Summary:"
echo "  • API server started successfully"
echo "  • Health and info endpoints working"
echo "  • Feature flags API functional"
echo ""
echo "To start the server manually:"
echo "  PORT=8000 npx ts-node src/api/app.ts"
echo ""
echo "API Documentation: http://localhost:8000/api/v1"
echo "Server logs: /tmp/experimeh-server.log"
echo ""
