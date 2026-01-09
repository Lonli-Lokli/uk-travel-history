'use client';

/**
 * AddOptionsDrawer Component
 *
 * Drawer that displays options for adding new content:
 * - Add a new goal/tracker
 * - Add a new trip
 * - Import from PDF
 * - Import from Excel
 * - Import from clipboard
 */

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  UIIcon,
  Button,
} from '@uth/ui';
import { cn } from '@uth/utils';

export interface AddOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal?: () => void;
  onAddTrip?: () => void;
  onImportPdf?: () => void;
  onImportExcel?: () => void;
  onImportClipboard?: () => void;
}

interface OptionButtonProps {
  icon: string;
  label: string;
  description: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

function OptionButton({
  icon,
  label,
  description,
  onClick,
  variant = 'secondary',
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full p-4 rounded-lg border-2 transition-all duration-200',
        'flex items-start gap-4 text-left',
        onClick
          ? 'hover:border-primary hover:bg-primary/5 cursor-pointer'
          : 'opacity-50 cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary/10 border-primary'
          : 'bg-white border-slate-200',
      )}
      type="button"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
          variant === 'primary' ? 'bg-primary/20' : 'bg-slate-100',
        )}
      >
        <UIIcon
          iconName={icon}
          className={cn(
            'w-6 h-6',
            variant === 'primary' ? 'text-primary' : 'text-slate-600',
          )}
        />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-900 mb-1">{label}</p>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {onClick && (
        <UIIcon iconName="chevron-right" className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );
}

export function AddOptionsDrawer({
  isOpen,
  onClose,
  onAddGoal,
  onAddTrip,
  onImportPdf,
  onImportExcel,
  onImportClipboard,
}: AddOptionsDrawerProps) {
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add New Content</DrawerTitle>
          <DrawerDescription>
            Choose what you'd like to add or import
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-3">
          {/* Add Goal/Tracker */}
          {onAddGoal && (
            <OptionButton
              icon="target"
              label="Add Tracker"
              description="Create a new goal to track your days"
              onClick={onAddGoal}
              variant="primary"
            />
          )}

          {/* Add Trip */}
          {onAddTrip && (
            <OptionButton
              icon="airplane"
              label="Add Trip"
              description="Manually add a travel entry"
              onClick={onAddTrip}
            />
          )}

          {/* Divider */}
          {(onImportPdf || onImportExcel || onImportClipboard) && (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-500 uppercase tracking-wide">
                  Import
                </span>
              </div>
            </div>
          )}

          {/* Import PDF */}
          {onImportPdf && (
            <OptionButton
              icon="pdf"
              label="Import from PDF"
              description="Import trips from Home Office SAR document"
              onClick={onImportPdf}
            />
          )}

          {/* Import Excel */}
          {onImportExcel && (
            <OptionButton
              icon="xlsx"
              label="Import from Excel"
              description="Import trips from CSV or Excel file"
              onClick={onImportExcel}
            />
          )}

          {/* Import Clipboard */}
          {onImportClipboard && (
            <OptionButton
              icon="clipboard"
              label="Import from Clipboard"
              description="Paste trip data from your clipboard"
              onClick={onImportClipboard}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
