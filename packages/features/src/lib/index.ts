// Unified feature flag system (Vercel Edge Config only)
export {
  isFeatureEnabled,
  FEATURE_KEYS,
  DEFAULT_FEATURE_STATES,
  getAllFeatureFlags,
  isFeatureEnabledClient,
  setCachedFlags,
  type FeatureFlagKey,
} from './edgeConfigFlags';

// Feature tier system (client-safe)
export * from './features';

// NOTE: Server-only exports (api-guards, server-validation) moved to './server'
// Import from '@uth/features/server' for server-side code
// This prevents accidental imports in client components
