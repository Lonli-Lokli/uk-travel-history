'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode, type MouseEvent } from 'react';
import type { FeatureFlagKey } from '@uth/features';
import { Button } from '@uth/ui';
import { useFeatureGate } from './feature-gate-context';

export interface FeatureButtonProps {
  /**
   * Feature ID to check access for
   */
  feature: FeatureFlagKey;

  /**
   * Children to render (button content)
   */
  children: ReactNode;

  /**
   * Click handler for when user has access
   */
  onClick?: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Button variant
   */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';

  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';

  /**
   * Whether the button is disabled (independent of feature access)
   */
  disabled?: boolean;
}

/**
 * FeatureButton Component
 *
 * A specialized button that automatically handles premium feature gating.
 * Shows a disabled state with premium badge overlay when access is denied.
 *
 * @example
 * ```tsx
 * <FeatureButton
 *   feature={FEATURE_KEYS.EXCEL_EXPORT}
 *   onClick={handleExport}
 *   variant="default"
 * >
 *   <UIIcon iconName="export" />
 *   Export Data
 * </FeatureButton>
 * ```
 */
const FeatureButtonComponent = ({
  feature,
  children,
  onClick,
  className = '',
  variant = 'default',
  size = 'default',
  disabled = false,
}: FeatureButtonProps) => {
  const { hasAccess, isLoading, handleUpgrade } = useFeatureGate(feature);

  // If loading, show disabled state
  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={`opacity-50 ${className}`}
      >
        {children}
      </Button>
    );
  }

  // If user has access, render normally
  if (hasAccess) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
    );
  }

  // No access - show disabled state with premium badge overlay
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpgrade();
  };

  return (
    <div className="relative group inline-block">
      <Button
        variant={variant}
        size={size}
        disabled
        className={`blur-[1.5px] select-none pointer-events-none opacity-40 grayscale ${className}`}
        aria-hidden="true"
      >
        {children}
      </Button>
      <div
        className="absolute top-2 right-2 z-10"
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
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer transform group-hover:scale-110 transition-transform border border-white/30">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-bold tracking-wide">Premium</span>
          </div>
        </div>
      </div>
      <div
        className="absolute inset-0 cursor-pointer hover:bg-slate-900/5 transition-colors rounded"
        onClick={handleClick}
      />
    </div>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureButton = observer(FeatureButtonComponent);
