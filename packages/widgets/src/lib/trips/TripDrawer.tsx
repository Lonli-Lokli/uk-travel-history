'use client';

import { observer } from 'mobx-react-lite';
import {
  tripsStore,
  authStore,
  travelStore,
  useRefreshAccessContext,
} from '@uth/stores';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerDescription,
  Button,
  UIIcon,
  Input,
  Label,
  DatePicker,
} from '@uth/ui';
import { useState } from 'react';

/**
 * TripDrawer - Drawer-based trip creation and editing (Phase 4)
 *
 * Replaces inline editing with a consistent drawer pattern
 * Uses uiStore for UI state and tripsStore for data operations
 *
 * Supports both authenticated and anonymous users:
 * - Authenticated: Uses tripsStore (server-persisted via API)
 * - Anonymous: Uses travelStore (client-side only)
 */
export const TripDrawer = observer(() => {
  const isOpen = travelStore.isDrawerOpen;
  const mode = travelStore.drawerMode;
  const formData = travelStore.drawerFormData;
  const isLoading = tripsStore.isLoading;
  const isAuthenticated = !!authStore.user;
  const refreshAccessContext = useRefreshAccessContext();

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async () => {
    // Clear previous validation errors
    setValidationError(null);

    // Validate required fields
    if (!formData.outDate || !formData.inDate) {
      setValidationError('Both departure and return dates are required');
      return;
    }

    // Validate date order (return must be after departure)
    const outDate = new Date(formData.outDate);
    const inDate = new Date(formData.inDate);

    if (outDate > inDate) {
      setValidationError('Return date must not be before departure date');
      return;
    }

    // For authenticated users: Use tripsStore (no goal required)
    if (isAuthenticated) {
      let success = false;
      if (mode === 'create') {
        const result = await tripsStore.createTrip({
          title: formData.title || null,
          outDate: formData.outDate,
          inDate: formData.inDate,
          outRoute: formData.outRoute,
          inRoute: formData.inRoute,
        });
        success = result !== null;
      } else if (mode === 'edit' && travelStore.editingTripId) {
        const result = await tripsStore.updateTrip(travelStore.editingTripId, {
          title: formData.title || null,
          outDate: formData.outDate,
          inDate: formData.inDate,
          outRoute: formData.outRoute,
          inRoute: formData.inRoute,
        });
        success = result !== null;
      }

      // Trigger server-side re-hydration to get fresh calculations
      if (success) {
        refreshAccessContext();
      }
    } else {
      // For anonymous users: Use travelStore (client-side only)
      if (mode === 'create') {
        travelStore.addTrip({
          outDate: formData.outDate,
          inDate: formData.inDate,
          outRoute: formData.outRoute || '',
          inRoute: formData.inRoute || '',
        });
      } else if (mode === 'edit' && travelStore.editingTripId) {
        // Find and update the trip in travelStore
        const tripIndex = travelStore.trips.findIndex(
          (t) => t.id === travelStore.editingTripId,
        );
        if (tripIndex !== -1) {
          travelStore.updateTrip(travelStore.editingTripId, {
            outDate: formData.outDate,
            inDate: formData.inDate,
            outRoute: formData.outRoute || '',
            inRoute: formData.inRoute || '',
          });
        }
      }
    }

    travelStore.closeDrawer();
  };

  const handleClose = () => {
    setValidationError(null);
    travelStore.closeDrawer();
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    // Clear validation error when user changes fields
    if (validationError) {
      setValidationError(null);
    }
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
          {/* Trip Title (optional) */}
          <div className="space-y-2">
            <Label htmlFor="trip-title">
              Trip Title{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="trip-title"
              type="text"
              value={formData.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g., Summer Vacation, Business Trip to Paris"
            />
          </div>

          {/* Departure Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 uppercase">
              Departure
            </label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="out-date">Date Out</Label>
                <DatePicker
                  id="out-date"
                  value={formData.outDate || ''}
                  onChange={(e) => handleFieldChange('outDate', e)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <Label htmlFor="out-route">Departure Route</Label>
                <Input
                  id="out-route"
                  type="text"
                  value={formData.outRoute || ''}
                  onChange={(e) =>
                    handleFieldChange('outRoute', e.target.value)
                  }
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
                <Label htmlFor="in-date">Date In</Label>
                <DatePicker
                  id="in-date"
                  value={formData.inDate || ''}
                  onChange={(e) => handleFieldChange('inDate', e)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <Label htmlFor="in-route">Return Route</Label>
                <Input
                  id="in-route"
                  type="text"
                  value={formData.inRoute || ''}
                  onChange={(e) => handleFieldChange('inRoute', e.target.value)}
                  placeholder="e.g., NRT → LHR"
                />
              </div>
            </div>
          </div>

          {/* Validation Error Panel */}
          {validationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <UIIcon
                  iconName="alert-circle"
                  className="h-4 w-4 text-red-600 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    Validation Error
                  </p>
                  <p className="text-xs text-red-700 mt-1">{validationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Completeness Panel */}
          {!isComplete && !validationError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <UIIcon
                  iconName="alert-circle"
                  className="h-4 w-4 text-amber-600 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Incomplete Trip
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    This trip will be excluded from calculations until both
                    dates are set.
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
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!isComplete || isLoading}
          >
            {isLoading ? (
              'Saving...'
            ) : (
              <>
                <UIIcon iconName="check" className="h-4 w-4 mr-1" />
                Save Trip
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
});

TripDrawer.displayName = 'TripDrawer';
