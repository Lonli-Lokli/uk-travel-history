'use client';

import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRefreshAccessContext, goalsStore } from '@uth/stores';
import { FeatureGate, useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { ValidationStatusCard } from './ValidationStatusCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { TravelToolbar } from './TravelToolbar';
import { ImportPreviewDialog, FullDataImportDialog } from '@uth/widgets';
import {
  GoalMiniCardsRow,
  GoalDetailPanel,
  GoalEmptyState,
  AddGoalModal,
} from './goals';
import {
  useClearAll,
  useCsvImport,
  useClipboardImport,
  useFileUpload,
  useExport,
} from './hooks';

/**
 * Travel page client component.
 *
 * This component renders its own toolbar at the top of the page.
 */
export const TravelPageClient = observer(() => {
  const { handleClearAll } = useClearAll();
  const searchParams = useSearchParams();
  const router = useRouter();
  const refreshAccessContext = useRefreshAccessContext();

  // Refresh access context after successful checkout
  // This ensures the UI updates with the new subscription tier
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');

    if (checkoutStatus === 'success') {
      // Refresh access context to load new subscription from server
      refreshAccessContext();

      // Clear the query parameter to prevent re-triggering on refresh
      const params = new URLSearchParams(searchParams.toString());
      params.delete('checkout');
      const query = params.toString();
      router.replace(`/travel${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [searchParams, router, refreshAccessContext]);

  // Hooks for toolbar functionality
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const {
    fileInputRef: csvFileInputRef,
    handleFileSelect: handleCsvFileSelect,
    triggerFileInput: triggerCsvFileInput,
    isDialogOpen: isCsvDialogOpen,
    previewData: csvPreviewData,
    confirmImport: confirmCsvImport,
    cancelImport: cancelCsvImport,
    isFullDataDialogOpen,
    fullDataPreviewData,
    confirmFullDataImport,
    cancelFullDataImport,
  } = useCsvImport();

  const {
    handleClipboardPaste,
    isDialogOpen: isClipboardDialogOpen,
    previewData: clipboardPreviewData,
    confirmImport: confirmClipboardImport,
    cancelImport: cancelClipboardImport,
  } = useClipboardImport();

  // Handlers for goal actions
  const handleAddGoal = () => goalsStore.openAddModal();
  const handleUpgrade = () => router.push('/account');

  // Feature gate for multi-goal tracking
  const {
    hasAccess: hasGoalsAccess,
    isLoading: isGoalsLoading,
    requiresUpgrade: goalsRequiresUpgrade,
    handleUpgrade: handleGoalsUpgrade,
  } = useFeatureGate(FEATURE_KEYS.MULTI_GOAL_TRACKING);

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {/* Page Toolbar */}
        <div className="mb-4 flex justify-end">
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            className="hidden"
            onChange={handleCsvFileSelect}
          />
          <TravelToolbar
            triggerFileInput={triggerFileInput}
            triggerCsvFileInput={triggerCsvFileInput}
            handleClipboardPaste={handleClipboardPaste}
            handleExport={handleExport}
          />
        </div>

        {/* Multi-Goal Tracking Section (feature-gated) */}
        <FeatureGate
          hasAccess={hasGoalsAccess}
          isLoading={isGoalsLoading}
          mode="hide"
          gateReason={goalsRequiresUpgrade ? 'upgrade' : 'login'}
          onGatedClick={handleGoalsUpgrade}
          fallback={null}
        >
          <div className="mb-6">
            {goalsStore.hasGoals ? (
              <>
                {/* Goals row */}
                <GoalMiniCardsRow
                  onAddGoal={handleAddGoal}
                  onUpgrade={handleUpgrade}
                  className="mb-4"
                />

                {/* Selected goal details */}
                {goalsStore.activeGoal && (
                  <GoalDetailPanel
                    goal={goalsStore.activeGoal}
                    calculation={goalsStore.activeCalculation}
                  />
                )}
              </>
            ) : (
              <GoalEmptyState onAddGoal={handleAddGoal} />
            )}
          </div>
        </FeatureGate>

        <SummaryCards />
        <VisaDetailsCard />
        <ValidationStatusCard />
        <RiskAreaChart />
        <TravelHistoryCard onClearAll={handleClearAll} />
      </div>

      {/* CSV Import Preview Dialog */}
      {csvPreviewData && (
        <ImportPreviewDialog
          isOpen={isCsvDialogOpen}
          tripCount={csvPreviewData.tripCount}
          onConfirm={confirmCsvImport}
          onCancel={cancelCsvImport}
        />
      )}

      {/* Clipboard Import Preview Dialog */}
      {clipboardPreviewData && (
        <ImportPreviewDialog
          isOpen={isClipboardDialogOpen}
          tripCount={clipboardPreviewData.tripCount}
          onConfirm={confirmClipboardImport}
          onCancel={cancelClipboardImport}
        />
      )}

      {/* Full Data Import Preview Dialog */}
      {fullDataPreviewData && (
        <FullDataImportDialog
          isOpen={isFullDataDialogOpen}
          tripCount={fullDataPreviewData.tripCount}
          hasVignetteDate={fullDataPreviewData.hasVignetteDate}
          hasVisaStartDate={fullDataPreviewData.hasVisaStartDate}
          hasIlrTrack={fullDataPreviewData.hasIlrTrack}
          onConfirm={confirmFullDataImport}
          onCancel={cancelFullDataImport}
        />
      )}

      {/* Add Goal Modal - state managed by goalsStore */}
      <AddGoalModal />
    </>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
