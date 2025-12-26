/**
 * Server-only exports for feature management
 * DO NOT import this file from client components
 */

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
