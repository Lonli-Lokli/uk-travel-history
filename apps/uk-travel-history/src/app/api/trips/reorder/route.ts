/**
 * Reorder Trips API Route
 * POST /api/trips/reorder - Reorder trips (for drag-and-drop)
 */

import { NextRequest, NextResponse } from 'next/server';
import { reorderTrips } from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

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
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    await reorderTrips(body.tripIds);

    logger.info('Trips reordered', {
      extra: {
        userId: userContext.userId,
        count: body.tripIds.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to reorder trips', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
