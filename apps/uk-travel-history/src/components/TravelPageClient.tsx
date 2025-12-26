'use client';

import { observer } from 'mobx-react-lite';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { ValidationStatusCard } from './ValidationStatusCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { FullDataImportDialog } from './FullDataImportDialog';
import { FeatureGateProvider } from '@uth/widgets';
import {
  authStore,
  monetizationStore,
  paymentStore,
} from '@uth/stores';
import {
  useClearAll,
  useCsvImport,
  useClipboardImport,
} from './hooks';

/**
 * Travel page client component.
 *
 * Note: The toolbar (Import/Export buttons) is now rendered by the Navbar component
 * based on the current route. This eliminates the need for context-based injection
 * and useEffect timing issues that were causing the toolbar to not appear.
 */
export const TravelPageClient = observer(() => {
  const { handleClearAll } = useClearAll();

  const {
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
