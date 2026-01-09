/**
 * Bulk Trips API Route
 * POST /api/trips/bulk - Bulk create trips (for imports)
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulkCreateTrips, getGoalById, type BulkCreateTripsData } from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 60; // Longer timeout for bulk operations

/**
 * POST /api/trips/bulk
 * Bulk create trips (for PDF/Excel imports)
 */
export async function POST(request: NextRequest) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as BulkCreateTripsData;

    // Basic validation
    if (!body.goalId || !body.trips || !Array.isArray(body.trips)) {
      return NextResponse.json(
        {
          error: 'Missing required fields: goalId, trips (array)',
        },
        { status: 400 },
      );
    }

    if (body.trips.length === 0) {
      return NextResponse.json(
        { error: 'Trips array must not be empty' },
        { status: 400 },
      );
    }

    // Validate each trip has required fields
    for (let i = 0; i < body.trips.length; i++) {
      const trip = body.trips[i];
      if (!trip.outDate || !trip.inDate) {
        return NextResponse.json(
          {
            error: `Trip at index ${i} missing required fields: outDate, inDate`,
          },
          { status: 400 },
        );
      }

      // Validate dates
      const outDate = new Date(trip.outDate);
      const inDate = new Date(trip.inDate);

      if (outDate >= inDate) {
        return NextResponse.json(
          {
            error: `Trip at index ${i}: Return date must be after departure date (same-day trips are invalid)`,
          },
          { status: 400 },
        );
      }
    }

    // CRITICAL: Verify goal ownership before creating trips
    const goal = await getGoalById(body.goalId);

    if (!goal || goal.userId !== userContext.userId) {
      return NextResponse.json(
        { error: 'Goal not found or not authorized' },
        { status: 404 },
      );
    }

    const trips = await bulkCreateTrips(userContext.userId, body);

    logger.info('Trips bulk created', {
      extra: {
        userId: userContext.userId,
        goalId: body.goalId,
        count: trips.length,
      },
    });

    return NextResponse.json({ trips, count: trips.length }, { status: 201 });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to bulk create trips', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
