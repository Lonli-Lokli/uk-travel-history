/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createPortalSession } from '@uth/payments-server';
import { logger } from '@uth/utils';

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, returnUrl } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 },
      );
    }

    // Create Customer Portal session using SDK
    const url = await createPortalSession(
      customerId,
      returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account`,
    );

    logger.addBreadcrumb('Customer portal session created', 'billing', {
      customerId,
      userId,
    });

    return NextResponse.json({ url });
  } catch (error) {
    logger.error('Failed to create customer portal session', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
