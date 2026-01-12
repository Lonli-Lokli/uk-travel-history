'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode } from 'react';
import { FeatureGate, type RenderMode } from './feature-gate';
import { FEATURE_KEYS } from '@uth/features';
import { useFeatureGate } from './feature-gate-context';

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
   * If not provided, uses default handleUpgrade from hook
   */
  onUpgradeClick?: () => void;
}

/**
 * PremiumGate Component
 *
 * A simplified wrapper around FeatureGate specifically for premium-only content.
 * Uses EXCEL_EXPORT as the representative premium feature for gating.
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
  const { hasAccess, isLoading, requiresUpgrade, handleUpgrade } =
    useFeatureGate(FEATURE_KEYS.EXCEL_EXPORT);

  return (
    <FeatureGate
      hasAccess={hasAccess}
      isLoading={isLoading}
      mode={mode}
      gateReason={requiresUpgrade ? 'upgrade' : 'login'}
      fallback={fallback}
      onGatedClick={onUpgradeClick ?? handleUpgrade}
    >
      {children}
    </FeatureGate>
  );
};

/**
 * Export as observer to make it reactive to MobX store changes
 */
export const PremiumGate = observer(PremiumGateComponent);
