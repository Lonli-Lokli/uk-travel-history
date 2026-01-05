/**
 * Single Goal API Routes
 * GET /api/goals/[goalId] - Get a specific goal
 * PATCH /api/goals/[goalId] - Update a goal
 * DELETE /api/goals/[goalId] - Delete (archive) a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getGoalById,
  updateGoal,
  deleteGoal,
  type UpdateTrackingGoalData,
} from '@uth/db';
import { checkFeatureAccess, FEATURE_KEYS } from '@uth/features';
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
    const { userId } = await auth();
    const { goalId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag
    const hasAccess = await checkFeatureAccess(FEATURE_KEYS.MULTI_GOAL_TRACKING, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
    }

    const goal = await getGoalById(goalId);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (goal.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ goal });
  } catch (error) {
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
    const { userId } = await auth();
    const { goalId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag
    const hasAccess = await checkFeatureAccess(FEATURE_KEYS.MULTI_GOAL_TRACKING, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
    }

    const existingGoal = await getGoalById(goalId);

    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (existingGoal.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json() as UpdateTrackingGoalData;
    const goal = await updateGoal(goalId, body);

    logger.info('Goal updated', {
      extra: { userId, goalId },
    });

    return NextResponse.json({ goal });
  } catch (error) {
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
    const { userId } = await auth();
    const { goalId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag
    const hasAccess = await checkFeatureAccess(FEATURE_KEYS.MULTI_GOAL_TRACKING, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
    }

    const existingGoal = await getGoalById(goalId);

    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Ensure user owns this goal
    if (existingGoal.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Soft delete - archive the goal
    await updateGoal(goalId, { isArchived: true });

    logger.info('Goal archived', {
      extra: { userId, goalId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
