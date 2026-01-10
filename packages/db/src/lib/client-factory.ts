/**
 * Factory functions for creating Supabase clients with different access levels
 *
 * SECURITY MODEL:
 * - User-scoped clients use the anon key + Clerk JWT token (RLS enforced)
 * - Admin clients use the service_role key (RLS bypassed, for webhooks only)
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../internal/providers/supabase.types';

/**
 * Create a user-scoped Supabase client
 *
 * This client uses the ANON key and includes the user's Clerk JWT token
 * for authentication. Row Level Security (RLS) policies will enforce
 * that users can only access their own data.
 *
 * @param clerkToken - The Clerk JWT token from the authenticated user
 * @returns Supabase client configured for user-scoped access
 *
 * @example
 * // Server-side (API route or Server Component)
 * import { auth } from '@clerk/nextjs/server';
 *
 * const { getToken } = await auth();
 * const token = await getToken({ template: 'supabase' });
 * const client = createUserScopedClient(token);
 *
 * @example
 * // Client-side (React component)
 * import { useAuth } from '@clerk/nextjs';
 *
 * const { getToken } = useAuth();
 * const token = await getToken({ template: 'supabase' });
 * const client = createUserScopedClient(token);
 */
export function createUserScopedClient(
  clerkToken: string | null,
): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    );
  }

  // Create client with anon key
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: clerkToken
        ? {
            Authorization: `Bearer ${clerkToken}`,
          }
        : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

/**
 * Create an admin Supabase client
 *
 * This client uses the SERVICE_ROLE key and BYPASSES Row Level Security.
 * It should ONLY be used in:
 * - Webhook handlers (Clerk, Stripe)
 * - Server-side admin operations
 * - Background jobs
 *
 * NEVER use this client in user-facing request paths.
 *
 * @returns Supabase client configured with service_role access
 *
 * @example
 * // Webhook handler
 * export async function POST(request: Request) {
 *   // Verify webhook signature first!
 *   const client = createAdminClient();
 *   await client.from('users').insert({ ... });
 * }
 */
export function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase service role configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Check if a user has premium access
 *
 * This is a convenience function that queries the database to check
 * entitlement status. Use this for server-side access control.
 *
 * @param clerkUserId - The Clerk user ID to check
 * @returns Promise resolving to true if user has premium access
 */
export async function checkUserHasPremiumAccess(
  clerkUserId: string,
): Promise<boolean> {
  const client = createAdminClient();

  // Note: Using type assertion because RPC function types aren't defined in Database type
  const { data, error } = await (client.rpc as any)('has_premium_access', {
    user_id: clerkUserId,
  });

  if (error) {
    console.error('Error checking premium access:', error);
    return false;
  }

  return data ?? false;
}
