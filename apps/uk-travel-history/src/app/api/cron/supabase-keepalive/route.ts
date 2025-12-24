/**
 * GET /api/cron/supabase-keepalive
 * Vercel Cron endpoint to keep Supabase Free tier active
 * Prevents automatic pause due to inactivity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@uth/db';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', undefined);
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Invalid cron secret', undefined);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Supabase keepalive function
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc('keepalive');

    if (error) {
      logger.error('Keepalive RPC error', error);
      return NextResponse.json(
        { error: 'Keepalive failed', details: error.message },
        { status: 500 },
      );
    }

    logger.info('Supabase keepalive successful', { extra: { result: data } });

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (error: any) {
    logger.error('Keepalive error', error);
    return NextResponse.json(
      { error: 'Keepalive failed', details: error.message },
      { status: 500 },
    );
  }
}
