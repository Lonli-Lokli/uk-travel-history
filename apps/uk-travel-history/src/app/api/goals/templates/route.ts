/**
 * Goal Templates API Route
 * GET /api/goals/templates - Get available goal templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoalTemplates, getUserByAuthId } from '@uth/db';
import { checkFeatureAccess, FEATURE_KEYS } from '@uth/features';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/goals/templates
 * Get available goal templates, filtered by user's tier
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Allow anonymous access for browsing templates
    // But filter based on tier

    // Check feature flag (if user is authenticated)
    if (userId) {
      const hasAccess = await checkFeatureAccess(FEATURE_KEYS.MULTI_GOAL_TRACKING, userId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
      }
    }

    const jurisdiction = request.nextUrl.searchParams.get('jurisdiction') ?? undefined;
    const allTemplates = await getGoalTemplates(jurisdiction);

    // Determine user's tier for filtering
    let userTier = 'anonymous';
    if (userId) {
      const user = await getUserByAuthId(userId);
      if (user) {
        userTier = user.subscriptionTier;
      }
    }

    // Define tier hierarchy for filtering
    const tierHierarchy: Record<string, number> = {
      anonymous: 0,
      free: 1,
      monthly: 2,
      yearly: 2,
      lifetime: 3,
    };

    const userTierLevel = tierHierarchy[userTier] ?? 0;

    // Filter templates by min_tier (but show all with availability info)
    const templates = allTemplates.map((template) => {
      const templateTierLevel = tierHierarchy[template.minTier] ?? 0;
      const isAvailableForTier = userTierLevel >= templateTierLevel;

      return {
        ...template,
        isAvailableForTier,
        requiresUpgrade: !isAvailableForTier,
      };
    });

    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Failed to fetch goal templates', {
      extra: { error: (error as Error).message },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
