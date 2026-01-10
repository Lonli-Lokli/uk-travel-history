'use client';

import { useRef, useCallback, useState } from 'react';
import { useToast } from '@uth/ui';
import ExcelJS from 'exceljs';
import { travelStore, tripsStore, goalsStore, authStore } from '@uth/stores';
import { useFeatureGate } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

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
          // Check if this is a 2-sheet backup format by looking for "Travel History" sheet
          const arrayBuffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);

          const hasTravelHistorySheet =
            !!workbook.getWorksheet('Travel History');

          if (hasTravelHistorySheet) {
            // This is a full backup file - delegate to full data import
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

            // For paid users, trips are already saved to DB by server
            if (result.metadata?.saved) {
              // Update local store with saved trips
              result.data.trips.forEach((trip: any) => {
                tripsStore.trips.push(trip);
              });

              toast({
                title: 'Import successful',
                description: `Successfully imported ${result.metadata.tripCount} trips to database`,
                variant: 'success' as any,
              });
            } else {
              // For free users, hydrate trips in-memory (legacy travelStore)
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
            return;
          }

          // Legacy single-sheet XLSX format - use new server endpoint
          const formData = new FormData();
          formData.append('file', file);

          // Add goalId for paid users
          if (hasGoalsAccess && goalsStore.goals.length > 0) {
            formData.append('goalId', goalsStore.goals[0].id);
          }

          const response = await fetch('/api/import/xlsx', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.details?.join('\n') ||
                result.error ||
                'Failed to import file',
            );
          }

          // For paid users, trips are already saved to DB by server
          if (result.metadata?.saved) {
            // Update local store with saved trips
            result.trips.forEach((trip: any) => {
              tripsStore.trips.push(trip);
            });

            toast({
              title: 'Import successful',
              description: `Successfully imported ${result.trips.length} trips to database`,
              variant: 'success' as any,
            });
          } else {
            // For free users, hydrate trips in-memory (legacy travelStore)
            const tripData = result.trips
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

            toast({
              title: 'Import successful',
              description: `Successfully imported ${result.trips.length} trips`,
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

          // For paid users, trips are already saved to DB by server
          if (result.metadata?.saved) {
            // Update local store with saved trips
            result.trips.forEach((trip: any) => {
              tripsStore.trips.push(trip);
            });

            toast({
              title: 'Import successful',
              description: `Successfully imported ${result.trips.length} trips to database`,
              variant: 'success' as any,
            });
          } else {
            // For free users, hydrate trips in-memory (legacy travelStore)
            const tripData = result.trips
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

            toast({
              title: 'Import successful',
              description: `Successfully imported ${result.trips.length} trips`,
              variant: 'success' as any,
            });
          }
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
