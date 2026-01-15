import { TierId } from '@uth/domain';

/**
 * Feature flag identifiers (typed constants)
 * These match the keys in Vercel Edge Config
 */
export const FEATURE_KEYS = {
  // Master switches
  MONETIZATION: 'monetization',
  AUTH: 'auth',
  PAYMENTS: 'payments',

  // Premium features
  EXCEL_EXPORT: 'excel_export',
  EXCEL_IMPORT: 'excel_import',
  PDF_IMPORT: 'pdf_import',
  CLIPBOARD_IMPORT: 'clipboard_import',

  // UI features
  RISK_CHART: 'risk_chart',

  // Multi-goal tracking (Issue #XXX)
  MULTI_GOAL_TRACKING: 'multi_goal_tracking',
} as const;

export type FeatureFlagKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Feature policy configuration for tier-based access control
 * This allows changing feature tier requirements without code deployment
 *
 * IMPORTANT: This is the source of truth for feature tier configuration
 * - Stored in Supabase feature_policies table
 * - Cached with Next.js unstable_cache until midnight
 * - Prevents client-side bypass with server-side enforcement
 * - Supports three access levels: anonymous, free, premium
 */
export interface FeaturePolicy {
  /** Global kill switch - if false, feature is disabled for everyone */
  enabled: boolean;
  /** Minimum tier required to access this feature */
  minTier: TierId;
  /** Rollout percentage (0-100) for gradual feature rollout */
  rolloutPercentage?: number;
  /** Explicit allowlist of user IDs (bypasses tier check) */
  allowlist?: string[];
  /** Explicit denylist of user IDs (blocks access regardless of tier) */
  denylist?: string[];
  /** Explicit list of beta users who get access regardless of tier */
  betaUsers?: string[];
}
