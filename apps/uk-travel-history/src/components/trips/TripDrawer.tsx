'use client';

import { observer } from 'mobx-react-lite';
import { uiStore, tripsStore, goalsStore } from '@uth/stores';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@uth/ui';

/**
 * TripDrawer - Drawer-based trip creation and editing (Phase 4)
 *
 * Replaces inline editing with a consistent drawer pattern
 * Uses uiStore for UI state and tripsStore for data operations
 */
export const TripDrawer = observer(() => {
  const isOpen = uiStore.isTripDrawerOpen;
  const mode = uiStore.tripDrawerMode;
  const formData = uiStore.tripDrawerFormData;
  const isLoading = tripsStore.isLoading;

  const handleSave = async () => {
    if (!formData.outDate || !formData.inDate) {
      return; // Don't save incomplete trips
    }

    if (!formData.goalId) {
      // If no goal selected, try to use the first available goal
      const firstGoal = goalsStore.goals[0];
      if (!firstGoal) {
        console.error('No goals available');
        return;
      }
      formData.goalId = firstGoal.id;
    }

    if (mode === 'create') {
      await tripsStore.createTrip({
        goalId: formData.goalId,
        outDate: formData.outDate,
        inDate: formData.inDate,
        outRoute: formData.outRoute,
        inRoute: formData.inRoute,
      });
    } else if (mode === 'edit' && uiStore.editingTripId) {
      await tripsStore.updateTrip(uiStore.editingTripId, {
        outDate: formData.outDate,
        inDate: formData.inDate,
        outRoute: formData.outRoute,
        inRoute: formData.inRoute,
      });
    }

    uiStore.closeTripDrawer();
  };

  const handleClose = () => {
    uiStore.closeTripDrawer();
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    uiStore.updateTripDrawerFormData({ [field]: value });
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
          {/* Goal Selection */}
          {goalsStore.goals.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="goal-select">Goal</Label>
              <Select
                value={formData.goalId || goalsStore.goals[0]?.id || ''}
                onValueChange={(value) => handleFieldChange('goalId', value)}
              >
                <SelectTrigger id="goal-select">
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent>
                  {goalsStore.goals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Departure Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 uppercase">
              Departure
            </label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="out-date">Date Out</Label>
                <Input
                  id="out-date"
                  type="date"
                  value={formData.outDate || ''}
                  onChange={(e) => handleFieldChange('outDate', e.target.value)}
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
                <Input
                  id="in-date"
                  type="date"
                  value={formData.inDate || ''}
                  onChange={(e) => handleFieldChange('inDate', e.target.value)}
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
                <UIIcon iconName="tick-02" className="h-4 w-4 mr-1" />
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
