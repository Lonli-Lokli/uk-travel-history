-- Migration: Remove start_date column from tracking_goals
--
-- Rationale: The start_date field is confusing and not used in calculations.
-- For UK ILR goals, the actual tracking start is determined by visaStartDate
-- or vignetteEntryDate in the config JSON, not by a separate start_date field.
-- For other goal types, tracking begins when trips are added.

-- Drop the start_date column
ALTER TABLE tracking_goals DROP COLUMN IF EXISTS start_date;

-- Add comment to table explaining the design
COMMENT ON TABLE tracking_goals IS 'Tracking goals for visa/tax/personal purposes. Start dates for calculations are stored in the config JSON field (e.g., visaStartDate, vignetteEntryDate for ILR goals).';
