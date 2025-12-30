-- Migration: Make subscription_status nullable and add FK to subscription_statuses table
-- Date: 2025-12-30
-- Description: Converts subscription_status from ENUM to nullable TEXT with FK constraint
-- Related to Issue #120: NULL status = free/non-paid user, non-NULL = paid user with status
--
-- Design rationale:
-- - Free tier users have NULL subscription_status (no payment, no status)
-- - Paid users have subscription_status referencing subscription_statuses table
-- - This cleanly separates free users from paid users semantically

-- ============================================================================
-- Step 1: Create new nullable column with FK constraint
-- ============================================================================

-- Add new column as TEXT (nullable by default)
ALTER TABLE users
  ADD COLUMN subscription_status_new TEXT;

-- ============================================================================
-- Step 2: Migrate existing data
-- ============================================================================

-- For free tier users: set to NULL (they have no paid subscription status)
UPDATE users
SET subscription_status_new = NULL
WHERE subscription_tier = 'free';

-- For paid tier users: preserve their existing status
UPDATE users
SET subscription_status_new = subscription_status::TEXT
WHERE subscription_tier IN ('monthly', 'yearly', 'lifetime');

-- ============================================================================
-- Step 3: Drop old ENUM column and rename new column
-- ============================================================================

-- Drop the old ENUM column
ALTER TABLE users
  DROP COLUMN subscription_status;

-- Rename the new column to subscription_status
ALTER TABLE users
  RENAME COLUMN subscription_status_new TO subscription_status;

-- ============================================================================
-- Step 4: Add foreign key constraint
-- ============================================================================

-- Add FK constraint to subscription_statuses table (only when not NULL)
ALTER TABLE users
  ADD CONSTRAINT fk_users_subscription_status
  FOREIGN KEY (subscription_status)
  REFERENCES subscription_statuses(code)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- ============================================================================
-- Step 5: Drop old ENUM type (no longer needed)
-- ============================================================================

DROP TYPE IF EXISTS subscription_status;

-- ============================================================================
-- Step 6: Update RLS policies to handle nullable status
-- ============================================================================

-- The existing RLS policies in 003_add_rls_policies.sql use IS NOT DISTINCT FROM
-- which already handles NULL correctly, so no changes needed

-- ============================================================================
-- Step 7: Update indexes
-- ============================================================================

-- Re-create index on subscription_status (now it's TEXT instead of ENUM)
DROP INDEX IF EXISTS idx_users_subscription_status;
CREATE INDEX IF NOT EXISTS idx_users_subscription_status
  ON users(subscription_status)
  WHERE subscription_status IS NOT NULL;

-- ============================================================================
-- Step 8: Update helper function for premium access check
-- ============================================================================

-- Update has_premium_access function to handle NULL status and grace period
-- NULL status means free user, but they may have grace period access
-- Grace period: after cancellation, user keeps access until current_period_end
CREATE OR REPLACE FUNCTION has_premium_access(user_row users)
RETURNS BOOLEAN AS $$
BEGIN
  -- Free tier users with NULL status
  IF user_row.subscription_status IS NULL THEN
    -- Check if they have a valid grace period
    -- Grace period allows access even after downgrade to free tier
    IF user_row.current_period_end IS NOT NULL
       AND user_row.current_period_end > NOW() THEN
      RETURN TRUE;  -- Grace period still active
    END IF;
    RETURN FALSE;  -- Fully free, no access
  END IF;

  -- Paid tier users must have active or trialing status
  RETURN user_row.subscription_tier IN ('monthly', 'yearly', 'lifetime')
    AND user_row.subscription_status IN ('active', 'trialing');
END;
$$ LANGUAGE plpgsql STABLE;  -- Changed from IMMUTABLE because uses NOW()

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN users.subscription_status IS 'Subscription status code from subscription_statuses table. NULL = free/non-paid user, non-NULL = paid user with specific status';
