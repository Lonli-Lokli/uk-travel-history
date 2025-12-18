'use client';

import { useCallback } from 'react';
import { useToast } from '@uth/ui';
import { travelStore } from '@uth/stores';

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
