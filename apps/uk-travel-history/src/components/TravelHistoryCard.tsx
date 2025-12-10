'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, TravelTable } from '@uth/ui';
import { Trash2, FileSpreadsheet } from 'lucide-react';

interface TravelHistoryCardProps {
  onClearAll: () => void;
}

export const TravelHistoryCard = observer(({ onClearAll }: TravelHistoryCardProps) => {
  const hasTrips = travelStore.trips.length > 0;
  const tripCount = travelStore.trips.length;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            Travel History
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Click on any cell to edit. Full days exclude travel days.
          </p>
        </div>

        {hasTrips && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Clear All</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clear all trips?</DialogTitle>
                <DialogDescription>
                  This will remove all {tripCount} trips.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 sm:flex-none"
                  onClick={onClearAll}
                >
                  Clear All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent>
        <TravelTable />
      </CardContent>
    </Card>
  );
});

TravelHistoryCard.displayName = 'TravelHistoryCard';
