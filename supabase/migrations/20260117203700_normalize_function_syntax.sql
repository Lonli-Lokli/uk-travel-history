-- Migration: Normalize function syntax from PostgreSQL
--
-- Context: PostgreSQL normalizes function definitions when storing them in the system catalog.
-- This migration captures the normalized format to eliminate false-positive drift detection.
--
-- Changes:
-- - Dollar quoting: AS $$ → AS $function$ (PostgreSQL normalizes dollar quote tags)
-- - Type qualification: RETURNS user_role → RETURNS public.user_role (adds schema prefix)
-- - Clause ordering: $$ LANGUAGE plpgsql → LANGUAGE plpgsql ... AS $function$ (reorders clauses)
-- - Header setting: Adds `set check_function_bodies = off;` (PostgreSQL schema dump format)
--
-- These differences are semantically identical - no functional changes to the database.
-- The functions already exist in production; this migration simply documents their normalized form.
--
-- Related issue: https://github.com/Lonli-Lokli/uk-travel-history/issues/181

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN public.current_user_role() = 'admin';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS public.user_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  user_record users;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE clerk_user_id = public.clerk_user_id();

  IF NOT FOUND THEN
    RETURN 'standard';
  END IF;

  RETURN user_record.role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tracking_goals_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
