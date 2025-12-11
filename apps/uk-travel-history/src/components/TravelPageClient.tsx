'use client';

import { observer } from 'mobx-react-lite';
import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { InfoSection } from './InfoSection';
import { useFileUpload, useExport, useClearAll } from './hooks';

export const TravelPageClient = observer(() => {
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
        <RiskAreaChart />
        <TravelHistoryCard onClearAll={handleClearAll} />
        <InfoSection />
      </main>
    </div>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
