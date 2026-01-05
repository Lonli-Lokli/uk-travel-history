-- Migration: Add user role field for admin access control
-- Date: 2026-01-05
-- Description: Adds role field to users table with standard/admin values
-- Related to Issue #126: Introduce user roles and enforce admin-only access

-- ============================================================================
-- User Role Enum
-- ============================================================================

CREATE TYPE user_role AS ENUM ('standard', 'admin');

-- ============================================================================
-- Add Role Field to Users Table
-- ============================================================================

ALTER TABLE users
  ADD COLUMN role user_role NOT NULL DEFAULT 'standard';

-- Index for efficient role-based queries
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- Update RLS Policies to Prevent Role Escalation
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS users_update_own ON users;

-- Recreate with role protection (users cannot modify their own role)
CREATE POLICY users_update_own
  ON users
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = public.clerk_user_id())
  WITH CHECK (
    clerk_user_id = public.clerk_user_id() AND
    -- Prevent modification of role field (only service_role can modify this)
    role = (SELECT role FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    -- Prevent modification of entitlement fields (only service_role can modify these)
    subscription_tier = (SELECT subscription_tier FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_price_id IS NOT DISTINCT FROM (SELECT stripe_price_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    pause_resumes_at IS NOT DISTINCT FROM (SELECT pause_resumes_at FROM users WHERE clerk_user_id = public.clerk_user_id())
  );

COMMENT ON POLICY users_update_own ON users IS 'Users can update own profile but not role or entitlement fields';

-- ============================================================================
-- Helper Functions for Role Checking
-- ============================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
DECLARE
  user_record users;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE clerk_user_id = public.clerk_user_id();

  IF NOT FOUND THEN
    RETURN 'standard';
  END IF;

  RETURN user_record.role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant access to functions
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON COLUMN users.role IS 'User role: standard (default) or admin (privileged access)';
COMMENT ON FUNCTION public.current_user_role() IS 'Returns the current user''s role (standard if not found)';
COMMENT ON FUNCTION public.current_user_is_admin() IS 'Returns true if current user has admin role';
