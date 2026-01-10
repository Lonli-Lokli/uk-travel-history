/**
 * CSV Import API Route
 * POST /api/import/csv - Parse CSV/clipboard text to trips
 *
 * Server-side parsing for all import types:
 * - Authenticated users (free): Returns parsed trips (not saved to DB)
 * - Paid users: Can optionally save via /api/trips/bulk after receiving trips
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCsvText } from '@uth/parser';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Enforce feature access - Excel import feature
    await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT);

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text" field' },
        { status: 400 },
      );
    }

    // Parse CSV text using server-side parser
    const result = parseCsvText(text);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to parse CSV',
          details: result.errors,
        },
        { status: 400 },
      );
    }

    logger.info('CSV parsed successfully', {
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
    logger.error('Failed to parse CSV', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
