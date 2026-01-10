/**
 * Trip Groups API Routes
 * GET /api/trip-groups - List user's trip groups
 * POST /api/trip-groups - Create a new trip group
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTripGroups,
  createTripGroup,
  type CreateTripGroupData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/trip-groups
 * List all trip groups for the authenticated user
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

    const groups = await getTripGroups(userContext.userId);

    return NextResponse.json({ groups });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to fetch trip groups', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/trip-groups
 * Create a new trip group
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

    const body = (await request.json()) as CreateTripGroupData;

    // Basic validation
    if (!body.name) {
      return NextResponse.json(
        {
          error: 'Missing required field: name',
        },
        { status: 400 },
      );
    }

    const group = await createTripGroup(userContext.userId, body);

    logger.info('Trip group created', {
      extra: {
        userId: userContext.userId,
        groupId: group.id,
        name: group.name,
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to create trip group', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
