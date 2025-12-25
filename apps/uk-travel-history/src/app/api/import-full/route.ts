import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';
import { parse, format } from 'date-fns';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Authentication handled by Clerk middleware in proxy.ts
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Sheet 1: Travel History (always present)
    const travelSheet = workbook.getWorksheet('Travel History');

    if (!travelSheet) {
      return NextResponse.json(
        { error: 'Invalid file format - missing Travel History sheet' },
        { status: 400 },
      );
    }

    // Parse date from DD/MM/YYYY format to ISO string
    const parseDate = (dateStr: string): string => {
      if (!dateStr || typeof dateStr !== 'string') return '';
      try {
        // Handle DD/MM/YYYY format
        const date = parse(dateStr.trim(), 'dd/MM/yyyy', new Date());
        return format(date, 'yyyy-MM-dd');
      } catch {
        return '';
      }
    };

    // Read trips from Sheet 1 (skip header row)
    const trips: Array<{
      outDate: string;
      inDate: string;
      outRoute: string;
      inRoute: string;
    }> = [];

    let rowIndex = 2; // Start after header
    let currentRow = travelSheet.getRow(rowIndex);

    while (currentRow && currentRow.getCell(2).value) {
      const outDateCell = currentRow.getCell(2).value;
      const inDateCell = currentRow.getCell(3).value;
      const outDate = parseDate(outDateCell?.toString() || '');
      const inDate = parseDate(inDateCell?.toString() || '');

      if (outDate || inDate) {
        trips.push({
          outDate,
          inDate,
          outRoute: currentRow.getCell(4).value?.toString() || '',
          inRoute: currentRow.getCell(5).value?.toString() || '',
        });
      }

      rowIndex++;
      currentRow = travelSheet.getRow(rowIndex);
    }

    // Sheet 2: Visa Details (optional)
    const detailsSheet = workbook.getWorksheet('Visa Details');
    let vignetteEntryDate = '';
    let visaStartDate = '';
    let ilrTrack = 5;

    if (detailsSheet) {
      // Read visa details from Sheet 2 (Field-Value format)
      // Row 1 is header, data starts at row 2
      for (let i = 2; i <= detailsSheet.rowCount; i++) {
        const row = detailsSheet.getRow(i);
        const field = row.getCell(1).value?.toString().trim() || '';
        const value = row.getCell(2).value?.toString().trim() || '';

        if (field.includes('Vignette Entry Date') && value) {
          vignetteEntryDate = parseDate(value);
        } else if (field.includes('Visa Start Date') && value) {
          visaStartDate = parseDate(value);
        } else if (field.includes('ILR Track') && value) {
          const trackNum = parseInt(value, 10);
          if (
            !isNaN(trackNum) &&
            (trackNum === 2 || trackNum === 5 || trackNum === 10)
          ) {
            ilrTrack = trackNum as 2 | 5 | 10;
          }
        }
      }
    }

    // Return the validated data
    return NextResponse.json({
      success: true,
      data: {
        vignetteEntryDate,
        visaStartDate,
        ilrTrack,
        trips,
      },
      metadata: {
        tripCount: trips.length,
        hasVisaDetails: !!detailsSheet,
      },
    });
  } catch (error) {
    logger.error('Error importing full data', error);
    return NextResponse.json(
      { error: 'Failed to import file' },
      { status: 500 },
    );
  }
}
