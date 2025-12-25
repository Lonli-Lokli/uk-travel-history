'use client';

import { observer } from 'mobx-react-lite';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { ValidationStatusCard } from './ValidationStatusCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { FullDataImportDialog } from './FullDataImportDialog';
import { FeatureGateProvider, FeatureDropdownItem } from '@uth/widgets';
import {
  authStore,
  monetizationStore,
  paymentStore,
  uiStore,
  travelStore,
} from '@uth/stores';
import {
  useFileUpload,
  useExport,
  useClearAll,
  useCsvImport,
  useClipboardImport,
} from './hooks';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  UIIcon,
} from '@uth/ui';
import { FEATURES } from '@uth/features';

export const TravelPageClient = observer(() => {
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const { handleClearAll } = useClearAll();

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
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
      uiStore={uiStore}
    >
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

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 min-h-[calc(100vh-60px)]">
        {/* Import/Export Toolbar */}
        <div className="flex justify-end gap-2 mb-4">
          {/* Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={travelStore.isLoading}
              >
                {travelStore.isLoading ? (
                  <UIIcon
                    iconName="loading"
                    className="h-4 w-4 mr-1.5 animate-spin"
                  />
                ) : (
                  <UIIcon iconName="import" className="h-4 w-4 mr-1.5" />
                )}
                <span className="hidden sm:inline">Import</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={triggerFileInput}>
                <UIIcon iconName="pdf" className="h-4 w-4 shrink-0" />
                From PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={triggerCsvFileInput}>
                <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
                From Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClipboardPaste}>
                <UIIcon iconName="clipboard" className="h-4 w-4 shrink-0" />
                From Clipboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                disabled={travelStore.trips.length === 0}
              >
                <UIIcon iconName="export" className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <FeatureDropdownItem
                feature={FEATURES.EXCEL_EXPORT}
                onClick={() => handleExport('ilr')}
              >
                <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
                Travel history only
              </FeatureDropdownItem>
              <FeatureDropdownItem
                feature={FEATURES.EXCEL_EXPORT}
                onClick={() => handleExport('full')}
              >
                <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
                Full backup
              </FeatureDropdownItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
    </FeatureGateProvider>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
