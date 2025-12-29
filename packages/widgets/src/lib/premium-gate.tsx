'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode } from 'react';
import { FeatureGate, type RenderMode } from './feature-gate';
import { FEATURE_KEYS } from '@uth/features';
import { useFeatureGateContext } from './feature-gate-context';

/**
 * Premium-only features that require paid subscription
 */
const PREMIUM_FEATURES = [
  FEATURE_KEYS.EXCEL_EXPORT,
  FEATURE_KEYS.EXCEL_IMPORT,
  // Future premium features:
  // FEATURE_KEYS.PDF_EXPORT,
  // FEATURE_KEYS.EMPLOYER_LETTERS,
  // FEATURE_KEYS.CLOUD_SYNC,
  // FEATURE_KEYS.ADVANCED_ANALYTICS,
] as const;

export interface PremiumGateProps {
  /**
   * Render mode when access is denied
   * @default 'blur'
   */
  mode?: RenderMode;

  /**
   * Custom fallback component when access is denied
   * Only used when mode is 'hide'
   */
  fallback?: ReactNode;

  /**
   * Children to render when user has premium access
   */
  children: ReactNode;

  /**
   * Optional callback when user clicks on upgrade prompt
   */
  onUpgradeClick?: () => void;
}

/**
 * PremiumGate Component
 *
 * A simplified wrapper around FeatureGate specifically for premium-only content.
 * Uses EXCEL_EXPORT as the representative premium feature for gating.
 *
 * This component automatically handles:
 * - Checking premium access via monetizationStore
 * - Showing upgrade prompts for non-premium users
 * - Integrating with payment flow
 *
 * @example
 * ```tsx
 * // Basic usage - blur content for free users
 * <PremiumGate>
 *   <AdvancedAnalyticsPanel />
 * </PremiumGate>
 *
 * // Hide content completely
 * <PremiumGate mode="hide">
 *   <ExportButton />
 * </PremiumGate>
 *
 * // Show custom upgrade prompt
 * <PremiumGate
 *   mode="hide"
 *   fallback={<UpgradeCard />}
 * >
 *   <PremiumFeature />
 * </PremiumGate>
 * ```
 */
const PremiumGateComponent = ({
  mode = 'blur',
  fallback,
  children,
  onUpgradeClick,
}: PremiumGateProps) => {
  const { monetizationStore, authStore, paymentStore } =
    useFeatureGateContext();

  return (
    <FeatureGate
      feature={FEATURE_KEYS.EXCEL_EXPORT}
      mode={mode}
      fallback={fallback}
      onUpgradeClick={onUpgradeClick}
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >
      {children}
    </FeatureGate>
  );
};

/**
 * Export as observer to make it reactive to MobX store changes
 */
export const PremiumGate = observer(PremiumGateComponent);
