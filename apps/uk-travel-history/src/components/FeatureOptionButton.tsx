'use client';

import { observer } from 'mobx-react-lite';
import type { FeatureFlagKey } from '@uth/features';
import { UIIcon } from '@uth/ui';
import { cn } from '@uth/utils';
import { useFeatureGate } from '@uth/widgets';

export interface FeatureOptionButtonProps {
  icon: string;
  label: string;
  description: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  feature?: FeatureFlagKey;
}

/**
 * FeatureOptionButton Component
 *
 * A specialized option button for drawers that automatically handles feature gating.
 * Shows inline "Sign up" or "PRO" badges when access is denied.
 *
 * @example
 * ```tsx
 * <FeatureOptionButton
 *   icon="pdf"
 *   label="Import from PDF"
 *   description="Import trips from Home Office SAR document"
 *   onClick={handleImportPdf}
 *   feature={FEATURE_KEYS.PDF_IMPORT}
 * />
 * ```
 */
const FeatureOptionButtonComponent = ({
  icon,
  label,
  description,
  onClick,
  variant = 'secondary',
  feature,
}: FeatureOptionButtonProps) => {
  // If no feature specified, render as regular button
  if (!feature) {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'w-full p-4 rounded-lg border-2 transition-all duration-200',
          'flex items-start gap-4 text-left',
          onClick
            ? 'hover:border-primary hover:bg-primary/5 cursor-pointer'
            : 'opacity-50 cursor-not-allowed',
          variant === 'primary'
            ? 'bg-primary/10 border-primary'
            : 'bg-white border-slate-200',
        )}
        type="button"
      >
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            variant === 'primary' ? 'bg-primary/20' : 'bg-slate-100',
          )}
        >
          <UIIcon
            iconName={icon}
            className={cn(
              'w-6 h-6',
              variant === 'primary' ? 'text-primary' : 'text-slate-600',
            )}
          />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 mb-1">{label}</p>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        {onClick && (
          <UIIcon iconName="chevron-right" className="w-5 h-5 text-slate-400" />
        )}
      </button>
    );
  }

  // Feature-gated button - call hook after early return for non-feature buttons
  const {
    hasAccess,
    isLoading,
    requiresSignUp,
    requiresUpgrade,
    handleUpgrade,
  } = useFeatureGate(feature);

  // Loading state
  if (isLoading) {
    return (
      <button
        disabled
        className={cn(
          'w-full p-4 rounded-lg border-2 transition-all duration-200',
          'flex items-start gap-4 text-left opacity-50 cursor-not-allowed',
          variant === 'primary'
            ? 'bg-primary/10 border-primary'
            : 'bg-white border-slate-200',
        )}
        type="button"
      >
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            variant === 'primary' ? 'bg-primary/20' : 'bg-slate-100',
          )}
        >
          <UIIcon
            iconName={icon}
            className={cn(
              'w-6 h-6',
              variant === 'primary' ? 'text-primary' : 'text-slate-600',
            )}
          />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 mb-1">{label}</p>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </button>
    );
  }

  // Determine badge content
  const badgeContent = requiresSignUp ? (
    <span className="ml-2 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 border border-blue-300 bg-blue-50 px-2 py-0.5 rounded">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
      Sign up
    </span>
  ) : requiresUpgrade ? (
    <span className="ml-2 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
          clipRule="evenodd"
        />
      </svg>
      PRO
    </span>
  ) : null;

  // Handle click based on access
  const handleClick = () => {
    if (hasAccess && onClick) {
      onClick();
    } else {
      handleUpgrade();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full p-4 rounded-lg border-2 transition-all duration-200',
        'flex items-start gap-4 text-left',
        hasAccess
          ? 'hover:border-primary hover:bg-primary/5 cursor-pointer'
          : 'cursor-pointer hover:border-amber-300 hover:bg-amber-50/50',
        variant === 'primary'
          ? 'bg-primary/10 border-primary'
          : 'bg-white border-slate-200',
      )}
      type="button"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
          variant === 'primary' ? 'bg-primary/20' : 'bg-slate-100',
          !hasAccess && 'opacity-60',
        )}
      >
        <UIIcon
          iconName={icon}
          className={cn(
            'w-6 h-6',
            variant === 'primary' ? 'text-primary' : 'text-slate-600',
          )}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p
            className={cn(
              'font-semibold text-slate-900',
              !hasAccess && 'opacity-60',
            )}
          >
            {label}
          </p>
          {badgeContent}
        </div>
        <p className={cn('text-sm text-slate-600', !hasAccess && 'opacity-60')}>
          {description}
        </p>
      </div>
      {hasAccess && onClick && (
        <UIIcon iconName="chevron-right" className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );
};

// Export as observer to make it reactive to MobX changes
export const FeatureOptionButton = observer(FeatureOptionButtonComponent);
