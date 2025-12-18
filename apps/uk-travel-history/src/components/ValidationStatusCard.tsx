'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';
import { formatDate } from '@uth/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@uth/ui';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
} from 'lucide-react';

export const ValidationStatusCard = observer(() => {
  const validation = travelStore.validation;
  const hasRequiredFields = travelStore.hasRequiredFields;

  // Case 1: Required fields missing (gating)
  if (!hasRequiredFields) {
    const missingFields: string[] = [];
    if (!travelStore.vignetteEntryDate) missingFields.push('Vignette Entry Date');
    if (!travelStore.visaStartDate) missingFields.push('Visa Start Date');
    if (!travelStore.ilrTrack) missingFields.push('ILR Track');
    const incompleteTrips = travelStore.trips.filter(
      (t) => !t.outDate || !t.inDate
    );
    if (incompleteTrips.length > 0) {
      missingFields.push(`${incompleteTrips.length} incomplete trip(s)`);
    }

    return (
      <Card className="bg-amber-50 border-amber-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900">
            <Info className="w-4 h-4" />
            Required Information Missing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-2">
            Please provide the following required information to calculate ILR
            eligibility:
          </p>
          <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Case 2: No validation result (shouldn't happen, but defensive)
  if (!validation) {
    return null;
  }

  // Case 3: ELIGIBLE
  if (validation.status === 'ELIGIBLE') {
    return (
      <Card className="bg-green-50 border-green-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-green-900">
            <CheckCircle className="w-4 h-4" />
            ILR Eligible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-800">
            You are eligible to apply for Indefinite Leave to Remain as of{' '}
            <strong>{formatDate(validation.applicationDate)}</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Case 4: INELIGIBLE - handle different reason types
  const { reason } = validation;

  if (reason.type === 'TOO_EARLY') {
    return (
      <Card className="bg-red-50 border-red-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-red-900">
            <XCircle className="w-4 h-4" />
            NOT ELIGIBLE - Application Date Too Early
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800 mb-2 font-semibold">{reason.message}</p>
          <p className="text-sm text-red-800">
            <strong>Earliest allowed date:</strong>{' '}
            {formatDate(reason.earliestAllowedDate)}
          </p>
          <p className="text-xs text-red-700 mt-2">
            You cannot apply for ILR before completing the required continuous residence period.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (reason.type === 'EXCESSIVE_ABSENCE') {
    return (
      <Card className="bg-red-50 border-red-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-red-900">
            <AlertTriangle className="w-4 h-4" />
            Excessive Absence Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800 mb-2">{reason.message}</p>
          {reason.offendingWindows.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-red-900 mb-2">
                Offending 12-Month Periods:
              </p>
              <div className="space-y-2">
                {reason.offendingWindows.map((window, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-2 rounded border border-red-200"
                  >
                    <p className="text-xs text-red-800">
                      <strong>Period:</strong> {formatDate(window.start)} to{' '}
                      {formatDate(window.end)}
                    </p>
                    <p className="text-xs text-red-800">
                      <strong>Absences:</strong> {window.days} days (exceeds 180
                      day limit)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (reason.type === 'INCORRECT_INPUT') {
    return (
      <Card className="bg-orange-50 border-orange-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-orange-900">
            <AlertCircle className="w-4 h-4" />
            Input Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-800">{reason.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (reason.type === 'INCOMPLETED_TRIPS') {
    return (
      <Card className="bg-yellow-50 border-yellow-300 mb-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-900">
            <XCircle className="w-4 h-4" />
            Incomplete Trips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-800">{reason.message}</p>
        </CardContent>
      </Card>
    );
  }

  return null;
});

ValidationStatusCard.displayName = 'ValidationStatusCard';
