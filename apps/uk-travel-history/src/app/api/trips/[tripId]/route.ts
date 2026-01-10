/**
 * Single Trip API Routes
 * GET /api/trips/[tripId] - Get a specific trip
 * PATCH /api/trips/[tripId] - Update a trip
 * DELETE /api/trips/[tripId] - Delete a trip
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTripById,
  updateTrip,
  deleteTrip,
  getTripGroupById,
  type UpdateTripData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

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
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { tripId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trip = await getTripById(tripId);

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Ensure user owns this trip
    if (trip.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ trip });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
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
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { tripId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingTrip = await getTripById(tripId);

    if (!existingTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Ensure user owns this trip
    if (existingTrip.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateTripData;

    // Validate dates if provided
    if (body.outDate && body.inDate) {
      const outDate = new Date(body.outDate);
      const inDate = new Date(body.inDate);

      if (outDate >= inDate) {
        return NextResponse.json(
          { error: 'Return date must be after departure date (same-day trips are invalid)' },
          { status: 400 },
        );
      }
    }

    // CRITICAL: Verify trip group ownership if changing groupId
    if (body.groupId) {
      const group = await getTripGroupById(body.groupId);
      if (!group || group.userId !== userContext.userId) {
        return NextResponse.json(
          { error: 'Trip group not found or not authorized' },
          { status: 404 },
        );
      }
    }

    const trip = await updateTrip(tripId, body);

    logger.info('Trip updated', {
      extra: { userId: userContext.userId, tripId },
    });

    return NextResponse.json({ trip });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
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
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { tripId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingTrip = await getTripById(tripId);

    if (!existingTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Ensure user owns this trip
    if (existingTrip.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await deleteTrip(tripId);

    logger.info('Trip deleted', {
      extra: { userId: userContext.userId, tripId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to delete trip', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
