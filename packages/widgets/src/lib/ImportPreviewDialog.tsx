'use client';

import { Sheet } from 'react-modal-sheet';
import { Button } from '@uth/ui';

interface ImportPreviewDialogProps {
  isOpen: boolean;
  tripCount: number;
  onConfirm: (mode: 'replace' | 'append') => void;
  onCancel: () => void;
}

export const ImportPreviewDialog = ({
  isOpen,
  tripCount,
  onConfirm,
  onCancel,
}: ImportPreviewDialogProps) => {
  return (
    <Sheet isOpen={isOpen} onClose={onCancel} detent="content">
      <Sheet.Container className="!rounded-t-2xl">
        <Sheet.Header className="!h-10" />
        <Sheet.Content>
          <div className="px-4 pb-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-2">Import Travel History</h2>
            <p className="text-sm text-slate-600 mb-4">
              Found {tripCount} trip{tripCount !== 1 ? 's' : ''} in the data.
              <br />
              How would you like to import?
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-1">
                  Append to existing trips
                </h4>
                <p className="text-xs text-blue-700">
                  Add these {tripCount} trip{tripCount !== 1 ? 's' : ''} to your
                  current list without removing existing data.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-amber-900 mb-1">
                  Replace all trips
                </h4>
                <p className="text-xs text-amber-700">
                  Remove all existing trips and replace with these {tripCount} trip
                  {tripCount !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => onConfirm('append')} className="w-full">
                Append
              </Button>
              <Button
                variant="destructive"
                onClick={() => onConfirm('replace')}
                className="w-full"
              >
                Replace All
              </Button>
              <Button variant="outline" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop />
    </Sheet>
  );
};
