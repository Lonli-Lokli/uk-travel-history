-- Migration: Add subscription entitlement fields to users table
-- Date: 2025-12-26
-- Description: Adds tier, status, and Stripe identifiers for subscription management
-- Related to Issue #100: Migrate to unlocked public sign-up + Supabase RLS-enforced entitlements

-- ============================================================================
-- Subscription Tier and Status Enums
-- ============================================================================

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('free', 'monthly', 'yearly', 'lifetime');

-- Subscription statuses (aligned with Stripe subscription statuses)
CREATE TYPE subscription_status AS ENUM (
  'active',      -- Subscription is active and paid
  'past_due',    -- Payment failed but subscription not cancelled yet
  'canceled',    -- Subscription has been cancelled
  'trialing',    -- In trial period
  'incomplete',  -- Initial payment failed
  'unpaid'       -- Payment failed and grace period ended
);

-- ============================================================================
-- Add Entitlement Fields to Users Table
-- ============================================================================

ALTER TABLE users
  ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'active',
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN stripe_subscription_id TEXT,
  ADD COLUMN stripe_price_id TEXT,
  ADD COLUMN current_period_end TIMESTAMPTZ;

-- Indexes for efficient entitlement queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- Helper Function: Check Premium Access
-- ============================================================================

CREATE OR REPLACE FUNCTION has_premium_access(user_row users)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_row.subscription_tier IN ('monthly', 'yearly', 'lifetime')
    AND user_row.subscription_status IN ('active', 'trialing');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Migrate Existing Users
-- ============================================================================

-- Set all existing users to 'lifetime' tier (they paid for one-time access)
-- This preserves backward compatibility with the previous payment model
UPDATE users
SET
  subscription_tier = 'lifetime',
  subscription_status = 'active'
WHERE subscription_tier = 'free';  -- Only update users still on default 'free'

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN users.subscription_tier IS 'User subscription tier: free (default), monthly, yearly, or lifetime (one-time purchase)';
COMMENT ON COLUMN users.subscription_status IS 'Stripe subscription status: active, past_due, canceled, trialing, incomplete, or unpaid';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing management';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID (null for one-time lifetime purchases)';
COMMENT ON COLUMN users.stripe_price_id IS 'Stripe price ID for the current subscription/purchase';
COMMENT ON COLUMN users.current_period_end IS 'End date of current subscription period (null for lifetime)';
