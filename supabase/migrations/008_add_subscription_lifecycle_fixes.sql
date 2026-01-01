-- ============================================================================
-- Migration: Fix subscription lifecycle handling
-- Date: 2026-01-01
-- Description: Adds missing constraints, paused status, and lifecycle tracking
-- Related to Issue #128: Audit & Fix Subscription Lifecycle Handling
-- ============================================================================

-- ============================================================================
-- Step 1: Add 'paused' status to subscription_status enum
-- ============================================================================

-- Add new status value to existing enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'paused';

COMMENT ON TYPE subscription_status IS 'Stripe subscription statuses: active, past_due, canceled, trialing, incomplete, unpaid, paused';

-- ============================================================================
-- Step 2: Add unique constraints for Stripe identifiers
-- ============================================================================

-- Prevent duplicate Stripe customers
-- Only enforce uniqueness on non-NULL values (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id_unique
  ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Prevent duplicate Stripe subscriptions
-- Only enforce uniqueness on non-NULL values (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_subscription_id_unique
  ON users(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- Step 3: Add fields for advanced subscription lifecycle tracking
-- ============================================================================

-- Track scheduled cancellations (cancel_at_period_end)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Track when subscription will resume (for paused subscriptions)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pause_resumes_at TIMESTAMPTZ;

COMMENT ON COLUMN users.cancel_at_period_end IS 'True if subscription is scheduled to cancel at period end (Stripe cancel_at_period_end flag)';
COMMENT ON COLUMN users.pause_resumes_at IS 'When a paused subscription will resume (from Stripe pause_collection.resumes_at)';

-- ============================================================================
-- Step 4: Add indexes for new fields
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_cancel_at_period_end
  ON users(cancel_at_period_end)
  WHERE cancel_at_period_end = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_pause_resumes_at
  ON users(pause_resumes_at)
  WHERE pause_resumes_at IS NOT NULL;

-- ============================================================================
-- Step 5: Update has_premium_access function to handle new states
-- ============================================================================

CREATE OR REPLACE FUNCTION has_premium_access(user_row users)
RETURNS BOOLEAN AS $$
BEGIN
  -- Premium access if:
  -- 1. Paid tier (monthly, yearly, lifetime)
  -- 2. Active or trialing status
  -- 3. OR scheduled for cancellation but still in current period
  RETURN (
    user_row.subscription_tier IN ('monthly', 'yearly', 'lifetime')
    AND (
      user_row.subscription_status IN ('active', 'trialing')
      OR (
        -- Grace period: scheduled cancellation but period hasn't ended
        user_row.cancel_at_period_end = TRUE
        AND user_row.current_period_end IS NOT NULL
        AND user_row.current_period_end > NOW()
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION has_premium_access IS 'Determines if user has premium access considering active subscriptions, trials, and grace periods for scheduled cancellations';

-- ============================================================================
-- Step 6: Add validation for paused status
-- ============================================================================

-- Paused subscriptions must have a resume date
ALTER TABLE users
  ADD CONSTRAINT check_paused_has_resume_date
  CHECK (
    subscription_status != 'paused'
    OR pause_resumes_at IS NOT NULL
  );

COMMENT ON CONSTRAINT check_paused_has_resume_date ON users IS
  'Ensures paused subscriptions always have a resume date (pause_resumes_at)';

-- ============================================================================
-- Step 7: Data cleanup for existing users
-- ============================================================================

-- Set cancel_at_period_end to false for all existing users (safe default)
UPDATE users
SET cancel_at_period_end = FALSE
WHERE cancel_at_period_end IS NULL;

-- Make cancel_at_period_end non-nullable with default
ALTER TABLE users
  ALTER COLUMN cancel_at_period_end SET NOT NULL,
  ALTER COLUMN cancel_at_period_end SET DEFAULT FALSE;
