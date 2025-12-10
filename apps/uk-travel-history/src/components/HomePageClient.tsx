'use client';

import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { TravelHistoryCard } from './TravelHistoryCard';
import { InfoSection } from './InfoSection';
import { useFileUpload, useExport, useClearAll } from './hooks';

export const HomePageClient = () => {
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const { handleClearAll } = useClearAll();

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
        <SummaryCards />
        <VisaDetailsCard />
        <TravelHistoryCard onClearAll={handleClearAll} />
        <InfoSection />
      </main>
    </div>
  );
};
