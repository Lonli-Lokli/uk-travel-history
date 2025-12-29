// Tier identifiers
export const TIERS = {
  ANONYMOUS: 'anonymous', // No authentication required
  FREE: 'free', // Authenticated, free tier
  PREMIUM: 'premium', // Authenticated, paid subscription
} as const;

export type TierId = (typeof TIERS)[keyof typeof TIERS];

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
} as const;

export type FeatureFlagKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

