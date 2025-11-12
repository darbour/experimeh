# Getting Started with Experimeh

## 🎉 Status: API Server is Working!

The TypeScript compilation issues have been fixed and the API server is now fully operational.

## Quick Start (60 seconds)

### Option 1: Run the Demo Script

```bash
./demo.sh
```

This will:
- Start the API server
- Test health endpoints
- Show API capabilities
- Clean up automatically

### Option 2: Manual Server Launch

```bash
# Install dependencies (if not done)
npm install

# Start the server
PORT=8000 npx ts-node src/api/app.ts

# In another terminal, test it:
curl http://localhost:8000/health
curl http://localhost:8000/api/v1
```

### Option 3: Python Examples (Also Working!)

```bash
cd python
pip install -e .
cd ..
python3 examples/example1_conversion_ab_test.py
```

## What Was Fixed

### Type System Unification

**Problem:** The codebase had two parallel type systems causing compilation errors:
- Old: `src/types/index.ts` (simple)
- New: `src/models/` (comprehensive, production-ready)

**Solution:** Updated all code to use the new models consistently.

### Specific Fixes

1. **API Routes** (`src/api/routes/experiments.ts`, `feature-flags.ts`)
   - ✅ Updated imports from `../../types` to `../../models/experiment` and `../../models/feature-flag`
   - ✅ Changed `flag.enabled` (boolean) to `flag.status === FeatureFlagStatus.ENABLED` (enum)
   - ✅ Fixed `experiment.createdAt` to `experiment.audit.createdAt`
   - ✅ Fixed `unknown` type issues in sorting with proper type assertions

2. **Unified Assignment Service** (`src/services/unified-assignment-service.ts`)
   - ✅ Fixed ExposureEvent type mismatches (flagKey, reason fields)
   - ✅ Fixed metadata to allow error field with proper typing
   - ✅ Added proper undefined handling for optional experiment fields

3. **Documentation**
   - ✅ Created `QUICKSTART.md` - Fast path guide
   - ✅ Created `LAUNCH_GUIDE.md` - Comprehensive troubleshooting
   - ✅ Created `GETTING_STARTED.md` (this file)
   - ✅ Created `demo.sh` - Automated demo script

## API Endpoints

### Health & Info
- `GET /health` - Server health check
- `GET /api/v1` - API information

### Feature Flags
- `GET /api/v1/flags` - List feature flags
- `POST /api/v1/flags` - Create feature flag
- `GET /api/v1/flags/:id` - Get flag by ID
- `PUT /api/v1/flags/:id` - Update flag
- `DELETE /api/v1/flags/:id` - Delete flag

### Experiments
- `GET /api/v1/experiments` - List experiments
- `POST /api/v1/experiments` - Create experiment
- `GET /api/v1/experiments/:id` - Get experiment
- `PUT /api/v1/experiments/:id` - Update experiment
- `POST /api/v1/experiments/:id/start` - Start experiment
- `POST /api/v1/experiments/:id/stop` - Stop experiment

### Assignments
- `POST /api/v1/assignments` - Get user assignment
- `GET /api/v1/assignments/:experimentId` - Get all assignments

### Events
- `POST /api/v1/events/exposure` - Log exposure event
- `POST /api/v1/events/metric` - Log metric event

## Architecture Overview

```
experimeh/
├── src/
│   ├── api/              # ✅ REST API (WORKING)
│   │   ├── routes/       # Endpoint handlers
│   │   ├── middleware/   # Auth, validation, rate limiting
│   │   └── validators/   # Request validation schemas
│   ├── models/           # ✅ Type definitions (NEW, comprehensive)
│   │   ├── experiment.ts
│   │   ├── feature-flag.ts
│   │   └── assignment.ts
│   ├── services/         # ✅ Core business logic
│   │   ├── unified-assignment-service.ts
│   │   └── ...
│   ├── analysis/         # ✅ Statistical tests
│   └── types/            # ⚠️  Old types (deprecated, keeping for compatibility)
├── dashboard/            # ✅ React UI (ready once API fully integrated)
├── examples/             # ⚠️  TypeScript examples (need function name updates)
├── python/               # ✅ Python examples (WORKING)
└── tests/                # Unit and integration tests
```

## Next Steps

### For Learning

1. **Read the documentation**
   ```bash
   cat QUICKSTART.md          # Fast overview
   cat examples/README.md     # Example walkthroughs
   cat README.md              # Full project docs
   ```

2. **Run Python examples** (these work perfectly)
   ```bash
   python3 examples/example1_conversion_ab_test.py
   ```

3. **Test the API**
   ```bash
   ./demo.sh
   ```

### For Development

1. **Start the Dashboard** (once you want a UI)
   ```bash
   cd dashboard
   npm install
   cat > .env << EOF
   VITE_API_URL=http://localhost:8000/api
   EOF
   npm run dev
   # Opens on http://localhost:5173
   ```

2. **Run Tests**
   ```bash
   npm test                  # All tests
   npm run test:unit         # Unit tests only
   npm run test:integration  # Integration tests
   ```

3. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

### For Production Deployment

1. **Set up infrastructure**
   ```bash
   ./scripts/infra-setup.sh     # PostgreSQL, Redis, Kafka
   ./scripts/infra-health.sh    # Verify services
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Deploy**
   ```bash
   npm run build
   docker build -t experimeh .
   docker run -p 3000:3000 experimeh
   ```

## Common Tasks

### Creating a Feature Flag

```bash
curl -X POST http://localhost:8000/api/v1/flags \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "key": "new_feature",
    "name": "New Feature",
    "description": "Testing new feature rollout",
    "defaultValue": false,
    "variants": [
      {"key": "off", "value": false, "weight": 50},
      {"key": "on", "value": true, "weight": 50}
    ]
  }'
```

### Starting an Experiment

```bash
curl -X POST http://localhost:8000/api/v1/experiments/:id/start \
  -H "X-API-Key: your-api-key"
```

### Getting User Assignment

```bash
curl -X POST http://localhost:8000/api/v1/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "experimentKey": "checkout_test",
    "unitId": "user_123"
  }'
```

## Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :8000

# View server logs
cat /tmp/experimeh-server.log

# Try a different port
PORT=3000 npx ts-node src/api/app.ts
```

### TypeScript compilation errors

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Try building
npm run build
```

### Python examples not working

```bash
cd python
pip install -e .
cd ..
```

## Documentation

- **QUICKSTART.md** - Fast getting started guide
- **LAUNCH_GUIDE.md** - Detailed troubleshooting and launch info
- **README.md** - Main project documentation
- **examples/README.md** - Example walkthroughs and learning paths
- **API_DOCUMENTATION.md** - Complete API reference
- **STATISTICAL_ANALYSIS_SUMMARY.md** - Statistical methods explained

## Support

- Check documentation first (see above)
- Run `./demo.sh` to verify server is working
- Check `/tmp/experimeh-server.log` for server errors
- Review commit history for recent changes

## Summary

✅ **API Server**: Working and tested
✅ **Python Examples**: Working
✅ **Documentation**: Comprehensive
✅ **Core Services**: Fully functional
⚠️ **TypeScript Examples**: Need function name updates (minor)
✅ **Dashboard**: Ready (just needs API running)

The system is ready to use! Start with `./demo.sh` or `python3 examples/example1_conversion_ab_test.py`.

---

**Last Updated**: November 2025
**Status**: Production Ready (with noted caveats)
