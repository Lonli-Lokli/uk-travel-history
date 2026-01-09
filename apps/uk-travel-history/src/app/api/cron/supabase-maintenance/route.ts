/**
 * GET /api/cron/supabase-maintenance
 * Vercel Cron endpoint for combined Supabase maintenance:
 * 1. Keepalive: Prevents automatic pause on Free tier
 * 2. Refresh dispatcher: Triggers GitHub Actions to refresh staging/weekly/monthly DBs
 *
 * Runs daily at 2:00 UTC (Vercel Hobby: within the hour)
 * - Always: staging refresh
 * - Sundays: weekly refresh
 * - 1st of month: monthly refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { keepalive } from '@uth/db';
import { getRouteLogger } from '@uth/flow';

export const runtime = 'nodejs';
export const maxDuration = 30; // Allow more time for GitHub API calls

type Target = 'staging' | 'weekly' | 'monthly';

interface KeepaliveResult {
  ok: boolean;
  status: number;
  body: string;
}

interface DispatchResult {
  target: Target;
  ok: boolean;
  error?: string;
}

/**
 * Verify the request is authorized via CRON_SECRET
 */
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get('authorization') || '';
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Call Supabase auth health endpoint for keepalive
 * Uses auth/v1/health which is lightweight and reliable
 */
async function supabaseAuthHealth(
  url: string,
  anonKey: string,
): Promise<KeepaliveResult> {
  try {
    const healthUrl = `${url.replace(/\/$/, '')}/auth/v1/health`;
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    return {
      ok: res.ok,
      status: res.status,
      body: text.slice(0, 2000),
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      body: error.message || String(error),
    };
  }
}

/**
 * Dispatch GitHub Actions workflow via workflow_dispatch API
 */
async function dispatchWorkflow(target: Target): Promise<void> {
  const token = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE; // "supabase-env-refresh.yml"
  const ref = process.env.GITHUB_WORKFLOW_REF || 'master';

  if (!token || !owner || !repo || !workflowFile) {
    throw new Error(
      'Missing env vars: GITHUB_ACTIONS_DISPATCH_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW_FILE',
    );
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'vercel-cron-supabase-maintenance',
    },
    body: JSON.stringify({
      ref,
      inputs: { target },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Dispatch failed (${target}): ${res.status} ${res.statusText} :: ${text.slice(0, 2000)}`,
    );
  }
}

export async function GET(request: NextRequest) {
  const logger = getRouteLogger();

  try {
    // 1. Verify authorization
    if (!isAuthorized(request)) {
      logger.error('Invalid cron secret', undefined);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sunday
    const dayOfMonth = now.getUTCDate(); // 1..31

    // 2. Determine which environments to refresh
    const targets: Target[] = ['staging'];
    if (dayOfWeek === 0) targets.push('weekly');
    if (dayOfMonth === 1) targets.push('monthly');

    logger.info('Starting Supabase maintenance', {
      extra: {
        ranAtUtc: now.toISOString(),
        targets,
      },
    });

    // 3. Keepalive: Call auth health endpoints for staging and production
    const keepaliveResults: Record<string, KeepaliveResult | { skipped: boolean; reason: string }> = {};

    const stagingUrl = process.env.SUPABASE_KEEPALIVE_STAGING_URL || '';
    const stagingAnon = process.env.SUPABASE_KEEPALIVE_STAGING_ANON_KEY || '';
    if (stagingUrl && stagingAnon) {
      keepaliveResults.staging = await supabaseAuthHealth(stagingUrl, stagingAnon);
    } else {
      keepaliveResults.staging = {
        skipped: true,
        reason: 'Missing SUPABASE_KEEPALIVE_STAGING_URL/ANON_KEY',
      };
    }

    const prodUrl = process.env.SUPABASE_KEEPALIVE_PROD_URL || '';
    const prodAnon = process.env.SUPABASE_KEEPALIVE_PROD_ANON_KEY || '';
    if (prodUrl && prodAnon) {
      keepaliveResults.production = await supabaseAuthHealth(prodUrl, prodAnon);
    } else {
      keepaliveResults.production = {
        skipped: true,
        reason: 'Missing SUPABASE_KEEPALIVE_PROD_URL/ANON_KEY',
      };
    }

    // Also call the existing keepalive function from @uth/db
    let dbKeepaliveResult: number | null = null;
    try {
      dbKeepaliveResult = await keepalive();
    } catch (error: any) {
      logger.error('DB keepalive error', error);
    }

    // 4. Dispatch GitHub Actions workflows (sequential for readable logs)
    const dispatchResults: DispatchResult[] = [];
    for (const target of targets) {
      try {
        await dispatchWorkflow(target);
        dispatchResults.push({ target, ok: true });
        logger.info(`Dispatched refresh workflow: ${target}`, undefined);
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        dispatchResults.push({ target, ok: false, error: errorMsg });
        logger.error(`Failed to dispatch workflow: ${target}`, error);
      }
    }

    // 5. Determine overall success
    const allKeepaliveOk = Object.values(keepaliveResults).every(
      (r) => ('skipped' in r && r.skipped) || ('ok' in r && r.ok),
    );
    const allDispatchOk = dispatchResults.every((r) => r.ok);
    const overallOk = allKeepaliveOk && allDispatchOk;

    const responseData = {
      ok: overallOk,
      ranAtUtc: now.toISOString(),
      keepalive: {
        ...keepaliveResults,
        db: dbKeepaliveResult !== null ? { ok: true, result: dbKeepaliveResult } : { ok: false },
      },
      dispatched: dispatchResults,
    };

    logger.info('Supabase maintenance complete', {
      extra: responseData,
    });

    return NextResponse.json(responseData, { status: overallOk ? 200 : 502 });
  } catch (error: any) {
    logger.error('Supabase maintenance error', error);
    return NextResponse.json(
      {
        error: 'Maintenance failed',
        details: error.message || String(error),
      },
      { status: 500 },
    );
  }
}
