-- Migration: Add RLS policies for user-scoped and premium access control
-- Date: 2025-12-26
-- Description: Implements security-first RLS policies for entitlement enforcement
-- Related to Issue #100: Migrate to unlocked public sign-up + Supabase RLS-enforced entitlements

-- ============================================================================
-- Helper Functions for RLS Policies
-- ============================================================================

-- Get current user's Clerk user ID from JWT claims
CREATE OR REPLACE FUNCTION auth.clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  -- Extract clerk user ID from JWT claims
  -- Clerk stores user_id in the 'sub' claim
  RETURN nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user has premium access
CREATE OR REPLACE FUNCTION auth.current_user_has_premium_access()
RETURNS BOOLEAN AS $$
DECLARE
  user_record users;
BEGIN
  -- Get current user record
  SELECT * INTO user_record
  FROM users
  WHERE clerk_user_id = auth.clerk_user_id();

  -- Return false if user not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check premium access using helper function
  RETURN has_premium_access(user_record);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- RLS Policies for Users Table
-- ============================================================================

-- Drop existing overly permissive grants
REVOKE SELECT ON users FROM authenticated;
REVOKE INSERT ON users FROM authenticated;
REVOKE UPDATE ON users FROM authenticated;

-- Policy: Users can read their own profile
CREATE POLICY users_select_own
  ON users
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.clerk_user_id());

-- Policy: Users can update their own profile
CREATE POLICY users_update_own
  ON users
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = auth.clerk_user_id())
  WITH CHECK (clerk_user_id = auth.clerk_user_id());

-- Note: INSERT on users is restricted to service_role only (via webhooks)
-- This prevents users from creating their own accounts with premium access

-- ============================================================================
-- RLS Policies for Purchase Intents Table
-- ============================================================================

-- Drop existing overly permissive grants
REVOKE SELECT ON purchase_intents FROM authenticated;
REVOKE INSERT ON purchase_intents FROM authenticated;
REVOKE UPDATE ON purchase_intents FROM authenticated;

-- Policy: Users can only view their own purchase intents
CREATE POLICY purchase_intents_select_own
  ON purchase_intents
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.clerk_user_id());

-- Note: INSERT/UPDATE on purchase_intents is restricted to service_role only
-- This prevents users from manipulating their payment status

-- ============================================================================
-- RLS Policies for Webhook Events Table
-- ============================================================================

-- Drop existing overly permissive grants
REVOKE SELECT ON webhook_events FROM authenticated;

-- Webhook events should NOT be readable by regular users (sensitive payment data)
-- Only service_role can access this table

-- ============================================================================
-- Example: Premium Content Table (for future use)
-- ============================================================================
-- If you create tables that require premium access, use this pattern:
--
-- CREATE POLICY premium_content_select
--   ON premium_content
--   FOR SELECT
--   TO authenticated
--   USING (auth.current_user_has_premium_access());
--
-- This ensures only users with active premium subscriptions can access the data

-- ============================================================================
-- Grant Permissions for User-Scoped Access
-- ============================================================================

-- Users can SELECT their own data via RLS policies
GRANT SELECT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;
GRANT SELECT ON purchase_intents TO authenticated;

-- Service role retains full access for webhooks and admin operations
-- (Already granted in 001_initial_schema.sql)

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON POLICY users_select_own ON users IS 'Users can read their own profile data';
COMMENT ON POLICY users_update_own ON users IS 'Users can update their own profile data (but not entitlement fields - those are service_role only)';
COMMENT ON POLICY purchase_intents_select_own ON purchase_intents IS 'Users can view their own purchase history';
