/**
 * Server-only exports for feature management
 * DO NOT import this file from client components
 */

// Access Context - Server-authoritative access context loader (NEW)
// This is the primary way to load user access context for hydration
export { loadDataContext, loadIdentityContext } from './access-context';

// API Guards - Server-side feature access enforcement (NEW)
// This is the comprehensive implementation for server-side feature enforcement
export * from './api-guards';

// Re-export feature keys and types for server-side usage
export { FEATURE_KEYS, type FeatureFlagKey } from './shapes';
