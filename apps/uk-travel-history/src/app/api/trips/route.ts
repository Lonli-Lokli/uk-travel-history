/**
 * Trips API Routes
 * GET /api/trips - List user's trips
 * POST /api/trips - Create a new trip
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Trips stored in Supabase (persistent)
 * - Free/anonymous users: Trips stored in cache (ephemeral, TTL expires at end of day)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoalById } from '@uth/db';
import { logger } from '@uth/utils';
import {
  createTripStoreContext,
  getTrips,
  createTripEntity,
  setSessionCookie,
  clearSessionCookie,
  type CreateTripInput,
} from '@uth/trip-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/trips
 * List all trips for the current user/session
 * Query params:
 * - goalId: Filter trips by goal ID (only for authenticated users)
 */
export async function GET(request: NextRequest) {
  try {
    const { context, isNewSession, didMigrate } = await createTripStoreContext(request);

    // Get trips from the appropriate storage
    const trips = await getTrips(context);

    // Filter by goalId if provided (client-side filtering for cache storage)
    const goalId = request.nextUrl.searchParams.get('goalId');
    const filteredTrips = goalId
      ? trips.filter((t) => t.goalId === goalId)
      : trips;

    const response = NextResponse.json({ trips: filteredTrips });

    // Handle session cookie based on migration/session state
    if (didMigrate) {
      // Clear session cookie after successful migration
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      // Set session cookie if this is a new session
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
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
    const { context, isNewSession, didMigrate } = await createTripStoreContext(request);

    const body = (await request.json()) as CreateTripInput;

    // Basic validation
    if (!body.outDate || !body.inDate) {
      return NextResponse.json(
        {
          error: 'Missing required fields: outDate, inDate',
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

    // Optional: Verify goal ownership if goalId is provided (only for authenticated users)
    if (body.goalId && context.userId) {
      const goal = await getGoalById(body.goalId);

      if (!goal || goal.userId !== context.userId) {
        return NextResponse.json(
          { error: 'Goal not found or not authorized' },
          { status: 404 },
        );
      }
    }

    const trip = await createTripEntity(context, body as any);

    logger.info('Trip created', {
      extra: {
        userId: context.userId ?? 'anonymous',
        sessionId: context.sessionId,
        tripId: trip.id,
        goalId: trip.goalId,
        isPersistent: context.isPaidUser,
      },
    });

    const response = NextResponse.json({ trip }, { status: 201 });

    // Handle session cookie based on migration/session state
    if (didMigrate) {
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
    logger.error('Failed to create trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
