/**
 * Goals API Routes
 * GET /api/goals - List user's goals
 * POST /api/goals - Create a new goal
 *
 * Supports both authenticated (paid) and anonymous (free) users:
 * - Paid users: Goals stored in Supabase (persistent)
 * - Free/anonymous users: Goals stored in cache (ephemeral, TTL expires at end of day)
 * - Limit: 1 goal for free/anonymous users, unlimited for paid
 */

import { NextRequest, NextResponse } from 'next/server';
import type { CreateTrackingGoalData } from '@uth/db';
import { getCurrentUser } from '@uth/auth-server';
import {
  createGoalStoreContext,
  getGoals,
  createGoalEntity,
  getCachedGoalCount,
} from '@uth/trip-store';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/goals
 * List all goals for the current user/session
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();
    const context = await createGoalStoreContext(authUser, request);

    const includeArchived =
      request.nextUrl.searchParams.get('includeArchived') === 'true';

    // Get goals - filtering handled by the store
    // Note: includeArchived filtering is done after fetching since cache doesn't support it
    let goals = await getGoals(context);

    // Filter archived goals if not requested
    if (!includeArchived) {
      goals = goals.filter(goal => !(goal as any).isArchived);
    }

    return context.response.json({ goals });
  } catch (error) {
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
    const authUser = await getCurrentUser();
    const context = await createGoalStoreContext(authUser, request);

    const body = (await request.json()) as CreateTrackingGoalData;

    // Basic validation
    if (!body.type || !body.jurisdiction || !body.name) {
      return NextResponse.json(
        {
          error: 'Missing required fields: type, jurisdiction, name',
        },
        { status: 400 },
      );
    }

    // Enforce 1 goal limit for free/anonymous users
    if (!context.isPaidUser && context.sessionId) {
      const cachedCount = await getCachedGoalCount(context.sessionId);
      if (cachedCount >= 1) {
        return NextResponse.json(
          { error: 'Free tier limited to 1 goal. Upgrade to add more.' },
          { status: 403 },
        );
      }
    }

    const goal = await createGoalEntity(context, body as any);

    logger.info(`Goal created (${context.isPaidUser ? 'paid' : 'cache'})`, {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId: context.sessionId,
        goalId: goal.id,
        type: (goal as any).type,
      },
    });

    return context.response.json({ goal }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create goal', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
