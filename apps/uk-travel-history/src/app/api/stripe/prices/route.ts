import { NextResponse } from 'next/server';
import { getPriceDetails } from '@uth/payments-server';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/stripe/prices
 * Fetches pricing information using payments SDK
 * Public endpoint - no authentication required
 */
export async function GET() {
  try {
    const prices = await getPriceDetails();

    return NextResponse.json({
      monthly: {
        id: prices.monthly.id,
        amount: prices.monthly.amount,
        currency: prices.monthly.currency,
      },
      annual: {
        id: prices.annual.id,
        amount: prices.annual.amount,
        currency: prices.annual.currency,
      },
      lifetime: {
        id: prices.lifetime.id,
        amount: prices.lifetime.amount,
        currency: prices.lifetime.currency,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch prices', error, {
      tags: {
        service: 'payments',
        operation: 'fetch_prices',
      },
    });

    // Return fallback prices on error (in GBP)
    return NextResponse.json(
      {
        monthly: { id: '', amount: 9.99, currency: 'gbp' },
        annual: { id: '', amount: 99.0, currency: 'gbp' },
        lifetime: { id: '', amount: 249.0, currency: 'gbp' },
      },
      { status: 200 }, // Still 200, but with fallback data
    );
  }
}
