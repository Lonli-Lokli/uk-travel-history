-- ============================================================================
-- Migration: Add subscription tier/status consistency constraints
-- Date: 2025-12-30
-- Description: Prevents inconsistent subscription_tier + subscription_status combinations
-- Related to Issue #120 and PR #122
-- ============================================================================
--
-- Design rationale:
-- - Free tier users MUST have NULL subscription_status (no paid subscription)
-- - Paid tier users MUST have non-NULL subscription_status (from reference table)
-- - This constraint enforces the business rule at database level
--
-- This prevents bugs like:
-- - Free users with 'active' status (from adapter logic bug)
-- - Free users with 'canceled' status (from cancellation handler bug)
-- - Paid users with NULL status (from update logic bugs)

-- ============================================================================
-- Step 1: Verify existing data complies with constraint
-- ============================================================================

-- Check for inconsistent rows before applying constraint
DO $$
DECLARE
  inconsistent_count INTEGER;
  sample_rows TEXT;
BEGIN
  -- Count inconsistent rows
  SELECT COUNT(*)
  INTO inconsistent_count
  FROM users
  WHERE NOT (
    (subscription_tier = 'free' AND subscription_status IS NULL)
    OR
    (subscription_tier IN ('monthly', 'yearly', 'lifetime') AND subscription_status IS NOT NULL)
  );

  IF inconsistent_count > 0 THEN
    -- Get sample of inconsistent rows for debugging
    SELECT string_agg(
      format('id=%s, tier=%s, status=%s', id, subscription_tier, COALESCE(subscription_status, 'NULL')),
      '; '
    )
    INTO sample_rows
    FROM (
      SELECT id, subscription_tier, subscription_status
      FROM users
      WHERE NOT (
        (subscription_tier = 'free' AND subscription_status IS NULL)
        OR
        (subscription_tier IN ('monthly', 'yearly', 'lifetime') AND subscription_status IS NOT NULL)
      )
      LIMIT 5
    ) sample;

    RAISE EXCEPTION 'Found % users with inconsistent subscription_tier/subscription_status. Sample rows: %. Clean up data before applying constraint.',
      inconsistent_count, sample_rows;
  END IF;

  RAISE NOTICE 'Data validation passed: all users have consistent tier/status';
END $$;

-- ============================================================================
-- Step 2: Add CHECK constraint
-- ============================================================================

-- Add constraint to ensure:
-- - Free tier users have NULL subscription_status
-- - Paid tier users have non-NULL subscription_status
ALTER TABLE users
  ADD CONSTRAINT check_subscription_tier_status_consistency
  CHECK (
    (subscription_tier = 'free' AND subscription_status IS NULL)
    OR
    (subscription_tier IN ('monthly', 'yearly', 'lifetime') AND subscription_status IS NOT NULL)
  );

-- ============================================================================
-- Step 3: Add documentation
-- ============================================================================

COMMENT ON CONSTRAINT check_subscription_tier_status_consistency ON users IS
  'Enforces business rule: free tier = NULL status, paid tier = non-NULL status. Prevents inconsistent states like free+active or paid+NULL.';
