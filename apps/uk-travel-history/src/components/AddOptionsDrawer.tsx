'use client';

/**
 * AddOptionsDrawer Component
 *
 * Drawer that displays options for adding new content:
 * - Add a new goal/tracker (gated for multi-goal: 1st goal = free, 2+ = paid only)
 * - Add a new trip
 * - Import from PDF
 * - Import from Excel
 * - Import from clipboard
 */

import { observer } from 'mobx-react-lite';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  UIIcon,
} from '@uth/ui';
import { FEATURE_KEYS } from '@uth/features';
import { FeatureOptionButton, useFeatureGate } from '@uth/widgets';
import { goalsStore } from '@uth/stores';
import { cn } from '@uth/utils';
import { useRouter } from 'next/navigation';

export interface AddOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal?: () => void;
  onAddTrip?: () => void;
  onImportPdf?: () => void;
  onImportExcel?: () => void;
  onImportClipboard?: () => void;
}

/**
 * Custom Add Tracker button with multi-goal gating logic
 * - First goal: available to all users (anonymous, free, paid)
 * - Additional goals (2+): paid tier only
 */
const AddTrackerButton = observer(function AddTrackerButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const router = useRouter();
  const activeGoalCount = goalsStore.activeGoalCount;

  // Use feature gate to check auth and tier
  const {
    hasAccess: hasFeatureAccess,
    isLoading,
    requiresSignUp,
    requiresUpgrade,
    handleUpgrade,
  } = useFeatureGate(FEATURE_KEYS.MULTI_GOAL_TRACKING);

  // Multi-goal logic:
  // - If user has 0 goals: anyone can create (show without badge)
  // - If user has 1+ goals: only paid users (show with PRO badge for non-paid)
  const needsUpgradeForMultiGoal = activeGoalCount >= 1 && requiresUpgrade;

  // Loading state
  if (isLoading) {
    return (
      <button
        disabled
        className={cn(
          'w-full p-4 rounded-lg border-2 transition-all duration-200',
          'flex items-start gap-4 text-left opacity-50 cursor-not-allowed',
          'bg-primary/10 border-primary',
        )}
        type="button"
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
          <UIIcon iconName="target" className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 mb-1">Add Tracker</p>
          <p className="text-sm text-slate-600">
            Create a new goal to track your days
          </p>
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
  ) : needsUpgradeForMultiGoal ? (
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

  const hasAccess = hasFeatureAccess && !needsUpgradeForMultiGoal;

  // Handle click based on access
  const handleClick = () => {
    if (hasAccess) {
      onClick();
    } else if (requiresSignUp || needsUpgradeForMultiGoal) {
      // Trigger upgrade flow (sign-in or paywall)
      if (requiresSignUp) {
        handleUpgrade(); // Will show sign-in modal
      } else {
        router.push('/account'); // Navigate to subscription page
      }
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
        'bg-primary/10 border-primary',
      )}
      type="button"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
          'bg-primary/20',
          !hasAccess && 'opacity-60',
        )}
      >
        <UIIcon iconName="target" className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p
            className={cn(
              'font-semibold text-slate-900',
              !hasAccess && 'opacity-60',
            )}
          >
            Add Tracker
          </p>
          {badgeContent}
        </div>
        <p className={cn('text-sm text-slate-600', !hasAccess && 'opacity-60')}>
          {activeGoalCount === 0
            ? 'Create a new goal to track your days'
            : 'Create additional tracking goals (PRO feature)'}
        </p>
      </div>
      {hasAccess && (
        <UIIcon iconName="chevron-right" className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );
});

export const AddOptionsDrawer = observer(function AddOptionsDrawer({
  isOpen,
  onClose,
  onAddGoal,
  onAddTrip,
  onImportPdf,
  onImportExcel,
  onImportClipboard,
}: AddOptionsDrawerProps) {
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add New Content</DrawerTitle>
          <DrawerDescription>
            Choose what you'd like to add or import
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3">
          {/* Add Goal/Tracker - with custom multi-goal gating */}
          {onAddGoal && <AddTrackerButton onClick={onAddGoal} />}

          {/* Add Trip */}
          {onAddTrip && (
            <FeatureOptionButton
              icon="airplane"
              label="Add Trip"
              description="Manually add a travel entry"
              onClick={onAddTrip}
            />
          )}

          {/* Divider */}
          {(onImportPdf || onImportExcel || onImportClipboard) && (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-500 uppercase tracking-wide">
                  Import
                </span>
              </div>
            </div>
          )}

          {/* Import PDF */}
          {onImportPdf && (
            <FeatureOptionButton
              icon="pdf"
              label="Import from PDF"
              description="Import trips from Home Office SAR document"
              onClick={onImportPdf}
              feature={FEATURE_KEYS.PDF_IMPORT}
            />
          )}

          {/* Import Excel */}
          {onImportExcel && (
            <FeatureOptionButton
              icon="xlsx"
              label="Import from Excel"
              description="Import trips from CSV or Excel file"
              onClick={onImportExcel}
              feature={FEATURE_KEYS.EXCEL_IMPORT}
            />
          )}

          {/* Import Clipboard */}
          {onImportClipboard && (
            <FeatureOptionButton
              icon="clipboard"
              label="Import from Clipboard"
              description="Paste trip data from your clipboard"
              onClick={onImportClipboard}
              feature={FEATURE_KEYS.CLIPBOARD_IMPORT}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
});
