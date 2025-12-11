import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';

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

    if (!tripsDataStr) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const data: ExportData = JSON.parse(tripsDataStr);
    const trips = data.trips || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'UK Travel Parser';
    workbook.created = new Date();

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
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-GB');
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
