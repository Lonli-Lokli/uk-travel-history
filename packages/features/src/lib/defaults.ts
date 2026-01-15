import { TIERS } from '@uth/domain';
import { FEATURE_KEYS, FeatureFlagKey, FeaturePolicy } from './shapes';

/**
 * Default feature policies (used as fallback if configuration unavailable)
 * Conservative defaults: features are enabled but require appropriate tier
 *
 * Tier hierarchy:
 * - ANONYMOUS: No authentication required (most restrictive features)
 * - FREE: Authenticated users with free tier (more features)
 * - PREMIUM: Authenticated users with paid subscription (all features)
 */
export const DEFAULT_FEATURE_POLICIES: Record<FeatureFlagKey, FeaturePolicy> = {
  // Master switches (ANONYMOUS - can be checked without auth)
  [FEATURE_KEYS.MONETIZATION]: {
    enabled: false,
    minTier: TIERS.ANONYMOUS,
  },
  [FEATURE_KEYS.AUTH]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },
  [FEATURE_KEYS.PAYMENTS]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },

  // Premium features (require PREMIUM tier)
  [FEATURE_KEYS.EXCEL_EXPORT]: {
    enabled: true,
    minTier: TIERS.FREE,
  },
  [FEATURE_KEYS.EXCEL_IMPORT]: {
    enabled: true,
    minTier: TIERS.FREE,
  },
  [FEATURE_KEYS.PDF_IMPORT]: {
    enabled: true, // Disabled by default, but configured as premium feature
    minTier: TIERS.PREMIUM, // Premium tier - PDF import requires active subscription
  },
  [FEATURE_KEYS.CLIPBOARD_IMPORT]: {
    enabled: true,
    minTier: TIERS.ANONYMOUS,
  },

  // UI features (ANONYMOUS - available to all)
  [FEATURE_KEYS.RISK_CHART]: {
    enabled: true,
    minTier: TIERS.PREMIUM,
  },

  // Multi-goal tracking (FREE tier can have 1 goal, PREMIUM unlimited)
  [FEATURE_KEYS.MULTI_GOAL_TRACKING]: {
    enabled: true,
    minTier: TIERS.FREE,
  },
};
