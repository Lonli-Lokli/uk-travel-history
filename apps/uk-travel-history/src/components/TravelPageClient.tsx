'use client';

import { observer } from 'mobx-react-lite';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { ValidationStatusCard } from './ValidationStatusCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { FullDataImportDialog } from './FullDataImportDialog';
import { TravelToolbar } from './TravelToolbar';
import { ProvidersWrapper } from './ProvidersWrapper';
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

  return (
    <ProvidersWrapper>
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
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
    </ProvidersWrapper>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
