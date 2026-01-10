-- Migration: Make trip goal_id optional
-- Date: 2026-01-10
-- Description: Remove the required relationship between trips and goals
--              Trips should be independent entities that can be tracked
--              across multiple goals or without a specific goal

-- ============================================================================
-- Make goal_id nullable in trips table
-- ============================================================================

-- Remove NOT NULL constraint from goal_id
ALTER TABLE trips ALTER COLUMN goal_id DROP NOT NULL;

-- Update the documentation
COMMENT ON COLUMN trips.goal_id IS 'Optional foreign key to tracking_goals - trips can exist without being tied to a specific goal';
