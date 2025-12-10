'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Card, CardContent } from '@uth/ui';
import {
  Plane,
  CalendarDays,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const SummaryCards = observer(() => {
  const summary = travelStore.summary;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.totalTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total Trips
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.completeTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Complete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-slate-900">
                {summary.incompleteTrips}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Incomplete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold">
                {summary.totalFullDays}
              </p>
              <p className="text-[10px] sm:text-xs opacity-80">
                Days Outside UK
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

SummaryCards.displayName = 'SummaryCards';
