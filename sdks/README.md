# Experimeh SDKs

Official SDKs for Experimeh feature flag experimentation platform.

## Available SDKs

### [@experimeh/browser](./browser-js)

Lightweight browser JavaScript SDK for client-side experimentation.

- **Size**: < 10KB gzipped
- **Features**: LocalStorage caching, automatic retry, TypeScript types
- **Formats**: UMD, ESM, CJS
- **Installation**: `npm install @experimeh/browser`

[Documentation](./browser-js/README.md) | [Examples](./browser-js/examples)

### [@experimeh/react](./react)

React SDK with hooks and components for experimentation.

- **React Version**: 16.8+ (hooks)
- **Features**: Context API, auto-tracking, SSR support
- **TypeScript**: Full type definitions
- **Installation**: `npm install @experimeh/react @experimeh/browser`

[Documentation](./react/README.md) | [Examples](./react/examples)

## Quick Start

### Browser JavaScript SDK

```javascript
import { ExperimentClient } from '@experimeh/browser';

const client = new ExperimentClient({
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
});

// Get assignment
const assignment = await client.getAssignment('exp-1', 'user-123');

// Track exposure
await client.trackExposure('exp-1', 'user-123', assignment.variantKey);

// Use variant
if (assignment.variantKey === 'treatment') {
  showNewFeature();
}
```

### React SDK

```tsx
import { ExperimentProvider, useAssignment } from '@experimeh/react';

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

function MyComponent() {
  const { variantKey } = useAssignment('exp-1', {
    autoTrackExposure: true,
  });

  return variantKey === 'treatment' ? (
    <NewFeature />
  ) : (
    <OldFeature />
  );
}
```

## Features

### Core Features (All SDKs)

- **Type Safety**: Full TypeScript support
- **Caching**: LocalStorage-based caching with configurable TTL
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error types and handling
- **Lightweight**: Minimal bundle size impact

### React-Specific Features

- **Hooks**: `useExperiment`, `useAssignment`, `useTrackMetric`
- **Components**: `ExperimentGate`, `FeatureFlag`
- **Auto-Tracking**: Automatic exposure tracking
- **SSR Support**: Works with Next.js and other SSR frameworks
- **Loading States**: Built-in loading and error handling

## Development

Each SDK has its own development workflow:

```bash
# Browser JS SDK
cd browser-js
npm install
npm run build
npm test

# React SDK
cd react
npm install
npm run build
npm test
```

## Testing

All SDKs include comprehensive test suites:

- Unit tests with Jest
- 80%+ code coverage
- Integration tests
- TypeScript type checking

## Documentation

- [Browser JS SDK Documentation](./browser-js/README.md)
- [React SDK Documentation](./react/README.md)
- [API Reference](https://docs.experimeh.com)

## Examples

- [Browser JS Examples](./browser-js/examples)
- [React Examples](./react/examples)

## Coming Soon

- **@experimeh/node**: Node.js SDK for server-side experimentation
- **@experimeh/vue**: Vue.js SDK
- **@experimeh/angular**: Angular SDK
- **@experimeh/react-native**: React Native SDK

## Support

- GitHub Issues: https://github.com/experimeh/experimeh/issues
- Documentation: https://docs.experimeh.com
- Email: support@experimeh.com

## License

All SDKs are licensed under MIT.
