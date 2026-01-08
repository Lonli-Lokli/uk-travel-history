-- Migration: Add multi_goal_tracking feature flag
-- Date: 2026-01-05
-- Description: Adds feature flag for multi-goal tracking system

-- Add multi_goal_tracking feature flag (disabled by default)
INSERT INTO feature_policies (feature_key, enabled, min_tier, rollout_percentage, beta_users)
VALUES ('multi_goal_tracking', false, 'anonymous', NULL, '{}')
ON CONFLICT (feature_key) DO NOTHING;
