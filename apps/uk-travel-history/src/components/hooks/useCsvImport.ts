'use client';

import { useRef, useCallback, useState } from 'react';
import { travelStore, useToast } from '@uth/ui';

export const useCsvImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    text: string;
    tripCount: number;
  } | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();

        // Quick validation
        const { parseCsvText } = await import('@uth/parser');
        const result = parseCsvText(text);

        if (!result.success) {
          toast({
            title: 'Invalid CSV',
            description: result.errors.join('\n'),
            variant: 'destructive',
          });
          return;
        }

        // Show preview dialog
        setPreviewData({
          text,
          tripCount: result.trips.length,
        });
        setIsDialogOpen(true);
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to read CSV file',
          variant: 'destructive',
        });
      } finally {
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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
  };
};
