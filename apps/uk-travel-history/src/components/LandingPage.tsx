'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, toast, UIIcon } from '@uth/ui';
import { useCsvImport } from './hooks/useCsvImport';
import { useClipboardImport } from './hooks/useClipboardImport';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { FullDataImportDialog } from './FullDataImportDialog';
import { useRef, useState } from 'react';
import {
  travelStore,
  authStore,
  monetizationStore,
  paymentStore,
  uiStore,
} from '@uth/stores';
import { logger } from '@uth/utils';
import { FeatureGateProvider, FeatureButton } from '@uth/widgets';
import { FEATURES } from '@uth/features';

export const LandingPage = () => {
  const router = useRouter();
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [activeAction, setActiveAction] = useState<
    'pdf' | 'csv' | 'clipboard' | null
  >(null);

  // CSV Import Hook
  const csvImport = useCsvImport();

  // Clipboard Import Hook
  const clipboardImport = useClipboardImport();

  const handlePdfImportClick = () => {
    pdfFileInputRef.current?.click();
  };

  const handlePdfFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      handleCancelImport();
      return;
    }

    setIsImporting(true);
    setActiveAction('pdf');
    try {
      await travelStore.importFromPdf(file);
      router.push('/travel');
    } catch (error) {
      logger.error('Import failed', error);
      toast({
        title: 'Import Failed',
        description:
          'Failed to import PDF. Please try again or add trips manually.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setActiveAction(null);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    }
  };

  const handleCsvFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      handleCancelImport();
      return;
    }
    try {
      await csvImport.handleFileSelect(e);
    } catch (error) {
      logger.error('Import failed', error);
      toast({
        title: 'Import Failed',
        description:
          'Failed to import Excel file. Please try again or add trips manually.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setActiveAction(null);
      if (csvImport.fileInputRef.current) {
        csvImport.fileInputRef.current.value = '';
      }
    }
  };
  const handleAddManually = () => {
    router.push('/travel');
  };

  const handleCsvImportClick = () => {
    setActiveAction('csv');
    csvImport.triggerFileInput();
  };

  const handleClipboardImportClick = async () => {
    setActiveAction('clipboard');
    try {
      await clipboardImport.handleClipboardPaste();
    } finally {
      if (!clipboardImport.isDialogOpen) {
        setActiveAction(null);
      }
    }
  };

  const handleCsvImportConfirm = async (mode: 'replace' | 'append') => {
    await csvImport.confirmImport(mode);
    setActiveAction(null);
    // Navigate to travel page after successful import
    if (!csvImport.isDialogOpen) {
      router.push('/travel');
    }
  };

  const handleClipboardImportConfirm = async (mode: 'replace' | 'append') => {
    await clipboardImport.confirmImport(mode);
    setActiveAction(null);
    // Navigate to travel page after successful import
    if (!clipboardImport.isDialogOpen) {
      router.push('/travel');
    }
  };

  const handleFullDataImportConfirm = async (mode: 'replace' | 'append') => {
    await csvImport.confirmFullDataImport(mode, () => {
      // Navigate to travel page after successful import
      setActiveAction(null);
      router.push('/travel');
    });
  };

  const handleCancelImport = () => {
    setActiveAction(null);
  };

  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
      uiStore={uiStore}
    >
      {/* Hidden File Inputs */}
      <input
        ref={pdfFileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handlePdfFileSelect}
      />
      <input
        ref={csvImport.fileInputRef}
        type="file"
        accept=".csv,.txt,.xlsx"
        className="hidden"
        onChange={handleCsvFileSelect}
      />

      {/* Import Preview Dialogs */}
      {csvImport.isDialogOpen && csvImport.previewData && (
        <ImportPreviewDialog
          isOpen={csvImport.isDialogOpen}
          tripCount={csvImport.previewData.tripCount}
          onConfirm={handleCsvImportConfirm}
          onCancel={() => {
            csvImport.cancelImport();
            handleCancelImport();
          }}
        />
      )}
      {clipboardImport.isDialogOpen && clipboardImport.previewData && (
        <ImportPreviewDialog
          isOpen={clipboardImport.isDialogOpen}
          tripCount={clipboardImport.previewData.tripCount}
          onConfirm={handleClipboardImportConfirm}
          onCancel={() => {
            clipboardImport.cancelImport();
            handleCancelImport();
          }}
        />
      )}
      {csvImport.isFullDataDialogOpen && csvImport.fullDataPreviewData && (
        <FullDataImportDialog
          isOpen={csvImport.isFullDataDialogOpen}
          tripCount={csvImport.fullDataPreviewData.tripCount}
          hasVignetteDate={csvImport.fullDataPreviewData.hasVignetteDate}
          hasVisaStartDate={csvImport.fullDataPreviewData.hasVisaStartDate}
          hasIlrTrack={csvImport.fullDataPreviewData.hasIlrTrack}
          onConfirm={handleFullDataImportConfirm}
          onCancel={() => {
            csvImport.cancelFullDataImport();
            handleCancelImport();
          }}
        />
      )}

      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <UIIcon iconName="airplane" className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-slate-900 text-sm sm:text-base">
                    UK Travel Parser
                  </h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                    Calculate days outside UK
                  </p>
                </div>
              </div>

              {/* Buy Me a Coffee Button */}
              <a
                href="https://www.buymeacoffee.com/LonliLokliV"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:block"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
                >
                  <UIIcon iconName="coffee" className="h-4 w-4 mr-1.5" />
                  Buy Me a Coffee
                </Button>
              </a>

              <a
                href="https://www.buymeacoffee.com/LonliLokliV"
                target="_blank"
                rel="noopener noreferrer"
                className="sm:hidden"
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
                >
                  <UIIcon iconName="coffee" className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <Card className="bg-white">
            <CardContent className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UIIcon
                    iconName="airplane"
                    className="w-8 h-8 text-primary"
                  />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  Welcome to UK Travel Parser
                </h2>
                <p className="text-slate-600 text-sm sm:text-base">
                  Track your UK travel history and calculate continuous
                  residence for settlement applications
                </p>
              </div>

              {/* Quick Start Options */}
              <div className="bg-slate-50 rounded-lg p-5 mb-8">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                  Get Started
                </h3>
                <div className="space-y-2">
                  <FeatureButton
                    feature={FEATURES.PDF_IMPORT}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handlePdfImportClick}
                    disabled={isImporting || activeAction !== null}
                  >
                    {activeAction === 'pdf' ? (
                      <UIIcon
                        iconName="loading"
                        className="h-4 w-4 mr-2 animate-spin"
                      />
                    ) : (
                      <UIIcon iconName="pdf" className="h-4 w-4 mr-2" />
                    )}
                    Import from PDF
                    {activeAction === 'pdf' && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Processing...
                      </span>
                    )}
                  </FeatureButton>
                  <FeatureButton
                    feature={FEATURES.CSV_IMPORT}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleCsvImportClick}
                    disabled={isImporting || activeAction !== null}
                  >
                    {activeAction === 'csv' ? (
                      <UIIcon
                        iconName="loading"
                        className="h-4 w-4 mr-2 animate-spin"
                      />
                    ) : (
                      <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    )}
                    Import from Excel
                    {activeAction === 'csv' && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Processing...
                      </span>
                    )}
                  </FeatureButton>
                  <FeatureButton
                    feature={FEATURES.CSV_IMPORT}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleClipboardImportClick}
                    disabled={isImporting || activeAction !== null}
                  >
                    {activeAction === 'clipboard' ? (
                      <UIIcon
                        iconName="loading"
                        className="h-4 w-4 mr-2 animate-spin"
                      />
                    ) : (
                      <UIIcon iconName="clipboard" className="h-4 w-4 mr-2" />
                    )}
                    Import from Clipboard
                    {activeAction === 'clipboard' && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Processing...
                      </span>
                    )}
                  </FeatureButton>
                  <div className="border-t border-slate-200 my-2 pt-2">
                    <FeatureButton
                      feature={FEATURES.MANUAL_ENTRY}
                      variant="ghost"
                      className="w-full justify-start text-slate-600"
                      onClick={handleAddManually}
                      disabled={isImporting || activeAction !== null}
                    >
                      <UIIcon iconName="note-add" className="h-4 w-4 mr-2" />
                      Or add travel dates manually
                    </FeatureButton>
                  </div>
                </div>
              </div>

              {/* How to Get Your PDF */}
              <div className="bg-slate-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <UIIcon
                    iconName="info-circle"
                    className="w-5 h-5 text-primary"
                  />
                  How to Get Your Travel History PDF
                </h3>
                <ol className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">
                        1
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">
                        Request your travel history document
                      </span>
                      <p className="text-xs text-slate-600 mt-1">
                        Use the official UK Visas and Immigration Subject Access
                        Request portal to request your travel document
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">
                        2
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Wait for processing</span>
                      <p className="text-xs text-slate-600 mt-1">
                        The Home Office typically responds within 40 days with
                        your travel history PDF
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">
                        3
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Upload your PDF here</span>
                      <p className="text-xs text-slate-600 mt-1">
                        Once received, import it using the "Import PDF" button
                        above
                      </p>
                    </div>
                  </li>
                </ol>
                <a
                  href="https://visas-immigration.service.gov.uk/product/saru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-4 font-medium"
                >
                  Request your travel history document
                  <UIIcon iconName="hand-right" className="w-3 h-3" />
                </a>
              </div>

              {/* What This Tool Does */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-4">
                  What This Tool Does
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Calculate days outside the UK
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Track continuous residence period
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Verify 180-day absence limit
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Export formatted Excel reports
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Track vignette & visa dates
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UIIcon
                      iconName="check-circle"
                      className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-slate-700">
                      Follows Home Office guidance
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </FeatureGateProvider>
  );
};

LandingPage.displayName = 'LandingPage';
