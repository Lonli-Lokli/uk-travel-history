/**
 * GET /api/user/subscription
 * Returns the current user's subscription details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSubscription } from '@uth/auth-server';
import { verifyAuth } from '../../../../middleware/serverAuth';
import { logger } from '@uth/utils';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authContext = await verifyAuth(request);

    // If auth is disabled, return null subscription
    if (!authContext) {
      return NextResponse.json({ subscription: null });
    }

    // Fetch subscription from auth-server SDK
    const subscription = await getSubscription(authContext.userId);

    if (!subscription) {
      return NextResponse.json({ subscription: null }, { status: 404 });
    }

    return NextResponse.json({
      subscription: {
        userId: subscription.userId,
        status: subscription.status,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeSessionId: subscription.stripeSessionId,
        stripePriceId: subscription.stripePriceId,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
        canceledAt: subscription.canceledAt?.toISOString(),
        lastPaymentError: subscription.lastPaymentError?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch subscription', error, {
      tags: {
        service: 'subscription',
        operation: 'get_subscription',
      },
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch subscription',
      },
      { status: 500 }
    );
  }
}
