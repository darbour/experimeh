# Experimeh Launch Guide

This guide will help you get started with the Experimeh experimentation system.

## Current Status

The project has two type systems that need reconciliation:
- **Old types**: `src/types/index.ts` - simpler definitions
- **New models**: `src/models/` - comprehensive, production-ready definitions

The API routes currently have type mismatches that prevent compilation. However, the standalone examples work perfectly!

## ✅ Quick Start: Run Standalone Examples (Recommended)

The easiest way to see the system in action is to run the standalone examples. These are fully functional and demonstrate all major features.

### Step 1: Install Dependencies

```bash
npm install
```

###Step 2: Run Examples

```bash
# Simple A/B test - great starting point!
npx ts-node examples/01-simple-ab-test.ts

# Factorial design - test multiple factors simultaneously
npx ts-node examples/02-factorial-design.ts

# Feature flags demonstration
npx ts-node examples/05-feature-flags.ts

# Power analysis - essential for planning experiments
npx ts-node examples/07-power-analysis.ts

# CUPED variance reduction - advanced technique
npx ts-node examples/08-cuped-variance-reduction.ts

# Stepped wedge design - sequential rollout
npx ts-node examples/10-stepped-wedge-design.ts
```

### What You'll See

Each example produces detailed output including:
- **Scenario description**: What's being tested
- **Configuration**: Experiment parameters
- **Simulated data**: Generated user behavior
- **Statistical analysis**: P-values, confidence intervals, effect sizes
- **Visualization**: ASCII charts and tables
- **Recommendations**: Should you ship the feature?
- **Key takeaways**: Best practices and lessons

### Learning Path

1. **Beginners**: Start with `01-simple-ab-test.ts`
2. **Intermediate**: Try `02-factorial-design.ts` and `07-power-analysis.ts`
3. **Advanced**: Explore `08-cuped-variance-reduction.ts` and `10-stepped-wedge-design.ts`

## 🔧 Fixing the API Server (For Contributors)

If you want to fix the API server and get it running, here's what needs to be done:

### Issues to Resolve

1. **Type System Unification**: The codebase has two parallel type systems
   - `src/types/index.ts` - older, simpler types
   - `src/models/` - newer, comprehensive types with proper enums

2. **Specific Type Mismatches**:
   - `FeatureFlag.enabled` (boolean) → `FeatureFlag.status` (enum)
   - `FeatureFlagVariant` missing `id` property in old types
   - `FeatureFlag` missing `linkedExperiments` in old types
   - `Experiment` structure significantly different between systems

### Recommended Fix Approach

**Option A: Use New Models Everywhere (Recommended)**

1. Update all API routes to import from `src/models/` instead of `src/types/`
2. Update validators to match new model structure
3. Update any code using `flag.enabled` to use `flag.status === FeatureFlagStatus.ENABLED`
4. Update Experiment usage to include required fields: `featureFlagId`, `variantAllocations`, etc.

**Option B: Use Old Types Everywhere**

1. Revert imports back to `src/types/`
2. Simplify the API routes to match simpler type structure
3. Remove advanced features that require the new models

### Quick Fix to Get Server Running

If you just want to get something running quickly, here's a minimal fix:

```bash
# Create a simple server that just returns health check
cat > src/simple-server.ts << 'EOF'
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Experimentation API',
    version: 'v1',
    message: 'API server running. Use standalone examples to see features in action.',
    examples: '/examples/',
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API Info: http://localhost:${PORT}/api/v1`);
});
EOF

# Run it
PORT=8000 npx ts-node src/simple-server.ts
```

## 📊 Dashboard Setup (Once API is Fixed)

The React dashboard provides a visual interface for managing experiments.

### Prerequisites
- Backend API running on port 8000
- Node.js 18+

### Steps

```bash
# 1. Install dashboard dependencies
cd dashboard
npm install

# 2. Configure environment
cat > .env << EOF
VITE_API_URL=http://localhost:8000/api
EOF

# 3. Start dashboard
npm run dev

# 4. Open browser
# Navigate to http://localhost:5173
```

### Dashboard Features

Once running, you can:
- Create experiments via wizard
- Start/pause/stop experiments
- View real-time metrics
- Analyze statistical results
- Monitor guardrail metrics

## 🎯 Recommended Next Steps

### For Learning

1. **Run all examples**: `for file in examples/*.ts; do npx ts-node "$file"; done`
2. **Read the examples README**: `cat examples/README.md`
3. **Study the code**: Examples have extensive inline comments

### For Development

1. **Fix type system**: Choose models or types and be consistent
2. **Update API routes**: Make all imports consistent
3. **Test server**: `PORT=8000 npx ts-node src/api/app.ts`
4. **Run tests**: `npm test` (after server is fixed)

### For Production Use

1. **Set up infrastructure**: `./scripts/infra-setup.sh`
2. **Configure environment**: Copy and edit `.env.example`
3. **Fix API types**: Complete the type system unification
4. **Set up database**: Replace in-memory storage with PostgreSQL
5. **Deploy**: Use Docker or your preferred platform

## 📚 Additional Resources

- **Examples README**: `examples/README.md` - Detailed guide to all examples
- **API Documentation**: `API_DOCUMENTATION.md` - API reference (once server is fixed)
- **Statistical Methods**: `STATISTICAL_ANALYSIS_SUMMARY.md` - Statistical approaches
- **Production Guide**: `FINAL_PRODUCTION_READINESS.md` - Deployment checklist

## 🐛 Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Property 'enabled' does not exist on type 'FeatureFlag'"
This is the type mismatch issue. Use standalone examples instead of API server for now.

### Examples run but show no output
Examples are synchronous and print to console. Make sure you're not redirecting output.

### Want to see real database integration?
Check `python/` directory for Python examples with actual statistics calculations.

## 💡 Tips

1. **Start Simple**: Begin with `01-simple-ab-test.ts`
2. **Read Comments**: Examples have extensive documentation inline
3. **Modify Parameters**: Change values to see different scenarios
4. **Use TypeScript**: The type system (once fixed) provides excellent IDE support
5. **Check Examples README**: It has learning paths for different skill levels

## ❓ Questions?

- Check example source code - they're heavily commented
- Read `examples/README.md` for detailed explanations
- Review API docs once server is fixed
- Look at test files for more usage examples

---

**TL;DR**: Run `npx ts-node examples/01-simple-ab-test.ts` to see the system in action right now!
