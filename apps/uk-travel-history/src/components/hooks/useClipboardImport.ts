'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@uth/ui';
import { travelStore, tripsStore, goalsStore, authStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

export const useClipboardImport = () => {
  const { toast } = useToast();
  const { hasAccess: hasGoalsAccess } = useFeatureGate(
    FEATURE_KEYS.MULTI_GOAL_TRACKING,
  );
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
        // For authenticated users with multi-goal access, persist to database
        if (hasGoalsAccess && authStore.user && goalsStore.goals.length > 0) {
          // Parse trips from CSV
          const { parseCsvText } = await import('@uth/parser');
          const parseResult = parseCsvText(previewData.text);

          if (!parseResult.success) {
            throw new Error(parseResult.errors.join('\n'));
          }

          // Use first available goal
          const goalId = goalsStore.goals[0].id;

          // Bulk create trips in database
          await tripsStore.bulkCreateTrips(goalId, parseResult.trips);

          toast({
            title: 'Import successful',
            description: `Successfully imported ${parseResult.trips.length} trips to database`,
            variant: 'success' as any,
          });
        } else {
          // Free users: use legacy in-memory travelStore
          const result = await travelStore.importFromCsv(previewData.text, mode);
          toast({
            title: 'Import successful',
            description: result.message,
            variant: 'success' as any,
          });
        }

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
    [previewData, toast, hasGoalsAccess],
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
