/**
 * Goals API Routes
 * GET /api/goals - List user's goals
 * POST /api/goals - Create a new goal
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserGoals,
  createGoal,
  getGoalCount,
  type CreateTrackingGoalData,
} from '@uth/db';
import { assertFeatureAccess, FEATURE_KEYS } from '@uth/features/server';
import { TIERS } from '@uth/domain';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/goals
 * List all goals for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.MULTI_GOAL_TRACKING);

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
    const goals = await getUserGoals(userContext.userId, includeArchived);

    return NextResponse.json({ goals });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to fetch goals', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/goals
 * Create a new tracking goal
 */
export async function POST(request: NextRequest) {
  try {
    // Check feature flag and get user context
    const userContext = await assertFeatureAccess(request, FEATURE_KEYS.MULTI_GOAL_TRACKING);

    if (!userContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check goal limit: 1 for free tier, unlimited for paid
    const existingCount = await getGoalCount(userContext.userId);
    const isPaid = userContext.tier === TIERS.PREMIUM;

    if (!isPaid && existingCount >= 1) {
      return NextResponse.json(
        { error: 'Free tier limited to 1 goal. Upgrade to add more.' },
        { status: 403 },
      );
    }

    const body = await request.json() as CreateTrackingGoalData;

    // Basic validation
    if (!body.type || !body.jurisdiction || !body.name || !body.startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: type, jurisdiction, name, startDate' },
        { status: 400 },
      );
    }

    const goal = await createGoal(userContext.userId, body);

    logger.info('Goal created', {
      extra: { userId: userContext.userId, goalId: goal.id, type: goal.type },
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    // If assertFeatureAccess throws a NextResponse, return it directly
    if (error instanceof NextResponse) {
      return error;
    }
    logger.error('Failed to create goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
