'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@uth/ui';
import { goalsStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';
import type { TripData } from '@uth/db';
import { handleImportResult } from './utils/handleImportResult';

export const useClipboardImport = () => {
  const { toast } = useToast();
  const { hasAccess: hasGoalsAccess } = useFeatureGate(
    FEATURE_KEYS.MULTI_GOAL_TRACKING,
  );
  const [isImporting, setIsImporting] = useState(false);

  const handleClipboardPaste = useCallback(async () => {
    if (isImporting) return;

    try {
      setIsImporting(true);

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

      // Parse on server (with optional DB save for paid users)
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
          result.details?.join('\n') || result.error || 'Failed to parse data',
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
    } catch (err) {
      toast({
        title: 'Import failed',
        description:
          err instanceof Error ? err.message : 'Failed to import data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [toast, hasGoalsAccess, isImporting]);

  return {
    handleClipboardPaste,
    isImporting,
  };
};
