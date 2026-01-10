'use client';

import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';
import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { TravelHistoryCard } from './TravelHistoryCard';
import { EmptyState } from './EmptyState';
import {
  useFileUpload,
  useExport,
  useClearAll,
  useCsvImport,
  useClipboardImport,
} from './hooks';

export const HomePageClient = observer(() => {
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const { handleClearAll } = useClearAll();
  const travelTableRef = useRef<HTMLDivElement>(null);

  const {
    fileInputRef: csvFileInputRef,
    handleFileSelect: handleCsvFileSelect,
    triggerFileInput: triggerCsvFileInput,
    isImporting: isCsvImporting,
  } = useCsvImport();

  const { handleClipboardPaste, isImporting: isClipboardImporting } =
    useClipboardImport();

  const hasTrips = travelStore.trips.length > 0;

  const handleAddManually = () => {
    // Scroll to the travel table and add a new trip
    travelTableRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    // Add a new trip automatically
    setTimeout(() => {
      travelStore.addTrip();
    }, 300);
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100">
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

      <Header
        onImportPdfClick={triggerFileInput}
        onImportCsvClick={triggerCsvFileInput}
        onImportClipboardClick={handleClipboardPaste}
        onExportClick={handleExport}
      />

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {!hasTrips ? (
          <EmptyState
            onImportClick={triggerFileInput}
            onImportCsvClick={triggerCsvFileInput}
            onImportClipboardClick={handleClipboardPaste}
            onAddManuallyClick={handleAddManually}
          />
        ) : (
          <>
            <SummaryCards />
            <VisaDetailsCard />
            <div ref={travelTableRef}>
              <TravelHistoryCard onClearAll={handleClearAll} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});
