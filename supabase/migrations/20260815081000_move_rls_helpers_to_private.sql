-- Migration 2: Move RLS SECURITY DEFINER authorization helpers into a private schema.
--
-- These functions are authorization primitives used by RLS policies. They are not
-- frontend RPC endpoints. Keeping them in public makes them discoverable/callable
-- through the Data API when EXECUTE is granted. Supabase recommends placing
-- SECURITY DEFINER RLS helpers in an unexposed schema and explicitly qualifying
-- them in policies.
--
-- Migration 1 intentionally left these helpers executable because the existing
-- policies still referenced them from public. This migration removes that exposure
-- without changing their authorization logic.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

-- Do not expose the helper schema through the Data API. The API roles receive only
-- the minimum privileges required for PostgreSQL to evaluate the RLS policies.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- Move the existing functions rather than recreating them. This preserves their
-- definitions, signatures, ownership, volatility, and existing dependencies.
ALTER FUNCTION public.can_manage_boarding(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_clinic(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_discipline(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_hr(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_reception(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_school_data(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_sports(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_record_payments(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.current_user_school_id() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.has_role_in_school(uuid, uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.is_diocese_admin(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_staff_of_school(uuid, uuid) SET SCHEMA private;

-- RLS evaluates these functions on behalf of anon/authenticated. They therefore
-- need EXECUTE/USAGE for policy evaluation, but the schema remains unexposed so
-- they are not available as PostgREST RPC endpoints.
REVOKE EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_user_school_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_school_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) TO anon, authenticated;

-- Re-point every existing public-schema policy that references one of these
-- authorization helpers. Using pg_policies makes this migration resilient to
-- policy additions/renames and avoids maintaining a brittle list of dozens of
-- policy names. ALTER POLICY changes only USING/WITH CHECK, preserving policy
-- roles, command, and permissive/restrictive behavior.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~ '(can_manage_boarding|can_manage_clinic|can_manage_discipline|can_manage_hr|can_manage_reception|can_manage_school_data|can_manage_sports|can_record_payments|current_user_school_id|has_role_in_school|has_role|is_diocese_admin|is_staff_of_school)\\('
        OR
        coalesce(with_check, '') ~ '(can_manage_boarding|can_manage_clinic|can_manage_discipline|can_manage_hr|can_manage_reception|can_manage_school_data|can_manage_sports|can_record_payments|current_user_school_id|has_role_in_school|has_role|is_diocese_admin|is_staff_of_school)\\('
      )
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    -- pg_policies emits these policy references as unqualified function calls.
    -- Replace the longer name first so has_role() does not partially rewrite
    -- has_role_in_school().
    new_qual := replace(new_qual, 'has_role_in_school(', 'private.has_role_in_school(');
    new_qual := replace(new_qual, 'can_manage_boarding(', 'private.can_manage_boarding(');
    new_qual := replace(new_qual, 'can_manage_clinic(', 'private.can_manage_clinic(');
    new_qual := replace(new_qual, 'can_manage_discipline(', 'private.can_manage_discipline(');
    new_qual := replace(new_qual, 'can_manage_hr(', 'private.can_manage_hr(');
    new_qual := replace(new_qual, 'can_manage_reception(', 'private.can_manage_reception(');
    new_qual := replace(new_qual, 'can_manage_school_data(', 'private.can_manage_school_data(');
    new_qual := replace(new_qual, 'can_manage_sports(', 'private.can_manage_sports(');
    new_qual := replace(new_qual, 'can_record_payments(', 'private.can_record_payments(');
    new_qual := replace(new_qual, 'current_user_school_id(', 'private.current_user_school_id(');
    new_qual := replace(new_qual, 'has_role(', 'private.has_role(');
    new_qual := replace(new_qual, 'is_diocese_admin(', 'private.is_diocese_admin(');
    new_qual := replace(new_qual, 'is_staff_of_school(', 'private.is_staff_of_school(');

    new_check := replace(new_check, 'has_role_in_school(', 'private.has_role_in_school(');
    new_check := replace(new_check, 'can_manage_boarding(', 'private.can_manage_boarding(');
    new_check := replace(new_check, 'can_manage_clinic(', 'private.can_manage_clinic(');
    new_check := replace(new_check, 'can_manage_discipline(', 'private.can_manage_discipline(');
    new_check := replace(new_check, 'can_manage_hr(', 'private.can_manage_hr(');
    new_check := replace(new_check, 'can_manage_reception(', 'private.can_manage_reception(');
    new_check := replace(new_check, 'can_manage_school_data(', 'private.can_manage_school_data(');
    new_check := replace(new_check, 'can_manage_sports(', 'private.can_manage_sports(');
    new_check := replace(new_check, 'can_record_payments(', 'private.can_record_payments(');
    new_check := replace(new_check, 'current_user_school_id(', 'private.current_user_school_id(');
    new_check := replace(new_check, 'has_role(', 'private.has_role(');
    new_check := replace(new_check, 'is_diocese_admin(', 'private.is_diocese_admin(');
    new_check := replace(new_check, 'is_staff_of_school(', 'private.is_staff_of_school(');

    IF new_qual IS DISTINCT FROM p.qual AND new_check IS DISTINCT FROM p.with_check THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        p.policyname, p.schemaname, p.tablename, new_qual, new_check
      );
    ELSIF new_qual IS DISTINCT FROM p.qual THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        p.policyname, p.schemaname, p.tablename, new_qual
      );
    ELSIF new_check IS DISTINCT FROM p.with_check THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        p.policyname, p.schemaname, p.tablename, new_check
      );
    END IF;
  END LOOP;
END
$$;

-- Fail the migration if any of the RLS helpers accidentally remain in public.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*)
    INTO remaining
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'can_manage_boarding', 'can_manage_clinic', 'can_manage_discipline',
      'can_manage_hr', 'can_manage_reception', 'can_manage_school_data',
      'can_manage_sports', 'can_record_payments', 'current_user_school_id',
      'has_role', 'has_role_in_school', 'is_diocese_admin',
      'is_staff_of_school'
    );

  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Migration 2 failed: % RLS helper function(s) remain in public', remaining;
  END IF;
END
$$;

COMMIT;
