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
import {
  getGoalById,
  updateGoal,
  getUserByAuthId,
  SubscriptionTier,
  type UpdateTrackingGoalData,
  type TrackingGoalData,
} from '@uth/db';
import { getCurrentUser } from '@uth/auth-server';
import { get, withTTL } from '@uth/cache';
import {
  getSessionId,
  createSessionId,
  setSessionCookie,
  getEndOfDayTTLSeconds,
} from '@uth/trip-store';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * Paid subscription tiers that use persistent storage
 */
const PAID_TIERS: SubscriptionTier[] = [
  SubscriptionTier.MONTHLY,
  SubscriptionTier.YEARLY,
  SubscriptionTier.LIFETIME,
];

/**
 * Check if a subscription tier is a paid tier
 */
function isPaidTier(tier: SubscriptionTier): boolean {
  return PAID_TIERS.includes(tier);
}

/**
 * Get cache key for goals
 */
function getGoalsCacheKey(sessionId: string): string {
  return `goals:session:${sessionId}`;
}

/**
 * Get goals from cache
 */
async function getCachedGoals(sessionId: string): Promise<TrackingGoalData[]> {
  const key = getGoalsCacheKey(sessionId);
  const goals = await get<TrackingGoalData[]>(key);
  return goals || [];
}

/**
 * Save goals to cache with TTL
 */
async function setCachedGoals(
  sessionId: string,
  goals: TrackingGoalData[],
): Promise<void> {
  const key = getGoalsCacheKey(sessionId);
  const ttl = getEndOfDayTTLSeconds();
  const cache = withTTL(ttl);
  await cache.set(key, goals);
}

/**
 * GET /api/goals/[goalId]
 * Get a specific goal by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getCurrentUser();
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;
    const { goalId } = await params;

    if (authUser) {
      // Authenticated user - check subscription tier
      const dbUser = await getUserByAuthId(authUser.uid);
      const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
      const isPaid = isPaidTier(tier);

      if (isPaid) {
        // Paid user - use Supabase
        const goal = await getGoalById(goalId);

        if (!goal) {
          return NextResponse.json(
            { error: 'Goal not found' },
            { status: 404 },
          );
        }

        if (goal.userId !== authUser.uid) {
          return NextResponse.json(
            { error: 'Not authorized' },
            { status: 403 },
          );
        }

        return NextResponse.json({ goal });
      }
    }

    // Free/anonymous user - use cache
    if (!sessionId) {
      sessionId = createSessionId();
    }

    const goals = await getCachedGoals(sessionId);
    const goal = goals.find((g) => g.id === goalId);

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const response = NextResponse.json({ goal });
    if (isNewSession && sessionId) {
      setSessionCookie(response, sessionId);
    }

    return response;
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
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;
    const { goalId } = await params;

    const body = (await request.json()) as UpdateTrackingGoalData;

    if (authUser) {
      // Authenticated user - check subscription tier
      const dbUser = await getUserByAuthId(authUser.uid);
      const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
      const isPaid = isPaidTier(tier);

      if (isPaid) {
        // Paid user - use Supabase
        const existingGoal = await getGoalById(goalId);

        if (!existingGoal) {
          return NextResponse.json(
            { error: 'Goal not found' },
            { status: 404 },
          );
        }

        if (existingGoal.userId !== authUser.uid) {
          return NextResponse.json(
            { error: 'Not authorized' },
            { status: 403 },
          );
        }

        const goal = await updateGoal(goalId, body);

        logger.info('Goal updated (paid)', {
          extra: { userId: authUser.uid, goalId },
        });

        return NextResponse.json({ goal });
      }
    }

    // Free/anonymous user - use cache
    if (!sessionId) {
      sessionId = createSessionId();
    }

    const goals = await getCachedGoals(sessionId);
    const goalIndex = goals.findIndex((g) => g.id === goalId);

    if (goalIndex === -1) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Update goal in cache
    const updatedGoal: TrackingGoalData = {
      ...goals[goalIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    goals[goalIndex] = updatedGoal;
    await setCachedGoals(sessionId, goals);

    logger.info('Goal updated (cache)', {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId,
        goalId,
      },
    });

    const response = NextResponse.json({ goal: updatedGoal });
    if (isNewSession && sessionId) {
      setSessionCookie(response, sessionId);
    }

    return response;
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
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;
    const { goalId } = await params;

    if (authUser) {
      // Authenticated user - check subscription tier
      const dbUser = await getUserByAuthId(authUser.uid);
      const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
      const isPaid = isPaidTier(tier);

      if (isPaid) {
        // Paid user - use Supabase
        const existingGoal = await getGoalById(goalId);

        if (!existingGoal) {
          return NextResponse.json(
            { error: 'Goal not found' },
            { status: 404 },
          );
        }

        if (existingGoal.userId !== authUser.uid) {
          return NextResponse.json(
            { error: 'Not authorized' },
            { status: 403 },
          );
        }

        // Soft delete - archive the goal
        await updateGoal(goalId, { isArchived: true });

        logger.info('Goal archived (paid)', {
          extra: { userId: authUser.uid, goalId },
        });

        return NextResponse.json({ success: true });
      }
    }

    // Free/anonymous user - use cache (hard delete since it's ephemeral)
    if (!sessionId) {
      sessionId = createSessionId();
    }

    const goals = await getCachedGoals(sessionId);
    const goalIndex = goals.findIndex((g) => g.id === goalId);

    if (goalIndex === -1) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Remove goal from cache
    goals.splice(goalIndex, 1);
    await setCachedGoals(sessionId, goals);

    logger.info('Goal deleted (cache)', {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId,
        goalId,
      },
    });

    const response = NextResponse.json({ success: true });
    if (isNewSession && sessionId) {
      setSessionCookie(response, sessionId);
    }

    return response;
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
