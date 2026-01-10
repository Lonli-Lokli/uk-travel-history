'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@uth/ui';
import { travelStore, tripsStore, goalsStore, authStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

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

        // Parse the full data file on server
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/import-full', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to import file');
        }

        // For authenticated users with multi-goal access (paid users), save to database
        if (hasGoalsAccess && authStore.user && goalsStore.goals.length > 0) {
          const goalId = goalsStore.goals[0].id;

          // Save trips to database via bulk endpoint
          if (result.data.trips && result.data.trips.length > 0) {
            await tripsStore.bulkCreateTrips(goalId, result.data.trips);
          }

          toast({
            title: 'Import successful',
            description: `Successfully imported ${result.metadata.tripCount} trips to database`,
            variant: 'success' as any,
          });
        } else {
          // Authenticated users without multi-goal access: hydrate trips in-memory (legacy travelStore)
          // Convert trips to CSV format for legacy import
          const trips = result.data.trips || [];
          const tripData = trips
            .map(
              (trip: {
                outDate: string;
                inDate: string;
                outRoute: string;
                inRoute: string;
              }) =>
                `${trip.outDate},${trip.inDate},${trip.outRoute || ''},${trip.inRoute || ''}`,
            )
            .join('\n');

          const csvText = `Date Out,Date In,Departure,Return\n${tripData}`;
          await travelStore.importFromCsv(csvText, 'append');

          // Also update visa details if present (legacy travelStore)
          if (result.data.vignetteEntryDate) {
            travelStore.setVignetteEntryDate(result.data.vignetteEntryDate);
          }
          if (result.data.visaStartDate) {
            travelStore.setVisaStartDate(result.data.visaStartDate);
          }
          if (result.data.ilrTrack) {
            travelStore.setILRTrack(result.data.ilrTrack);
          }

          toast({
            title: 'Import successful',
            description: `Successfully imported ${result.metadata.tripCount} trips`,
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
