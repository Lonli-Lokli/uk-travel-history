/**
 * Full Data Import API Route
 * POST /api/import-full - Parse full backup XLSX file with trips and goals
 *
 * Handles full backup files with:
 * - Sheet 1: Travel History (trips)
 * - Sheet 2: Visa Details (vignette date, visa start date, ILR track) [legacy]
 * - Sheet 3: Goals (optional, for multi-goal users)
 *
 * Server-side parsing with tier-based persistence:
 * - Authenticated users (free): Returns parsed trips (not saved to DB)
 * - Paid users (multi-goal): Saves trips and goals to DB, returns saved data
 *
 * Request: FormData with:
 * - file: XLSX file to parse
 * - goalId: (optional) Goal ID to import trips into (for paid users)
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@uth/utils';
import { parse, format } from 'date-fns';
import { assertFeatureAccess, checkFeatureAccess, getUserContext, FEATURE_KEYS } from '@uth/features/server';
import { bulkCreateTrips, getGoalById } from '@uth/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Enforce feature access - Excel import feature (base requirement)
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const goalId = formData.get('goalId') as string | null;

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

    // Sheet 2: Visa Details (optional, legacy format)
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

    // Sheet 3: Goals (optional, for multi-goal exports)
    const goalsSheet = workbook.getWorksheet('Goals');
    const goals: Array<{
      name: string;
      type: string;
      jurisdiction: string;
      startDate: string;
      config: Record<string, unknown>;
    }> = [];

    if (goalsSheet) {
      // Read goals from Sheet 3 (skip header row)
      // Header: Name | Type | Jurisdiction | Start Date | Config JSON
      for (let i = 2; i <= goalsSheet.rowCount; i++) {
        const row = goalsSheet.getRow(i);
        const name = row.getCell(1).value?.toString().trim();
        const type = row.getCell(2).value?.toString().trim();
        const jurisdiction = row.getCell(3).value?.toString().trim();
        const startDate = row.getCell(4).value?.toString().trim();
        const configStr = row.getCell(5).value?.toString().trim();

        if (name && type && jurisdiction && startDate) {
          let config: Record<string, unknown> = {};
          if (configStr) {
            try {
              config = JSON.parse(configStr);
            } catch (err) {
              logger.warn('Failed to parse goal config JSON', {
                extra: { row: i, configStr },
              });
            }
          }

          goals.push({
            name,
            type,
            jurisdiction,
            startDate: parseDate(startDate),
            config,
          });
        }
      }
    }

    logger.info('Full data parsed successfully', {
      extra: {
        tripCount: trips.length,
        goalCount: goals.length,
        hasVisaDetails: !!detailsSheet,
      },
    });

    // Check if user has multi-goal tracking (paid feature)
    const multiGoalUserContext = await getUserContext(request);
    const multiGoalAccessResult = await checkFeatureAccess(
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
      multiGoalUserContext,
    );
    const hasMultiGoalAccess = multiGoalAccessResult.allowed;

    // For paid users with a goalId, save trips to database
    if (hasMultiGoalAccess && goalId && userContext.userId) {
      // Verify goal ownership
      const goal = await getGoalById(goalId);

      if (!goal || goal.userId !== userContext.userId) {
        return NextResponse.json(
          { error: 'Goal not found or not authorized' },
          { status: 404 },
        );
      }

      // Save trips to database
      const savedTrips = await bulkCreateTrips(userContext.userId, {
        goalId,
        trips,
      });

      logger.info('Full import trips saved to database', {
        extra: {
          userId: userContext.userId,
          goalId,
          count: savedTrips.length,
        },
      });

      // Return saved data
      return NextResponse.json({
        success: true,
        data: {
          vignetteEntryDate,
          visaStartDate,
          ilrTrack,
          trips: savedTrips,
          goals,
        },
        metadata: {
          tripCount: savedTrips.length,
          goalCount: goals.length,
          hasVisaDetails: !!detailsSheet,
          hasGoals: goals.length > 0,
          saved: true,
        },
      });
    }

    // For free users, return parsed data (in-memory only)
    return NextResponse.json({
      success: true,
      data: {
        vignetteEntryDate,
        visaStartDate,
        ilrTrack,
        trips,
        goals,
      },
      metadata: {
        tripCount: trips.length,
        goalCount: goals.length,
        hasVisaDetails: !!detailsSheet,
        hasGoals: goals.length > 0,
        saved: false,
      },
    });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Error importing full data', error);
    return NextResponse.json(
      { error: 'Failed to import file' },
      { status: 500 },
    );
  }
}
