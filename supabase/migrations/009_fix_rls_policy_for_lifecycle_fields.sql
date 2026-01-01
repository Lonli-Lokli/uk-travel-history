-- ============================================================================
-- Migration: Fix RLS policy to protect new subscription lifecycle fields
-- Date: 2026-01-01
-- Description: Adds cancel_at_period_end and pause_resumes_at to RLS policy
-- Related to Issue #128: Audit & Fix Subscription Lifecycle Handling
-- ============================================================================

-- Ensure the clerk_user_id() helper function exists
-- This function is originally created in migration 003, but we recreate it here
-- to make this migration more self-contained and idempotent
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  -- Extract clerk user ID from JWT claims
  -- Clerk stores user_id in the 'sub' claim
  RETURN nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS users_update_own ON users;

-- Recreate with protection for new entitlement fields
CREATE POLICY users_update_own
  ON users
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = public.clerk_user_id())
  WITH CHECK (
    clerk_user_id = public.clerk_user_id() AND
    -- Prevent modification of entitlement fields (only webhooks can modify these)
    subscription_tier = (SELECT subscription_tier FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    stripe_price_id IS NOT DISTINCT FROM (SELECT stripe_price_id FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    cancel_at_period_end IS NOT DISTINCT FROM (SELECT cancel_at_period_end FROM users WHERE clerk_user_id = public.clerk_user_id()) AND
    pause_resumes_at IS NOT DISTINCT FROM (SELECT pause_resumes_at FROM users WHERE clerk_user_id = public.clerk_user_id())
  );

COMMENT ON POLICY users_update_own ON users IS 'Users can update their own profile data (but not entitlement fields - those are service_role only)';
