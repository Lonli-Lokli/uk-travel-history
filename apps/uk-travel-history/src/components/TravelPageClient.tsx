'use client';

import { observer } from 'mobx-react-lite';
import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { VisaDetailsCard } from './VisaDetailsCard';
import { RiskAreaChart } from './RiskAreaChart';
import { TravelHistoryCard } from './TravelHistoryCard';
import { useFileUpload, useExport, useClearAll } from './hooks';

export const TravelPageClient = observer(() => {
  const { fileInputRef, handleFileSelect, triggerFileInput } = useFileUpload();
  const { handleExport } = useExport();
  const { handleClearAll } = useClearAll();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Header onImportClick={triggerFileInput} onExportClick={handleExport} />

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 min-h-[calc(100vh-60px)]">
        <SummaryCards />
        <VisaDetailsCard />
        <RiskAreaChart />
        <TravelHistoryCard onClearAll={handleClearAll} />
      </main>
    </>
  );
});

TravelPageClient.displayName = 'TravelPageClient';
