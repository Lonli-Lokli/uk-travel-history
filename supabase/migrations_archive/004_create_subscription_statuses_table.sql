-- Migration: Create subscription_statuses reference table
-- Date: 2025-12-30
-- Description: Creates a reference table for subscription statuses instead of using ENUM
-- Related to Issue #120: Refactor subscription status handling

-- ============================================================================
-- Subscription Statuses Reference Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_statuses (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate with standard Stripe subscription statuses
INSERT INTO subscription_statuses (code, description, is_active) VALUES
  ('active', 'Subscription is active and paid', TRUE),
  ('past_due', 'Payment failed but subscription not cancelled yet', TRUE),
  ('canceled', 'Subscription has been cancelled', FALSE),
  ('trialing', 'In trial period', TRUE),
  ('incomplete', 'Initial payment failed', FALSE),
  ('unpaid', 'Payment failed and grace period ended', FALSE);

-- Enable RLS on subscription_statuses table
ALTER TABLE subscription_statuses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read subscription statuses (reference data)
CREATE POLICY subscription_statuses_select_all
  ON subscription_statuses
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Grant permissions
GRANT SELECT ON subscription_statuses TO authenticated;
GRANT ALL ON subscription_statuses TO service_role;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_subscription_statuses_code ON subscription_statuses(code);
CREATE INDEX IF NOT EXISTS idx_subscription_statuses_is_active ON subscription_statuses(is_active);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE subscription_statuses IS 'Reference table for subscription status codes (aligned with Stripe)';
COMMENT ON COLUMN subscription_statuses.code IS 'Status code (e.g., active, past_due, canceled)';
COMMENT ON COLUMN subscription_statuses.description IS 'Human-readable description of the status';
COMMENT ON COLUMN subscription_statuses.is_active IS 'Whether this status represents an active/valid subscription';
