-- Migration: Add title field to trips table
-- Issue: #162 - Fix Goals/Trips Model, Anonymous Goal Visibility, and Trip Titles
-- Date: 2026-01-10

-- Add title column to trips table
-- Title is optional (nullable) to maintain backward compatibility
-- Existing trips without titles will have NULL values
ALTER TABLE trips ADD COLUMN IF NOT EXISTS title TEXT;

-- Add comment to document the column
COMMENT ON COLUMN trips.title IS 'Optional human-readable title for the trip (e.g., "Summer Vacation", "Business Trip to Paris")';
