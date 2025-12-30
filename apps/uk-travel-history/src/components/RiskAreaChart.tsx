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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  UIIcon,
} from '@uth/ui';
import { FeatureChart, useFeatureGate } from '@uth/widgets';
import { RollingDataPoint, TripBar } from '@uth/calculators';
import { travelStore } from '@uth/stores';
import { FEATURE_KEYS } from '@uth/features';
import { addDays, format } from 'date-fns';

type TimelinePoint = {
  id: string;
  name: string;
  start: number;
  end: number;
  y: number;
};

// Fixed fake placeholder data for premium preview (to avoid hydration errors)
const FAKE_PLACEHOLDER_DATA = {
  rollingData: [
    { date: '2020-01-01', rollingDays: 50, daysToExpire: 10, nextExpirationDate: '2020-01-31' },
    { date: '2020-03-01', rollingDays: 70, daysToExpire: 15, nextExpirationDate: '2020-03-31' },
    { date: '2020-05-01', rollingDays: 85, daysToExpire: 20, nextExpirationDate: '2020-05-31' },
    { date: '2020-07-01', rollingDays: 110, daysToExpire: 25, nextExpirationDate: '2020-07-31' },
    { date: '2020-09-01', rollingDays: 95, daysToExpire: 18, nextExpirationDate: '2020-09-30' },
    { date: '2020-11-01', rollingDays: 80, daysToExpire: 12, nextExpirationDate: '2020-11-30' },
    { date: '2021-01-01', rollingDays: 65, daysToExpire: 10, nextExpirationDate: '2021-01-31' },
    { date: '2021-03-01', rollingDays: 75, daysToExpire: 15, nextExpirationDate: '2021-03-31' },
    { date: '2021-05-01', rollingDays: 90, daysToExpire: 20, nextExpirationDate: '2021-05-31' },
    { date: '2021-07-01', rollingDays: 105, daysToExpire: 22, nextExpirationDate: '2021-07-31' },
    { date: '2021-09-01', rollingDays: 120, daysToExpire: 28, nextExpirationDate: '2021-09-30' },
    { date: '2021-11-01', rollingDays: 100, daysToExpire: 15, nextExpirationDate: '2021-11-30' },
    { date: '2022-01-01', rollingDays: 85, daysToExpire: 12, nextExpirationDate: '2022-01-31' },
    { date: '2022-03-01', rollingDays: 95, daysToExpire: 18, nextExpirationDate: '2022-03-31' },
    { date: '2022-05-01', rollingDays: 110, daysToExpire: 25, nextExpirationDate: '2022-05-31' },
    { date: '2022-07-01', rollingDays: 130, daysToExpire: 30, nextExpirationDate: '2022-07-31' },
    { date: '2022-09-01', rollingDays: 145, daysToExpire: 28, nextExpirationDate: '2022-09-30' },
    { date: '2022-11-01', rollingDays: 125, daysToExpire: 20, nextExpirationDate: '2022-11-30' },
    { date: '2023-01-01', rollingDays: 105, daysToExpire: 15, nextExpirationDate: '2023-01-31' },
    { date: '2023-03-01', rollingDays: 90, daysToExpire: 18, nextExpirationDate: '2023-03-31' },
    { date: '2023-05-01', rollingDays: 75, daysToExpire: 12, nextExpirationDate: '2023-05-31' },
    { date: '2023-07-01', rollingDays: 95, daysToExpire: 20, nextExpirationDate: '2023-07-31' },
    { date: '2023-09-01', rollingDays: 110, daysToExpire: 25, nextExpirationDate: '2023-09-30' },
    { date: '2023-11-01', rollingDays: 125, daysToExpire: 22, nextExpirationDate: '2023-11-30' },
    { date: '2024-01-01', rollingDays: 115, daysToExpire: 18, nextExpirationDate: '2024-01-31' },
    { date: '2024-03-01', rollingDays: 105, daysToExpire: 15, nextExpirationDate: '2024-03-31' },
    { date: '2024-05-01', rollingDays: 120, daysToExpire: 20, nextExpirationDate: '2024-05-31' },
    { date: '2024-07-01', rollingDays: 135, daysToExpire: 28, nextExpirationDate: '2024-07-31' },
    { date: '2024-09-01', rollingDays: 140, daysToExpire: 25, nextExpirationDate: '2024-09-30' },
    { date: '2024-11-01', rollingDays: 130, daysToExpire: 20, nextExpirationDate: '2024-11-30' },
  ] as RollingDataPoint[],
  trips: [
    {
      outDate: '2020-06-15',
      inDate: '2020-07-20',
      tripLabel: 'Trip 1',
      fullDaysOutside: 34,
    },
    {
      outDate: '2021-12-20',
      inDate: '2022-01-10',
      tripLabel: 'Trip 2',
      fullDaysOutside: 20,
    },
    {
      outDate: '2022-08-01',
      inDate: '2022-09-15',
      tripLabel: 'Trip 3',
      fullDaysOutside: 44,
    },
    {
      outDate: '2023-03-10',
      inDate: '2023-04-05',
      tripLabel: 'Trip 4',
      fullDaysOutside: 25,
    },
    {
      outDate: '2024-07-01',
      inDate: '2024-08-30',
      tripLabel: 'Trip 5',
      fullDaysOutside: 59,
    },
  ] as TripBar[],
};

export const RiskAreaChart: React.FC = observer(() => {
  const {
    rollingAbsenceData,
    tripBars,
    selectedTripDetails,
    effectiveApplicationDate,
    autoDateUsed,
  } = travelStore;

  const { hasAccess } = useFeatureGate(FEATURE_KEYS.RISK_CHART);
  const areaChartRef = useRef<HighchartsReactRefObject>(null);
  const ganttChartRef = useRef<HighchartsReactRefObject>(null);

  // Use fake data if no access, otherwise use real data
  const displayRollingData = hasAccess ? rollingAbsenceData : FAKE_PLACEHOLDER_DATA.rollingData;
  const displayTripBars = hasAccess ? tripBars : FAKE_PLACEHOLDER_DATA.trips;

  // -------- Shared x-domain (dates) -----------------------------------------

  const chartDomain = useMemo(() => {
    const ts: number[] = [];

    displayRollingData.forEach((d: RollingDataPoint) => {
      ts.push(parseISO(d.date).getTime());
    });

    displayTripBars.forEach((trip: TripBar) => {
      const s = parseISO(trip.outDate).getTime();
      const e = parseISO(trip.inDate).getTime();
      if (!Number.isNaN(s)) ts.push(s);
      if (!Number.isNaN(e)) ts.push(e);
    });

    const min = Math.min(...ts);
    const max = Math.max(...ts);

    return { min, max };
  }, [displayRollingData, displayTripBars]);

  // -------- Risk area chart data --------------------------------------------

  const riskSeriesData = useMemo<[number, number][]>(() => {
    // Filter data to only show up to the effective application date (if eligible with auto date)
    // This ensures the chart shows risk based on the calculated/auto application date
    const effectiveEndDate =
      effectiveApplicationDate && autoDateUsed && hasAccess
        ? parseISO(effectiveApplicationDate).getTime()
        : null;

    const filteredData = effectiveEndDate
      ? displayRollingData.filter(
          (d: RollingDataPoint) =>
            parseISO(d.date).getTime() <= effectiveEndDate,
        )
      : displayRollingData;

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
  }, [displayRollingData, effectiveApplicationDate, autoDateUsed, hasAccess]);

  const maxRolling = riskSeriesData.reduce((acc, [, y]) => Math.max(acc, y), 0);
  const yMax = Math.max(maxRolling, 180);

  // Find crossover points where the line crosses 180-day limit
  const crossoverPoints = useMemo(() => {
    const points: { x: number; type: 'breach' | 'recover' }[] = [];

    for (let i = 1; i < riskSeriesData.length; i++) {
      const [prevX, prevY] = riskSeriesData[i - 1];
      const [currX, currY] = riskSeriesData[i];

      // Crossing upward (breach)
      if (prevY < 180 && currY >= 180) {
        points.push({ x: currX, type: 'breach' });
      }
      // Crossing downward (recovery)
      else if (prevY >= 180 && currY < 180) {
        points.push({ x: currX, type: 'recover' });
      }
    }

    return points;
  }, [riskSeriesData]);

  // -------- Trip timeline data (single row until overlap) -------------------

  const timeline = useMemo<{
    points: TimelinePoint[];
    rowCount: number;
  }>(() => {
    if (!displayTripBars || displayTripBars.length === 0) {
      return { points: [], rowCount: 0 };
    }

    const parsed = displayTripBars
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
  }, [displayTripBars]);

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

          // Find the data point to get nextExpirationDate info
          const dataPoint = displayRollingData.find(
            (d: RollingDataPoint) => parseISO(d.date).getTime() === x,
          );

          let html =
            '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;box-shadow:0 4px 6px rgba(15,23,42,0.1);min-width:240px;">' +
            `<div style="font-size:12px;color:#475569;margin-bottom:4px;font-weight:500;">${dateLabel}</div>` +
            '<div style="border-bottom:1px solid #e2e8f0;margin-bottom:6px;"></div>';

          if (y >= 180) {
            // BREACH: At or above the limit
            const excessDays = y - 180;
            html +=
              `<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px;">&#9888; LIMIT BREACH</div>` +
              `<div style="font-size:12px;color:#1e293b;margin-bottom:3px;"><strong>Current Absences:</strong> ${y} days</div>` +
              `<div style="font-size:12px;color:#dc2626;margin-bottom:6px;"><strong>Over Limit By:</strong> ${excessDays} day${excessDays !== 1 ? 's' : ''}</div>`;

            // Find when it will drop below 180
            const currentIndex = riskSeriesData.findIndex(
              ([timestamp]) => timestamp === x,
            );
            if (currentIndex !== -1) {
              let nextDropIndex = -1;
              for (let i = currentIndex + 1; i < riskSeriesData.length; i++) {
                if (riskSeriesData[i][1] < 180) {
                  nextDropIndex = i;
                  break;
                }
              }

              if (nextDropIndex !== -1) {
                const nextDropDate = riskSeriesData[nextDropIndex][0];
                const nextDropDateLabel = Highcharts.dateFormat(
                  '%e %b %Y',
                  nextDropDate,
                );
                const daysAfterDrop = 180 - riskSeriesData[nextDropIndex][1];

                html +=
                  '<div style="border-top:1px solid #fee2e2;margin:6px 0;"></div>' +
                  `<div style="font-size:11px;color:#475569;margin-bottom:2px;">Recovery Date:</div>` +
                  `<div style="font-size:12px;color:#059669;font-weight:600;margin-bottom:4px;">${nextDropDateLabel}</div>` +
                  `<div style="font-size:11px;color:#475569;">Available After Recovery: ${daysAfterDrop} days</div>`;
              } else if (y === 180) {
                html +=
                  '<div style="font-size:11px;color:#dc2626;margin-top:4px;">No additional absences allowed</div>';
              }
            }
          } else {
            // COMPLIANT: Below the limit
            const availableQuota = 180 - y;
            const quotaPercent = Math.round((y / 180) * 100);

            html +=
              `<div style="font-size:13px;font-weight:700;color:#059669;margin-bottom:6px;">✓ Compliant</div>` +
              `<div style="font-size:12px;color:#1e293b;margin-bottom:3px;"><strong>Current Absences:</strong> ${y} days (${quotaPercent}% used)</div>` +
              `<div style="font-size:12px;color:#059669;margin-bottom:6px;"><strong>Available Quota:</strong> ${availableQuota} days</div>`;

            if (dataPoint?.nextExpirationDate && dataPoint.daysToExpire) {
              const expirationDateLabel = Highcharts.dateFormat(
                '%e %b %Y',
                parseISO(dataPoint.nextExpirationDate).getTime(),
              );
              const futureQuota = availableQuota + dataPoint.daysToExpire;

              html +=
                '<div style="border-top:1px solid #d1fae5;margin:6px 0;"></div>' +
                `<div style="font-size:11px;color:#475569;margin-bottom:2px;">Next Quota Increase:</div>` +
                `<div style="font-size:12px;color:#1e293b;font-weight:600;margin-bottom:2px;">${expirationDateLabel}</div>` +
                `<div style="font-size:11px;color:#475569;margin-bottom:2px;">Oldest trip expires, freeing <strong>${dataPoint.daysToExpire} days</strong></div>` +
                `<div style="font-size:11px;color:#059669;"><strong>Total After:</strong> ${futureQuota} days available</div>`;
            }
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
        // Crossover markers
        {
          type: 'scatter',
          name: 'Limit Crossings',
          data: crossoverPoints.map((p) => ({
            x: p.x,
            y: 180,
            marker: {
              symbol:
                p.type === 'breach'
                  ? 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNyIgZmlsbD0iI2VmNDQ0NCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNSA1TDExIDExTTExIDVMNSAxMSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==)'
                  : 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNyIgZmlsbD0iIzA1OTY2OSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNSA4TDcgMTBMMTEgNiIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==)',
              width: 16,
              height: 16,
            },
            name: p.type === 'breach' ? 'Limit Breached' : 'Limit Recovered',
            custom: {
              type: p.type,
            },
          })),
          marker: {
            enabled: true,
          },
          enableMouseTracking: true,
          showInLegend: false,
          tooltip: {
            pointFormatter: function (this: any) {
              const dateLabel = Highcharts.dateFormat('%e %b %Y', this.x);
              const isBreach = this.custom?.type === 'breach';
              return (
                '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;box-shadow:0 4px 6px rgba(15,23,42,0.1);">' +
                `<div style="font-size:12px;color:#475569;margin-bottom:4px;font-weight:500;">${dateLabel}</div>` +
                '<div style="border-bottom:1px solid #e2e8f0;margin-bottom:6px;"></div>' +
                (isBreach
                  ? '<div style="font-size:13px;font-weight:700;color:#dc2626;">&#9888; 180-Day Limit Breached</div>' +
                    '<div style="font-size:11px;color:#475569;margin-top:4px;">Absences exceeded 180 days on this date</div>'
                  : '<div style="font-size:13px;font-weight:700;color:#059669;">✓ Limit Recovered</div>' +
                    '<div style="font-size:11px;color:#475569;margin-top:4px;">Absences dropped below 180 days on this date</div>') +
                '</div>'
              );
            },
          },
        },
      ],
    }),
    [
      chartDomain.min,
      chartDomain.max,
      riskSeriesData,
      yMax,
      syncExtremes,
      crossoverPoints,
      displayRollingData,
    ],
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

  // Chart header component (always visible)
  const ChartHeader = () => (
    <CardHeader className="pb-2">
      <CardTitle className="text-base flex items-center gap-2">
        <UIIcon
          iconName="line-chart"
          className="w-4 h-4 text-muted-foreground"
        />
        180-Day Rolling Absence Risk Timeline
      </CardTitle>
    </CardHeader>
  );

  // Chart legend component (always visible)
  const ChartLegend = () => (
    <div className="mb-3">
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
        {crossoverPoints.length > 0 && (
          <>
            <div className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <path
                  d="M5 5L11 11M11 5L5 11"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-slate-600">Limit Breached</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <path
                  d="M5 8L7 10L11 6"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-slate-600">Limit Recovered</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Show empty state only if user has access but no real data
  if (hasAccess && (!rollingAbsenceData || rollingAbsenceData.length === 0)) {
    return (
      <Card className="bg-white mb-3">
        <ChartHeader />
        <CardContent>
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">
              Set a Vignette Entry Date or Visa Start Date to view the risk
              timeline.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no access, we'll show fake data which will be blurred by FeatureChart

  return (
    <Card className="bg-white mb-3">
      <ChartHeader />
      <CardContent>
        <ChartLegend />

        <FeatureChart feature={FEATURE_KEYS.RISK_CHART}>
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
        </FeatureChart>

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
      </CardContent>
    </Card>
  );
});

RiskAreaChart.displayName = 'RiskAreaChart';
