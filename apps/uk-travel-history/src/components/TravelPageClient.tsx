'use client';

import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { ValidationStatusCard } from './ValidationStatusCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { FullDataImportDialog } from './FullDataImportDialog';
import { FeatureGateProvider } from '@uth/widgets';
import { TravelToolbar } from './TravelToolbar';
import {
  authStore,
  monetizationStore,
  paymentStore,
  navbarToolbarStore,
} from '@uth/stores';
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
 * This component registers its toolbar items with the navbarToolbarStore.
 * The Navbar observes the store and renders the registered items.
 */
export const TravelPageClient = observer(() => {
  const { handleClearAll } = useClearAll();

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

  // Register toolbar items with the store on mount
  useEffect(() => {
    navbarToolbarStore.registerToolbarItems([
      {
        id: 'travel-toolbar',
        element: (
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
            {/* Toolbar component */}
            <TravelToolbar
              triggerFileInput={triggerFileInput}
              triggerCsvFileInput={triggerCsvFileInput}
              handleClipboardPaste={handleClipboardPaste}
              handleExport={handleExport}
            />
          </>
        ),
      },
    ]);

    // Cleanup: clear toolbar when component unmounts
    return () => {
      navbarToolbarStore.clearToolbar();
    };
  }, [
    fileInputRef,
    csvFileInputRef,
    handleFileSelect,
    handleCsvFileSelect,
    triggerFileInput,
    triggerCsvFileInput,
    handleClipboardPaste,
    handleExport,
  ]);

  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 min-h-[calc(100vh-60px)]">
        <SummaryCards />
        <VisaDetailsCard />
        <ValidationStatusCard />
        <RiskAreaChart />
        <TravelHistoryCard onClearAll={handleClearAll} />
      </main>

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
    </FeatureGateProvider>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
