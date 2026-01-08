/**
 * Single Goal API Routes
 * GET /api/goals/[goalId] - Get a specific goal
 * PATCH /api/goals/[goalId] - Update a goal
 * DELETE /api/goals/[goalId] - Delete (archive) a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getGoalById,
  updateGoal,
  type UpdateTrackingGoalData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]
 * Get a specific goal by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.MULTI_GOAL_TRACKING);
    const { goalId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goal = await getGoalById(goalId);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (goal.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ goal });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to fetch goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/goals/[goalId]
 * Update a goal
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.MULTI_GOAL_TRACKING);
    const { goalId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingGoal = await getGoalById(goalId);

    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (existingGoal.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json() as UpdateTrackingGoalData;
    const goal = await updateGoal(goalId, body);

    logger.info('Goal updated', {
      extra: { userId: userContext.userId, goalId },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to update goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/goals/[goalId]
 * Archive a goal (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.MULTI_GOAL_TRACKING);
    const { goalId } = await params;

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingGoal = await getGoalById(goalId);

    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (existingGoal.userId !== userContext.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Soft delete - archive the goal
    await updateGoal(goalId, { isArchived: true });

    logger.info('Goal archived', {
      extra: { userId: userContext.userId, goalId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to delete goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
