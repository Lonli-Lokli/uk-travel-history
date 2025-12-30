'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode, type MouseEvent } from 'react';
import type { FeatureFlagKey } from '@uth/features';
import { useFeatureGate } from './feature-gate-context';

export interface FeatureChartProps {
  /**
   * Feature ID to check access for
   */
  feature: FeatureFlagKey;

  /**
   * Children to render (chart content)
   */
  children: ReactNode;
}

/**
 * FeatureChart Component
 *
 * A specialized wrapper for charts and analytics that automatically handles premium feature gating.
 * Shows a blurred state with centered premium badge when access is denied.
 *
 * @example
 * ```tsx
 * <FeatureChart feature={FEATURE_KEYS.RISK_CHART}>
 *   <RiskAreaChart />
 * </FeatureChart>
 * ```
 */
const FeatureChartComponent = ({ feature, children }: FeatureChartProps) => {
  const { hasAccess, isLoading, requiresSignUp, requiresUpgrade, handleUpgrade } = useFeatureGate(feature);

  // If loading, show blurred content
  if (isLoading) {
    return (
      <div className="relative opacity-50 pointer-events-none">{children}</div>
    );
  }

  // If user has access, render normally
  if (hasAccess) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  // No access - show blurred content with appropriate badge
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpgrade();
  };

  return (
    <div className="relative">
      {/* Content layer - maintains layout */}
      <div className="relative">
        {children}
      </div>

      {/* Overlay positioned absolutely on top */}
      <div
        className="absolute inset-0 cursor-pointer flex items-center justify-center transition-all"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e as unknown as MouseEvent);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={requiresSignUp ? "Sign up to access this feature" : "Upgrade to access this feature"}
      >
        {/* Badge - matching FeatureButton style */}
        {requiresSignUp ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border-2 border-blue-300 bg-blue-50 px-3 py-2 rounded-lg shadow-lg">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>Sign up</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 border-2 border-amber-300 bg-amber-50 px-3 py-2 rounded-lg shadow-lg">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <span>PRO</span>
          </span>
        )}
      </div>
    </div>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureChart = observer(FeatureChartComponent);
