/**
 * POST /api/billing/checkout
 * Creates a Stripe checkout session for one-time payment
 * Creates purchase_intent record and redirects to Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@uth/db';
import Stripe from 'stripe';
import { logger } from '@uth/utils';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
  });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 },
      );
    }

    // Validate environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.error('STRIPE_SECRET_KEY not configured', undefined);
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 },
      );
    }

    const PRICE_ID = process.env.STRIPE_PRICE_ONE_TIME_PAYMENT;
    if (!PRICE_ID) {
      logger.error('STRIPE_PRICE_ONE_TIME_PAYMENT not configured', undefined);
      return NextResponse.json(
        { error: 'Payment price not configured' },
        { status: 500 },
      );
    }

    const supabase = getSupabaseServerClient();

    // Create purchase intent record
    const { data: purchaseIntent, error: insertError } = await supabase
      .from('purchase_intents')
      .insert({
        email,
        status: 'created',
        price_id: PRICE_ID,
      })
      .select()
      .single();

    if (insertError || !purchaseIntent) {
      logger.error('Failed to create purchase intent', insertError);
      return NextResponse.json(
        { error: 'Failed to create purchase intent' },
        { status: 500 },
      );
    }

    // Create Stripe Checkout Session
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // One-time payment
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: email,
      client_reference_id: purchaseIntent.id,
      metadata: {
        purchase_intent_id: purchaseIntent.id,
        email,
      },
      success_url: `${APP_URL}/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/`,
    });

    // Update purchase intent with session ID
    const { error: updateError } = await supabase
      .from('purchase_intents')
      .update({
        stripe_checkout_session_id: session.id,
        status: 'checkout_created',
      })
      .eq('id', purchaseIntent.id);

    if (updateError) {
      logger.error('Failed to update purchase intent', updateError);
      // Continue anyway - webhook can handle it
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('Checkout error', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
