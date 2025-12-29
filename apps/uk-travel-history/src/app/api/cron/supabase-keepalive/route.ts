/**
 * GET /api/cron/supabase-keepalive
 * Vercel Cron endpoint to keep Supabase Free tier active
 * Prevents automatic pause due to inactivity
 */

import { NextRequest, NextResponse } from 'next/server';
import { keepalive } from '@uth/db';
import { getRouteLogger } from '@uth/flow';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      getRouteLogger().error('CRON_SECRET not configured', undefined);
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      getRouteLogger().error('Invalid cron secret', undefined);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call database keepalive function
    const result = await keepalive();

    getRouteLogger().info('Database keepalive successful', {
      extra: { result },
    });

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    getRouteLogger().error('Keepalive error', error);
    return NextResponse.json(
      { error: 'Keepalive failed', details: error.message },
      { status: 500 },
    );
  }
}
