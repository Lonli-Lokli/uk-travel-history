/**
 * Bulk Trips API Route
 * POST /api/trips/bulk - Bulk create trips (for imports)
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Trips stored in Supabase (persistent)
 * - Free/anonymous users: Trips stored in cache (ephemeral, TTL expires at end of day)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoalById, type CreateTripData } from '@uth/db';
import { logger } from '@uth/utils';
import {
  createTripStoreContext,
  bulkCreateTrips,
  setSessionCookie,
  clearSessionCookie,
} from '@uth/trip-store';

export const runtime = 'nodejs';
export const maxDuration = 60; // Longer timeout for bulk operations

interface BulkCreateRequestData {
  goalId?: string;
  trips: Array<Omit<CreateTripData, 'goalId'>>;
}

/**
 * POST /api/trips/bulk
 * Bulk create trips (for PDF/Excel imports)
 */
export async function POST(request: NextRequest) {
  try {
    const { context, isNewSession, didMigrate } = await createTripStoreContext(request);

    const body = (await request.json()) as BulkCreateRequestData;

    // Basic validation
    if (!body.trips || !Array.isArray(body.trips)) {
      return NextResponse.json(
        {
          error: 'Missing required field: trips (array)',
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

    // CRITICAL: Verify goal ownership if goalId is provided (only for authenticated users)
    if (body.goalId && context.userId) {
      const goal = await getGoalById(body.goalId);

      if (!goal || goal.userId !== context.userId) {
        return NextResponse.json(
          { error: 'Goal not found or not authorized' },
          { status: 404 },
        );
      }
    }

    // Add goalId to each trip if provided
    const tripsWithGoal: CreateTripData[] = body.trips.map((trip) => ({
      ...trip,
      goalId: body.goalId ?? null,
    }));

    const trips = await bulkCreateTrips(context, tripsWithGoal);

    logger.info('Trips bulk created', {
      extra: {
        userId: context.userId ?? 'anonymous',
        goalId: body.goalId ?? null,
        count: trips.length,
        isPersistent: context.isPaidUser,
      },
    });

    const response = NextResponse.json(
      { trips, count: trips.length },
      { status: 201 },
    );

    if (didMigrate) {
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
    logger.error('Failed to bulk create trips', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
