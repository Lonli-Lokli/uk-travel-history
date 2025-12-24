'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode, type MouseEvent } from 'react';
import type { FeatureId } from '@uth/features';
import { useFeatureGate } from './feature-gate-context';

export interface FeatureChartProps {
  /**
   * Feature ID to check access for
   */
  feature: FeatureId;

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
 * <FeatureChart feature={FEATURES.ADVANCED_ANALYTICS}>
 *   <RiskAreaChart />
 * </FeatureChart>
 * ```
 */
const FeatureChartComponent = ({ feature, children }: FeatureChartProps) => {
  const { hasAccess, isLoading, handleUpgrade } = useFeatureGate(feature);

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

  // No access - show blurred content with premium badge
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpgrade();
  };

  return (
    <div className="relative group">
      <div
        className="blur-[3px] select-none pointer-events-none grayscale"
        aria-hidden="true"
      >
        {children}
      </div>
      <div
        className="absolute inset-0 cursor-pointer flex items-center justify-center bg-gradient-to-br from-slate-900/10 via-transparent to-slate-900/10 hover:from-slate-900/20 hover:to-slate-900/20 transition-all"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e as unknown as MouseEvent);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upgrade to access this feature"
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full shadow-xl backdrop-blur-md border border-white/20 transform group-hover:scale-105 transition-transform">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-semibold tracking-wide">
              Premium Feature
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureChart = observer(FeatureChartComponent);
