/**
 * CSV Import API Route
 * POST /api/import/csv - Parse CSV/clipboard text and optionally save to DB
 *
 * Server-side parsing with tier-based persistence:
 * - Authenticated users (free): Returns parsed trips (not saved to DB)
 * - Paid users (multi-goal): Saves to DB and returns saved trips
 *
 * Request body:
 * - text: CSV text to parse
 * - goalId: (optional) Goal ID to save trips to (for paid users)
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCsvText } from '@uth/parser';
import { assertFeatureAccess, checkFeatureAccess, getUserContext, FEATURE_KEYS } from '@uth/features/server';
import { bulkCreateTrips, getGoalById } from '@uth/db';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Enforce feature access - Excel import feature (base requirement)
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.EXCEL_IMPORT);

    const body = await request.json();
    const { text, goalId } = body;

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
        trips: result.trips,
      });

      logger.info('CSV trips saved to database', {
        extra: {
          userId: userContext.userId,
          goalId,
          count: savedTrips.length,
        },
      });

      return NextResponse.json({
        success: true,
        trips: savedTrips,
        warnings: result.warnings,
        metadata: {
          tripCount: savedTrips.length,
          saved: true,
        },
      });
    }

    // For free users, return parsed trips (in-memory only)
    return NextResponse.json({
      success: true,
      trips: result.trips,
      warnings: result.warnings,
      metadata: {
        tripCount: result.trips.length,
        saved: false,
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
