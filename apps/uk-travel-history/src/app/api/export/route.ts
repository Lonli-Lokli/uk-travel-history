import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';
import { format, parseISO } from 'date-fns';
import {
  requirePaidFeature,
  createAuthErrorResponse,
} from '@/middleware/serverAuth';
import { FEATURES } from '@uth/features';

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
    // SECURITY: Verify authentication and check feature access
    // This prevents unauthorized users from bypassing client-side feature gates
    await requirePaidFeature(request, FEATURES.EXCEL_EXPORT);

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

    // Helper function to format dates
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const date = parseISO(dateStr);
        return format(date, 'dd/MM/yyyy');
      } catch {
        return '';
      }
    };

    // Sheet 1: Travel History (identical for both modes)
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
      const row = sheet.addRow({
        num: index + 1,
        outDate: formatDate(trip.outDate),
        inDate: formatDate(trip.inDate),
        outRoute: trip.outRoute || '',
        inRoute: trip.inRoute || '',
      });

      row.getCell('num').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('outDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('inDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
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

    // Sheet 2: Visa Details (only for full mode)
    if (exportMode === 'full') {
      const detailsSheet = workbook.addWorksheet('Visa Details');

      // Add header row with styling
      const detailsHeader = detailsSheet.addRow(['Field', 'Value']);
      detailsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailsHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      detailsHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      detailsHeader.height = 26;

      // Add visa details rows
      const addDetailRow = (field: string, value: string | number) => {
        const row = detailsSheet.addRow([field, value]);
        row.getCell(1).font = { bold: true };
        row.getCell(1).alignment = { vertical: 'middle' };
        row.getCell(2).alignment = { vertical: 'middle' };
        row.height = 20;

        // Add borders
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
            left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
            bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
            right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          };
        });
      };

      addDetailRow(
        'Vignette Entry Date',
        data.vignetteEntryDate ? formatDate(data.vignetteEntryDate) : '',
      );
      addDetailRow(
        'Visa Start Date',
        data.visaStartDate ? formatDate(data.visaStartDate) : '',
      );
      addDetailRow('ILR Track (Years)', data.ilrTrack?.toString() || '5');

      // Set column widths
      detailsSheet.getColumn(1).width = 25;
      detailsSheet.getColumn(2).width = 20;

      // Apply border to header cells
      detailsHeader.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="UK_Travel_History${exportMode === 'full' ? '_Full' : ''}.xlsx"`,
      },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AuthError') {
      return createAuthErrorResponse(error);
    }

    logger.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 },
    );
  }
}
