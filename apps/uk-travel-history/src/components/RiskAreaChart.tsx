'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import Highcharts from 'highcharts/highcharts-gantt';
import HighchartsReact, {
  HighchartsReactRefObject,
} from 'highcharts-react-official';
import type { AxisSetExtremesEventObject } from 'highcharts';
import { parseISO } from 'date-fns';

import {
  travelStore,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@uth/ui';
import { RollingDataPoint, TripBar } from '@uth/calculators';

type TimelinePoint = {
  id: string;
  name: string;
  start: number;
  end: number;
  y: number;
};

export const RiskAreaChart: React.FC = observer(() => {
  const {
    rollingAbsenceData,
    tripBars,
    selectedTripDetails,
    effectiveApplicationDate,
    autoDateUsed,
  } = travelStore;

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
    // Filter data to only show up to the effective application date (if eligible with auto date)
    // This ensures the chart shows risk based on the calculated/auto application date
    const effectiveEndDate =
      effectiveApplicationDate && autoDateUsed
        ? parseISO(effectiveApplicationDate).getTime()
        : null;

    const filteredData = effectiveEndDate
      ? rollingAbsenceData.filter(
          (d: RollingDataPoint) => parseISO(d.date).getTime() <= effectiveEndDate
        )
      : rollingAbsenceData;

    // Cap risk at 180 days - if eligible with future date, risk cannot exceed 180
    // (otherwise the calculated date would have been pushed further out)
    return filteredData.map((d: RollingDataPoint) => {
      const timestamp = parseISO(d.date).getTime();
      const rollingDays =
        effectiveApplicationDate && autoDateUsed
          ? Math.min(d.rollingDays, 180)
          : d.rollingDays;

      return [timestamp, rollingDays];
    });
  }, [rollingAbsenceData, effectiveApplicationDate, autoDateUsed]);

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
    [],
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
          const displayColor = y >= 180 ? '#ef4444' : '#3b82f6';

          // Find the data point to get nextExpirationDate info
          const dataPoint = rollingAbsenceData.find((d: RollingDataPoint) =>
            parseISO(d.date).getTime() === x
          );

          let html =
            '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;box-shadow:0 2px 4px rgba(15,23,42,0.08);">' +
            `<div style="font-size:11px;color:#475569;margin-bottom:2px;">${dateLabel}</div>` +
            `<div style="font-size:13px;font-weight:600;color:${displayColor};">Rolling 12-month: ${y} days</div>`;

          if (y >= 180) {
            // At or above the limit - find when it will drop below 180
            const currentIndex = riskSeriesData.findIndex(([timestamp]) => timestamp === x);
            if (currentIndex !== -1) {
              // Look ahead to find when rolling days drop below 180
              let nextDropIndex = -1;
              for (let i = currentIndex + 1; i < riskSeriesData.length; i++) {
                if (riskSeriesData[i][1] < 180) {
                  nextDropIndex = i;
                  break;
                }
              }

              if (nextDropIndex !== -1) {
                const nextDropDate = riskSeriesData[nextDropIndex][0];
                const nextDropDateLabel = Highcharts.dateFormat('%e %b %Y', nextDropDate);
                const remainingDays = 180 - riskSeriesData[nextDropIndex][1];

                html +=
                  '<div style="font-size:11px;color:#dc2626;margin-top:4px;">&#9888; At/above 180-day limit</div>' +
                  `<div style="font-size:11px;color:#dc2626;margin-top:2px;"><strong>Limit expires: ${nextDropDateLabel}</strong></div>` +
                  `<div style="font-size:11px;color:#475569;">Available margin after: ${remainingDays} days</div>`;
              } else if (y === 180) {
                html +=
                  '<div style="font-size:11px;color:#dc2626;margin-top:4px;">&#9888; At 180-day limit</div>' +
                  '<div style="font-size:11px;color:#475569;margin-top:2px;">No additional absences allowed</div>';
              } else {
                html +=
                  '<div style="font-size:11px;color:#dc2626;margin-top:4px;">&#9888; Exceeds 180-day limit</div>';
              }
            }
          } else if (y < 180 && dataPoint?.nextExpirationDate && dataPoint.daysToExpire) {
            // Feature 1: Show future quota information for compliant dates
            const availableLimit = 180 - y;
            const expirationDateLabel = Highcharts.dateFormat('%e %b %Y', parseISO(dataPoint.nextExpirationDate).getTime());

            html +=
              `<div style="font-size:11px;color:#059669;margin-top:4px;">Available Limit: ${availableLimit} days</div>` +
              `<div style="font-size:11px;color:#475569;margin-top:2px;">Oldest Trip Expires: ${expirationDateLabel}</div>` +
              `<div style="font-size:11px;color:#475569;">+${dataPoint.daysToExpire} days available</div>`;
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
          color: '#3b82f6', // base color: blue
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, 'rgba(59,130,246,0.35)'],
              [1, 'rgba(59,130,246,0.05)'],
            ],
          },
          zones: [
            { value: 180, color: '#3b82f6' }, // blue
            { color: '#ef4444' }, // red for exceeding 180 days
          ],
        },
      ],
    }),
    [chartDomain.min, chartDomain.max, riskSeriesData, yMax, syncExtremes],
  );

  // -------- Highcharts options: trip Gantt timeline -------------------------

  const ganttOptions = useMemo(
    () =>
      ({
        chart: {
          height:
            timeline.rowCount > 0
              ? Math.max(120, 50 * timeline.rowCount + 70)
              : 120,
          zooming: { type: 'x' },
          spacingTop: 30,
          spacingBottom: 4,
          spacingLeft: 0,
          spacingRight: 8,
          marginTop: 0,
        },
        title: { text: '' },
        credits: { enabled: false },
        legend: { enabled: false },

        // Minimal x-axis: no header grid, no labels (area chart already shows them)
        xAxis: [
          {
            type: 'datetime',
            min: chartDomain.min,
            max: chartDomain.max,
            labels: { enabled: false },
            gridLineWidth: 0,
            minorGridLineWidth: 0,
            // Completely disable date time label formatting to remove year headers
            dateTimeLabelFormats: {
              millisecond: '',
              second: '',
              minute: '',
              hour: '',
              day: '',
              week: '',
              month: '',
              year: '',
            },
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
          { visible: false },
        ],

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

        // Navigator + scrollbar for explicit zoom & pan (positioned at top).
        navigator: {
          enabled: true,
          height: 20,
          outlineWidth: 1,
          outlineColor: '#cbd5e1',
          handles: {
            enabled: true,
            backgroundColor: '#f1f5f9',
            borderColor: '#64748b',
          },
          maskFill: 'rgba(100, 116, 139, 0.1)',
          series: {
            color: '#64748b',
            lineWidth: 1,
          },
          opposite: true, // Position at top
          xAxis: {
            labels: { enabled: false },
          },
        },
        scrollbar: {
          enabled: false, // Disable scrollbar when navigator is at top for cleaner look
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
            cursor: 'pointer',
            pointPadding: 0.05, // minimal padding = thicker bars for mobile
            point: {
              events: {
                click: function () {
                  // Show trip details on click - delegate to MobX store
                  const point = this as any;
                  travelStore.selectTrip(point.name, point.start, point.end);
                },
              },
            },
          },
        ],
      }) satisfies Highcharts.Options,
    [
      chartDomain.min,
      chartDomain.max,
      timeline.points,
      timeline.rowCount,
      syncExtremes,
    ],
  );

  // -------- Render ----------------------------------------------------------

  if (!rollingAbsenceData || rollingAbsenceData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-3">
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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-slate-800 mb-2">
          180-Day Rolling Absence Risk Timeline
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#3b82f6' }}
            />
            <span className="text-slate-600">Days Absent (&lt;180)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="text-slate-600">Exceeded Limit (≥180 days)</span>
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

      {/* Trip Details Dialog */}
      <Dialog
        open={!!selectedTripDetails}
        onOpenChange={(open) => {
          if (!open) {
            travelStore.clearSelectedTrip();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTripDetails?.name || 'Trip Details'}
            </DialogTitle>
            <DialogDescription asChild>
              {selectedTripDetails ? (
                <div className="mt-2 text-sm">
                  <p>
                    <strong>Departure:</strong> {selectedTripDetails.start}
                  </p>
                  <p>
                    <strong>Return:</strong> {selectedTripDetails.end}
                  </p>
                </div>
              ) : (
                <span />
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
});

RiskAreaChart.displayName = 'RiskAreaChart';
