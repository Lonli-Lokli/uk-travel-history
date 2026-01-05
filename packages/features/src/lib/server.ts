/**
 * Server-only exports for feature management
 * DO NOT import this file from client components
 */

// Access Context - Server-authoritative access context loader (NEW)
// This is the primary way to load user access context for hydration
export { loadAccessContext } from './access-context';

// API Guards - Server-side feature access enforcement (NEW)
// This is the comprehensive implementation for server-side feature enforcement
export * from './api-guards';

// Legacy server validation (DEPRECATED - use api-guards instead)
// Kept for backward compatibility but will be removed in future
// Export with specific names to avoid conflicts
export {
  validateFeatureAccess as legacyValidateFeatureAccess,
  isPremiumFeature,
  getAccessibleFeatures,
  type UserTier,
} from './server-validation';

// Re-export feature keys and types for server-side usage
export { FEATURE_KEYS, type FeatureFlagKey } from './shapes';
