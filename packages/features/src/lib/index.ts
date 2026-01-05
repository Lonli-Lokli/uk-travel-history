// Unified feature flag system (Supabase-backed)
export {
  isFeatureEnabled,
  DEFAULT_FEATURE_POLICIES,
  type FeaturePolicy,
  type SupabasePolicies,
  getFeaturePolicy,
  getAllFeaturePolicies,
  isSupabaseFeaturePoliciesAvailable,
} from './features';

// Feature keys and types
export { FEATURE_KEYS, type FeatureFlagKey } from './shapes';

// NOTE: Server-only exports (api-guards, server-validation) moved to './server'
// Import from '@uth/features/server' for server-side code
// This prevents accidental imports in client components
