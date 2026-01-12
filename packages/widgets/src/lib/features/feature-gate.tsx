'use client';

import { type ReactNode, type MouseEvent } from 'react';

export type RenderMode = 'hide' | 'disable' | 'blur' | 'paywall';
export type GateReason = 'login' | 'upgrade';

export interface FeatureGateProps {
  /**
   * Whether user has access to this feature
   * Consumer is responsible for computing this value
   */
  hasAccess: boolean;

  /**
   * Whether access check is still loading
   */
  isLoading?: boolean;

  /**
   * Render mode when access is denied
   * - hide: Don't render children (return null)
   * - disable: Render but disable interaction (blur + click handler)
   * - blur: Render with CSS blur effect
   * - paywall: Show upgrade modal on click
   */
  mode?: RenderMode;

  /**
   * Why access is denied - determines badge text
   * - login: Show "Sign up to access" badge
   * - upgrade: Show "Premium Feature" badge
   */
  gateReason?: GateReason;

  /**
   * Custom fallback component when access is denied
   * Only used when mode is 'hide'
   */
  fallback?: ReactNode;

  /**
   * Children to render when access is granted
   */
  children: ReactNode;

  /**
   * Callback when user clicks on gated content
   * Consumer handles the action (login redirect, upgrade modal, etc.)
   */
  onGatedClick?: () => void;
}

/**
 * FeatureGate Component
 *
 * Presentation-only component for conditionally rendering content based on access.
 * Does NOT contain business logic - consumer computes hasAccess and handles onGatedClick.
 *
 * @example
 * ```tsx
 * // Using with useFeatureGate hook
 * const { hasAccess, isLoading, requiresUpgrade, handleUpgrade } = useFeatureGate(FEATURE_KEYS.EXCEL_EXPORT);
 *
 * <FeatureGate
 *   hasAccess={hasAccess}
 *   isLoading={isLoading}
 *   mode="blur"
 *   gateReason={requiresUpgrade ? 'upgrade' : 'login'}
 *   onGatedClick={handleUpgrade}
 * >
 *   <ExportButton />
 * </FeatureGate>
 *
 * // Simple hide mode
 * <FeatureGate hasAccess={isPremium} mode="hide">
 *   <PremiumFeature />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  hasAccess,
  isLoading = false,
  mode = 'hide',
  gateReason = 'upgrade',
  fallback,
  children,
  onGatedClick,
}: FeatureGateProps) {
  // Show loading state while checking subscription
  if (isLoading) {
    if (mode === 'hide') {
      return fallback ? <>{fallback}</> : null;
    }
    // For other modes, show blurred content while loading
    return (
      <div className="relative opacity-50 pointer-events-none">{children}</div>
    );
  }

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - handle based on mode
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onGatedClick?.();
  };

  const isLoginGate = gateReason === 'login';

  switch (mode) {
    case 'hide':
      return fallback ? <>{fallback}</> : null;

    case 'blur':
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
            aria-label={
              isLoginGate
                ? 'Sign up to access this feature'
                : 'Upgrade to access this feature'
            }
          >
            {isLoginGate ? (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-full shadow-xl backdrop-blur-md border border-white/20 transform group-hover:scale-105 transition-transform">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide">
                    Sign up to access
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full shadow-xl backdrop-blur-md border border-white/20 transform group-hover:scale-105 transition-transform">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
            )}
          </div>
        </div>
      );

    case 'disable':
      return (
        <div className="relative group">
          <div
            className="blur-[1.5px] select-none pointer-events-none opacity-40 grayscale"
            aria-hidden="true"
          >
            {children}
          </div>
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
            aria-label={
              isLoginGate
                ? 'Sign up to access this feature'
                : 'Upgrade to access this feature'
            }
          >
            {isLoginGate ? (
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer transform group-hover:scale-110 transition-transform border border-white/30">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-bold tracking-wide">
                    Sign up
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg cursor-pointer transform group-hover:scale-110 transition-transform border border-white/30">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs font-bold tracking-wide">
                    Premium
                  </span>
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute inset-0 cursor-pointer hover:bg-slate-900/5 transition-colors rounded"
            onClick={handleClick}
          />
        </div>
      );

    case 'paywall':
      return (
        <div
          className="cursor-pointer"
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
          {children}
        </div>
      );

    default:
      return null;
  }
}
