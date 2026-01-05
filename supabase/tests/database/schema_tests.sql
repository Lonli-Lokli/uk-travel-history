-- pgTAP tests for database schema
-- Run with: supabase test db

BEGIN;
SELECT plan(31);

-- ==========================================================================
-- Test that required extensions are enabled
-- ==========================================================================
SELECT has_extension('uuid-ossp', 'uuid-ossp extension should be enabled');

-- ==========================================================================
-- Test that core tables exist
-- ==========================================================================
SELECT has_table('users', 'users table should exist');
SELECT has_table('purchase_intents', 'purchase_intents table should exist');
SELECT has_table('webhook_events', 'webhook_events table should exist');
SELECT has_table('subscription_statuses', 'subscription_statuses table should exist');
SELECT has_table('feature_policies', 'feature_policies table should exist');
SELECT has_table('tracking_goals', 'tracking_goals table should exist');
SELECT has_table('goal_templates', 'goal_templates table should exist');

-- ==========================================================================
-- Test that RLS is enabled on all tables
-- ==========================================================================
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'users' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on users table'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'purchase_intents' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on purchase_intents table'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
   WHERE c.relname = 'webhook_events' AND n.nspname = 'public'),
  true,
  'RLS should be enabled on webhook_events table'
);

-- ==========================================================================
-- Test users table structure
-- ==========================================================================
SELECT has_column('users', 'id', 'users should have id column');
SELECT has_column('users', 'clerk_user_id', 'users should have clerk_user_id column');
SELECT has_column('users', 'email', 'users should have email column');
SELECT has_column('users', 'subscription_tier', 'users should have subscription_tier column');
SELECT has_column('users', 'subscription_status', 'users should have subscription_status column');
SELECT has_column('users', 'created_at', 'users should have created_at column');

-- ==========================================================================
-- Test purchase_intents table structure
-- ==========================================================================
SELECT has_column('purchase_intents', 'id', 'purchase_intents should have id column');
SELECT has_column('purchase_intents', 'status', 'purchase_intents should have status column');
SELECT has_column('purchase_intents', 'email', 'purchase_intents should have email column');

-- ==========================================================================
-- Test indexes exist
-- ==========================================================================
SELECT has_index('users', 'idx_users_clerk_user_id', 'users should have clerk_user_id index');
SELECT has_index('purchase_intents', 'idx_purchase_intents_email', 'purchase_intents should have email index');

-- ==========================================================================
-- Test subscription_tier enum values
-- ==========================================================================
SELECT is(
  (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = 'subscription_tier'::regtype),
  4::bigint,
  'subscription_tier enum should have 4 values (free, monthly, yearly, lifetime)'
);

-- ==========================================================================
-- Test seed data exists
-- ==========================================================================
SELECT is(
  (SELECT COUNT(*) FROM subscription_statuses),
  7::bigint,
  'subscription_statuses should have 7 rows seeded'
);

SELECT is(
  (SELECT COUNT(*) FROM feature_policies),
  9::bigint,
  'feature_policies should have 9 rows seeded'
);

-- ==========================================================================
-- Test key reference data
-- ==========================================================================
SELECT isnt_empty(
  $$SELECT 1 FROM subscription_statuses WHERE code = 'active' AND is_active = true$$,
  'active subscription status should exist and be marked active'
);

-- ==========================================================================
-- Test tracking_goals table structure
-- ==========================================================================
SELECT has_column('tracking_goals', 'id', 'tracking_goals should have id column');
SELECT has_column('tracking_goals', 'user_id', 'tracking_goals should have user_id column');
SELECT has_column('tracking_goals', 'type', 'tracking_goals should have type column');
SELECT has_column('tracking_goals', 'config', 'tracking_goals should have config column');

-- ==========================================================================
-- Test goal_templates has seed data
-- ==========================================================================
SELECT is(
  (SELECT COUNT(*) FROM goal_templates),
  9::bigint,
  'goal_templates should have 9 rows seeded'
);

SELECT * FROM finish();
ROLLBACK;
