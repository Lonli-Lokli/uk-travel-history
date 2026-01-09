/**
 * GET /api/cron/supabase-keepalive
 * Vercel Cron endpoint to:
 * 1. Keep Supabase production database active (prevents auto-pause on free tier)
 * 2. Dispatch GitHub Actions workflow to refresh staging environment from production (daily)
 *
 * Runs daily at 12:00 UTC via Vercel Cron (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { keepalive } from '@uth/db';
import { getRouteLogger } from '@uth/flow';

export const runtime = 'nodejs';
export const maxDuration = 30; // Increased for GitHub API call

/**
 * Dispatch GitHub Actions workflow to refresh staging environment
 */
async function dispatchStagingRefresh(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const token = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE || 'supabase-env-refresh.yml';
  const ref = process.env.GITHUB_WORKFLOW_REF || 'master';

  // Skip if not configured (staging refresh is optional)
  if (!token || !owner || !repo) {
    getRouteLogger().warn('Staging refresh skipped: missing env vars', {
      extra: {
        hasToken: !!token,
        hasOwner: !!owner,
        hasRepo: !!repo,
      },
    });
    return { ok: true }; // Not an error, just not configured
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'vercel-cron-supabase-keepalive',
      },
      body: JSON.stringify({
        ref,
        inputs: { target: 'staging' },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const errorMsg = `GitHub API returned ${res.status}: ${text.slice(0, 500)}`;
      getRouteLogger().error('Staging refresh dispatch failed', {
        extra: { status: res.status, response: text.slice(0, 500) },
      });
      return { ok: false, error: errorMsg };
    }

    getRouteLogger().info('Staging refresh workflow dispatched', {
      extra: { workflow: workflowFile, ref, target: 'staging' },
    });
    return { ok: true };
  } catch (error: any) {
    getRouteLogger().error('Staging refresh dispatch error', error);
    return { ok: false, error: error.message };
  }
}

export async function GET(request: NextRequest) {
  const logger = getRouteLogger();

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

    // 1. Call database keepalive function
    const keepaliveResult = await keepalive();
    logger.info('Database keepalive successful', {
      extra: { result: keepaliveResult },
    });

    // 2. Dispatch staging refresh workflow
    const dispatchResult = await dispatchStagingRefresh();

    const ok = dispatchResult.ok;
    const status = ok ? 200 : 502;

    return NextResponse.json(
      {
        ok,
        timestamp: new Date().toISOString(),
        keepalive: { ok: true, result: keepaliveResult },
        stagingRefresh: dispatchResult,
      },
      { status },
    );
  } catch (error: any) {
    logger.error('Cron endpoint error', error);
    return NextResponse.json(
      { error: 'Cron endpoint failed', details: error.message },
      { status: 500 },
    );
  }
}
