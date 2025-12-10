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
  summary?: {
    totalTrips: number;
    completeTrips: number;
    incompleteTrips: number;
    totalFullDays: number;
    continuousLeaveDays: number | null;
    maxAbsenceInAny12Months: number | null;
    hasExceeded180Days: boolean;
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
      { header: '#', key: 'num', width: 6 },
      { header: 'Date Out', key: 'outDate', width: 14 },
      { header: 'Date In', key: 'inDate', width: 14 },
      { header: 'Departure Route', key: 'outRoute', width: 28 },
      { header: 'Return Route', key: 'inRoute', width: 28 },
      { header: 'Calendar Days', key: 'calendarDays', width: 14 },
      { header: 'Full Days Outside UK', key: 'fullDays', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    let totalFullDays = 0;

    trips.forEach((trip, index) => {
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-GB');
      };

      const row = sheet.addRow({
        num: index + 1,
        outDate: formatDate(trip.outDate),
        inDate: formatDate(trip.inDate),
        outRoute: trip.outRoute || '—',
        inRoute: trip.inRoute || '—',
        calendarDays: trip.calendarDays ?? '—',
        fullDays: trip.fullDays ?? '—',
      });

      row.getCell('num').alignment = { horizontal: 'center' };
      row.getCell('outDate').alignment = { horizontal: 'center' };
      row.getCell('inDate').alignment = { horizontal: 'center' };
      row.getCell('calendarDays').alignment = { horizontal: 'center' };
      row.getCell('fullDays').alignment = { horizontal: 'center' };

      if (trip.isIncomplete) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' },
          };
        });
      }

      if (trip.fullDays !== null) {
        totalFullDays += trip.fullDays;
      }
    });

    const lastDataRow = trips.length + 1;
    for (let row = 1; row <= lastDataRow; row++) {
      for (let col = 1; col <= 7; col++) {
        const cell = sheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
      }
    }

    // Add summary section
    sheet.addRow([]);
    sheet.addRow([]);

    // Visa/Vignette Information
    if (data.vignetteEntryDate || data.visaStartDate) {
      const infoHeaderRow = sheet.addRow(['VISA & VIGNETTE INFORMATION']);
      infoHeaderRow.getCell(1).font = { bold: true, size: 12 };
      infoHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' },
      };

      if (data.vignetteEntryDate) {
        const vignetteRow = sheet.addRow([
          'Vignette Entry Date:',
          new Date(data.vignetteEntryDate).toLocaleDateString('en-GB'),
        ]);
        vignetteRow.getCell(1).font = { bold: true };
      }

      if (data.visaStartDate) {
        const visaRow = sheet.addRow([
          'Visa Start Date:',
          new Date(data.visaStartDate).toLocaleDateString('en-GB'),
        ]);
        visaRow.getCell(1).font = { bold: true };
      }

      sheet.addRow([]);
    }

    // Summary Statistics
    const summaryHeaderRow = sheet.addRow(['SUMMARY']);
    summaryHeaderRow.getCell(1).font = { bold: true, size: 12 };
    summaryHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' },
    };

    const totalRow = sheet.addRow(['Total Full Days Outside UK:', totalFullDays]);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(2).font = { bold: true, size: 14 };
    totalRow.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' },
    };
    totalRow.getCell(2).alignment = { horizontal: 'center' };

    if (data.summary?.continuousLeaveDays !== null && data.summary?.continuousLeaveDays !== undefined) {
      const continuousRow = sheet.addRow([
        'Days in UK (Continuous Leave):',
        data.summary.continuousLeaveDays,
      ]);
      continuousRow.getCell(1).font = { bold: true };
      continuousRow.getCell(2).font = { bold: true, size: 14 };
      continuousRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD5E8D4' },
      };
      continuousRow.getCell(2).alignment = { horizontal: 'center' };
    }

    if (data.summary?.maxAbsenceInAny12Months !== null && data.summary?.maxAbsenceInAny12Months !== undefined) {
      const maxAbsenceRow = sheet.addRow([
        'Max Absence in Any 12 Months:',
        data.summary.maxAbsenceInAny12Months,
      ]);
      maxAbsenceRow.getCell(1).font = { bold: true };
      maxAbsenceRow.getCell(2).font = { bold: true };

      if (data.summary.hasExceeded180Days) {
        maxAbsenceRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC7CE' },
        };
        maxAbsenceRow.getCell(2).font = { bold: true, color: { argb: 'FF9C0006' } };

        sheet.addRow([]);
        const warningRow = sheet.addRow(['⚠️ WARNING: Exceeded 180-day limit in a 12-month period']);
        warningRow.getCell(1).font = { bold: true, color: { argb: 'FF9C0006' } };
        warningRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC7CE' },
        };
      } else {
        maxAbsenceRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD5E8D4' },
        };
      }
      maxAbsenceRow.getCell(2).alignment = { horizontal: 'center' };
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
