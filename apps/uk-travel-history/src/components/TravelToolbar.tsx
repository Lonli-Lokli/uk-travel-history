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
              size="sm"
              disabled={travelStore.isLoading}
            >
              {travelStore.isLoading ? (
                <UIIcon
                  iconName="loading"
                  className="h-4 w-4 mr-1.5 animate-spin"
                />
              ) : (
                <UIIcon iconName="import" className="h-4 w-4 mr-1.5" />
              )}
              <span className="hidden sm:inline">Import</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            <Button
              size="sm"
              disabled={travelStore.trips.length === 0}
            >
              <UIIcon iconName="export" className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <FeatureDropdownItem
              feature={FEATURES.EXCEL_EXPORT}
              onClick={() => handleExport('ilr')}
            >
              <UIIcon iconName="xlsx" className="h-4 w-4 shrink-0" />
              Travel history only
            </FeatureDropdownItem>
            <FeatureDropdownItem
              feature={FEATURES.EXCEL_EXPORT}
              onClick={() => handleExport('full')}
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
