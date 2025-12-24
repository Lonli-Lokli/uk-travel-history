'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode } from 'react';
import type { FeatureId } from '@uth/features';
import { DropdownMenuItem } from '@uth/ui';
import { useFeatureGate } from './feature-gate-context';

export interface FeatureDropdownItemProps {
  /**
   * Feature ID to check access for
   */
  feature: FeatureId;

  /**
   * Children to render when access is granted
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
   * Whether the item is disabled
   */
  disabled?: boolean;
}

/**
 * FeatureDropdownItem Component
 *
 * A specialized dropdown menu item that automatically handles premium feature gating.
 * Shows an inline "Premium" badge when access is denied and handles upgrade flow.
 *
 * @example
 * ```tsx
 * <FeatureDropdownItem
 *   feature={FEATURES.EXCEL_EXPORT}
 *   onClick={() => handleExport('full')}
 * >
 *   <UIIcon iconName="xlsx" />
 *   Full backup
 * </FeatureDropdownItem>
 * ```
 */
const FeatureDropdownItemComponent = ({
  feature,
  children,
  onClick,
  className = '',
  disabled = false,
}: FeatureDropdownItemProps) => {
  const { hasAccess, isLoading, handleUpgrade } = useFeatureGate(feature);

  // If loading, show disabled state
  if (isLoading) {
    return (
      <DropdownMenuItem disabled className={`opacity-50 ${className}`}>
        {children}
      </DropdownMenuItem>
    );
  }

  // If user has access, render normally
  if (hasAccess) {
    return (
      <DropdownMenuItem
        onClick={onClick}
        className={className}
        disabled={disabled}
      >
        {children}
      </DropdownMenuItem>
    );
  }

  // No access - show premium badge
  return (
    <DropdownMenuItem
      disabled
      className={`cursor-pointer opacity-60 ${className}`}
      onClick={handleUpgrade}
    >
      {children}
      <span className="ml-auto pl-2 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
        Premium
      </span>
    </DropdownMenuItem>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureDropdownItem = observer(FeatureDropdownItemComponent);
