'use client';

/**
 * TravelPageClient (New) - Phase 4 Implementation
 *
 * Mobile-first redesign with drawer patterns and tab navigation.
 * - Tab navigation (Trackers/Timeline)
 * - Stats bar with date range picker
 * - Trackers view (goal cards)
 * - Timeline view (trips with sticky month headers)
 * - Floating action button for adding content
 * - Drawer patterns instead of modals
 */

import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRefreshAccessContext, goalsStore } from '@uth/stores';
import { FeatureGate, useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import { TabSwitcher } from './TabSwitcher';
import { StatsBar } from './StatsBar';
import { TrackersView } from './TrackersView';
import { TimelineView } from './TimelineView';
import { AddFab } from './AddFab';
import { AddGoalDrawer } from './goals';
import { uiStore, tripsStore } from '@uth/stores';
import {
  useClearAll,
  useCsvImport,
  useClipboardImport,
  useFileUpload,
  useExport,
} from './hooks';
import { ImportPreviewDialog, FullDataImportDialog } from '@uth/widgets';

/**
 * Travel page client component with new Phase 4 design.
 */
export const TravelPageClientNew = observer(() => {
  const { handleClearAll } = useClearAll();
  const searchParams = useSearchParams();
  const router = useRouter();
  const refreshAccessContext = useRefreshAccessContext();

  // Refresh access context after successful checkout
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');

    if (checkoutStatus === 'success') {
      refreshAccessContext();

      const params = new URLSearchParams(searchParams.toString());
      params.delete('checkout');
      const query = params.toString();
      router.replace(`/${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [searchParams, router, refreshAccessContext]);

  // Hooks for import/export functionality
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

  // Handlers for FAB actions
  const handleAddGoal = () => goalsStore.openAddModal();
  const handleAddTrip = () => {
    // TODO: Open add trip drawer
    console.log('Add trip');
  };
  const handleUpgrade = () => router.push('/account');

  // Feature gate for multi-goal tracking
  const { hasAccess: hasGoalsAccess, isLoading: isGoalsLoading } =
    useFeatureGate(FEATURE_KEYS.MULTI_GOAL_TRACKING);

  // Get trips from store (hydrated from server)
  const trips = tripsStore.trips;
  const totalTrips = tripsStore.totalTrips;
  const daysAway = tripsStore.totalDaysAway;

  return (
    <>
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

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {/* Tab Navigation */}
        <FeatureGate
          hasAccess={hasGoalsAccess}
          isLoading={isGoalsLoading}
          mode="hide"
          gateReason="login"
          onGatedClick={handleUpgrade}
          fallback={null}
        >
          <div className="mb-6">
            <TabSwitcher />
          </div>
        </FeatureGate>

        {/* Stats Bar (only show on Timeline tab) */}
        {uiStore.activeTab === 'timeline' && (
          <div className="mb-6">
            <StatsBar totalTrips={totalTrips} daysAway={daysAway} />
          </div>
        )}

        {/* Content Area - switches based on active tab */}
        <FeatureGate
          hasAccess={hasGoalsAccess}
          isLoading={isGoalsLoading}
          mode="hide"
          gateReason="login"
          onGatedClick={handleUpgrade}
          fallback={null}
        >
          {uiStore.activeTab === 'trackers' ? (
            <TrackersView onAddGoal={handleAddGoal} />
          ) : (
            <TimelineView
              trips={trips}
              onAddTrip={handleAddTrip}
              onEditTrip={(tripId) => console.log('Edit trip', tripId)}
              onDeleteTrip={(tripId) => console.log('Delete trip', tripId)}
            />
          )}
        </FeatureGate>
      </div>

      {/* Floating Action Button */}
      <FeatureGate
        hasAccess={hasGoalsAccess}
        isLoading={isGoalsLoading}
        mode="hide"
        gateReason="login"
        onGatedClick={handleUpgrade}
        fallback={null}
      >
        <AddFab
          onAddGoal={handleAddGoal}
          onAddTrip={handleAddTrip}
          onImportPdf={triggerFileInput}
          onImportExcel={triggerCsvFileInput}
          onImportClipboard={handleClipboardPaste}
        />
      </FeatureGate>

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

      {/* Add Goal Drawer - state managed by goalsStore */}
      <AddGoalDrawer />
    </>
  );
});

TravelPageClientNew.displayName = 'TravelPageClientNew';
