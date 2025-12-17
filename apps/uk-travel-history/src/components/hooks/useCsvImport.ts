'use client';

import { useRef, useCallback, useState } from 'react';
import { travelStore, useToast } from '@uth/ui';
import ExcelJS from 'exceljs';

export const useCsvImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    text: string;
    tripCount: number;
  } | null>(null);
  // For full data imports (2-sheet format)
  const [fullDataPreviewData, setFullDataPreviewData] = useState<{
    tripCount: number;
    hasVignetteDate: boolean;
    hasVisaStartDate: boolean;
    hasIlrTrack: boolean;
  } | null>(null);
  const [isFullDataDialogOpen, setIsFullDataDialogOpen] = useState(false);
  const [pendingFullDataFile, setPendingFullDataFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      try {
        const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

        if (isXlsx) {
          // Check if this is a 2-sheet backup format by looking for "Travel History" sheet
          const arrayBuffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);

          const hasTravelHistorySheet = !!workbook.getWorksheet('Travel History');

          if (hasTravelHistorySheet) {
            // This is a full backup file - use full data import
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/import-full', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Failed to preview file');
            }

            // Show full data preview dialog
            setFullDataPreviewData({
              tripCount: result.metadata.tripCount,
              hasVignetteDate: !!result.data.vignetteEntryDate,
              hasVisaStartDate: !!result.data.visaStartDate,
              hasIlrTrack: !!result.data.ilrTrack,
            });
            setPendingFullDataFile(file);
            setIsFullDataDialogOpen(true);
            return;
          }

          // Legacy single-sheet XLSX format
          const { parseXlsxFile } = await import('@uth/parser');
          const result = await parseXlsxFile(arrayBuffer);

          if (!result.success) {
            toast({
              title: 'Invalid Excel file',
              description: result.errors.join('\n'),
              variant: 'destructive',
            });
            return;
          }

          setPreviewData({
            text: `__XLSX__${JSON.stringify(result.trips)}`,
            tripCount: result.trips.length,
          });
          setIsDialogOpen(true);
        } else {
          // Parse CSV file
          const text = await file.text();
          const { parseCsvText } = await import('@uth/parser');
          const result = parseCsvText(text);

          if (!result.success) {
            toast({
              title: 'Invalid CSV file',
              description: result.errors.join('\n'),
              variant: 'destructive',
            });
            return;
          }

          setPreviewData({
            text: await file.text(),
            tripCount: result.trips.length,
          });
          setIsDialogOpen(true);
        }
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to read file',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const confirmImport = useCallback(
    async (mode: 'replace' | 'append') => {
      if (!previewData) return;

      try {
        const result = await travelStore.importFromCsv(previewData.text, mode);
        toast({
          title: 'Import successful',
          description: result.message,
          variant: 'success' as any,
        });
        setIsDialogOpen(false);
        setPreviewData(null);
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to import CSV',
          variant: 'destructive',
        });
      }
    },
    [previewData, toast]
  );

  const cancelImport = useCallback(() => {
    setIsDialogOpen(false);
    setPreviewData(null);
  }, []);

  const confirmFullDataImport = useCallback(
    async (mode: 'replace' | 'append', onSuccess?: () => void) => {
      if (!pendingFullDataFile) return;

      try {
        const result = await travelStore.importFullData(pendingFullDataFile, mode);

        toast({
          title: 'Import successful',
          description: result.message,
          variant: 'success' as any,
        });

        setIsFullDataDialogOpen(false);
        setFullDataPreviewData(null);
        setPendingFullDataFile(null);

        // Call success callback after state updates
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to import file',
          variant: 'destructive',
        });
      }
    },
    [pendingFullDataFile, toast]
  );

  const cancelFullDataImport = useCallback(() => {
    setIsFullDataDialogOpen(false);
    setFullDataPreviewData(null);
    setPendingFullDataFile(null);
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFileSelect,
    triggerFileInput,
    isDialogOpen,
    previewData,
    confirmImport,
    cancelImport,
    // Full data import
    isFullDataDialogOpen,
    fullDataPreviewData,
    confirmFullDataImport,
    cancelFullDataImport,
  };
};
