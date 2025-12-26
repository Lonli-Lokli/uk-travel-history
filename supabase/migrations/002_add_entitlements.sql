-- Migration: Add entitlement fields for subscription management
-- Date: 2025-12-26
-- Description: Adds subscription_tier, subscription_status, and Stripe identifiers to users table

-- ============================================================================
-- Enums for subscription management
-- ============================================================================

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM (
  'free',      -- Free tier (default for new sign-ups)
  'monthly',   -- Monthly recurring subscription
  'yearly',    -- Yearly recurring subscription
  'lifetime'   -- Lifetime one-time purchase
);

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM (
  'active',      -- Subscription is active and paid
  'trialing',    -- In trial period
  'past_due',    -- Payment failed, grace period
  'canceled',    -- Subscription canceled
  'incomplete',  -- Initial payment incomplete
  'unpaid'       -- Payment failed, no access
);

-- ============================================================================
-- Add entitlement columns to users table
-- ============================================================================

ALTER TABLE users
  ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_status subscription_status DEFAULT NULL,
  ADD COLUMN stripe_customer_id TEXT DEFAULT NULL,
  ADD COLUMN stripe_subscription_id TEXT DEFAULT NULL,
  ADD COLUMN stripe_price_id TEXT DEFAULT NULL,
  ADD COLUMN current_period_end TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);

-- Add unique constraint on stripe_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id_unique
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- Update trigger for users.updated_at
-- ============================================================================

-- Trigger to auto-update updated_at on users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper function to check if user has premium access
-- ============================================================================

CREATE OR REPLACE FUNCTION has_premium_access(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tier subscription_tier;
  status subscription_status;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO tier, status
  FROM users
  WHERE id = user_id;

  -- Free tier has no premium access
  IF tier = 'free' THEN
    RETURN FALSE;
  END IF;

  -- Lifetime always has access
  IF tier = 'lifetime' THEN
    RETURN TRUE;
  END IF;

  -- Subscription tiers require active status
  IF status IN ('active', 'trialing') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Data migration: Set existing users to lifetime tier
-- ============================================================================

-- Existing users were created via payment, so they get lifetime access
UPDATE users
SET
  subscription_tier = 'lifetime',
  subscription_status = 'active'
WHERE subscription_tier = 'free';

COMMENT ON TABLE users IS 'Application users with entitlement tracking';
COMMENT ON COLUMN users.subscription_tier IS 'User subscription tier (free/monthly/yearly/lifetime)';
COMMENT ON COLUMN users.subscription_status IS 'Current subscription status (active/canceled/etc)';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID (null for lifetime)';
COMMENT ON COLUMN users.stripe_price_id IS 'Stripe price ID for current subscription';
COMMENT ON COLUMN users.current_period_end IS 'End of current billing period (null for lifetime)';
