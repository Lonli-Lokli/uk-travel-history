/**
 * Supabase client utility
 * Provides configured Supabase clients for server and client usage
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase client for server-side usage (with service role key)
 * Use this only in server-side code (API routes, server components)
 */
export function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase client for client-side usage (with anon key)
 * Use this in browser/client components
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
