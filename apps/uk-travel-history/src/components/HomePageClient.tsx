'use client';

import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/ui';
import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { TravelHistoryCard } from './TravelHistoryCard';
import { EmptyState } from './EmptyState';
import { useFileUpload, useExport, useClearAll } from './hooks';

export const HomePageClient = observer(() => {
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const { handleClearAll } = useClearAll();
  const travelTableRef = useRef<HTMLDivElement>(null);

  const hasTrips = travelStore.trips.length > 0;

  const handleAddManually = () => {
    // Scroll to the travel table and add a new trip
    travelTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Add a new trip automatically
    setTimeout(() => {
      travelStore.addTrip();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Header
        onImportClick={triggerFileInput}
        onExportClick={handleExport}
      />

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {!hasTrips ? (
          <EmptyState
            onImportClick={triggerFileInput}
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
      </main>
    </div>
  );
});
