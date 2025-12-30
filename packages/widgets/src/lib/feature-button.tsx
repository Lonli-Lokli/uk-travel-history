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
  const { hasAccess, isLoading, requiresSignUp, requiresUpgrade, handleUpgrade } = useFeatureGate(feature);

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

  // No access - render button with badge inline
  const handleClick = () => {
    handleUpgrade();
  };

  // Render badge inline similar to FeatureDropdownItem
  const badgeContent = requiresSignUp ? (
    <span className="ml-2 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 border border-blue-300 bg-blue-50 px-2 py-0.5 rounded">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
      Sign up
    </span>
  ) : requiresUpgrade ? (
    <span className="ml-2 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
      </svg>
      PRO
    </span>
  ) : null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={`w-full ${className}`}
    >
      <span className="flex items-center justify-between w-full">
        <span className="flex items-center gap-2">
          {children}
        </span>
        {badgeContent}
      </span>
    </Button>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureButton = observer(FeatureButtonComponent);
