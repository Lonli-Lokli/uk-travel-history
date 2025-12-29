'use client';

import { observer } from 'mobx-react-lite';
import { type ReactNode, useState, useEffect } from 'react';
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

  // No access - show premium badge and trigger upgrade
  return (
    <DropdownMenuItem
      className={`cursor-pointer justify-between ${className}`}
      onClick={handleUpgrade}
    >
      <span className="flex items-center gap-2 opacity-60">
        {children}
      </span>
      <span className="ml-2 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
        </svg>
        PRO
      </span>
    </DropdownMenuItem>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureDropdownItem = observer(FeatureDropdownItemComponent);
