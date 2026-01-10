'use client';

/**
 * AddFab Component (Floating Action Button)
 *
 * Mobile-first floating action button for adding new content.
 * Triggers the AddOptionsDrawer when clicked.
 */

import { useState } from 'react';
import { cn } from '@uth/utils';
import { UIIcon } from '@uth/ui';
import { AddOptionsDrawer } from './AddOptionsDrawer';

export interface AddFabProps {
  onAddGoal?: () => void;
  onAddTrip?: () => void;
  onImportPdf?: () => void;
  onImportExcel?: () => void;
  onImportClipboard?: () => void;
  className?: string;
}

export function AddFab({
  onAddGoal,
  onAddTrip,
  onImportPdf,
  onImportExcel,
  onImportClipboard,
  className,
}: AddFabProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleAddGoal = () => {
    setIsDrawerOpen(false);
    onAddGoal?.();
  };

  const handleAddTrip = () => {
    setIsDrawerOpen(false);
    onAddTrip?.();
  };

  const handleImportPdf = () => {
    setIsDrawerOpen(false);
    onImportPdf?.();
  };

  const handleImportExcel = () => {
    setIsDrawerOpen(false);
    onImportExcel?.();
  };

  const handleImportClipboard = () => {
    setIsDrawerOpen(false);
    onImportClipboard?.();
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpenDrawer}
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'w-14 h-14 md:w-16 md:h-16 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg hover:shadow-xl',
          'transition-all duration-200',
          'hover:scale-110 active:scale-95',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          className,
        )}
        type="button"
        aria-label="Add new content"
      >
        <UIIcon iconName="plus" className="w-6 h-6 md:w-8 md:h-8" />
      </button>

      {/* Options Drawer */}
      <AddOptionsDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onAddGoal={onAddGoal ? handleAddGoal : undefined}
        onAddTrip={onAddTrip ? handleAddTrip : undefined}
        onImportPdf={onImportPdf ? handleImportPdf : undefined}
        onImportExcel={onImportExcel ? handleImportExcel : undefined}
        onImportClipboard={
          onImportClipboard ? handleImportClipboard : undefined
        }
      />
    </>
  );
}
