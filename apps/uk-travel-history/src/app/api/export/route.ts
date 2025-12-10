import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tripsDataStr = formData.get('tripsData') as string;

    if (!tripsDataStr) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const trips: TripData[] = JSON.parse(tripsDataStr);

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

    sheet.addRow([]);
    const totalRow = sheet.addRow({
      outRoute: '',
      inRoute: 'TOTAL FULL DAYS OUTSIDE UK:',
      calendarDays: '',
      fullDays: totalFullDays,
    });

    totalRow.getCell('inRoute').font = { bold: true };
    totalRow.getCell('inRoute').alignment = { horizontal: 'right' };
    totalRow.getCell('fullDays').font = { bold: true, size: 14 };
    totalRow.getCell('fullDays').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' },
    };
    totalRow.getCell('fullDays').alignment = { horizontal: 'center' };
    totalRow.getCell('fullDays').border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'medium' },
    };

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
    console.error('Error generating Excel:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    );
  }
}
