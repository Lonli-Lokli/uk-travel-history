-- =============================================================================
-- UK Travel History - Database Seed Data
-- =============================================================================
-- This file contains reference data needed for the application to function.
-- It seeds lookup tables and configuration data (NOT user data).
--
-- This file is run:
--   - Automatically after migrations during `supabase db reset`
--   - Manually for local development setup
--
-- IMPORTANT: This should NOT contain user data. Only reference/config data.
-- =============================================================================

-- =============================================================================
-- Subscription Statuses (Reference Table)
-- =============================================================================
-- These map to Stripe subscription status codes

INSERT INTO subscription_statuses (code, description, is_active)
VALUES
  ('active', 'Subscription is active and paid', TRUE),
  ('past_due', 'Payment failed but subscription not cancelled yet', TRUE),
  ('canceled', 'Subscription has been cancelled', FALSE),
  ('trialing', 'In trial period', TRUE),
  ('incomplete', 'Initial payment failed', FALSE),
  ('unpaid', 'Payment failed and grace period ended', FALSE),
  ('paused', 'Subscription is paused and will resume later', FALSE)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- =============================================================================
-- Feature Policies (Feature Flag Configuration)
-- =============================================================================
-- Default feature flag settings matching production configuration

INSERT INTO feature_policies (feature_key, enabled, min_tier, rollout_percentage, beta_users)
VALUES
  -- Master switches (ANONYMOUS tier - affects all users)
  ('monetization', false, 'anonymous', NULL, '{}'),
  ('auth', false, 'anonymous', NULL, '{}'),
  ('payments', false, 'anonymous', NULL, '{}'),

  -- Premium features (PREMIUM tier - paid users only)
  ('excel_export', true, 'premium', NULL, '{}'),
  ('excel_import', true, 'premium', NULL, '{}'),
  ('pdf_import', false, 'premium', NULL, '{}'),

  -- Free features (ANONYMOUS tier - available to all)
  ('clipboard_import', true, 'anonymous', NULL, '{}'),

  -- UI features (ANONYMOUS tier)
  ('risk_chart', false, 'anonymous', NULL, '{}')
ON CONFLICT (feature_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  min_tier = EXCLUDED.min_tier,
  rollout_percentage = EXCLUDED.rollout_percentage,
  updated_at = NOW();

-- =============================================================================
-- Verification Queries (for testing)
-- =============================================================================
-- These can be run to verify seed data was applied correctly

-- SELECT 'subscription_statuses' as table_name, count(*) as row_count FROM subscription_statuses
-- UNION ALL
-- SELECT 'feature_policies' as table_name, count(*) as row_count FROM feature_policies;
