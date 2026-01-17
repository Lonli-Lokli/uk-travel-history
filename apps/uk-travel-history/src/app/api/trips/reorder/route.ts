/**
 * Reorder Trips API Route
 * POST /api/trips/reorder - Reorder trips (for drag-and-drop)
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Uses Supabase reorderTrips function
 * - Free/anonymous users: Updates sort_order in cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { reorderTrips as dbReorderTrips } from '@uth/db';
import { logger } from '@uth/utils';
import {
  createTripStoreContext,
  getTrips,
  updateTripEntity,
  getTripById,
  setSessionCookie,
  clearSessionCookie,
  tripStoreUsesPersistentStorage,
} from '@uth/trip-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ReorderRequest {
  tripIds: string[];
}

/**
 * POST /api/trips/reorder
 * Reorder trips by updating their sort_order
 * Body: { tripIds: string[] } - Array of trip IDs in desired order
 */
export async function POST(request: NextRequest) {
  try {
    const { context, isNewSession, didMigrate } = await createTripStoreContext(request);

    const body = (await request.json()) as ReorderRequest;

    // Basic validation
    if (!body.tripIds || !Array.isArray(body.tripIds)) {
      return NextResponse.json(
        {
          error: 'Missing required field: tripIds (array)',
        },
        { status: 400 },
      );
    }

    if (body.tripIds.length === 0) {
      return NextResponse.json(
        { error: 'tripIds array must not be empty' },
        { status: 400 },
      );
    }

    if (tripStoreUsesPersistentStorage(context)) {
      // For persistent storage, use the database reorder function
      // CRITICAL: Verify ALL trips belong to the user before reordering
      const trips = await Promise.all(
        body.tripIds.map((id) => getTripById(context, id)),
      );

      // Check ownership - all trips must exist and belong to this user
      const unauthorizedTrip = trips.find(
        (trip) => !trip || trip.userId !== context.userId,
      );

      if (unauthorizedTrip) {
        return NextResponse.json(
          { error: 'Not authorized to reorder these trips' },
          { status: 403 },
        );
      }

      await dbReorderTrips(body.tripIds);
    } else {
      // For cache storage, update sort_order for each trip
      for (let i = 0; i < body.tripIds.length; i++) {
        await updateTripEntity(context, body.tripIds[i], { sortOrder: i });
      }
    }

    logger.info('Trips reordered', {
      extra: {
        userId: context.userId ?? 'anonymous',
        count: body.tripIds.length,
        isPersistent: context.isPaidUser,
      },
    });

    const response = NextResponse.json({ success: true });

    if (didMigrate) {
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
    logger.error('Failed to reorder trips', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
