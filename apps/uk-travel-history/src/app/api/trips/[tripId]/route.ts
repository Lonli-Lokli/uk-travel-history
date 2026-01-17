/**
 * Single Trip API Routes
 * GET /api/trips/[tripId] - Get a specific trip
 * PATCH /api/trips/[tripId] - Update a trip
 * DELETE /api/trips/[tripId] - Delete a trip
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Trips stored in Supabase (persistent)
 * - Free/anonymous users: Trips stored in cache (ephemeral, TTL expires at end of day)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTripGroupById } from '@uth/db';
import { logger } from '@uth/utils';
import {
  createTripStoreContext,
  getTripById,
  updateTripEntity,
  deleteTripEntity,
  setSessionCookie,
  clearSessionCookie,
  tripStoreUsesPersistentStorage,
  type UpdateTripInput,
} from '@uth/trip-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ tripId: string }>;
}

/**
 * GET /api/trips/[tripId]
 * Get a specific trip by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { context, isNewSession, didMigrate } =
      await createTripStoreContext(request);
    const { tripId } = await params;

    const trip = await getTripById(context, tripId);

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // For persistent storage, verify ownership
    if (
      tripStoreUsesPersistentStorage(context) &&
      context.userId &&
      trip.userId !== context.userId
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const response = NextResponse.json({ trip });

    if (didMigrate) {
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
    logger.error('Failed to fetch trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/trips/[tripId]
 * Update a trip
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { context, isNewSession, didMigrate } =
      await createTripStoreContext(request);
    const { tripId } = await params;

    const existingTrip = await getTripById(context, tripId);

    if (!existingTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // For persistent storage, verify ownership
    if (
      tripStoreUsesPersistentStorage(context) &&
      context.userId &&
      existingTrip.userId !== context.userId
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateTripInput;

    // Validate dates if provided
    if (body.outDate && body.inDate) {
      const outDate = new Date(body.outDate);
      const inDate = new Date(body.inDate);

      if (outDate >= inDate) {
        return NextResponse.json(
          {
            error:
              'Return date must be after departure date (same-day trips are invalid)',
          },
          { status: 400 },
        );
      }
    }

    // CRITICAL: Verify trip group ownership if changing groupId (only for authenticated users)
    if (body.groupId && context.userId) {
      const group = await getTripGroupById(body.groupId);
      if (!group || group.userId !== context.userId) {
        return NextResponse.json(
          { error: 'Trip group not found or not authorized' },
          { status: 404 },
        );
      }
    }

    const trip = await updateTripEntity(context, tripId, body);

    logger.info('Trip updated', {
      extra: {
        userId: context.userId ?? 'anonymous',
        tripId,
        isPersistent: context.isPaidUser,
      },
    });

    const response = NextResponse.json({ trip });

    if (didMigrate) {
      clearSessionCookie(response);
    } else if (isNewSession && context.sessionId) {
      setSessionCookie(response, context.sessionId);
    }

    return response;
  } catch (error) {
    logger.error('Failed to update trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/trips/[tripId]
 * Delete a trip
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { context, isNewSession, didMigrate } =
      await createTripStoreContext(request);
    const { tripId } = await params;

    const existingTrip = await getTripById(context, tripId);

    if (!existingTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // For persistent storage, verify ownership
    if (
      tripStoreUsesPersistentStorage(context) &&
      context.userId &&
      existingTrip.userId !== context.userId
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await deleteTripEntity(context, tripId);

    logger.info('Trip deleted', {
      extra: {
        userId: context.userId ?? 'anonymous',
        tripId,
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
    logger.error('Failed to delete trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
