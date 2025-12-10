'use client';

import { useCallback } from 'react';
import { travelStore, useToast } from '@uth/ui';

export const useClearAll = () => {
  const { toast } = useToast();

  const handleClearAll = useCallback(() => {
    travelStore.clearAll();
    toast({
      title: 'Cleared',
      description: 'All trips have been removed',
    });
  }, [toast]);

  return { handleClearAll };
};
