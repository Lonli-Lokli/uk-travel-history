'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerDescription,
  Button,
  UIIcon,
} from '@uth/ui';
import { EditableCell } from './editable-cell';

/**
 * TripDrawer - Drawer-based trip creation and editing
 *
 * Replaces inline editing with a consistent drawer pattern
 * Shows all trip fields with goal-aware completeness feedback
 */
export const TripDrawer = observer(() => {
  const isOpen = travelStore.isDrawerOpen;
  const mode = travelStore.drawerMode;
  const formData = travelStore.drawerFormData;

  const handleSave = () => {
    travelStore.saveFromDrawer();
  };

  const handleClose = () => {
    travelStore.closeDrawer();
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    travelStore.updateDrawerFormData({ [field]: value });
  };

  const title = mode === 'create' ? 'Add Trip' : 'Edit Trip';
  const isComplete = formData.outDate && formData.inDate;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            {mode === 'create'
              ? 'Enter travel details for this trip'
              : 'Update travel details for this trip'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Departure Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 uppercase">
              Departure
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Date Out</label>
                <EditableCell
                  value={formData.outDate || ''}
                  onSave={(value) => handleFieldChange('outDate', value)}
                  type="date"
                  displayValue={formData.outDate}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Departure Route</label>
                <EditableCell
                  value={formData.outRoute || ''}
                  onSave={(value) => handleFieldChange('outRoute', value)}
                  type="text"
                  placeholder="e.g., LHR → NRT"
                />
              </div>
            </div>
          </div>

          {/* Return Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 uppercase">
              Return
            </label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Date In</label>
                <EditableCell
                  value={formData.inDate || ''}
                  onSave={(value) => handleFieldChange('inDate', value)}
                  type="date"
                  displayValue={formData.inDate}
                  defaultMonth={formData.outDate}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Return Route</label>
                <EditableCell
                  value={formData.inRoute || ''}
                  onSave={(value) => handleFieldChange('inRoute', value)}
                  type="text"
                  placeholder="e.g., NRT → LHR"
                />
              </div>
            </div>
          </div>

          {/* Completeness Panel */}
          {!isComplete && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <UIIcon
                  iconName="alert-02"
                  className="h-4 w-4 text-amber-600 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Incomplete Trip
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    This trip will be excluded from calculations until both dates are set.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {!formData.outDate && (
                      <li className="text-xs text-amber-700">
                        • Date out is required
                      </li>
                    )}
                    {!formData.inDate && (
                      <li className="text-xs text-amber-700">
                        • Date in is required
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <UIIcon iconName="tick-02" className="h-4 w-4 mr-1" />
            Save Trip
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
});
