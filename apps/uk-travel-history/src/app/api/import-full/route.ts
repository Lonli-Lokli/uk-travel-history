import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ImportedData {
  version: string;
  exportDate: string;
  vignetteEntryDate: string;
  visaStartDate: string;
  ilrTrack: number;
  trips: Array<{
    outDate: string;
    inDate: string;
    outRoute: string;
    inRoute: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Look for the "Import Data (JSON)" sheet
    const jsonSheet = workbook.getWorksheet('Import Data (JSON)');

    if (!jsonSheet) {
      return NextResponse.json(
        { error: 'Invalid file format - missing Import Data sheet' },
        { status: 400 }
      );
    }

    // Get the JSON data from cell A4
    const jsonCell = jsonSheet.getCell('A4');
    const jsonString = jsonCell.value as string;

    if (!jsonString) {
      return NextResponse.json(
        { error: 'No import data found in file' },
        { status: 400 }
      );
    }

    // Parse the JSON data
    let importedData: ImportedData;
    try {
      importedData = JSON.parse(jsonString);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON data in import file' },
        { status: 400 }
      );
    }

    // Validate the imported data
    if (!importedData.version) {
      return NextResponse.json(
        { error: 'Invalid import data - missing version' },
        { status: 400 }
      );
    }

    if (!Array.isArray(importedData.trips)) {
      return NextResponse.json(
        { error: 'Invalid import data - missing or invalid trips array' },
        { status: 400 }
      );
    }

    // Return the validated data
    return NextResponse.json({
      success: true,
      data: {
        vignetteEntryDate: importedData.vignetteEntryDate || '',
        visaStartDate: importedData.visaStartDate || '',
        ilrTrack: importedData.ilrTrack || 5,
        trips: importedData.trips.map((trip) => ({
          outDate: trip.outDate || '',
          inDate: trip.inDate || '',
          outRoute: trip.outRoute || '',
          inRoute: trip.inRoute || '',
        })),
      },
      metadata: {
        version: importedData.version,
        exportDate: importedData.exportDate,
        tripCount: importedData.trips.length,
      },
    });
  } catch (error) {
    logger.error('Error importing full data:', error);
    return NextResponse.json(
      { error: 'Failed to import file' },
      { status: 500 }
    );
  }
}
