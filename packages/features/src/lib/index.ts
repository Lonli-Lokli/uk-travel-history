// Unified feature flag system (Supabase-backed)
export {
  isFeatureEnabled,
  getFeaturePolicy,
  getAllFeaturePolicies,
} from './features';

export { DEFAULT_FEATURE_POLICIES } from './defaults';
// Feature keys and types
export {
  FEATURE_KEYS,
  type FeatureFlagKey,
  type FeaturePolicy,
} from './shapes';

// NOTE: Server-only exports (api-guards, server-validation) moved to './server'
// Import from '@uth/features/server' for server-side code
// This prevents accidental imports in client components
