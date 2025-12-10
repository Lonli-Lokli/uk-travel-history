'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Card, CardContent, CardHeader, CardTitle, Input, Label, ILRTrack } from '@uth/ui';
import { FileText, Target } from 'lucide-react';

export const VisaDetailsCard = observer(() => {
  return (
    <Card className="bg-white mb-4 sm:mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          Visa & Vignette Details
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Enter your vignette entry date or visa start date to calculate continuous leave and ILR eligibility.
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vignetteDate" className="text-sm font-medium">
              Vignette Entry Date
            </Label>
            <Input
              id="vignetteDate"
              type="date"
              value={travelStore.vignetteEntryDate}
              onChange={(e) => travelStore.setVignetteEntryDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Date you entered the UK with your vignette
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visaStartDate" className="text-sm font-medium">
              Visa Start Date
            </Label>
            <Input
              id="visaStartDate"
              type="date"
              value={travelStore.visaStartDate}
              onChange={(e) => travelStore.setVisaStartDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Start date of your current visa
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ilrTrack" className="text-sm font-medium flex items-center gap-1">
              <Target className="w-3 h-3" />
              ILR Track (Years)
            </Label>
            <select
              id="ilrTrack"
              value={travelStore.ilrTrack || ''}
              onChange={(e) => {
                const value = e.target.value;
                travelStore.setILRTrack(value ? (Number(value) as ILRTrack) : null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select track...</option>
              <option value="2">2 Years</option>
              <option value="3">3 Years</option>
              <option value="5">5 Years</option>
              <option value="10">10 Years</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Required continuous period for ILR
            </p>
          </div>
        </div>

        {(travelStore.vignetteEntryDate || travelStore.visaStartDate) && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Using:</strong>{' '}
              {travelStore.vignetteEntryDate ? (
                <>
                  Vignette Entry Date:{' '}
                  {new Date(travelStore.vignetteEntryDate).toLocaleDateString('en-GB')}
                </>
              ) : (
                <>
                  Visa Start Date:{' '}
                  {new Date(travelStore.visaStartDate).toLocaleDateString('en-GB')}
                </>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

VisaDetailsCard.displayName = 'VisaDetailsCard';
