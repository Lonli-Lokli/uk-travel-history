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
import { FEATURE_KEYS } from '@uth/features';
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
            <FeatureDropdownItem onClick={triggerFileInput} feature={FEATURE_KEYS.PDF_IMPORT}>
              <UIIcon iconName="pdf" className="h-4 w-4 shrink-0" />
              From PDF
            </FeatureDropdownItem>
            <FeatureDropdownItem onClick={triggerCsvFileInput} feature={FEATURE_KEYS.EXCEL_IMPORT}>
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              From Excel
            </FeatureDropdownItem>
            <DropdownMenuSeparator />
            <FeatureDropdownItem onClick={handleClipboardPaste} feature={FEATURE_KEYS.CLIPBOARD_IMPORT}>
              <UIIcon iconName="clipboard" className="h-4 w-4 shrink-0" />
              From Clipboard
            </FeatureDropdownItem>
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
              feature={FEATURE_KEYS.EXCEL_EXPORT}
              onClick={() => handleExportClick('ilr')}
            >
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              Travel history only
            </FeatureDropdownItem>
            <FeatureDropdownItem
              feature={FEATURE_KEYS.EXCEL_EXPORT}
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
