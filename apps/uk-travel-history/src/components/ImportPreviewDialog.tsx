'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@uth/ui';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Travel History</DialogTitle>
          <DialogDescription>
            Found {tripCount} trip{tripCount !== 1 ? 's' : ''} in the data.
            <br />
            How would you like to import?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm('replace')}
            className="w-full sm:w-auto"
          >
            Replace All
          </Button>
          <Button onClick={() => onConfirm('append')} className="w-full sm:w-auto">
            Append
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
