-- pgTAP tests for Row Level Security (RLS) policies
-- Run with: supabase test db

BEGIN;
SELECT plan(6);

-- Test that RLS policies exist for users table
-- Policy names match baseline migration: users_select_own, users_update_own
SELECT policies_are('public', 'users', ARRAY[
  'users_select_own',
  'users_update_own'
], 'users table should have correct RLS policies');

-- Test that feature_policies table has RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'feature_policies' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on feature_policies table'
);

-- Test that subscription_statuses table has RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'subscription_statuses' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on subscription_statuses table'
);

-- Test that webhook_events is service_role only (no user policies)
SELECT isnt_empty(
  $$SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'webhook_events' AND n.nspname = 'public' AND c.relrowsecurity = true$$,
  'webhook_events should have RLS enabled'
);

-- Test that purchase_intents has RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'purchase_intents' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on purchase_intents table'
);

-- Test that seed data exists in subscription_statuses
SELECT isnt_empty(
  $$SELECT 1 FROM subscription_statuses WHERE code = 'active'$$,
  'subscription_statuses should have active status seeded'
);

SELECT * FROM finish();
ROLLBACK;
