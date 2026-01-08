-- Migration: Add tracking_goals and goal_templates tables
-- Date: 2026-01-05
-- Description: Database schema for multi-goal tracking system

-- ============================================================================
-- Goal Type and Jurisdiction Enums
-- ============================================================================

CREATE TYPE goal_type AS ENUM (
  'uk_ilr',
  'uk_citizenship',
  'uk_tax_residency',
  'schengen_90_180',
  'days_counter',
  'custom_threshold'
);

CREATE TYPE goal_jurisdiction AS ENUM (
  'uk',
  'schengen',
  'global'
);

-- ============================================================================
-- tracking_goals Table
-- ============================================================================

CREATE TABLE tracking_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- clerk_user_id (not FK to allow anonymous local storage sync)

  -- Goal identity
  type goal_type NOT NULL,
  jurisdiction goal_jurisdiction NOT NULL DEFAULT 'global',
  name VARCHAR(100) NOT NULL,

  -- Configuration (JSONB for flexibility per goal type)
  config JSONB NOT NULL DEFAULT '{}',

  -- Key dates
  start_date DATE NOT NULL,
  target_date DATE,  -- Calculated eligibility date

  -- UI state
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(20),  -- Optional UI customization

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_tracking_goals_user ON tracking_goals(user_id);
CREATE INDEX idx_tracking_goals_active ON tracking_goals(user_id, is_active) WHERE NOT is_archived;

-- ============================================================================
-- RLS Policies for tracking_goals
-- ============================================================================

ALTER TABLE tracking_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_goals_select_own ON tracking_goals
  FOR SELECT TO authenticated
  USING (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_insert_own ON tracking_goals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_update_own ON tracking_goals
  FOR UPDATE TO authenticated
  USING (user_id = public.clerk_user_id())
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY tracking_goals_delete_own ON tracking_goals
  FOR DELETE TO authenticated
  USING (user_id = public.clerk_user_id());

-- Service role bypass for admin operations
CREATE POLICY tracking_goals_service_role ON tracking_goals
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- goal_templates Table (Reference Data)
-- ============================================================================

CREATE TABLE goal_templates (
  id VARCHAR(50) PRIMARY KEY,

  -- Categorization
  jurisdiction goal_jurisdiction NOT NULL,
  category VARCHAR(50) NOT NULL,  -- 'immigration', 'tax', 'personal'

  -- Display
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),

  -- Template data
  type goal_type NOT NULL,
  default_config JSONB NOT NULL,
  required_fields JSONB NOT NULL DEFAULT '[]',  -- Fields user must fill

  -- Availability
  display_order INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  min_tier VARCHAR(20) DEFAULT 'anonymous',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS for goal_templates (read-only for all)
-- ============================================================================

ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates
CREATE POLICY goal_templates_select_all ON goal_templates
  FOR SELECT
  USING (true);

-- Only service_role can modify templates
CREATE POLICY goal_templates_service_role ON goal_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Seed Goal Templates
-- ============================================================================

INSERT INTO goal_templates (id, jurisdiction, category, name, description, icon, type, default_config, required_fields, display_order, min_tier) VALUES
-- UK Immigration
('uk_ilr_5yr', 'uk', 'immigration', 'UK ILR (5-Year)', 'Indefinite Leave to Remain via standard 5-year route', 'home', 'uk_ilr', '{"trackYears": 5}', '["visaStartDate"]', 1, 'anonymous'),
('uk_ilr_3yr', 'uk', 'immigration', 'UK ILR (3-Year)', 'ILR via family/spouse route', 'home', 'uk_ilr', '{"trackYears": 3}', '["visaStartDate"]', 2, 'anonymous'),
('uk_ilr_10yr', 'uk', 'immigration', 'UK ILR (10-Year)', 'Long residence route', 'home', 'uk_ilr', '{"trackYears": 10}', '["visaStartDate"]', 3, 'anonymous'),
('uk_citizenship', 'uk', 'immigration', 'British Citizenship', 'Naturalisation after ILR', 'flag', 'uk_citizenship', '{"qualifyingYears": 5}', '["ilrGrantDate"]', 4, 'anonymous'),

-- UK Tax
('uk_tax', 'uk', 'tax', 'UK Tax Residency', 'Statutory Residence Test tracking', 'calculator', 'uk_tax_residency', '{}', '["taxYear"]', 10, 'anonymous'),

-- Schengen
('schengen_90_180', 'schengen', 'immigration', 'Schengen 90/180', '90 days per 180-day rolling window', 'globe', 'schengen_90_180', '{}', '[]', 20, 'anonymous'),

-- Personal / Generic
('days_away', 'global', 'personal', 'Days Away', 'Count days spent away from home', 'plane', 'days_counter', '{"countDirection": "days_away", "referenceLocation": "Home"}', '[]', 100, 'anonymous'),
('days_present', 'global', 'personal', 'Days Present', 'Count days in a specific location', 'map-pin', 'days_counter', '{"countDirection": "days_present", "referenceLocation": "UK"}', '[]', 101, 'anonymous'),
('custom', 'global', 'personal', 'Custom Goal', 'Set your own day limit and window', 'settings', 'custom_threshold', '{"thresholdDays": 180, "windowDays": 365}', '["thresholdDays", "windowDays"]', 110, 'monthly');

-- ============================================================================
-- Updated_at Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tracking_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracking_goals_updated_at
  BEFORE UPDATE ON tracking_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_tracking_goals_updated_at();

CREATE TRIGGER goal_templates_updated_at
  BEFORE UPDATE ON goal_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_tracking_goals_updated_at();

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE tracking_goals IS 'User-created tracking goals for various residence/tax/personal tracking needs';
COMMENT ON TABLE goal_templates IS 'Predefined goal templates that users can choose from when creating a goal';
COMMENT ON COLUMN tracking_goals.config IS 'Goal-type-specific configuration stored as JSONB';
COMMENT ON COLUMN tracking_goals.user_id IS 'Clerk user ID (not FK to support anonymous users)';
COMMENT ON COLUMN goal_templates.min_tier IS 'Minimum subscription tier required to use this template';
