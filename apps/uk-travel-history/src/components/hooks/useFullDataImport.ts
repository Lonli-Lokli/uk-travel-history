'use client';

import { useCallback, useRef, useState } from 'react';
import { travelStore, useToast } from '@uth/ui';

export const useFullDataImport = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    tripCount: number;
    hasVignetteDate: boolean;
    hasVisaStartDate: boolean;
    hasIlrTrack: boolean;
  } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      try {
        // Preview the file by calling the import API
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

        // Show preview dialog
        setPreviewData({
          tripCount: result.metadata.tripCount,
          hasVignetteDate: !!result.data.vignetteEntryDate,
          hasVisaStartDate: !!result.data.visaStartDate,
          hasIlrTrack: !!result.data.ilrTrack,
        });
        setPendingFile(file);
        setIsDialogOpen(true);
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
      if (!pendingFile) return;

      try {
        const result = await travelStore.importFullData(pendingFile, mode);

        toast({
          title: 'Import successful',
          description: result.message,
          variant: 'success' as any,
        });

        setIsDialogOpen(false);
        setPreviewData(null);
        setPendingFile(null);
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to import file',
          variant: 'destructive',
        });
      }
    },
    [pendingFile, toast]
  );

  const cancelImport = useCallback(() => {
    setIsDialogOpen(false);
    setPreviewData(null);
    setPendingFile(null);
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
