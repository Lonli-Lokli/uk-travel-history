-- pgTAP tests for Row Level Security (RLS) policies
-- Run with: supabase test db

BEGIN;
SELECT plan(6);

-- Test that RLS policies exist for users table
SELECT policies_are('public', 'users', ARRAY[
  'Users can read own profile',
  'Users can update own profile'
], 'users table should have correct RLS policies');

-- Test that feature_policies table has RLS enabled (if it exists)
SELECT CASE
  WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'feature_policies')
  THEN is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'feature_policies'),
    true,
    'RLS should be enabled on feature_policies table'
  )
  ELSE pass('feature_policies table does not exist yet')
END;

-- Test that subscription_statuses table has RLS enabled (if it exists)
SELECT CASE
  WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscription_statuses')
  THEN is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscription_statuses'),
    true,
    'RLS should be enabled on subscription_statuses table'
  )
  ELSE pass('subscription_statuses table does not exist yet')
END;

-- Test that user_roles table has RLS enabled (if it exists)
SELECT CASE
  WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_roles')
  THEN is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_roles'),
    true,
    'RLS should be enabled on user_roles table'
  )
  ELSE pass('user_roles table does not exist yet')
END;

-- Test that webhook_events is service_role only (no user policies)
SELECT isnt_empty(
  $$SELECT 1 FROM pg_class WHERE relname = 'webhook_events' AND relrowsecurity = true$$,
  'webhook_events should have RLS enabled'
);

-- Test that purchase_intents has RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'purchase_intents'),
  true,
  'RLS should be enabled on purchase_intents table'
);

SELECT * FROM finish();
ROLLBACK;
