-- Migration: Add trips and trip_groups tables
-- Date: 2026-01-09
-- Description: Database schema for trip tracking and organization

-- ============================================================================
-- Trip Groups Table
-- ============================================================================

CREATE TABLE trip_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- clerk_user_id

  name VARCHAR(100) NOT NULL,
  color VARCHAR(20),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trip_groups_user ON trip_groups(user_id);

-- RLS Policies
ALTER TABLE trip_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_groups_select_own ON trip_groups
  FOR SELECT TO authenticated
  USING (user_id = public.clerk_user_id());

CREATE POLICY trip_groups_insert_own ON trip_groups
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY trip_groups_update_own ON trip_groups
  FOR UPDATE TO authenticated
  USING (user_id = public.clerk_user_id())
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY trip_groups_delete_own ON trip_groups
  FOR DELETE TO authenticated
  USING (user_id = public.clerk_user_id());

-- Service role bypass
CREATE POLICY trip_groups_service_role ON trip_groups
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER trip_groups_updated_at
  BEFORE UPDATE ON trip_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Trips Table
-- ============================================================================

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- clerk_user_id
  goal_id UUID NOT NULL REFERENCES tracking_goals(id) ON DELETE CASCADE,

  -- Trip data
  out_date DATE NOT NULL,
  in_date DATE NOT NULL,
  out_route TEXT,
  in_route TEXT,
  destination TEXT,
  notes TEXT,

  -- Organization
  group_id UUID REFERENCES trip_groups(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  source TEXT DEFAULT 'manual',  -- 'manual', 'pdf_import', 'excel_import'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_trips_goal ON trips(goal_id);
CREATE INDEX idx_trips_user_dates ON trips(user_id, out_date DESC);
CREATE INDEX idx_trips_group ON trips(group_id) WHERE group_id IS NOT NULL;

-- RLS Policies
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY trips_select_own ON trips
  FOR SELECT TO authenticated
  USING (user_id = public.clerk_user_id());

CREATE POLICY trips_insert_own ON trips
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY trips_update_own ON trips
  FOR UPDATE TO authenticated
  USING (user_id = public.clerk_user_id())
  WITH CHECK (user_id = public.clerk_user_id());

CREATE POLICY trips_delete_own ON trips
  FOR DELETE TO authenticated
  USING (user_id = public.clerk_user_id());

-- Service role bypass
CREATE POLICY trips_service_role ON trips
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Remove Icon Column from goal_templates
-- ============================================================================

-- Icons should be mapped in code, not stored in database
-- This prevents runtime errors from missing icon names
ALTER TABLE goal_templates DROP COLUMN IF EXISTS icon;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE trips IS 'User travel trips associated with tracking goals';
COMMENT ON TABLE trip_groups IS 'Organizational groups for trips (e.g., "Japan 2026", "Work Travel")';
COMMENT ON COLUMN trips.goal_id IS 'Foreign key to tracking_goals - trips must belong to a goal';
COMMENT ON COLUMN trips.source IS 'How the trip was created: manual, pdf_import, or excel_import';
COMMENT ON COLUMN trips.sort_order IS 'User-defined display order for drag-and-drop';
