/**
 * Goal Templates API Route
 * GET /api/goals/templates - Get available goal templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoalTemplates } from '@uth/db';
import {
  getUserContext,
  checkFeatureAccess,
  FEATURE_KEYS,
} from '@uth/features/server';
import { TIERS } from '@uth/domain';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/goals/templates
 * Get available goal templates, filtered by user's tier
 */
export async function GET(request: NextRequest) {
  try {
    // Get user context (never throws - returns anonymous tier if not authenticated)
    const userContext = await getUserContext(request);

    // Check feature flag (if user is authenticated)
    if (userContext.userId) {
      const accessResult = await checkFeatureAccess(
        FEATURE_KEYS.MULTI_GOAL_TRACKING,
        userContext,
      );
      if (!accessResult.allowed) {
        return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
      }
    }

    const jurisdiction = request.nextUrl.searchParams.get('jurisdiction') ?? undefined;
    const allTemplates = await getGoalTemplates(jurisdiction);

    // Define tier hierarchy for filtering
    const tierHierarchy: Record<string, number> = {
      [TIERS.ANONYMOUS]: 0,
      [TIERS.FREE]: 1,
      [TIERS.PREMIUM]: 2,
    };

    const userTierLevel = tierHierarchy[userContext.tier] ?? 0;

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
