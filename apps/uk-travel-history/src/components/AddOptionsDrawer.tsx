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
} from '@uth/ui';
import { FEATURE_KEYS } from '@uth/features';
import { FeatureOptionButton } from '@uth/widgets';

export interface AddOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal?: () => void;
  onAddTrip?: () => void;
  onImportPdf?: () => void;
  onImportExcel?: () => void;
  onImportClipboard?: () => void;
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
            <FeatureOptionButton
              icon="target"
              label="Add Tracker"
              description="Create a new goal to track your days"
              onClick={onAddGoal}
              variant="primary"
            />
          )}

          {/* Add Trip */}
          {onAddTrip && (
            <FeatureOptionButton
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
            <FeatureOptionButton
              icon="pdf"
              label="Import from PDF"
              description="Import trips from Home Office SAR document"
              onClick={onImportPdf}
              feature={FEATURE_KEYS.PDF_IMPORT}
            />
          )}

          {/* Import Excel */}
          {onImportExcel && (
            <FeatureOptionButton
              icon="xlsx"
              label="Import from Excel"
              description="Import trips from CSV or Excel file"
              onClick={onImportExcel}
              feature={FEATURE_KEYS.EXCEL_IMPORT}
            />
          )}

          {/* Import Clipboard */}
          {onImportClipboard && (
            <FeatureOptionButton
              icon="clipboard"
              label="Import from Clipboard"
              description="Paste trip data from your clipboard"
              onClick={onImportClipboard}
              feature={FEATURE_KEYS.CLIPBOARD_IMPORT}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
