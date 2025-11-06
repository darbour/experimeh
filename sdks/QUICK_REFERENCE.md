# Experimeh SDKs - Quick Reference Guide

## Installation

```bash
# Browser JavaScript SDK
npm install @experimeh/browser

# React SDK
npm install @experimeh/react @experimeh/browser
```

---

## Browser JavaScript SDK

### Basic Setup
```javascript
import { ExperimentClient } from '@experimeh/browser';

const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});
```

### Get Assignment
```javascript
const assignment = await client.getAssignment('experiment-key', 'user-123');
console.log(assignment.variantKey); // 'control' or 'treatment'
```

### Track Exposure
```javascript
await client.trackExposure('experiment-key', 'user-123', assignment.variantKey);
```

### Track Metric
```javascript
await client.trackMetric('conversion', 'user-123', 1);
await client.trackMetric('revenue', 'user-123', 99.99, { currency: 'USD' });
```

### Feature Flag Pattern
```javascript
async function isFeatureEnabled(featureKey, userId) {
  try {
    const assignment = await client.getAssignment(featureKey, userId);
    return assignment.variantKey === 'enabled';
  } catch (error) {
    return false; // Fail closed
  }
}

if (await isFeatureEnabled('new-checkout', 'user-123')) {
  showNewCheckout();
}
```

---

## React SDK

### Provider Setup
```tsx
import { ExperimentProvider } from '@experimeh/react';

function App() {
  return (
    <ExperimentProvider
      apiUrl="https://api.example.com"
      apiKey="your-api-key"
      userId="user-123"
    >
      <MyApp />
    </ExperimentProvider>
  );
}
```

### useAssignment Hook
```tsx
import { useAssignment } from '@experimeh/react';

function MyComponent() {
  const { variantKey, loading } = useAssignment('experiment-key', {
    autoTrackExposure: true,
  });

  if (loading) return <Spinner />;

  return variantKey === 'treatment' ? (
    <NewFeature />
  ) : (
    <OldFeature />
  );
}
```

### ExperimentGate Component
```tsx
import { ExperimentGate } from '@experimeh/react';

<ExperimentGate experiment="new-ui" variant="treatment">
  <NewUI />
</ExperimentGate>

// With fallback
<ExperimentGate
  experiment="new-ui"
  variant="treatment"
  fallback={<OldUI />}
>
  <NewUI />
</ExperimentGate>

// Multiple variants
<ExperimentGate
  experiment="button-test"
  variant={['red', 'green', 'blue']}
>
  <ColoredButton />
</ExperimentGate>
```

### FeatureFlag Component
```tsx
import { FeatureFlag } from '@experimeh/react';

<FeatureFlag flag="dark-mode">
  <DarkTheme />
</FeatureFlag>

// With fallback
<FeatureFlag flag="dark-mode" fallback={<LightTheme />}>
  <DarkTheme />
</FeatureFlag>
```

### useTrackMetric Hook
```tsx
import { useTrackMetric } from '@experimeh/react';

function CheckoutButton() {
  const trackMetric = useTrackMetric();

  const handleClick = async () => {
    await trackMetric('checkout_click', 1);
    navigate('/checkout');
  };

  return <button onClick={handleClick}>Checkout</button>;
}
```

### useExperiment Hook
```tsx
import { useExperiment } from '@experimeh/react';

function MyComponent() {
  const { assignment, loading, error, refetch } = useExperiment('exp-1');

  if (loading) return <Spinner />;
  if (error) return <Error />;

  return <div>Variant: {assignment.variantKey}</div>;
}
```

---

## Common Patterns

### A/B Test
```tsx
function HomePage() {
  const { variantKey } = useAssignment('homepage-test', {
    autoTrackExposure: true,
  });

  return variantKey === 'treatment' ? <NewHero /> : <OldHero />;
}
```

### Multi-Variant Test
```tsx
function ButtonTest() {
  const { variantKey } = useAssignment('button-color', {
    autoTrackExposure: true,
  });

  const colors = {
    control: 'blue',
    red: 'red',
    green: 'green',
    yellow: 'yellow',
  };

  return <Button color={colors[variantKey || 'control']} />;
}
```

### Feature Flag
```tsx
<FeatureFlag flag="new-feature" fallback={<OldFeature />}>
  <NewFeature />
</FeatureFlag>
```

### Nested Flags
```tsx
<FeatureFlag flag="beta-features">
  <FeatureFlag flag="advanced-analytics">
    <AdvancedAnalytics />
  </FeatureFlag>
</FeatureFlag>
```

### Error Handling
```tsx
function MyComponent() {
  const { variantKey, loading, error } = useAssignment('exp-1');

  if (loading) return <Spinner />;

  if (error) {
    console.error('Failed to load experiment:', error);
    return <ControlVariant />; // Fail closed
  }

  return variantKey === 'treatment' ? (
    <TreatmentVariant />
  ) : (
    <ControlVariant />
  );
}
```

### Conversion Tracking
```tsx
function PurchaseForm() {
  const trackMetric = useTrackMetric();

  const handleSubmit = async (amount) => {
    // Process purchase...

    // Track conversion
    await trackMetric('purchase', 1);

    // Track revenue
    await trackMetric('revenue', amount, {
      currency: 'USD',
      items: 3,
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## TypeScript

### Types
```typescript
import type {
  Assignment,
  Experiment,
  Variant,
  UseAssignmentResult,
  ExperimentError,
  NetworkError,
  ValidationError,
} from '@experimeh/browser';
// or from '@experimeh/react'
```

### Type-Safe Hook Usage
```tsx
const result: UseAssignmentResult = useAssignment('exp-1');

const handleAssignment = (assignment: Assignment) => {
  console.log(assignment.variantKey);
};
```

---

## Configuration

### Browser SDK Config
```javascript
const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',  // Required
  apiKey: 'your-api-key',             // Required
  cacheEnabled: true,                  // Optional, default: true
  cacheTTL: 300000,                    // Optional, default: 5 min
  maxRetries: 3,                       // Optional, default: 3
  retryDelay: 1000,                    // Optional, default: 1s
  timeout: 5000,                       // Optional, default: 5s
});
```

### React Provider Config
```tsx
<ExperimentProvider
  apiUrl="https://api.example.com"    // Required
  apiKey="your-api-key"               // Required
  userId="user-123"                   // Required
  cacheEnabled={true}                 // Optional, default: true
  cacheTTL={300000}                   // Optional, default: 5 min
  maxRetries={3}                      // Optional, default: 3
  timeout={5000}                      // Optional, default: 5s
>
  <App />
</ExperimentProvider>
```

---

## Error Types

### Browser SDK
```javascript
try {
  const assignment = await client.getAssignment('exp-1', 'user-123');
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid parameters
  } else if (error instanceof NetworkError) {
    // API error: error.statusCode, error.response
  } else if (error instanceof TimeoutError) {
    // Request timeout
  } else if (error instanceof CacheError) {
    // Cache error (non-fatal)
  }
}
```

---

## Best Practices

1. **Always handle loading states**
   ```tsx
   if (loading) return <Spinner />;
   ```

2. **Fail closed on errors**
   ```tsx
   if (error) return <ControlVariant />;
   ```

3. **Use auto-tracking**
   ```tsx
   useAssignment('exp-1', { autoTrackExposure: true });
   ```

4. **Track metrics consistently**
   ```tsx
   await trackMetric('conversion', 1);
   ```

5. **Use TypeScript types**
   ```tsx
   const result: UseAssignmentResult = useAssignment('exp-1');
   ```

---

## Next.js Integration

```tsx
// _app.tsx
import { ExperimentProvider } from '@experimeh/react';

function MyApp({ Component, pageProps }) {
  const userId = getUserId(); // Your auth logic

  return (
    <ExperimentProvider
      apiUrl={process.env.NEXT_PUBLIC_API_URL!}
      apiKey={process.env.NEXT_PUBLIC_API_KEY!}
      userId={userId}
    >
      <Component {...pageProps} />
    </ExperimentProvider>
  );
}

// pages/index.tsx
import { useAssignment } from '@experimeh/react';

export default function HomePage() {
  const { variantKey } = useAssignment('homepage-test', {
    autoTrackExposure: true,
  });

  return <div>Variant: {variantKey}</div>;
}
```

---

## Testing

### Mock Provider
```tsx
import { ExperimentProvider } from '@experimeh/react';

function MockProvider({ children }) {
  return (
    <ExperimentProvider
      apiUrl="http://localhost:3000"
      apiKey="test-key"
      userId="test-user"
    >
      {children}
    </ExperimentProvider>
  );
}

test('renders treatment variant', async () => {
  render(
    <MockProvider>
      <MyComponent />
    </MockProvider>
  );

  await screen.findByText('Treatment Content');
});
```

---

## Resources

- [Browser SDK Documentation](./browser-js/README.md)
- [React SDK Documentation](./react/README.md)
- [Examples](./browser-js/examples)
- [API Reference](https://docs.experimeh.com)
- [GitHub Issues](https://github.com/experimeh/experimeh/issues)
