/**
 * Trips API Routes
 * GET /api/trips - List user's trips
 * POST /api/trips - Create a new trip
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTrips,
  getTripsByGoal,
  createTrip,
  getGoalById,
  type CreateTripData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/trips
 * List all trips for the authenticated user
 * Query params:
 * - goalId: Filter trips by goal ID
 */
export async function GET(request: NextRequest) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goalId = request.nextUrl.searchParams.get('goalId');

    const trips = goalId
      ? await getTripsByGoal(goalId)
      : await getTrips(userContext.userId);

    return NextResponse.json({ trips });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to fetch trips', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/trips
 * Create a new trip
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

    const body = (await request.json()) as CreateTripData;

    // Basic validation
    if (!body.goalId || !body.outDate || !body.inDate) {
      return NextResponse.json(
        {
          error: 'Missing required fields: goalId, outDate, inDate',
        },
        { status: 400 },
      );
    }

    // Validate dates
    const outDate = new Date(body.outDate);
    const inDate = new Date(body.inDate);

    if (outDate >= inDate) {
      return NextResponse.json(
        { error: 'Return date must be after departure date (same-day trips are invalid)' },
        { status: 400 },
      );
    }

    // CRITICAL: Verify goal ownership before creating trip
    const goal = await getGoalById(body.goalId);

    if (!goal || goal.userId !== userContext.userId) {
      return NextResponse.json(
        { error: 'Goal not found or not authorized' },
        { status: 404 },
      );
    }

    const trip = await createTrip(userContext.userId, body);

    logger.info('Trip created', {
      extra: {
        userId: userContext.userId,
        tripId: trip.id,
        goalId: trip.goalId,
      },
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to create trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
