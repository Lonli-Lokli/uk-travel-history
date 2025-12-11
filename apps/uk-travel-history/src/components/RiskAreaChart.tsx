'use client';

import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { travelStore, RollingDataPoint, TripBar } from '@uth/ui';
import { format, parseISO } from 'date-fns';

import Highcharts from 'highcharts/highcharts-gantt';
import HighchartsReact from 'highcharts-react-official';

type TooltipCtx = {
  x?: number;
  y?: number;
  points?: Array<{ y?: number }>;
  [key: string]: unknown;
};

type GanttPointOptions = {
  id: string;
  name: string;
  start: number;
  end: number;
  y: number;
  color?: string;
};

type HCOptions = Highcharts.Options;

type GradientStop = {
  offset: string;
  color: string;
  opacity: number;
};

type AssignedTrip = {
  trip: TripBar;
  start: number;
  end: number;
  lane: number;
  index: number;
};

const getRiskColor = (days: number): string => {
  if (days >= 180) return '#ef4444'; // red-500
  if (days >= 150) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const RiskAreaChart: React.FC = observer(() => {
  const { rollingAbsenceData, tripBars } = travelStore;

  const { gradientStops, maxRollingValue } = useMemo(() => {
    if (rollingAbsenceData.length === 0) {
      return {
        maxRollingValue: 0,
        gradientStops: [
          { offset: '0%', color: '#22c55e', opacity: 0.3 },
          { offset: '100%', color: '#22c55e', opacity: 0.3 },
        ] as GradientStop[],
      };
    }

    const maxValue = Math.max(
      ...rollingAbsenceData.map((d: RollingDataPoint) => d.rollingDays),
      0
    );

    const stops: GradientStop[] = [];

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

    return { gradientStops: stops, maxRollingValue: maxValue };
  }, [rollingAbsenceData]);

  const areaChartOptions = useMemo<HCOptions>(() => {
    if (rollingAbsenceData.length === 0) {
      return {};
    }

    const seriesData: Highcharts.PointOptionsObject[] = rollingAbsenceData.map(
      (d: RollingDataPoint) => ({
        x: Date.parse(d.date),
        y: d.rollingDays,
      })
    );

    const fillColor: Highcharts.GradientColorObject = {
      linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
      stops: gradientStops.map((stop) => [
        parseFloat(stop.offset.replace('%', '')) / 100,
        hexToRgba(stop.color, stop.opacity),
      ]),
    };

    const options: HCOptions = {
      chart: {
        type: 'area',
        height: 280,
        spacingBottom: 30,
      },
      title: { text: '' },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: 'datetime',
        lineColor: '#e2e8f0',
        tickColor: '#e2e8f0',
        labels: {
          style: { color: '#64748b', fontSize: '11px' },
          formatter: (ctx) => {
            const value = ctx.value as number;
            return format(new Date(value), 'MMM yyyy');
          },
        },
      },
      yAxis: {
        title: {
          text: 'Days Absent',
          style: { fontSize: '11px' },
        },
        min: 0,
        lineColor: '#e2e8f0',
        gridLineColor: '#e2e8f0',
        gridLineDashStyle: 'ShortDash',
        labels: {
          style: { color: '#64748b', fontSize: '11px' },
        },
        plotLines:
          maxRollingValue >= 180
            ? [
                {
                  value: 180,
                  color: '#ef4444',
                  width: 2,
                  zIndex: 5,
                  label: {
                    text: '180-day limit',
                    align: 'right',
                    style: {
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    },
                  },
                },
              ]
            : [],
      },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function (): string {
          const ctx = this as unknown as TooltipCtx;
          const x = (ctx.x ?? 0) as number;
          const y = (ctx.y ?? ctx.points?.[0]?.y ?? 0) as number;
          const riskColor = getRiskColor(y);
          const dateText = format(new Date(x), 'dd MMM yyyy');

          let warning = '';
          if (y >= 180) {
            warning =
              '<p style="font-size:0.75rem;margin:0.25rem 0 0 0;color:#dc2626;">⚠️ Exceeds 180-day limit</p>';
          } else if (y >= 150) {
            warning =
              '<p style="font-size:0.75rem;margin:0.25rem 0 0 0;color:#d97706;">⚠️ Approaching limit</p>';
          }

          return `
            <div style="background:#ffffff;border:1px solid #cbd5f5;border-radius:0.5rem;padding:0.5rem;box-shadow:0 10px 15px -3px rgba(15,23,42,0.1);">
              <p style="font-size:0.75rem;font-weight:500;color:#334155;margin:0 0 0.125rem 0;">${dateText}</p>
              <p style="font-size:0.875rem;font-weight:600;color:${riskColor};margin:0;">
                Rolling 12-month: ${y} days
              </p>
              ${warning}
            </div>
          `;
        },
      },
      plotOptions: {
        series: {
          marker: {
            enabled: false,
          },
        },
        area: {
          fillColor,
          lineColor: '#3b82f6',
          lineWidth: 2,
        },
      },
      series: [
        {
          type: 'area',
          name: 'Rolling 12-month',
          data: seriesData,
        },
      ],
    };

    return options;
  }, [gradientStops, maxRollingValue, rollingAbsenceData]);

  const ganttOptions = useMemo<HCOptions | null>(() => {
    if (tripBars.length === 0 || rollingAbsenceData.length === 0) {
      return null;
    }

    const startRange = parseISO(rollingAbsenceData[0].date).getTime();
    const endRange = parseISO(
      rollingAbsenceData[rollingAbsenceData.length - 1].date
    ).getTime();

    const rawTrips: AssignedTrip[] = tripBars.map(
      (trip: TripBar, idx: number) => ({
        trip,
        index: idx,
        start: parseISO(trip.outDate).getTime(),
        end: parseISO(trip.inDate).getTime(),
        lane: 0,
      })
    );

    // sort by start date
    rawTrips.sort((a, b) => a.start - b.start);

    const lanes: AssignedTrip[][] = [];
    const assigned: AssignedTrip[] = [];

    // greedy lane allocation: first lane that doesn't overlap
    for (const t of rawTrips) {
      let placed = false;

      for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
        const lane = lanes[laneIndex];
        const last = lane[lane.length - 1];

        if (t.start >= last.end) {
          t.lane = laneIndex;
          lane.push(t);
          assigned.push(t);
          placed = true;
          break;
        }
      }

      if (!placed) {
        t.lane = lanes.length;
        lanes.push([t]);
        assigned.push(t);
      }
    }

    const laneCount = lanes.length;

    const seriesData: GanttPointOptions[] = assigned.map((t) => ({
      id: `trip-${t.index}`,
      name: t.trip.tripLabel,
      start: t.start,
      end: t.end,
      y: t.lane,
    }));

    const categories = Array.from(
      { length: laneCount },
      (_, i) => `Lane ${i + 1}`
    );

    const chartHeight = Math.max(80, 40 + laneCount * 26);

    const options: HCOptions = {
      chart: {
        height: chartHeight,
      },
      title: { text: '' },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: [
        {
          type: 'datetime',
          min: startRange,
          max: endRange,
          lineColor: '#e2e8f0',
          tickColor: '#e2e8f0',
          labels: {
            style: { color: '#64748b', fontSize: '10px' },
            formatter: (ctx) => {
              const value = ctx.value as number;
              return format(new Date(value), 'MMM yyyy');
            },
          },
        },
      ],
      yAxis: {
        type: 'category',
        categories,
        min: 0,
        max: laneCount - 1,
        grid: {
          borderWidth: 0,
          columns: [],
        },
        labels: {
          enabled: false,
        },
      },
      tooltip: {
        useHTML: true,
        pointFormatter: function (this: Highcharts.Point): string {
          const start = (this as any).start as number;
          const end = (this as any).end as number;
          const label = (this as any).name as string;

          const startText = format(new Date(start), 'dd/MM/yyyy');
          const endText = format(new Date(end), 'dd/MM/yyyy');

          return `
            <span style="font-size:11px;"><b>${label}</b></span><br/>
            <span style="font-size:11px;">${startText} - ${endText}</span>
          `;
        },
      },
      series: [
        {
          type: 'gantt',
          name: 'Trips',
          data: seriesData,
          borderColor: '#2563eb',
          color: '#bfdbfe',
          dataLabels: {
            enabled: true,
            style: {
              fontSize: '10px',
              color: '#1e3a8a',
              textOutline: 'none',
            },
          },
        },
      ],
    };

    return options;
  }, [tripBars, rollingAbsenceData]);

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
            />
            <span className="text-slate-600">Low Risk (≤149 days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#f59e0b' }}
            />
            <span className="text-slate-600">Caution (150-179 days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="text-slate-600">Critical (≥180 days)</span>
          </div>
        </div>
      </div>

      {/* Rolling Absence Area Chart */}
      <div className="mb-4">
        <HighchartsReact highcharts={Highcharts} options={areaChartOptions} />
      </div>

      {/* Trip Timeline (Gantt-style, single row until overlaps) */}
      {ganttOptions && tripBars.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Trip Timeline
          </h4>
          <div className="bg-slate-50 rounded border border-slate-200 p-2 overflow-x-auto">
            <HighchartsReact
              highcharts={Highcharts}
              constructorType="ganttChart"
              options={ganttOptions}
            />
          </div>
        </div>
      )}
    </div>
  );
});

RiskAreaChart.displayName = 'RiskAreaChart';
