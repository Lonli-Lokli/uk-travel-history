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

      // Parse on server
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.details?.join('\n') || result.error || 'Failed to parse data',
        );
      }

      // For authenticated users with multi-goal access (paid users), save to database
      if (hasGoalsAccess && authStore.user && goalsStore.goals.length > 0) {
        const goalId = goalsStore.goals[0].id;

        // Save trips to database via bulk endpoint
        await tripsStore.bulkCreateTrips(goalId, result.trips);

        toast({
          title: 'Import successful',
          description: `Successfully imported ${result.trips.length} trips to database`,
          variant: 'success' as any,
        });
      } else {
        // Authenticated users without multi-goal access: hydrate trips in-memory (legacy travelStore)
        // Use 'append' mode to always add new trips
        const tripData = result.trips
          .map(
            (trip: { outDate: string; inDate: string; outRoute: string; inRoute: string }) =>
              `${trip.outDate},${trip.inDate},${trip.outRoute || ''},${trip.inRoute || ''}`,
          )
          .join('\n');

        const csvText = `Date Out,Date In,Departure,Return\n${tripData}`;
        await travelStore.importFromCsv(csvText, 'append');

        toast({
          title: 'Import successful',
          description: `Successfully imported ${result.trips.length} trips`,
          variant: 'success' as any,
        });
      }
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
