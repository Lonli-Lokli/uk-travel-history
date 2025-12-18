'use client';

import { useRef, useCallback } from 'react';
import { useToast } from '@uth/ui';
import { travelStore } from '@uth/stores';

export const useFileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await travelStore.importFromPdf(file);
        toast({
          title: 'Import successful',
          description: `Imported ${travelStore.summary.totalTrips} trips from PDF`,
          variant: 'success' as const,
        });
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to parse PDF',
          variant: 'destructive',
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [toast],
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFileSelect,
    triggerFileInput,
  };
};
