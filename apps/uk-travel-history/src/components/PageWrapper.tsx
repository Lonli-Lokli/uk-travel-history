import { ReactNode } from 'react';
import { cn } from '@uth/utils';

interface PageWrapperProps {
  /**
   * The content to be rendered inside the page
   */
  children: ReactNode;
  /**
   * Optional className for the main container
   */
  className?: string;
  /**
   * Variant for different page styles
   * - default: Standard page with white background card
   * - plain: Plain background without card wrapper
   * - gradient: Gradient background (used for landing page)
   */
  variant?: 'default' | 'plain' | 'gradient';
  /**
   * Maximum width of the content container
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
}

/**
 * Common page wrapper component that provides consistent layout across all pages.
 * Handles main container, background styling, and content spacing.
 */
export function PageWrapper({
  children,
  className,
  variant = 'default',
  maxWidth = '4xl',
}: PageWrapperProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
  };

  const backgroundClasses = {
    default: 'bg-slate-50',
    plain: 'bg-slate-50',
    gradient: 'bg-gradient-to-b from-slate-50 to-slate-100',
  };

  return (
    <div className={cn('min-h-screen', backgroundClasses[variant])}>
      <main
        className={cn(
          maxWidthClasses[maxWidth],
          'mx-auto px-4 py-8 sm:py-12',
          className,
        )}
      >
        {variant === 'default' ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
            {children}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

PageWrapper.displayName = 'PageWrapper';
