# @uth/widgets

React components and hooks for cross-cutting concerns (feature flags, providers).

## Purpose

Reusable React widgets that integrate with stores and features system.

## Components

### `FeatureFlagsProvider`

Provides feature flags to child components via React Context.

```typescript
import { FeatureFlagsProvider } from '@uth/widgets';

export default function RootLayout({ children, flags }) {
  return (
    <FeatureFlagsProvider flags={flags}>
      {children}
    </FeatureFlagsProvider>
  );
}
```

### `FeatureGateProvider`

Wraps components with monetization and feature access control.

```typescript
import { FeatureGateProvider } from '@uth/widgets';
import { monetizationStore, authStore, paymentStore } from '@uth/stores';

function MyComponent({ children }) {
  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >
      {children}
    </FeatureGateProvider>
  );
}
```

## Hooks

### `useFeatureFlags()`

Access feature flags in React components.

```typescript
import { useFeatureFlags } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

function MyComponent() {
  const { isFeatureEnabled, flags } = useFeatureFlags();

  if (!isFeatureEnabled(FEATURE_KEYS.EXPORT_PREMIUM)) {
    return <UpgradePrompt />;
  }

  return <PremiumFeature />;
}
```

## Testing

```bash
nx test widgets
```

## Related

- **[`@uth/features`](../features/README.md)** - Feature flag system
- **[`@uth/stores`](../stores/README.md)** - MobX stores
