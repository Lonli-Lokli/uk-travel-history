'use client';

import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/ui';
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
} from 'recharts';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';

interface RollingDataPoint {
  date: string;
  rollingDays: number;
  riskLevel: 'low' | 'caution' | 'critical';
  formattedDate: string;
}

interface TripBar {
  date: string;
  tripDuration: number;
  tripLabel: string;
  formattedDate: string;
}

const getRiskColor = (days: number): string => {
  if (days >= 180) return '#ef4444'; // red-500
  if (days >= 150) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const getRiskLevel = (days: number): 'low' | 'caution' | 'critical' => {
  if (days >= 180) return 'critical';
  if (days >= 150) return 'caution';
  return 'low';
};

// Define tooltip components outside to prevent hooks violation
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    const riskColor = getRiskColor(data.rollingDays);

    return (
      <div className="bg-white p-3 border border-slate-300 rounded shadow-lg">
        <p className="text-sm font-medium text-slate-700">
          {data.formattedDate}
        </p>
        <p className="text-sm font-semibold" style={{ color: riskColor }}>
          Rolling 12-month total: {data.rollingDays} days absent
        </p>
        {data.rollingDays >= 180 && (
          <p className="text-xs text-red-600 mt-1">⚠️ Exceeds 180-day limit</p>
        )}
        {data.rollingDays >= 150 && data.rollingDays < 180 && (
          <p className="text-xs text-amber-600 mt-1">⚠️ Approaching limit</p>
        )}
      </div>
    );
  }
  return null;
};

const TripTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border border-slate-300 rounded shadow-lg">
        <p className="text-sm font-medium text-slate-700">
          {data.formattedDate}
        </p>
        <p className="text-sm text-slate-600">
          {data.tripLabel}
        </p>
        <p className="text-sm font-semibold text-slate-800">
          {data.tripDuration} days
        </p>
      </div>
    );
  }
  return null;
};

export const RiskAreaChart = observer(() => {
  const { tripsWithCalculations, vignetteEntryDate, visaStartDate } = travelStore;

  const { rollingData, tripBars } = useMemo(() => {
    const startDate = vignetteEntryDate || visaStartDate;

    if (!startDate) {
      return { rollingData: [], tripBars: [] };
    }

    const start = parseISO(startDate);
    const today = new Date();
    const totalDays = differenceInDays(today, start);

    // Only calculate if there's a reasonable range
    if (totalDays < 0 || totalDays > 3650) { // Max 10 years
      return { rollingData: [], tripBars: [] };
    }

    const completeTrips = tripsWithCalculations.filter((t) => !t.isIncomplete);

    // Calculate rolling data points (sample every week for performance)
    const rollingPoints: RollingDataPoint[] = [];
    const sampleInterval = Math.max(1, Math.floor(totalDays / 200)); // Max 200 points

    for (let i = 0; i <= totalDays; i += sampleInterval) {
      const currentDate = addDays(start, i);
      const windowStart = addDays(currentDate, -365);

      // Calculate absences in the 12-month window ending on currentDate
      let absenceDays = 0;

      completeTrips.forEach((trip) => {
        const tripOut = parseISO(trip.outDate);
        const tripIn = parseISO(trip.inDate);

        // Check if trip overlaps with the 12-month window
        if (tripOut <= currentDate && tripIn >= windowStart) {
          const overlapStart = tripOut > windowStart ? tripOut : windowStart;
          const overlapEnd = tripIn < currentDate ? tripIn : currentDate;

          if (overlapStart <= overlapEnd) {
            const overlapDays = differenceInDays(overlapEnd, overlapStart);
            // Per guidance: only count whole days, exclude departure and return
            absenceDays += Math.max(0, overlapDays - 1);
          }
        }
      });

      rollingPoints.push({
        date: currentDate.toISOString(),
        rollingDays: absenceDays,
        riskLevel: getRiskLevel(absenceDays),
        formattedDate: format(currentDate, 'dd/MM/yyyy'),
      });
    }

    // Add final point (today) if not already included
    if (totalDays % sampleInterval !== 0) {
      const windowStart = addDays(today, -365);
      let absenceDays = 0;

      completeTrips.forEach((trip) => {
        const tripOut = parseISO(trip.outDate);
        const tripIn = parseISO(trip.inDate);

        if (tripOut <= today && tripIn >= windowStart) {
          const overlapStart = tripOut > windowStart ? tripOut : windowStart;
          const overlapEnd = tripIn < today ? tripIn : today;

          if (overlapStart <= overlapEnd) {
            const overlapDays = differenceInDays(overlapEnd, overlapStart);
            absenceDays += Math.max(0, overlapDays - 1);
          }
        }
      });

      rollingPoints.push({
        date: today.toISOString(),
        rollingDays: absenceDays,
        riskLevel: getRiskLevel(absenceDays),
        formattedDate: format(today, 'dd/MM/yyyy'),
      });
    }

    // Create trip bars for timeline
    const bars: TripBar[] = completeTrips.map((trip) => ({
      date: trip.outDate,
      tripDuration: trip.fullDays || 0,
      tripLabel: `${trip.outRoute || 'Unknown'} → ${trip.inRoute || 'Unknown'}`,
      formattedDate: format(parseISO(trip.outDate), 'dd/MM/yyyy'),
    }));

    return { rollingData: rollingPoints, tripBars: bars };
  }, [tripsWithCalculations, vignetteEntryDate, visaStartDate]);

  
  // Calculate gradient colors based on data
  const gradientStops = useMemo(() => {
    const maxValue = Math.max(...rollingData.map(d => d.rollingDays));
    const stops = [];

    if (maxValue >= 180) {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        { offset: `${(150 / maxValue) * 100}%`, color: '#22c55e', opacity: 0.3 },
        { offset: `${(150 / maxValue) * 100}%`, color: '#f59e0b', opacity: 0.4 },
        { offset: `${(180 / maxValue) * 100}%`, color: '#f59e0b', opacity: 0.4 },
        { offset: `${(180 / maxValue) * 100}%`, color: '#ef4444', opacity: 0.5 },
        { offset: '100%', color: '#ef4444', opacity: 0.5 }
      );
    } else if (maxValue >= 150) {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        { offset: `${(150 / maxValue) * 100}%`, color: '#22c55e', opacity: 0.3 },
        { offset: `${(150 / maxValue) * 100}%`, color: '#f59e0b', opacity: 0.4 },
        { offset: '100%', color: '#f59e0b', opacity: 0.4 }
      );
    } else {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        { offset: '100%', color: '#22c55e', opacity: 0.3 }
      );
    }

    return stops;
  }, [rollingData]);

  
  if (rollingData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Risk-Based Timeline
        </h3>
        <div className="text-center py-8 text-slate-500">
          <p>Set a Vignette Entry Date or Visa Start Date to view the risk timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          180-Day Rolling Absence Risk Timeline
        </h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
            <span className="text-slate-600">Low Risk (≤149 days)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
            <span className="text-slate-600">Caution (150-179 days)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
            <span className="text-slate-600">Critical (≥180 days)</span>
          </div>
        </div>
      </div>

      {/* Rolling Absence Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={rollingData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                {gradientStops.map((stop, idx) => (
                  <stop
                    key={idx}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM yyyy')}
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              label={{ value: 'Days Absent', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={180}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: '180-day limit', position: 'right', fill: '#ef4444', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="rollingDays"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trip Timeline */}
      {tripBars.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Trip Timeline</h4>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart
              data={tripBars}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(parseISO(value), 'MMM yyyy')}
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                label={{ value: 'Trip Duration (days)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
              />
              <Tooltip content={<TripTooltip />} />
              <Bar dataKey="tripDuration" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

RiskAreaChart.displayName = 'RiskAreaChart';
