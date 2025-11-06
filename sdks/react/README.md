# @experimeh/react

React SDK for Experimeh feature flag experimentation with hooks and components.

## Features

- **React 16.8+**: Built with hooks
- **TypeScript First**: Full type definitions included
- **Context API**: Clean state management
- **Auto-Tracking**: Automatic exposure tracking
- **SSR Compatible**: Works with Next.js and other SSR frameworks
- **Loading States**: Built-in loading and error handling
- **Concurrent Mode**: React 18 compatible
- **Small Bundle**: Minimal bundle size impact

## Installation

```bash
npm install @experimeh/react @experimeh/browser
```

Or using yarn:

```bash
yarn add @experimeh/react @experimeh/browser
```

## Quick Start

```tsx
import { ExperimentProvider, useAssignment } from '@experimeh/react';

// Wrap your app with the provider
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

// Use the hook in your components
function CheckoutButton() {
  const { variantKey } = useAssignment('checkout-redesign', {
    autoTrackExposure: true,
  });

  if (variantKey === 'treatment') {
    return <NewCheckoutButton />;
  }

  return <OldCheckoutButton />;
}
```

## API Reference

### ExperimentProvider

Context provider that wraps your application.

```tsx
<ExperimentProvider
  apiUrl="https://api.example.com"
  apiKey="your-api-key"
  userId="user-123"
  cacheEnabled={true}
  cacheTTL={300000}
  maxRetries={3}
  timeout={5000}
>
  <App />
</ExperimentProvider>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiUrl` | string | *required* | Base URL of the Experimeh API |
| `apiKey` | string | *required* | API key for authentication |
| `userId` | string | *required* | Current user identifier |
| `cacheEnabled` | boolean | `true` | Enable LocalStorage caching |
| `cacheTTL` | number | `300000` | Cache TTL in milliseconds |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `timeout` | number | `5000` | Request timeout in milliseconds |

### Hooks

#### useExperiment

Get experiment assignment with full control.

```tsx
const { assignment, loading, error, refetch } = useExperiment('exp-1');
```

**Returns:**

```typescript
{
  assignment: Assignment | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

**Example:**

```tsx
function MyComponent() {
  const { assignment, loading, error } = useExperiment('button-color');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <Button color={assignment.variantKey} />;
}
```

#### useAssignment

Get assignment with auto-tracking support.

```tsx
const { variantKey, assignment, loading, error } = useAssignment('exp-1', {
  autoTrackExposure: true,
  metadata: { page: '/checkout' },
});
```

**Options:**

```typescript
{
  autoTrackExposure?: boolean; // Default: false
  metadata?: Record<string, any>;
}
```

**Returns:**

```typescript
{
  variantKey: string | null;
  assignment: Assignment | null;
  loading: boolean;
  error: Error | null;
}
```

**Example:**

```tsx
function ProductPage() {
  const { variantKey, loading } = useAssignment('pricing-test', {
    autoTrackExposure: true,
  });

  if (loading) return <Spinner />;

  return (
    <div>
      {variantKey === 'premium' ? (
        <PremiumPricing />
      ) : (
        <StandardPricing />
      )}
    </div>
  );
}
```

#### useTrackMetric

Track custom metrics.

```tsx
const trackMetric = useTrackMetric();

// Track conversion
await trackMetric('purchase', 1);

// Track with metadata
await trackMetric('revenue', 99.99, { currency: 'USD' });
```

**Example:**

```tsx
function CheckoutForm() {
  const trackMetric = useTrackMetric();

  const handleSubmit = async () => {
    // ... process checkout
    await trackMetric('purchase', 1, {
      total: 99.99,
      items: 3,
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Components

#### ExperimentGate

Conditionally render based on experiment variant.

```tsx
<ExperimentGate
  experiment="exp-1"
  variant="treatment"
  fallback={<OldFeature />}
  autoTrackExposure={true}
>
  <NewFeature />
</ExperimentGate>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `experiment` | string | Experiment key |
| `variant` | string \| string[] | Variant(s) to match |
| `children` | ReactNode | Content to render on match |
| `fallback` | ReactNode | Content to render on no match |
| `autoTrackExposure` | boolean | Auto-track exposure (default: true) |

**Examples:**

```tsx
// Single variant
<ExperimentGate experiment="new-ui" variant="treatment">
  <NewUI />
</ExperimentGate>

// Multiple variants
<ExperimentGate
  experiment="button-test"
  variant={['red', 'green', 'blue']}
  fallback={<DefaultButton />}
>
  <ColoredButton />
</ExperimentGate>

// With fallback
<ExperimentGate
  experiment="premium-feature"
  variant="enabled"
  fallback={<UpgradePrompt />}
>
  <PremiumFeature />
</ExperimentGate>
```

#### FeatureFlag

Simple feature flag component.

```tsx
<FeatureFlag
  flag="new-checkout"
  fallback={<OldCheckout />}
  autoTrackExposure={true}
>
  <NewCheckout />
</FeatureFlag>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `flag` | string | Feature flag key |
| `children` | ReactNode | Content when enabled |
| `fallback` | ReactNode | Content when disabled |
| `autoTrackExposure` | boolean | Auto-track exposure (default: true) |

The flag is considered "enabled" if variant is `enabled`, `on`, or `true`.

**Example:**

```tsx
function App() {
  return (
    <div>
      <FeatureFlag flag="dark-mode" fallback={<LightTheme />}>
        <DarkTheme />
      </FeatureFlag>

      <FeatureFlag flag="beta-features">
        <BetaFeatures />
      </FeatureFlag>
    </div>
  );
}
```

## TypeScript Usage

The SDK is written in TypeScript with full type definitions:

```tsx
import {
  ExperimentProvider,
  useAssignment,
  Assignment,
  UseAssignmentResult,
} from '@experimeh/react';

// Type-safe hook usage
const MyComponent: React.FC = () => {
  const result: UseAssignmentResult = useAssignment('exp-1');

  return <div>{result.variantKey}</div>;
};

// Type-safe assignment handling
const handleAssignment = (assignment: Assignment) => {
  console.log(assignment.variantKey);
  console.log(assignment.metadata);
};
```

## Examples

### Basic A/B Test

```tsx
import { ExperimentProvider, useAssignment } from '@experimeh/react';

function App() {
  return (
    <ExperimentProvider
      apiUrl="https://api.example.com"
      apiKey="key"
      userId="user-123"
    >
      <HomePage />
    </ExperimentProvider>
  );
}

function HomePage() {
  const { variantKey, loading } = useAssignment('homepage-hero', {
    autoTrackExposure: true,
  });

  if (loading) return <Spinner />;

  return (
    <div>
      {variantKey === 'treatment' ? (
        <NewHero />
      ) : (
        <OldHero />
      )}
    </div>
  );
}
```

### Multi-Variant Test

```tsx
function ButtonTest() {
  const { variantKey } = useAssignment('button-color', {
    autoTrackExposure: true,
  });

  const buttonColor = {
    control: 'blue',
    red: 'red',
    green: 'green',
    yellow: 'yellow',
  }[variantKey || 'control'];

  return <Button color={buttonColor}>Click me</Button>;
}
```

### Feature Flags

```tsx
import { FeatureFlag } from '@experimeh/react';

function App() {
  return (
    <div>
      {/* Simple feature flag */}
      <FeatureFlag flag="new-feature">
        <NewFeature />
      </FeatureFlag>

      {/* With fallback */}
      <FeatureFlag flag="premium-ui" fallback={<StandardUI />}>
        <PremiumUI />
      </FeatureFlag>

      {/* Multiple flags */}
      <FeatureFlag flag="dark-mode">
        <FeatureFlag flag="compact-layout">
          <DarkCompactLayout />
        </FeatureFlag>
      </FeatureFlag>
    </div>
  );
}
```

### Experiment Gates

```tsx
import { ExperimentGate } from '@experimeh/react';

function PricingPage() {
  return (
    <div>
      <ExperimentGate
        experiment="pricing-test"
        variant={['premium', 'deluxe']}
        fallback={<StandardPricing />}
      >
        <PremiumPricing />
      </ExperimentGate>
    </div>
  );
}
```

### Metric Tracking

```tsx
import { useTrackMetric } from '@experimeh/react';

function CheckoutPage() {
  const trackMetric = useTrackMetric();

  const handlePurchase = async (amount: number) => {
    // Process purchase...

    // Track conversion
    await trackMetric('purchase', 1);

    // Track revenue
    await trackMetric('revenue', amount, {
      currency: 'USD',
      timestamp: Date.now(),
    });
  };

  return <CheckoutForm onSubmit={handlePurchase} />;
}
```

### Error Handling

```tsx
function MyComponent() {
  const { assignment, loading, error } = useExperiment('exp-1');

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    console.error('Failed to load experiment:', error);
    // Fallback to control
    return <ControlVariant />;
  }

  return assignment.variantKey === 'treatment' ? (
    <TreatmentVariant />
  ) : (
    <ControlVariant />
  );
}
```

### SSR (Next.js)

```tsx
// pages/_app.tsx
import { ExperimentProvider } from '@experimeh/react';

function MyApp({ Component, pageProps }) {
  // Get userId from auth context or cookies
  const userId = useAuth().userId;

  return (
    <ExperimentProvider
      apiUrl={process.env.NEXT_PUBLIC_API_URL}
      apiKey={process.env.NEXT_PUBLIC_API_KEY}
      userId={userId}
    >
      <Component {...pageProps} />
    </ExperimentProvider>
  );
}

// pages/index.tsx
import { useAssignment } from '@experimeh/react';

function HomePage() {
  const { variantKey } = useAssignment('homepage-test', {
    autoTrackExposure: true,
  });

  // Works with SSR!
  return <div>Variant: {variantKey}</div>;
}
```

### Testing

```tsx
import { render, screen } from '@testing-library/react';
import { ExperimentProvider } from '@experimeh/react';

// Mock provider for tests
function MockExperimentProvider({ children }) {
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
    <MockExperimentProvider>
      <MyComponent />
    </MockExperimentProvider>
  );

  await screen.findByText('Treatment Content');
  expect(screen.getByText('Treatment Content')).toBeInTheDocument();
});
```

## Loading and Error States

All hooks provide built-in loading and error states:

```tsx
function MyComponent() {
  const { variantKey, loading, error } = useAssignment('exp-1');

  // Handle loading
  if (loading) {
    return <Skeleton />;
  }

  // Handle errors (fail closed to control)
  if (error) {
    console.error('Experiment error:', error);
    return <ControlVariant />;
  }

  // Render variant
  return variantKey === 'treatment' ? (
    <TreatmentVariant />
  ) : (
    <ControlVariant />
  );
}
```

## Best Practices

### 1. Always Handle Loading States

```tsx
const { variantKey, loading } = useAssignment('exp-1');

if (loading) return <Spinner />;
```

### 2. Fail Closed on Errors

```tsx
const { variantKey, error } = useAssignment('exp-1');

// Default to control on error
if (error) return <ControlVariant />;
```

### 3. Use Auto-Tracking

```tsx
// Let the SDK track exposures automatically
const { variantKey } = useAssignment('exp-1', {
  autoTrackExposure: true,
});
```

### 4. Memoize Expensive Operations

```tsx
const { variantKey } = useAssignment('exp-1');

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(variantKey);
}, [variantKey]);
```

### 5. Use Feature Flags for Simple Gates

```tsx
// For simple on/off features
<FeatureFlag flag="new-feature">
  <NewFeature />
</FeatureFlag>

// For A/B tests with variants
<ExperimentGate experiment="button-test" variant="treatment">
  <TreatmentButton />
</ExperimentGate>
```

## React Version Support

- React 16.8+ (hooks required)
- React 17.x (full support)
- React 18.x (concurrent mode compatible)

## Browser Support

Same as @experimeh/browser:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT

## Related Packages

- [@experimeh/browser](../browser-js) - Core browser JavaScript SDK
- [@experimeh/node](../node) - Node.js SDK (coming soon)

## Support

- GitHub Issues: https://github.com/experimeh/experimeh/issues
- Documentation: https://docs.experimeh.com
- Email: support@experimeh.com
