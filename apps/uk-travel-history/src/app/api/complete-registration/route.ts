import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED: This endpoint is no longer used.
 *
 * The new auth flow uses Clerk + Supabase:
 * - Payment → Stripe webhook creates Clerk user automatically
 * - No need for manual registration completion
 *
 * This endpoint returns 410 Gone for backward compatibility.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'This endpoint is deprecated. The new auth flow uses Clerk + Supabase. ' +
        'Users are automatically provisioned via Stripe webhook.',
      migration: 'Please update to use the new /claim flow.',
    },
    { status: 410 }, // 410 Gone
  );
}
