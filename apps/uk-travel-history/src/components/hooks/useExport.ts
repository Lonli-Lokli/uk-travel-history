'use client';

import { useCallback } from 'react';
import { travelStore, useToast } from '@uth/ui';

export const useExport = () => {
  const { toast } = useToast();

  const handleExport = useCallback(async () => {
    if (travelStore.trips.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Add some trips first',
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await travelStore.exportToExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'UK_Travel_History.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export successful',
        description: 'Excel file downloaded',
        variant: 'success' as any,
      });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: 'Failed to generate Excel file',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { handleExport };
};
