/**
 * POST /api/billing/checkout
 * Creates a checkout session for one-time payment
 * Creates purchase_intent record and redirects to payment provider
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPurchaseIntent,
  updatePurchaseIntent,
  PurchaseIntentStatus,
} from '@uth/db';
import { createCheckoutSession, PaymentPlan } from '@uth/payments-server';
import { getRouteLogger } from '@uth/flow';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get price ID from env
    const PRICE_ID = process.env.STRIPE_PRICE_ONE_TIME_PAYMENT;
    if (!PRICE_ID) {
      getRouteLogger().error('STRIPE_PRICE_ONE_TIME_PAYMENT not configured', undefined);
      return NextResponse.json(
        { error: 'Payment price not configured' },
        { status: 500 },
      );
    }

    // Create purchase intent record
    let purchaseIntent;
    try {
      purchaseIntent = await createPurchaseIntent({
        email,
        status: PurchaseIntentStatus.CREATED,
        priceId: PRICE_ID,
      });
    } catch (error) {
      getRouteLogger().error('Failed to create purchase intent', error);
      return NextResponse.json(
        { error: 'Failed to create purchase intent' },
        { status: 500 },
      );
    }

    // Create checkout session via SDK
    try {
      const sessionRef = await createCheckoutSession({
        plan: PaymentPlan.PREMIUM_ONCE,
        customerEmail: email,
        successUrl: `${APP_URL}/travel?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/`,
        metadata: {
          purchase_intent_id: purchaseIntent.id,
          email,
        },
      });

      // Update purchase intent with session ID
      try {
        await updatePurchaseIntent(purchaseIntent.id, {
          stripeCheckoutSessionId: sessionRef.id,
          status: PurchaseIntentStatus.CHECKOUT_CREATED,
        });
      } catch (error) {
        getRouteLogger().error('Failed to update purchase intent', error);
        // Continue anyway - webhook can handle it
      }

      return NextResponse.json({
        sessionId: sessionRef.id,
        url: sessionRef.url,
      });
    } catch (error) {
      getRouteLogger().error('Checkout session creation error', error);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }
  } catch (error) {
    getRouteLogger().error('Checkout error', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
