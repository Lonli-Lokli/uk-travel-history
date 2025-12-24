import { NextRequest, NextResponse } from 'next/server';
import { retrieveCheckoutSession } from '@uth/payments-server';
import { logger } from '@uth/utils';
import { getSubscriptionBySessionId } from '@uth/auth-server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ValidateSessionRequest {
  session_id: string;
}

/**
 * Validates a Stripe Checkout session ID.
 *
 * SECURITY: This endpoint does NOT require authentication (pre-registration).
 * However, it only provides session validation - no sensitive data.
 *
 * Used by /registration page to verify payment before allowing account creation.
 *
 * Returns:
 * - paymentStatus: 'paid' | 'unpaid'
 * - alreadyUsed: boolean (prevents session reuse)
 * - subscriptionId: string (for linking)
 * - customerId: string (for linking)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidateSessionRequest;
    const { session_id } = body;

    if (!session_id || !session_id.startsWith('cs_')) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 },
      );
    }

    // Retrieve session from Stripe using SDK
    const session = await retrieveCheckoutSession(session_id);

    // Check if session is for new subscription
    if (session.metadata?.checkoutType !== 'new_subscription') {
      logger.warn('[Validate Session] Session is not for new subscription', {
        sessionId: session_id,
      });
      return NextResponse.json(
        { error: 'Invalid session type' },
        { status: 400 },
      );
    }

    // Check payment status
    const paymentStatus = session.paymentStatus; // 'paid' | 'unpaid'

    if (paymentStatus !== 'paid') {
      logger.warn('[Validate Session] Payment not completed', {
        sessionId: session_id,
        paymentStatus,
      });
      return NextResponse.json({
        paymentStatus,
        alreadyUsed: false,
      });
    }

    // Check if session has already been used using SDK
    const existingSubscription = await getSubscriptionBySessionId(session_id);
    const alreadyUsed = existingSubscription !== null;

    if (alreadyUsed) {
      logger.warn('[Validate Session] Session already used', {
        sessionId: session_id,
      });
    }

    // Return validation result
    return NextResponse.json({
      paymentStatus,
      alreadyUsed,
      subscriptionId: session.subscriptionId || '',
      customerId: session.customerId || '',
    });
  } catch (error) {
    logger.error('[Validate Session] Failed to validate session', error, {
      tags: {
        service: 'stripe',
        operation: 'validate_session',
      },
    });

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Failed to validate session' },
      { status: 500 },
    );
  }
}
