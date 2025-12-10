'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@uth/ui';
import { FileText } from 'lucide-react';

export const VisaDetailsCard = observer(() => {
  return (
    <Card className="bg-white mb-4 sm:mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          Visa & Vignette Details
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Enter your vignette entry date or visa start date to calculate continuous leave.
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
