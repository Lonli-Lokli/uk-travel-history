// Feature Registry & Configuration System
// Central source of truth for all application features and tier access

// Feature identifiers
export const FEATURES = {
  // Free tier features
  BASIC_CALCULATION: 'basic_calculation',
  PDF_IMPORT: 'pdf_import',
  CSV_IMPORT: 'csv_import',
  MANUAL_ENTRY: 'manual_entry',

  // Premium tier features
  EXCEL_EXPORT: 'excel_export',
  PDF_EXPORT: 'pdf_export',
  EMPLOYER_LETTERS: 'employer_letters',
  CLOUD_SYNC: 'cloud_sync',
  ADVANCED_ANALYTICS: 'advanced_analytics',
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

// Tier identifiers
export const TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
} as const;

export type TierId = (typeof TIERS)[keyof typeof TIERS];

// Tier configuration (which features are available in each tier)
export const TIER_CONFIG: Record<TierId, FeatureId[]> = {
  [TIERS.FREE]: [
    FEATURES.BASIC_CALCULATION,
    FEATURES.PDF_IMPORT,
    FEATURES.CSV_IMPORT,
    FEATURES.MANUAL_ENTRY,
  ],
  [TIERS.PREMIUM]: Object.values(FEATURES), // All features
};

// Feature metadata for UI display
export interface FeatureMetadata {
  id: FeatureId;
  name: string;
  description: string;
  comingSoon?: boolean;
}

export const FEATURE_METADATA: Record<FeatureId, FeatureMetadata> = {
  [FEATURES.BASIC_CALCULATION]: {
    id: FEATURES.BASIC_CALCULATION,
    name: 'Travel Calculations',
    description: 'Calculate days outside UK, continuous leave, ILR eligibility',
  },
  [FEATURES.PDF_IMPORT]: {
    id: FEATURES.PDF_IMPORT,
    name: 'PDF Import',
    description: 'Import travel history from Home Office SAR PDFs',
  },
  [FEATURES.CSV_IMPORT]: {
    id: FEATURES.CSV_IMPORT,
    name: 'CSV/Excel Import',
    description: 'Import travel data from CSV or Excel files',
  },
  [FEATURES.MANUAL_ENTRY]: {
    id: FEATURES.MANUAL_ENTRY,
    name: 'Manual Entry',
    description: 'Manually add and edit travel records',
  },
  [FEATURES.EXCEL_EXPORT]: {
    id: FEATURES.EXCEL_EXPORT,
    name: 'Excel Export',
    description:
      'Export your travel history to Excel format with all calculations',
  },
  [FEATURES.PDF_EXPORT]: {
    id: FEATURES.PDF_EXPORT,
    name: 'PDF Export',
    description: 'Generate professional PDF reports for visa applications',
    comingSoon: true,
  },
  [FEATURES.EMPLOYER_LETTERS]: {
    id: FEATURES.EMPLOYER_LETTERS,
    name: 'Employer Letters',
    description: 'Generate employer confirmation letters for ILR applications',
    comingSoon: true,
  },
  [FEATURES.CLOUD_SYNC]: {
    id: FEATURES.CLOUD_SYNC,
    name: 'Cloud Sync',
    description: 'Sync your travel data across devices',
    comingSoon: true,
  },
  [FEATURES.ADVANCED_ANALYTICS]: {
    id: FEATURES.ADVANCED_ANALYTICS,
    name: 'Advanced Analytics',
    description:
      'Detailed insights into your travel patterns and ILR readiness',
    comingSoon: true,
  },
};

/**
 * Helper function to get the required tier for a given feature
 * @param featureId - The feature to check
 * @returns The tier ID required to access this feature
 */
export function getRequiredTier(featureId: FeatureId): TierId {
  for (const [tier, features] of Object.entries(TIER_CONFIG)) {
    if (features.includes(featureId)) {
      return tier as TierId;
    }
  }
  return TIERS.PREMIUM; // Default to premium if not found
}
