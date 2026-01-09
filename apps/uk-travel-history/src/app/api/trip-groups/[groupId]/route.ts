/**
 * Single Trip Group API Routes
 * GET /api/trip-groups/[groupId] - Get a specific trip group
 * PATCH /api/trip-groups/[groupId] - Update a trip group
 * DELETE /api/trip-groups/[groupId] - Delete a trip group
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTripGroupById,
  updateTripGroup,
  deleteTripGroup,
  type UpdateTripGroupData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

/**
 * GET /api/trip-groups/[groupId]
 * Get a specific trip group by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { groupId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const group = await getTripGroupById(groupId);

    if (!group) {
      return NextResponse.json(
        { error: 'Trip group not found' },
        { status: 404 },
      );
    }

    // Ensure user owns this group
    if (group.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to fetch trip group', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/trip-groups/[groupId]
 * Update a trip group
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { groupId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingGroup = await getTripGroupById(groupId);

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Trip group not found' },
        { status: 404 },
      );
    }

    // Ensure user owns this group
    if (existingGroup.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateTripGroupData;

    const group = await updateTripGroup(groupId, body);

    logger.info('Trip group updated', {
      extra: { userId: userContext.userId, groupId },
    });

    return NextResponse.json({ group });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to update trip group', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/trip-groups/[groupId]
 * Delete a trip group (trips.group_id will be set to NULL)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(
      request,
      FEATURE_KEYS.MULTI_GOAL_TRACKING,
    );
    const { groupId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingGroup = await getTripGroupById(groupId);

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Trip group not found' },
        { status: 404 },
      );
    }

    // Ensure user owns this group
    if (existingGroup.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await deleteTripGroup(groupId);

    logger.info('Trip group deleted', {
      extra: { userId: userContext.userId, groupId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to delete trip group', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
