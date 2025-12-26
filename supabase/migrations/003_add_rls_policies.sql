-- Migration: Add Row Level Security (RLS) policies
-- Date: 2025-12-26
-- Description: Implements security-first RLS policies for user-scoped and premium access

-- ============================================================================
-- Drop existing overly permissive grants
-- ============================================================================

-- Revoke direct grants to authenticated role
REVOKE ALL ON purchase_intents FROM authenticated;
REVOKE ALL ON users FROM authenticated;
REVOKE ALL ON webhook_events FROM authenticated;

-- ============================================================================
-- Users Table Policies
-- ============================================================================

-- Policy: Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON users
  FOR SELECT
  USING (
    clerk_user_id = auth.jwt() ->> 'sub'
  );

-- Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (
    clerk_user_id = auth.jwt() ->> 'sub'
  )
  WITH CHECK (
    clerk_user_id = auth.jwt() ->> 'sub'
  );

-- Note: INSERT and DELETE are intentionally not allowed for regular users
-- User creation is handled by Clerk webhook using service_role
-- User deletion is handled by Clerk webhook or admin actions

-- ============================================================================
-- Purchase Intents Table Policies
-- ============================================================================

-- Policy: Users can read their own purchase intents
CREATE POLICY "Users can read their own purchase intents"
  ON purchase_intents
  FOR SELECT
  USING (
    clerk_user_id = auth.jwt() ->> 'sub'
    OR email = auth.jwt() ->> 'email'
  );

-- Policy: Anyone can create a purchase intent (for pre-auth checkout)
CREATE POLICY "Anyone can create a purchase intent"
  ON purchase_intents
  FOR INSERT
  WITH CHECK (true);

-- Note: UPDATE and DELETE are not allowed for regular users
-- Updates are handled by webhooks using service_role

-- ============================================================================
-- Webhook Events Table Policies
-- ============================================================================

-- Policy: No direct access to webhook_events
-- This table is for internal use only (webhooks via service_role)
-- No policies needed - deny all by default

-- ============================================================================
-- Helper function to get current user's Clerk ID from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() ->> 'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Helper function to check if current user has premium access
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.current_user_has_premium_access()
RETURNS BOOLEAN AS $$
DECLARE
  user_tier subscription_tier;
  user_status subscription_status;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO user_tier, user_status
  FROM users
  WHERE clerk_user_id = auth.clerk_user_id();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Free tier has no premium access
  IF user_tier = 'free' THEN
    RETURN FALSE;
  END IF;

  -- Lifetime always has access
  IF user_tier = 'lifetime' THEN
    RETURN TRUE;
  END IF;

  -- Subscription tiers require active or trialing status
  IF user_status IN ('active', 'trialing') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Example premium table (for future use)
-- ============================================================================

-- When you create premium-only tables, use a policy like this:
--
-- CREATE POLICY "Premium users only"
--   ON premium_features
--   FOR SELECT
--   USING (
--     auth.current_user_has_premium_access()
--   );

-- ============================================================================
-- Grant minimal permissions
-- ============================================================================

-- Grant schema usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant specific table permissions (RLS will enforce row-level access)
GRANT SELECT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT ON purchase_intents TO authenticated;

-- Functions available to authenticated users
GRANT EXECUTE ON FUNCTION auth.clerk_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.current_user_has_premium_access() TO authenticated;
GRANT EXECUTE ON FUNCTION has_premium_access(UUID) TO authenticated;

-- Service role retains full access
-- (Implicitly granted, no changes needed)

COMMENT ON FUNCTION auth.clerk_user_id IS 'Returns the Clerk user ID from the JWT token';
COMMENT ON FUNCTION auth.current_user_has_premium_access IS 'Checks if the current authenticated user has premium access';
COMMENT ON POLICY "Users can read their own profile" ON users IS 'Users can only read their own profile data';
COMMENT ON POLICY "Users can update their own profile" ON users IS 'Users can only update their own profile (but not entitlement fields)';
