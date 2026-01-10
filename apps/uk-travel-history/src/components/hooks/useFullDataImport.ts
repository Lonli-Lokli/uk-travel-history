'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@uth/ui';
import { goalsStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import type { TripData } from '@uth/db';
import { handleImportResult } from './utils/handleImportResult';

export const useFullDataImport = () => {
  const { toast } = useToast();
  const { hasAccess: hasGoalsAccess } = useFeatureGate(
    FEATURE_KEYS.MULTI_GOAL_TRACKING,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (isImporting) return;

      try {
        setIsImporting(true);

        // Parse the full data file on server (with optional DB save for paid users)
        const formData = new FormData();
        formData.append('file', file);

        // Add goalId for paid users
        if (hasGoalsAccess && goalsStore.goals.length > 0) {
          formData.append('goalId', goalsStore.goals[0].id);
        }

        const response = await fetch('/api/import-full', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to import file');
        }

        const trips = result.data.trips || [];

        // Handle import result with tier-based persistence
        const count = await handleImportResult(
          {
            trips: trips as TripData[],
            metadata: result.metadata,
          },
          {
            vignetteEntryDate: result.data.vignetteEntryDate,
            visaStartDate: result.data.visaStartDate,
            ilrTrack: result.data.ilrTrack,
          }
        );

        toast({
          title: 'Import successful',
          description: result.metadata?.saved
            ? `Successfully imported ${count} trips to database`
            : `Successfully imported ${count} trips`,
          variant: 'success' as any,
        });
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to read file',
          variant: 'destructive',
        });
      } finally {
        setIsImporting(false);
      }
    },
    [toast, hasGoalsAccess, isImporting],
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFileSelect,
    triggerFileInput,
    isImporting,
  };
};
