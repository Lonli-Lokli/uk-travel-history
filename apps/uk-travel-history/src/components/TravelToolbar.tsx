'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  UIIcon,
  toast,
} from '@uth/ui';
import { FeatureGateProvider, FeatureDropdownItem } from '@uth/widgets';
import { FEATURES } from '@uth/features';
import { authStore, monetizationStore, paymentStore } from '@uth/stores';

interface TravelToolbarProps {
  triggerFileInput: () => void;
  triggerCsvFileInput: () => void;
  handleClipboardPaste: () => void;
  handleExport: (type: 'ilr' | 'full') => void;
}

export const TravelToolbar = observer(({
  triggerFileInput,
  triggerCsvFileInput,
  handleClipboardPaste,
  handleExport,
}: TravelToolbarProps) => {
  const handleExportClick = (type: 'ilr' | 'full') => {
    if (travelStore.trips.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No trips to export',
        description: 'Please add some trips first.',
      });
      return;
    }
    handleExport(type);
  };

  return (
    <FeatureGateProvider
      monetizationStore={monetizationStore}
      authStore={authStore}
      paymentStore={paymentStore}
    >
      <div className="flex items-center gap-2">
        {/* Import Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={travelStore.isLoading}
            >
              {travelStore.isLoading ? (
                <UIIcon
                  iconName="loading"
                  className="h-4 w-4 mr-2 animate-spin"
                />
              ) : (
                <UIIcon iconName="import" className="h-4 w-4 mr-2" />
              )}
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onClick={triggerFileInput}>
              <UIIcon iconName="pdf" className="h-4 w-4 shrink-0" />
              From PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={triggerCsvFileInput}>
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              From Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClipboardPaste}>
              <UIIcon iconName="clipboard" className="h-4 w-4 shrink-0" />
              From Clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <UIIcon iconName="export" className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[240px]">
            <FeatureDropdownItem
              feature={FEATURES.EXCEL_EXPORT}
              onClick={() => handleExportClick('ilr')}
            >
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              Travel history only
            </FeatureDropdownItem>
            <FeatureDropdownItem
              feature={FEATURES.EXCEL_EXPORT}
              onClick={() => handleExportClick('full')}
            >
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              Full backup
            </FeatureDropdownItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </FeatureGateProvider>
  );
});

TravelToolbar.displayName = 'TravelToolbar';
