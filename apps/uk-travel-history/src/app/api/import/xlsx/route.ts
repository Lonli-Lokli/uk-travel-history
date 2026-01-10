/**
 * XLSX Import API Route
 * POST /api/import/xlsx - Parse single-sheet XLSX file to trips
 *
 * Server-side parsing for single-sheet Excel imports:
 * - Authenticated users (free): Returns parsed trips (not saved to DB)
 * - Paid users: Can optionally save via /api/trips/bulk after receiving trips
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseXlsxFile } from '@uth/parser';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Enforce feature access - Excel import feature
    await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'File must be .xlsx format' },
        { status: 400 },
      );
    }

    // Read and parse XLSX file
    const arrayBuffer = await file.arrayBuffer();
    const result = await parseXlsxFile(arrayBuffer);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to parse XLSX',
          details: result.errors,
        },
        { status: 400 },
      );
    }

    logger.info('XLSX parsed successfully', {
      extra: {
        tripCount: result.trips.length,
        warnings: result.warnings.length,
      },
    });

    // Return parsed trips (hydrated data, not saved to DB)
    return NextResponse.json({
      success: true,
      trips: result.trips,
      warnings: result.warnings,
      metadata: {
        tripCount: result.trips.length,
      },
    });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to parse XLSX', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
