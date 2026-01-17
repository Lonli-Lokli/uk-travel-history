/**
 * Single Goal API Routes
 * GET /api/goals/[goalId] - Get a specific goal
 * PATCH /api/goals/[goalId] - Update a goal
 * DELETE /api/goals/[goalId] - Delete (archive) a goal
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Goals stored in Supabase (persistent)
 * - Free/anonymous users: Goals stored in cache (ephemeral)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { UpdateTrackingGoalData } from '@uth/db';
import { getCurrentUser } from '@uth/auth-server';
import {
  createGoalStoreContext,
  getGoalById,
  updateGoalEntity,
  deleteGoalEntity,
} from '@uth/trip-store';
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
    const authUser = await getCurrentUser();
    const context = await createGoalStoreContext(authUser, request);
    const { goalId } = await params;

    const goal = await getGoalById(context, goalId);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Authorization check for paid users
    if (context.isPaidUser && goal.userId !== authUser?.uid) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return context.response.json({ goal });
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
    const authUser = await getCurrentUser();
    const context = await createGoalStoreContext(authUser, request);
    const { goalId } = await params;

    const body = (await request.json()) as UpdateTrackingGoalData;

    // Authorization check for paid users
    if (context.isPaidUser) {
      const existingGoal = await getGoalById(context, goalId);
      if (!existingGoal) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      if (existingGoal.userId !== authUser?.uid) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const goal = await updateGoalEntity(context, goalId, body);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    logger.info(`Goal updated (${context.isPaidUser ? 'paid' : 'cache'})`, {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId: context.sessionId,
        goalId,
      },
    });

    return context.response.json({ goal });
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
    const authUser = await getCurrentUser();
    const context = await createGoalStoreContext(authUser, request);
    const { goalId } = await params;

    // Authorization check for paid users
    if (context.isPaidUser) {
      const existingGoal = await getGoalById(context, goalId);
      if (!existingGoal) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      if (existingGoal.userId !== authUser?.uid) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    await deleteGoalEntity(context, goalId);

    logger.info(`Goal ${context.isPaidUser ? 'archived' : 'deleted'} (${context.isPaidUser ? 'paid' : 'cache'})`, {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId: context.sessionId,
        goalId,
      },
    });

    return context.response.json({ success: true });
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
