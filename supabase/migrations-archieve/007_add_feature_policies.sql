-- Migration: Add feature_policies table for runtime feature flag configuration
-- Date: 2025-12-30
-- Description: Migrate from Vercel Edge Config to Supabase for feature flags storage
-- Related to Issue #124: Reduce Edge Config reads by moving to Supabase with caching

-- ============================================================================
-- Feature Policies Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  min_tier TEXT NOT NULL DEFAULT 'anonymous',
  rollout_percentage INTEGER CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowlist TEXT[] DEFAULT '{}',
  denylist TEXT[] DEFAULT '{}',
  beta_users TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups by feature_key
CREATE INDEX IF NOT EXISTS idx_feature_policies_feature_key ON public.feature_policies(feature_key);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_policies_updated_at
  BEFORE UPDATE ON public.feature_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS Policies for Feature Policies Table
-- ============================================================================

-- Enable RLS on feature_policies table
ALTER TABLE public.feature_policies ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read feature policies
-- This is safe because feature policies don't contain sensitive data
-- They just define what features are available and to whom
CREATE POLICY feature_policies_select_all
  ON public.feature_policies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow anonymous reads for feature policies
-- This is necessary for public pages to check feature flags
CREATE POLICY feature_policies_select_anonymous
  ON public.feature_policies
  FOR SELECT
  TO anon
  USING (true);

-- Note: INSERT/UPDATE/DELETE on feature_policies is restricted to service_role only
-- This prevents users from manipulating feature flags

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant SELECT to authenticated users
GRANT SELECT ON public.feature_policies TO authenticated;

-- Grant SELECT to anonymous users
GRANT SELECT ON public.feature_policies TO anon;

-- Service role retains full access (already granted by default)

-- ============================================================================
-- Seed Default Feature Policies
-- ============================================================================

-- Insert default feature policies matching the current Edge Config defaults
INSERT INTO public.feature_policies (feature_key, enabled, min_tier, rollout_percentage, beta_users)
VALUES
  -- Master switches (ANONYMOUS tier)
  ('monetization', false, 'anonymous', NULL, '{}'),
  ('auth', false, 'anonymous', NULL, '{}'),
  ('payments', false, 'anonymous', NULL, '{}'),

  -- Premium features (PREMIUM tier)
  ('excel_export', true, 'premium', NULL, '{}'),
  ('excel_import', true, 'premium', NULL, '{}'),
  ('pdf_import', false, 'premium', NULL, '{}'),
  ('clipboard_import', true, 'anonymous', NULL, '{}'),

  -- UI features (ANONYMOUS tier)
  ('risk_chart', false, 'anonymous', NULL, '{}')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.feature_policies IS 'Runtime feature flag configuration - replaces Vercel Edge Config to reduce API calls';
COMMENT ON COLUMN public.feature_policies.feature_key IS 'Unique identifier for the feature (e.g., excel_export, pdf_import)';
COMMENT ON COLUMN public.feature_policies.enabled IS 'Global kill switch - if false, feature is disabled for everyone';
COMMENT ON COLUMN public.feature_policies.min_tier IS 'Minimum subscription tier required (anonymous, free, premium)';
COMMENT ON COLUMN public.feature_policies.rollout_percentage IS 'Percentage of users who get access (0-100) for gradual rollout';
COMMENT ON COLUMN public.feature_policies.allowlist IS 'Explicit allowlist of user IDs (bypasses tier check)';
COMMENT ON COLUMN public.feature_policies.denylist IS 'Explicit denylist of user IDs (blocks access regardless of tier)';
COMMENT ON COLUMN public.feature_policies.beta_users IS 'Beta users who get access regardless of tier';
