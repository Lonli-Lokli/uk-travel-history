'use client';

import { useCallback } from 'react';
import { useToast } from '@uth/ui';
import { travelStore } from '@uth/stores';

export const useExport = () => {
  const { toast } = useToast();

  const handleExport = useCallback(
    async (mode: 'ilr' | 'full' = 'ilr') => {
      if (travelStore.trips.length === 0) {
        toast({
          title: 'Nothing to export',
          description: 'Add some trips first',
          variant: 'destructive',
        });
        return;
      }

      try {
        const blob = await travelStore.exportToExcel(mode);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          mode === 'full'
            ? 'UK_Travel_History_Full.xlsx'
            : 'UK_Travel_History.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Export successful',
          description:
            mode === 'full'
              ? 'Full data export downloaded'
              : 'ILR application export downloaded',
          variant: 'success' as const,
        });
      } catch {
        toast({
          title: 'Export failed',
          description: 'Failed to generate Excel file',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  return { handleExport };
};
