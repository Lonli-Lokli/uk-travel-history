'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import Highcharts from 'highcharts/highcharts-gantt';
import HighchartsReact, {
  HighchartsReactRefObject,
} from 'highcharts-react-official';
import type { AxisSetExtremesEventObject } from 'highcharts';
import { parseISO } from 'date-fns';

import { travelStore, RollingDataPoint, TripBar } from '@uth/ui';

const getRiskColor = (days: number): string => {
  if (days >= 180) return '#ef4444'; // red-500
  if (days >= 150) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

type TimelinePoint = {
  id: string;
  name: string;
  start: number;
  end: number;
  y: number;
};

export const RiskAreaChart: React.FC = observer(() => {
  const { rollingAbsenceData, tripBars } = travelStore;

  const areaChartRef = useRef<HighchartsReactRefObject>(null);
  const ganttChartRef = useRef<HighchartsReactRefObject>(null);

  // -------- Shared x-domain (dates) -----------------------------------------

  const chartDomain = useMemo(() => {
    const ts: number[] = [];

    rollingAbsenceData.forEach((d: RollingDataPoint) => {
      ts.push(parseISO(d.date).getTime());
    });

    tripBars.forEach((trip: TripBar) => {
      const s = parseISO(trip.outDate).getTime();
      const e = parseISO(trip.inDate).getTime();
      if (!Number.isNaN(s)) ts.push(s);
      if (!Number.isNaN(e)) ts.push(e);
    });

    const min = Math.min(...ts);
    const max = Math.max(...ts);

    return { min, max };
  }, [rollingAbsenceData, tripBars]);

  // -------- Risk area chart data --------------------------------------------

  const riskSeriesData = useMemo<[number, number][]>(() => {
    return rollingAbsenceData.map((d: RollingDataPoint) => [
      parseISO(d.date).getTime(),
      d.rollingDays,
    ]);
  }, [rollingAbsenceData]);

  const maxRolling = riskSeriesData.reduce((acc, [, y]) => Math.max(acc, y), 0);
  const yMax = Math.max(maxRolling, 180);

  // -------- Trip timeline data (single row until overlap) -------------------

  const timeline = useMemo<{
    points: TimelinePoint[];
    rowCount: number;
  }>(() => {
    if (!tripBars || tripBars.length === 0) {
      return { points: [], rowCount: 0 };
    }

    const parsed = tripBars
      .map((trip: TripBar, index: number) => {
        const start = parseISO(trip.outDate).getTime();
        const end = parseISO(trip.inDate).getTime();
        return { trip, start, end, index };
      })
      .filter((t) => !Number.isNaN(t.start) && !Number.isNaN(t.end))
      .sort((a, b) => a.start - b.start);

    const trackEndTimes: number[] = [];
    const points: TimelinePoint[] = [];

    parsed.forEach(({ trip, start, end, index }) => {
      let track = 0;

      // “Single row until overlap”: reuse an existing track if the new trip
      // starts strictly after the last trip on that track ends.
      for (; track < trackEndTimes.length; track++) {
        if (start > trackEndTimes[track]) break;
      }

      if (track === trackEndTimes.length) {
        trackEndTimes.push(end);
      } else {
        trackEndTimes[track] = end;
      }

      points.push({
        id: `trip-${index}`,
        name: trip.tripLabel,
        start,
        end,
        y: track,
      });
    });

    return { points, rowCount: trackEndTimes.length };
  }, [tripBars]);

  // -------- Axis sync between area & gantt ----------------------------------

  const syncExtremes = useCallback(
    (source: 'area' | 'gantt', e: AxisSetExtremesEventObject) => {
      if (typeof e.min !== 'number' || typeof e.max !== 'number') return;
      if (e.trigger === 'sync') return;

      const targetRef =
        source === 'area' ? ganttChartRef.current : areaChartRef.current;

      const targetChart = targetRef?.chart;
      if (!targetChart) return;

      const targetAxis = targetChart.xAxis[0];
      targetAxis.setExtremes(e.min, e.max, undefined, undefined, {
        trigger: 'sync',
      });
    },
    []
  );

  // -------- Highcharts options: risk area chart -----------------------------

  const riskAreaOptions: Highcharts.Options = useMemo(
    () => ({
      chart: {
        type: 'area',
        height: 260,
        zoomType: 'x',
        spacingTop: 8,
        spacingBottom: 8,
      },
      title: { text: '' },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: 'datetime',
        min: chartDomain.min,
        max: chartDomain.max,
        labels: {
          style: { fontSize: '11px', color: '#64748b' },
        },
        events: {
          setExtremes: function (e) {
            syncExtremes('area', e as AxisSetExtremesEventObject);
          },
        },
      },
      yAxis: {
        title: {
          text: 'Days Absent',
          style: { fontSize: '11px' },
        },
        min: 0,
        max: yMax + 10,
        labels: {
          style: { fontSize: '11px', color: '#64748b' },
        },
        plotLines: [
          {
            value: 180,
            color: '#ef4444',
            dashStyle: 'Dash',
            width: 2,
            zIndex: 3,
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
        ],
      },
      tooltip: {
        useHTML: true,
        shared: false,
        formatter: function (this: any) {
          const x: number = typeof this.x === 'number' ? this.x : 0;
          const y: number = typeof this.y === 'number' ? this.y : 0;

          const dateLabel = x > 0 ? Highcharts.dateFormat('%e %b %Y', x) : '';
          const riskColor = getRiskColor(y);

          let html =
            '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;box-shadow:0 2px 4px rgba(15,23,42,0.08);">' +
            `<div style="font-size:11px;color:#475569;margin-bottom:2px;">${dateLabel}</div>` +
            `<div style="font-size:13px;font-weight:600;color:${riskColor};">Rolling 12-month: ${y} days</div>`;

          if (y >= 180) {
            html +=
              '<div style="font-size:11px;color:#dc2626;margin-top:4px;">&#9888; Exceeds 180-day limit</div>';
          } else if (y >= 150) {
            html +=
              '<div style="font-size:11px;color:#d97706;margin-top:4px;">&#9888; Approaching limit</div>';
          }

          html += '</div>';
          return html;
        },
      },
      plotOptions: {
        series: {
          animation: false,
          marker: { enabled: false },
        },
        area: {
          fillOpacity: 0.3,
        },
      },
      series: [
        {
          type: 'area',
          name: 'Rolling days absent',
          data: riskSeriesData,
          color: '#22c55e', // base color; zones override
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, 'rgba(34,197,94,0.35)'],
              [1, 'rgba(34,197,94,0.05)'],
            ],
          },
          zones: [
            { value: 150, color: '#22c55e' }, // green
            { value: 180, color: '#f59e0b' }, // amber
            { color: '#ef4444' }, // red
          ],
        },
      ],
    }),
    [chartDomain.min, chartDomain.max, riskSeriesData, yMax, syncExtremes]
  );

  // -------- Highcharts options: trip Gantt timeline -------------------------

  const ganttOptions = useMemo(
    () =>
      ({
        chart: {
          height:
            timeline.rowCount > 0
              ? Math.max(80, 24 * timeline.rowCount + 40)
              : 80,
          zooming: { type: 'x' },
          spacingTop: 4,
          spacingBottom: 4,
          spacingLeft: 0,
          spacingRight: 8,
        },
        title: { text: '' },
        credits: { enabled: false },
        legend: { enabled: false },

        // Minimal x-axis: no header grid, no labels (area chart already shows them)
        xAxis: {
          type: 'datetime',
          min: chartDomain.min,
          max: chartDomain.max,
          labels: { enabled: false },
          gridLineWidth: 0,
          minorGridLineWidth: 0,
          events: {
            setExtremes: function (e) {
              syncExtremes('gantt', e as AxisSetExtremesEventObject);
            },
          },
          // Disable Gantt's default "big boxes" header
          grid: {
            enabled: false,
            borderWidth: 0,
            columns: [],
          },
        },

        // Hide Y-axis labels entirely; we just want rows as lanes.
        yAxis: {
          type: 'category',
          categories:
            timeline.rowCount > 0
              ? Array.from({ length: timeline.rowCount }, () => '')
              : [],
          min: 0,
          max: Math.max(timeline.rowCount - 1, 0),
          grid: { enabled: false },
          labels: { enabled: false },
          title: { text: '' },
        },

        // Navigator + scrollbar for explicit zoom & pan.
        navigator: {
          enabled: true,
          height: 18,
          outlineWidth: 0,
          handles: { enabled: true },
          xAxis: {
            labels: { enabled: false }, // avoid duplicate labels
          },
        },
        scrollbar: {
          enabled: true,
        },

        tooltip: {
          useHTML: true,
          formatter: function (this: any) {
            const point = this.point || {};
            const start = typeof point.start === 'number' ? point.start : 0;
            const end = typeof point.end === 'number' ? point.end : 0;
            const name: string = point.name || '';

            if (!start || !end) return '';

            const startStr = Highcharts.dateFormat('%e %b %Y', start);
            const endStr = Highcharts.dateFormat('%e %b %Y', end);

            return (
              '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;box-shadow:0 2px 4px rgba(15,23,42,0.08);">' +
              `<div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:2px;">${name}</div>` +
              `<div style="font-size:11px;color:#475569;">${startStr} – ${endStr}</div>` +
              '</div>'
            );
          },
        },

        series: [
          {
            type: 'gantt',
            name: 'Trips',
            data: timeline.points,
            borderColor: '#2563eb',
            borderWidth: 0,
            color: '#3b82f6',
            dataLabels: {
              enabled: false, // keep strip clean
            },
            states: {
              hover: {
                borderWidth: 0,
                brightness: 0.15,
              },
            },
            pointPadding: 0.25, // makes bars visually thicker
          },
        ],
      } satisfies Highcharts.Options),
    [
      chartDomain.min,
      chartDomain.max,
      timeline.points,
      timeline.rowCount,
      syncExtremes,
    ]
  );

  // -------- Render ----------------------------------------------------------

  if (!rollingAbsenceData || rollingAbsenceData.length === 0) {
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
            <span className="text-slate-600">Caution (150–179 days)</span>
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

      {/* Risk area chart */}
      <div className="mb-4">
        <HighchartsReact
          ref={areaChartRef}
          highcharts={Highcharts}
          options={riskAreaOptions}
        />
      </div>

      {/* Trip timeline (Gantt) */}
      {timeline.points.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Trip Timeline
          </h4>
          <div className="bg-slate-50 rounded border border-slate-200 p-2">
            <HighchartsReact
              ref={ganttChartRef}
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
