// New unified feature flag system (Vercel Edge Config only)
export * from './edgeConfigFlags';

// Feature tier system
export * from './features';
export * from './server-validation';

// DEPRECATED: Old dual-system feature flags (will be removed in next major version)
// Use edgeConfigFlags instead
// Note: Explicitly export to avoid name conflicts with new system
export {
  FEATURE_FLAGS,
  isFeatureEnabled as isFeatureEnabledLegacy,
  isMonetizationActive,
  getEnabledFlags,
  getAllFlagStates,
} from './featureFlags';
export type { FeatureFlagKey as FeatureFlagKeyLegacy } from './featureFlags';

export {
  isFeatureEnabledOnVercel,
  isEnabledForUser,
  getAllFeatureFlags as getAllFeatureFlagsLegacy,
  isEdgeConfigAvailable as isEdgeConfigAvailableLegacy,
} from './vercel-features';
export type { EdgeConfigFlags as EdgeConfigFlagsLegacy } from './vercel-features';