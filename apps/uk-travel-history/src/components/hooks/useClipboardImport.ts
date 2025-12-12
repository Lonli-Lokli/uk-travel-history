'use client';

import { useCallback, useState } from 'react';
import { travelStore, useToast } from '@uth/ui';

export const useClipboardImport = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    text: string;
    tripCount: number;
  } | null>(null);

  const handleClipboardPaste = useCallback(async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported in this browser');
      }

      const text = await navigator.clipboard.readText();

      if (!text || text.trim().length === 0) {
        toast({
          title: 'Clipboard empty',
          description: 'No text found in clipboard',
          variant: 'destructive',
        });
        return;
      }

      // Quick validation
      const { parseCsvText } = await import('@uth/parser');
      const result = parseCsvText(text);

      if (!result.success) {
        toast({
          title: 'Invalid data',
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
        title: 'Paste failed',
        description:
          err instanceof Error ? err.message : 'Failed to read clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

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
            err instanceof Error ? err.message : 'Failed to import data',
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

  return {
    handleClipboardPaste,
    isDialogOpen,
    previewData,
    confirmImport,
    cancelImport,
  };
};
