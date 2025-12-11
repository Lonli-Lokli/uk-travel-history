'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Card, CardContent, CardHeader, CardTitle, Input, Label, ILRTrack } from '@uth/ui';
import { formatDate } from '@uth/utils';
import { FileText, Target } from 'lucide-react';

export const VisaDetailsCard = observer(() => {
  return (
    <Card className="bg-white mb-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Visa & Vignette Details
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
          Enter your vignette entry date or visa start date to calculate continuous leave and ILR eligibility.
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vignetteDate" className="text-xs font-medium">
              Vignette Entry Date
            </Label>
            <Input
              id="vignetteDate"
              type="date"
              value={travelStore.vignetteEntryDate}
              onChange={(e) => travelStore.setVignetteEntryDate(e.target.value)}
              className="w-full h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              Date you entered the UK with your vignette
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visaStartDate" className="text-xs font-medium">
              Visa Start Date
            </Label>
            <Input
              id="visaStartDate"
              type="date"
              value={travelStore.visaStartDate}
              onChange={(e) => travelStore.setVisaStartDate(e.target.value)}
              className="w-full h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              Start date of your current visa
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ilrTrack" className="text-xs font-medium flex items-center gap-1">
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
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select track...</option>
              <option value="2">2 Years</option>
              <option value="3">3 Years</option>
              <option value="5">5 Years</option>
              <option value="10">10 Years</option>
            </select>
            <p className="text-xs text-muted-foreground leading-tight">
              Required continuous period for ILR
            </p>
          </div>
        </div>

        {(travelStore.vignetteEntryDate || travelStore.visaStartDate) && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-800 leading-tight">
              <strong>Using:</strong>{' '}
              {travelStore.vignetteEntryDate ? (
                <>
                  Vignette Entry Date:{' '}
                  {formatDate(travelStore.vignetteEntryDate)}
                </>
              ) : (
                <>
                  Visa Start Date:{' '}
                  {formatDate(travelStore.visaStartDate)}
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
