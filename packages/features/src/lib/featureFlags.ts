// DEPRECATED: This module is deprecated in favor of edgeConfigFlags
// It's kept for backward compatibility but will be removed in the next major version
// Please migrate to:
// - import { FEATURE_KEYS, isFeatureEnabledClient } from '@uth/features'
// - Use FeatureFlagsProvider and useFeatureFlags hook for client components

// Re-export from compat layer for backward compatibility
export {
  FEATURE_FLAGS,
  isFeatureEnabled,
  isMonetizationActive,
  getEnabledFlags,
  getAllFlagStates,
  type FeatureFlagKey,
} from './featureFlagsCompat';
