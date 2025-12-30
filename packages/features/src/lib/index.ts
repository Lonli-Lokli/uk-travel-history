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
export { FEATURE_KEYS, TIERS, type FeatureFlagKey, type TierId } from './shapes';

// Re-export for convenience
import { DEFAULT_FEATURE_POLICIES } from './features';
import { FEATURE_KEYS, type FeatureFlagKey } from './shapes';

// Backward compatibility: DEFAULT_FEATURE_STATES for status page
// Maps feature keys to their default enabled state
export const DEFAULT_FEATURE_STATES: Record<FeatureFlagKey, boolean> =
  Object.values(FEATURE_KEYS).reduce((acc, key) => {
    acc[key] = DEFAULT_FEATURE_POLICIES[key].enabled;
    return acc;
  }, {} as Record<FeatureFlagKey, boolean>);

// NOTE: Server-only exports (api-guards, server-validation) moved to './server'
// Import from '@uth/features/server' for server-side code
// This prevents accidental imports in client components
