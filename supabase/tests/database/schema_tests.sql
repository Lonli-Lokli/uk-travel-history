-- pgTAP tests for database schema
-- Run with: supabase test db

BEGIN;
SELECT plan(15);

-- Test that required extensions are enabled
SELECT has_extension('uuid-ossp', 'uuid-ossp extension should be enabled');

-- Test that core tables exist
SELECT has_table('users', 'users table should exist');
SELECT has_table('purchase_intents', 'purchase_intents table should exist');
SELECT has_table('webhook_events', 'webhook_events table should exist');

-- Test that RLS is enabled on all tables
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'users'),
  true,
  'RLS should be enabled on users table'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'purchase_intents'),
  true,
  'RLS should be enabled on purchase_intents table'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'webhook_events'),
  true,
  'RLS should be enabled on webhook_events table'
);

-- Test users table structure
SELECT has_column('users', 'id', 'users should have id column');
SELECT has_column('users', 'clerk_user_id', 'users should have clerk_user_id column');
SELECT has_column('users', 'email', 'users should have email column');
SELECT has_column('users', 'created_at', 'users should have created_at column');

-- Test purchase_intents table structure
SELECT has_column('purchase_intents', 'id', 'purchase_intents should have id column');
SELECT has_column('purchase_intents', 'status', 'purchase_intents should have status column');
SELECT has_column('purchase_intents', 'email', 'purchase_intents should have email column');

-- Test indexes exist
SELECT has_index('users', 'idx_users_clerk_user_id', 'users should have clerk_user_id index');
SELECT has_index('purchase_intents', 'idx_purchase_intents_email', 'purchase_intents should have email index');

SELECT * FROM finish();
ROLLBACK;
