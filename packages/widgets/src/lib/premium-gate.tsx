'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode } from 'react';
import { FeatureGate, type RenderMode } from './feature-gate';
import { FEATURES } from '@uth/features';
import { useFeatureGateContext } from './feature-gate-context';

/**
 * Premium-only features that require paid subscription
 */
const PREMIUM_FEATURES = [
  FEATURES.EXCEL_EXPORT,
  FEATURES.PDF_EXPORT,
  FEATURES.EMPLOYER_LETTERS,
  FEATURES.CLOUD_SYNC,
  FEATURES.ADVANCED_ANALYTICS,
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
      feature={FEATURES.EXCEL_EXPORT}
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
