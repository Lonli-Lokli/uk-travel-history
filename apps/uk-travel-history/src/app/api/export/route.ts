import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';
import { format, parseISO } from 'date-fns';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface TripData {
  id: string;
  outDate: string;
  inDate: string;
  outRoute: string;
  inRoute: string;
  calendarDays: number | null;
  fullDays: number | null;
  isIncomplete: boolean;
}

interface ExportData {
  trips: TripData[];
  vignetteEntryDate?: string;
  visaStartDate?: string;
  ilrTrack?: number | null;
  summary?: {
    totalTrips: number;
    completeTrips: number;
    incompleteTrips: number;
    totalFullDays: number;
    continuousLeaveDays: number | null;
    maxAbsenceInAny12Months: number | null;
    hasExceeded180Days: boolean;
    ilrEligibilityDate: string | null;
    daysUntilEligible: number | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tripsDataStr = formData.get('tripsData') as string;
    const exportMode = (formData.get('exportMode') as string) || 'ilr';

    if (!tripsDataStr) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const data: ExportData = JSON.parse(tripsDataStr);
    const trips = data.trips || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'UK Travel Parser';
    // No need to set created date - ExcelJS handles this

    // If full mode, export as JSON in a single cell for easy re-import
    if (exportMode === 'full') {
      const sheet = workbook.addWorksheet('Full Data Export', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      });

      // Add metadata row
      sheet.addRow(['UK Travel History - Full Data Export']);
      sheet.addRow(['Export Date', new Date().toISOString()]);
      sheet.addRow(['Export Version', '1.0']);
      sheet.addRow([]);

      // Add visa details
      sheet.addRow(['Visa Details']);
      sheet.addRow(['Vignette Entry Date', data.vignetteEntryDate || '']);
      sheet.addRow(['Visa Start Date', data.visaStartDate || '']);
      sheet.addRow(['ILR Track', data.ilrTrack || '']);
      sheet.addRow([]);

      // Add summary statistics if available
      if (data.summary) {
        sheet.addRow(['Summary Statistics']);
        sheet.addRow(['Total Trips', data.summary.totalTrips]);
        sheet.addRow(['Complete Trips', data.summary.completeTrips]);
        sheet.addRow(['Incomplete Trips', data.summary.incompleteTrips]);
        sheet.addRow(['Total Full Days Outside UK', data.summary.totalFullDays]);
        sheet.addRow([
          'Continuous Leave Days',
          data.summary.continuousLeaveDays || 'N/A',
        ]);
        sheet.addRow([
          'Max Absence (12 months)',
          data.summary.maxAbsenceInAny12Months || 'N/A',
        ]);
        sheet.addRow([
          'Exceeded 180 Days',
          data.summary.hasExceeded180Days ? 'Yes' : 'No',
        ]);
        sheet.addRow([
          'ILR Eligibility Date',
          data.summary.ilrEligibilityDate || 'N/A',
        ]);
        sheet.addRow([
          'Days Until Eligible',
          data.summary.daysUntilEligible ?? 'N/A',
        ]);
        sheet.addRow([]);
      }

      // Add trips table
      sheet.addRow(['Travel History']);
      const tripsSheet = sheet;
      const headerRowIndex = sheet.rowCount + 1;

      tripsSheet.columns = [
        { header: '#', key: 'num', width: 8 },
        { header: 'Date Out', key: 'outDate', width: 16 },
        { header: 'Date In', key: 'inDate', width: 16 },
        { header: 'Departure', key: 'outRoute', width: 35 },
        { header: 'Return', key: 'inRoute', width: 35 },
        { header: 'Calendar Days', key: 'calendarDays', width: 14 },
        { header: 'Full Days', key: 'fullDays', width: 12 },
      ];

      const headerRow = tripsSheet.getRow(headerRowIndex);
      headerRow.values = ['#', 'Date Out', 'Date In', 'Departure', 'Return', 'Calendar Days', 'Full Days'];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 26;

      trips.forEach((trip, index) => {
        const formatDate = (dateStr: string): string => {
          if (!dateStr) return '';
          try {
            const date = parseISO(dateStr);
            return format(date, 'dd/MM/yyyy');
          } catch {
            return '';
          }
        };

        const row = tripsSheet.addRow({
          num: index + 1,
          outDate: formatDate(trip.outDate),
          inDate: formatDate(trip.inDate),
          outRoute: trip.outRoute || '',
          inRoute: trip.inRoute || '',
          calendarDays: trip.calendarDays ?? '',
          fullDays: trip.fullDays ?? '',
        });

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { vertical: 'middle' };
        row.getCell(5).alignment = { vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = 20;

        if (trip.isIncomplete) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF4C4' },
            };
            cell.font = { italic: true, color: { argb: 'FF9C6500' } };
          });
        }
      });

      // Add JSON data sheet for re-import
      const jsonSheet = workbook.addWorksheet('Import Data (JSON)');
      jsonSheet.addRow(['DO NOT EDIT THIS SHEET - Used for re-importing data']);
      jsonSheet.addRow([]);
      jsonSheet.addRow(['Full Data JSON:']);

      // Store complete data as JSON
      const fullDataJson = JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        vignetteEntryDate: data.vignetteEntryDate || '',
        visaStartDate: data.visaStartDate || '',
        ilrTrack: data.ilrTrack || 5,
        trips: trips.map(trip => ({
          outDate: trip.outDate,
          inDate: trip.inDate,
          outRoute: trip.outRoute || '',
          inRoute: trip.inRoute || '',
        })),
      }, null, 2);

      jsonSheet.getCell('A4').value = fullDataJson;
      jsonSheet.getCell('A4').alignment = { wrapText: true, vertical: 'top' };
      jsonSheet.getColumn(1).width = 100;

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="UK_Travel_History_Full.xlsx"',
        },
      });
    }

    // ILR mode - original minimal export
    const sheet = workbook.addWorksheet('Travel History', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    sheet.columns = [
      { header: '#', key: 'num', width: 8 },
      { header: 'Date Out', key: 'outDate', width: 16 },
      { header: 'Date In', key: 'inDate', width: 16 },
      { header: 'Departure', key: 'outRoute', width: 35 },
      { header: 'Return', key: 'inRoute', width: 35 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 26;

    trips.forEach((trip, index) => {
      /**
       * Format ISO date string to DD/MM/YYYY for Excel display
       * Uses date-fns to avoid timezone issues
       */
      const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
          const date = parseISO(dateStr);
          return format(date, 'dd/MM/yyyy');
        } catch {
          return '';
        }
      };

      const row = sheet.addRow({
        num: index + 1,
        outDate: formatDate(trip.outDate),
        inDate: formatDate(trip.inDate),
        outRoute: trip.outRoute || '',
        inRoute: trip.inRoute || '',
      });

      row.getCell('num').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('outDate').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('inDate').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('outRoute').alignment = { vertical: 'middle' };
      row.getCell('inRoute').alignment = { vertical: 'middle' };
      row.height = 20;

      if (trip.isIncomplete) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF4C4' },
          };
          cell.font = { italic: true, color: { argb: 'FF9C6500' } };
        });
      }
    });

    // Apply borders to all data cells
    const lastDataRow = trips.length + 1;
    for (let row = 1; row <= lastDataRow; row++) {
      for (let col = 1; col <= 5; col++) {
        const cell = sheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="UK_Travel_History.xlsx"',
      },
    });
  } catch (error) {
    logger.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    );
  }
}
