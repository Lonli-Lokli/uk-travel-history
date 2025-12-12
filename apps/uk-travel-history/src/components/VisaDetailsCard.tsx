'use client';

import { observer } from 'mobx-react-lite';
import {
  travelStore,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  ILRTrack,
  DatePicker,
} from '@uth/ui';
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
          Enter your vignette entry date or visa start date to calculate
          continuous leave and ILR eligibility.
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vignetteIssueDate" className="text-xs font-medium">
              Vignette Issue Date
            </Label>
            <DatePicker
              value={travelStore.vignetteIssueDate}
              onChange={(value) => travelStore.setVignetteIssueDate(value)}
              placeholder="Select vignette issue date"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              Date your entry clearance was issued
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vignetteDate" className="text-xs font-medium">
              Vignette Entry Date
            </Label>
            <DatePicker
              value={travelStore.vignetteEntryDate}
              onChange={(value) => travelStore.setVignetteEntryDate(value)}
              placeholder="Select vignette entry date"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              Date you entered the UK with your vignette
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visaStartDate" className="text-xs font-medium">
              Visa Start Date
            </Label>
            <DatePicker
              value={travelStore.visaStartDate}
              onChange={(value) => travelStore.setVisaStartDate(value)}
              placeholder="Select visa start date"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              Start date of your current visa
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="ilrTrack"
              className="text-xs font-medium flex items-center gap-1"
            >
              <Target className="w-3 h-3" />
              ILR Track (Years)
            </Label>
            <select
              id="ilrTrack"
              value={travelStore.ilrTrack || ''}
              onChange={(e) => {
                const value = e.target.value;
                travelStore.setILRTrack(
                  value ? (Number(value) as ILRTrack) : null
                );
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

          <div className="space-y-1.5">
            <Label htmlFor="applicationDate" className="text-xs font-medium">
              Application Date (Override)
            </Label>
            <DatePicker
              value={travelStore.applicationDate}
              onChange={(value) => travelStore.setApplicationDate(value)}
              placeholder={
                travelStore.calculatedApplicationDate
                  ? `Auto: ${formatDate(travelStore.calculatedApplicationDate)}`
                  : 'Will auto-calculate with ILR track'
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground leading-tight">
              {travelStore.calculatedApplicationDate ? (
                <>
                  Auto-calculated:{' '}
                  <strong>{formatDate(travelStore.calculatedApplicationDate)}</strong>
                  {travelStore.applicationDate && ' (Overridden)'}
                </>
              ) : (
                'Set ILR track to auto-calculate'
              )}
            </p>
          </div>
        </div>

        {(travelStore.vignetteEntryDate || travelStore.visaStartDate || travelStore.vignetteIssueDate) && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            {travelStore.summary.preEntryDays !== null && (
              <p className="text-xs text-blue-800 leading-tight">
                <strong>Pre-Entry Period:</strong>{' '}
                {travelStore.summary.preEntryDays} days between vignette issue (
                {formatDate(travelStore.vignetteIssueDate)}) and UK entry (
                {formatDate(travelStore.vignetteEntryDate)})
                {travelStore.summary.canCountPreEntry ? (
                  <span className="text-green-700 font-semibold"> ✓ Counts toward qualifying period</span>
                ) : (
                  <span className="text-orange-700 font-semibold"> ⚠ Exceeds 180 days - cannot count</span>
                )}
              </p>
            )}
            <p className="text-xs text-blue-800 leading-tight">
              <strong>Start Date:</strong>{' '}
              {travelStore.summary.canCountPreEntry && travelStore.vignetteIssueDate ? (
                <>
                  Vignette Issue Date:{' '}
                  {formatDate(travelStore.vignetteIssueDate)}
                </>
              ) : travelStore.vignetteEntryDate ? (
                <>
                  Vignette Entry Date:{' '}
                  {formatDate(travelStore.vignetteEntryDate)}
                </>
              ) : (
                <>Visa Start Date: {formatDate(travelStore.visaStartDate)}</>
              )}
            </p>
            {travelStore.ilrTrack && travelStore.effectiveApplicationDate && (
              <p className="text-xs text-blue-800 leading-tight mt-1">
                <strong>Assessment:</strong> UK Home Office backward counting from{' '}
                {formatDate(travelStore.effectiveApplicationDate)} (
                {travelStore.ilrTrack}-year track)
                {travelStore.applicationDate && ' - Manual override active'}
              </p>
            )}
            {travelStore.ilrTrack && !travelStore.effectiveApplicationDate && (
              <p className="text-xs text-blue-800 leading-tight mt-1">
                <strong>Info:</strong> Set ILR track to calculate eligibility
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

VisaDetailsCard.displayName = 'VisaDetailsCard';
