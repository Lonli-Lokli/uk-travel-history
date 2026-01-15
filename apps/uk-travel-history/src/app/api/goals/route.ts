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
import {
  getUserGoals,
  createGoal,
  getUserByAuthId,
  SubscriptionTier,
  type CreateTrackingGoalData,
  type TrackingGoalData,
} from '@uth/db';
import { getCurrentUser } from '@uth/auth-server';
import { get, set, withTTL } from '@uth/cache';
import {
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
  getEndOfDayTTLSeconds,
} from '@uth/trip-store';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
 * Generate a unique ID for cached goals
 */
function generateGoalId(): string {
  return `goal_${crypto.randomUUID()}`;
}

/**
 * Migrate cached goals to Supabase when user upgrades
 */
async function migrateGoalsFromCache(
  sessionId: string,
  userId: string,
): Promise<{ migrated: number; errors: number }> {
  const cachedGoals = await getCachedGoals(sessionId);

  if (cachedGoals.length === 0) {
    return { migrated: 0, errors: 0 };
  }

  let migrated = 0;
  let errors = 0;

  for (const goal of cachedGoals) {
    try {
      await createGoal(userId, {
        type: goal.type,
        jurisdiction: goal.jurisdiction,
        name: goal.name,
        config: goal.config,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        isActive: goal.isActive,
        displayOrder: goal.displayOrder,
        color: goal.color,
      });
      migrated++;
    } catch (error) {
      logger.warn('Failed to migrate goal from cache', {
        extra: {
          userId,
          sessionId,
          goalId: goal.id,
          error: (error as Error).message,
        },
      });
      errors++;
    }
  }

  // Clear cache after migration
  if (migrated > 0) {
    const key = getGoalsCacheKey(sessionId);
    const cache = withTTL(1); // Immediate expiry
    await cache.set(key, []);
  }

  return { migrated, errors };
}

/**
 * GET /api/goals
 * List all goals for the current user/session
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;

    if (authUser) {
      // Authenticated user - check subscription tier
      const dbUser = await getUserByAuthId(authUser.uid);
      const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
      const isPaid = isPaidTier(tier);

      if (isPaid) {
        // Paid user - use Supabase, migrate if needed
        let didMigrate = false;

        if (sessionId) {
          try {
            const result = await migrateGoalsFromCache(sessionId, authUser.uid);
            didMigrate = result.migrated > 0;

            if (result.migrated > 0) {
              logger.info('Migrated goals from cache to Supabase', {
                extra: {
                  userId: authUser.uid,
                  sessionId,
                  migrated: result.migrated,
                  errors: result.errors,
                },
              });
            }
          } catch (error) {
            logger.warn('Failed to migrate cached goals', {
              extra: {
                userId: authUser.uid,
                sessionId,
                error: (error as Error).message,
              },
            });
          }
        }

        const includeArchived =
          request.nextUrl.searchParams.get('includeArchived') === 'true';
        const goals = await getUserGoals(authUser.uid, includeArchived);

        const response = NextResponse.json({ goals });
        if (didMigrate) {
          clearSessionCookie(response);
        }
        return response;
      }
    }

    // Free/anonymous user - use cache
    if (!sessionId) {
      sessionId = createSessionId();
    }

    const goals = await getCachedGoals(sessionId);

    const response = NextResponse.json({ goals });
    if (isNewSession && sessionId) {
      setSessionCookie(response, sessionId);
    }

    return response;
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
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;

    const body = (await request.json()) as CreateTrackingGoalData;

    // Basic validation
    if (!body.type || !body.jurisdiction || !body.name || !body.startDate) {
      return NextResponse.json(
        {
          error: 'Missing required fields: type, jurisdiction, name, startDate',
        },
        { status: 400 },
      );
    }

    if (authUser) {
      // Authenticated user - check subscription tier
      const dbUser = await getUserByAuthId(authUser.uid);
      const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
      const isPaid = isPaidTier(tier);

      if (isPaid) {
        // Paid user - unlimited goals in Supabase
        const goal = await createGoal(authUser.uid, body);

        logger.info('Goal created (paid)', {
          extra: { userId: authUser.uid, goalId: goal.id, type: goal.type },
        });

        return NextResponse.json({ goal }, { status: 201 });
      }
    }

    // Free/anonymous user - use cache with 1 goal limit
    if (!sessionId) {
      sessionId = createSessionId();
    }

    const existingGoals = await getCachedGoals(sessionId);

    // Enforce 1 goal limit for free/anonymous users
    if (existingGoals.length >= 1) {
      return NextResponse.json(
        { error: 'Free tier limited to 1 goal. Upgrade to add more.' },
        { status: 403 },
      );
    }

    // Create goal in cache
    const now = new Date().toISOString();
    const newGoal: TrackingGoalData = {
      id: generateGoalId(),
      userId: authUser?.uid || `session:${sessionId}`,
      type: body.type,
      jurisdiction: body.jurisdiction,
      name: body.name,
      config: body.config,
      startDate: body.startDate,
      targetDate: body.targetDate ?? null,
      isActive: body.isActive ?? true,
      isArchived: false,
      displayOrder: body.displayOrder ?? 0,
      color: body.color ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await setCachedGoals(sessionId, [...existingGoals, newGoal]);

    logger.info('Goal created (cache)', {
      extra: {
        userId: authUser?.uid ?? 'anonymous',
        sessionId,
        goalId: newGoal.id,
        type: newGoal.type,
      },
    });

    const response = NextResponse.json({ goal: newGoal }, { status: 201 });
    if (isNewSession && sessionId) {
      setSessionCookie(response, sessionId);
    }

    return response;
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
