'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  RadioGroup,
  RadioGroupItem,
  Label,
} from '@uth/ui';
import { useState } from 'react';
import { Info, Check } from 'lucide-react';

interface FullDataImportDialogProps {
  isOpen: boolean;
  tripCount: number;
  hasVignetteDate: boolean;
  hasVisaStartDate: boolean;
  hasIlrTrack: boolean;
  onConfirm: (mode: 'replace' | 'append') => void;
  onCancel: () => void;
}

export const FullDataImportDialog = ({
  isOpen,
  tripCount,
  hasVignetteDate,
  hasVisaStartDate,
  hasIlrTrack,
  onConfirm,
  onCancel,
}: FullDataImportDialogProps) => {
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  const handleConfirm = () => {
    onConfirm(importMode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Full Data</DialogTitle>
          <DialogDescription>
            Review the data to be imported and choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Information */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900">
                  File contains {tripCount} trip{tripCount !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1 text-blue-700">
                  <div className="flex items-center gap-2">
                    {hasVignetteDate && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    <span>
                      Vignette Entry Date{' '}
                      {hasVignetteDate ? '(included)' : '(not set)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasVisaStartDate && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    <span>
                      Visa Start Date{' '}
                      {hasVisaStartDate ? '(included)' : '(not set)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasIlrTrack && <Check className="h-4 w-4 text-green-600" />}
                    <span>
                      ILR Track {hasIlrTrack ? '(included)' : '(not set)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Import Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Import Mode</Label>
            <RadioGroup value={importMode} onValueChange={setImportMode as any}>
              <div className="flex items-center space-x-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                <RadioGroupItem value="replace" id="replace" />
                <Label htmlFor="replace" className="flex-1 cursor-pointer">
                  <div className="font-medium">Replace all data</div>
                  <div className="text-sm text-muted-foreground">
                    Clear existing trips and visa details, then import
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                <RadioGroupItem value="append" id="append" />
                <Label htmlFor="append" className="flex-1 cursor-pointer">
                  <div className="font-medium">Append to existing data</div>
                  <div className="text-sm text-muted-foreground">
                    Keep current trips and add imported ones (visa details will
                    be updated)
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            {importMode === 'replace' ? 'Replace & Import' : 'Append & Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
