'use client';

import { useRef, useCallback, useState } from 'react';
import { useToast } from '@uth/ui';
import { goalsStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import type { TripData } from '@uth/db';
import { handleImportResult } from './utils/handleImportResult';

export const useCsvImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { hasAccess: hasGoalsAccess } = useFeatureGate(
    FEATURE_KEYS.MULTI_GOAL_TRACKING,
  );
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (isImporting) return;

      try {
        setIsImporting(true);

        const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

        if (isXlsx) {
          // For XLSX files, try full import first (which handles both 2-sheet and single-sheet formats)
          const formData = new FormData();
          formData.append('file', file);

          // Add goalId for paid users
          if (hasGoalsAccess && goalsStore.goals.length > 0) {
            formData.append('goalId', goalsStore.goals[0].id);
          }

          // Try full import endpoint first - it will handle format detection
          let response = await fetch('/api/import-full', {
            method: 'POST',
            body: formData,
          });

          let result = await response.json();

          // If full import fails, try single-sheet XLSX import
          if (!response.ok && result.error?.includes('sheet')) {
            const formData2 = new FormData();
            formData2.append('file', file);
            if (hasGoalsAccess && goalsStore.goals.length > 0) {
              formData2.append('goalId', goalsStore.goals[0].id);
            }

            response = await fetch('/api/import/xlsx', {
              method: 'POST',
              body: formData2,
            });

            result = await response.json();
          }

          if (!response.ok) {
            throw new Error(
              result.details?.join('\n') ||
                result.error ||
                'Failed to import file',
            );
          }

          // Handle result based on format detected by server
          if (result.data) {
            // Full backup format (2-sheet)
            const trips = result.data.trips || [];
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
          } else {
            // Single-sheet XLSX format
            const count = await handleImportResult({
              trips: result.trips as TripData[],
              metadata: result.metadata,
            });

            toast({
              title: 'Import successful',
              description: result.metadata?.saved
                ? `Successfully imported ${count} trips to database`
                : `Successfully imported ${count} trips`,
              variant: 'success' as any,
            });
          }
        } else {
          // Parse CSV file on server
          const text = await file.text();

          // Add goalId for paid users
          const goalId = hasGoalsAccess && goalsStore.goals.length > 0
            ? goalsStore.goals[0].id
            : undefined;

          const response = await fetch('/api/import/csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, goalId }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.details?.join('\n') ||
                result.error ||
                'Failed to parse data',
            );
          }

          // Handle import result with tier-based persistence
          const count = await handleImportResult({
            trips: result.trips as TripData[],
            metadata: result.metadata,
          });

          toast({
            title: 'Import successful',
            description: result.metadata?.saved
              ? `Successfully imported ${count} trips to database`
              : `Successfully imported ${count} trips`,
            variant: 'success' as any,
          });
        }
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
