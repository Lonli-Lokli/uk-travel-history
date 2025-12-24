/**
 * FeatureGate Component
 * Controls access to premium features based on user subscription tier
 *
 * Implements RFC-005 with adaptations for the current architecture:
 * - Uses Edge Config feature flags + subscription tier
 * - Integrates with existing PaymentModal
 * - Works with auth-server subscription system
 */

'use client';

import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { cn } from '@uth/utils';
import {
  authStore,
  subscriptionStore,
  uiStore,
  paymentStore,
} from '@uth/stores';
import { FEATURES, getRequiredTier, type FeatureId } from '@uth/features';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

export type FeatureGateMode = 'hide' | 'disable' | 'blur' | 'paywall';

export interface FeatureGateProps {
  /** Feature ID from FEATURES constant */
  feature: FeatureId;
  /** How to render when access is denied */
  mode?: FeatureGateMode;
  /** Children to gate */
  children: React.ReactNode;
  /** Custom fallback when access denied (overrides mode) */
  fallback?: React.ReactNode;
  /** Custom className for wrapper */
  className?: string;
}

/**
 * FeatureGate component - controls access to premium features
 *
 * @example
 * ```tsx
 * import { FeatureGate } from '@uth/ui';
 * import { FEATURES } from '@uth/features';
 *
 * <FeatureGate feature={FEATURES.EXCEL_EXPORT} mode="paywall">
 *   <ExportButton />
 * </FeatureGate>
 * ```
 */
export const FeatureGate = observer(
  ({
    feature,
    mode = 'paywall',
    children,
    fallback,
    className,
  }: FeatureGateProps) => {
    const [showUpgradeDialog, setShowUpgradeDialog] = React.useState(false);

    // Check if user has access to this feature
    const hasAccess = React.useMemo(() => {
      const requiredTier = getRequiredTier(feature);

      // Free features are always accessible
      if (requiredTier === 'free') {
        return true;
      }

      // Premium features require premium subscription
      return subscriptionStore.isPremium;
    }, [feature, subscriptionStore.isPremium]);

    // Handler for when user tries to access a gated feature
    const handleAccessAttempt = React.useCallback(() => {
      // If user is not logged in, show login modal
      if (!authStore.user) {
        uiStore.setLoginModalOpen(true);
        return;
      }

      // If logged in but no premium, show upgrade dialog
      setShowUpgradeDialog(true);
    }, []);

    // Handler for upgrade button click
    const handleUpgrade = React.useCallback(() => {
      setShowUpgradeDialog(false);
      paymentStore.openPaymentModal();
    }, []);

    // If user has access, render children normally
    if (hasAccess) {
      return <>{children}</>;
    }

    // If custom fallback provided, use it
    if (fallback) {
      return <>{fallback}</>;
    }

    // Handle different modes
    switch (mode) {
      case 'hide':
        // Don't render anything
        return null;

      case 'disable':
        // Render children but disabled (wrap in div and make non-interactive)
        return (
          <div
            className={cn('pointer-events-none opacity-50', className)}
            aria-disabled="true"
            role="group"
            aria-label="Premium feature - upgrade required"
          >
            {children}
          </div>
        );

      case 'blur':
        // Render children with blur effect and click handler
        return (
          <div className={cn('relative', className)}>
            <div
              className="blur-sm pointer-events-none select-none"
              aria-hidden="true"
            >
              {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                onClick={handleAccessAttempt}
                variant="default"
                size="sm"
                aria-label="Upgrade to access this feature"
              >
                Upgrade to Premium
              </Button>
            </div>
            <UpgradeDialog
              open={showUpgradeDialog}
              onOpenChange={setShowUpgradeDialog}
              onUpgrade={handleUpgrade}
              feature={feature}
            />
          </div>
        );

      case 'paywall':
      default:
        // Replace children with upgrade prompt
        return (
          <>
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 p-4 border border-dashed rounded-md bg-muted/50',
                className
              )}
            >
              <p className="text-sm text-muted-foreground text-center">
                This feature requires a premium subscription
              </p>
              <Button
                onClick={handleAccessAttempt}
                variant="default"
                size="sm"
                aria-label="Upgrade to access this feature"
              >
                Upgrade to Premium
              </Button>
            </div>
            <UpgradeDialog
              open={showUpgradeDialog}
              onOpenChange={setShowUpgradeDialog}
              onUpgrade={handleUpgrade}
              feature={feature}
            />
          </>
        );
    }
  }
);

FeatureGate.displayName = 'FeatureGate';

// Internal upgrade dialog component
interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
  feature: FeatureId;
}

const UpgradeDialog = observer(
  ({ open, onOpenChange, onUpgrade, feature }: UpgradeDialogProps) => {
    const featureName = getFeatureName(feature);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Premium Feature</DialogTitle>
            <DialogDescription>
              {featureName} is a premium feature. Upgrade to unlock this and
              other advanced features.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onUpgrade}>Upgrade Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

UpgradeDialog.displayName = 'UpgradeDialog';

// Helper to get user-friendly feature name
function getFeatureName(featureId: FeatureId): string {
  switch (featureId) {
    case FEATURES.BASIC_CALCULATION:
      return 'Travel Calculations';
    case FEATURES.PDF_IMPORT:
      return 'PDF Import';
    case FEATURES.CSV_IMPORT:
      return 'CSV/Excel Import';
    case FEATURES.MANUAL_ENTRY:
      return 'Manual Entry';
    case FEATURES.EXCEL_EXPORT:
      return 'Excel Export';
    case FEATURES.PDF_EXPORT:
      return 'PDF Export';
    case FEATURES.EMPLOYER_LETTERS:
      return 'Employer Letters';
    case FEATURES.CLOUD_SYNC:
      return 'Cloud Sync';
    case FEATURES.ADVANCED_ANALYTICS:
      return 'Advanced Analytics';
    default:
      return 'This feature';
  }
}
