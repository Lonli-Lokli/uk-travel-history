'use client';

import { observer } from 'mobx-react-lite';
import { travelStore, RollingDataPoint, TripBar } from '@uth/ui';
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
  Brush,
  TooltipContentProps,
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';

const getRiskColor = (days: number): string => {
  if (days >= 180) return '#ef4444'; // red-500
  if (days >= 150) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const CustomTooltip = ({
  active,
  payload,
}: TooltipContentProps<string | number, string>) => {
  if (active && payload && payload.length > 0) {
    const data: RollingDataPoint = payload[0].payload;
    const riskColor = getRiskColor(data.rollingDays);

    return (
      <div className="bg-white p-2 border border-slate-300 rounded shadow-lg">
        <p className="text-xs font-medium text-slate-700">
          {data.formattedDate}
        </p>
        <p className="text-sm font-semibold" style={{ color: riskColor }}>
          Rolling 12-month: {data.rollingDays} days
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

export const RiskAreaChart = observer(() => {
  const { rollingAbsenceData, tripBars } = travelStore;

  // Calculate gradient colors based on data
  const gradientStops = useMemo(() => {
    const maxValue = Math.max(
      ...rollingAbsenceData.map((d: RollingDataPoint) => d.rollingDays),
      0
    );
    const stops: Array<{ offset: string; color: string; opacity: number }> = [];

    if (maxValue >= 180) {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        {
          offset: `${(150 / maxValue) * 100}%`,
          color: '#22c55e',
          opacity: 0.3,
        },
        {
          offset: `${(150 / maxValue) * 100}%`,
          color: '#f59e0b',
          opacity: 0.4,
        },
        {
          offset: `${(180 / maxValue) * 100}%`,
          color: '#f59e0b',
          opacity: 0.4,
        },
        {
          offset: `${(180 / maxValue) * 100}%`,
          color: '#ef4444',
          opacity: 0.5,
        },
        { offset: '100%', color: '#ef4444', opacity: 0.5 }
      );
    } else if (maxValue >= 150) {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        {
          offset: `${(150 / maxValue) * 100}%`,
          color: '#22c55e',
          opacity: 0.3,
        },
        {
          offset: `${(150 / maxValue) * 100}%`,
          color: '#f59e0b',
          opacity: 0.4,
        },
        { offset: '100%', color: '#f59e0b', opacity: 0.4 }
      );
    } else {
      stops.push(
        { offset: '0%', color: '#22c55e', opacity: 0.3 },
        { offset: '100%', color: '#22c55e', opacity: 0.3 }
      );
    }

    return stops;
  }, [rollingAbsenceData]);

  if (rollingAbsenceData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-2">
          Risk-Based Timeline
        </h3>
        <div className="text-center py-6 text-slate-500">
          <p className="text-sm">
            Set a Vignette Entry Date or Visa Start Date to view the risk
            timeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-slate-800 mb-2">
          180-Day Rolling Absence Risk Timeline
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#22c55e' }}
            ></div>
            <span className="text-slate-600">Low Risk (≤149 days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#f59e0b' }}
            ></div>
            <span className="text-slate-600">Caution (150-179 days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#ef4444' }}
            ></div>
            <span className="text-slate-600">Critical (≥180 days)</span>
          </div>
        </div>
      </div>

      {/* Rolling Absence Chart */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={rollingAbsenceData}
            margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            syncId="timeline"
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
              style={{ fontSize: '11px' }}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '11px' }}
              domain={[0, 'auto']}
              label={{
                value: 'Days Absent',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: '11px' },
              }}
            />
            <Tooltip content={CustomTooltip} />
            <ReferenceLine
              y={180}
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              label={{
                value: '180-day limit',
                position: 'right',
                fill: '#ef4444',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            />
            <Area
              type="monotone"
              dataKey="rollingDays"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#riskGradient)"
            />
            <Brush
              dataKey="date"
              height={25}
              stroke="#3b82f6"
              fill="#f1f5f9"
              tickFormatter={(value) => format(parseISO(value), 'MMM yy')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trip Timeline */}
      {tripBars.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Trip Timeline
          </h4>
          <div className="relative bg-slate-50 rounded border border-slate-200 p-4 overflow-x-auto">
            {tripBars.map((trip: TripBar, idx: number) => {
              // Calculate position and width based on dates
              const startDate = parseISO(rollingAbsenceData[0].date);
              const endDate = parseISO(rollingAbsenceData[rollingAbsenceData.length - 1].date);
              const totalDays = differenceInDays(endDate, startDate);

              const tripStartDate = parseISO(trip.outDate);
              const tripEndDate = parseISO(trip.inDate);

              const leftPercent = (differenceInDays(tripStartDate, startDate) / totalDays) * 100;
              const widthPercent = (differenceInDays(tripEndDate, tripStartDate) / totalDays) * 100;

              return (
                <div
                  key={`trip-${idx}`}
                  className="relative mb-2 h-8 bg-blue-100 border border-blue-300 rounded"
                  style={{
                    marginLeft: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  title={`${trip.tripLabel}\n${format(tripStartDate, 'dd/MM/yyyy')} - ${format(tripEndDate, 'dd/MM/yyyy')}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-blue-900 px-1 truncate">
                    {trip.tripLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

RiskAreaChart.displayName = 'RiskAreaChart';
