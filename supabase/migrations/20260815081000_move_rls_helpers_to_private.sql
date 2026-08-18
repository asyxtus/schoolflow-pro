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

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

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

-- PostgreSQL tracks policy dependencies by function OID, so moving the existing
-- functions preserves the dependency. We still re-assert the policy expressions
-- with explicit private.* references so the schema boundary is visible in the
-- migration state and in pg_policies output.
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
        coalesce(qual, '') LIKE '%can_manage_boarding(%' OR
        coalesce(qual, '') LIKE '%can_manage_clinic(%' OR
        coalesce(qual, '') LIKE '%can_manage_discipline(%' OR
        coalesce(qual, '') LIKE '%can_manage_hr(%' OR
        coalesce(qual, '') LIKE '%can_manage_reception(%' OR
        coalesce(qual, '') LIKE '%can_manage_school_data(%' OR
        coalesce(qual, '') LIKE '%can_manage_sports(%' OR
        coalesce(qual, '') LIKE '%can_record_payments(%' OR
        coalesce(qual, '') LIKE '%current_user_school_id(%' OR
        coalesce(qual, '') LIKE '%has_role_in_school(%' OR
        coalesce(qual, '') LIKE '%has_role(%' OR
        coalesce(qual, '') LIKE '%is_diocese_admin(%' OR
        coalesce(qual, '') LIKE '%is_staff_of_school(%' OR
        coalesce(with_check, '') LIKE '%can_manage_boarding(%' OR
        coalesce(with_check, '') LIKE '%can_manage_clinic(%' OR
        coalesce(with_check, '') LIKE '%can_manage_discipline(%' OR
        coalesce(with_check, '') LIKE '%can_manage_hr(%' OR
        coalesce(with_check, '') LIKE '%can_manage_reception(%' OR
        coalesce(with_check, '') LIKE '%can_manage_school_data(%' OR
        coalesce(with_check, '') LIKE '%can_manage_sports(%' OR
        coalesce(with_check, '') LIKE '%can_record_payments(%' OR
        coalesce(with_check, '') LIKE '%current_user_school_id(%' OR
        coalesce(with_check, '') LIKE '%has_role_in_school(%' OR
        coalesce(with_check, '') LIKE '%has_role(%' OR
        coalesce(with_check, '') LIKE '%is_diocese_admin(%' OR
        coalesce(with_check, '') LIKE '%is_staff_of_school(%'
      )
  LOOP
    new_qual := p.qual;
    new_check := p.with_check;

    -- Protect already-qualified references before replacing unqualified names.
    new_qual := replace(new_qual, 'private.has_role_in_school(', '__PRIVATE_HAS_ROLE_IN_SCHOOL__(');
    new_qual := replace(new_qual, 'private.can_manage_boarding(', '__PRIVATE_CAN_MANAGE_BOARDING__(');
    new_qual := replace(new_qual, 'private.can_manage_clinic(', '__PRIVATE_CAN_MANAGE_CLINIC__(');
    new_qual := replace(new_qual, 'private.can_manage_discipline(', '__PRIVATE_CAN_MANAGE_DISCIPLINE__(');
    new_qual := replace(new_qual, 'private.can_manage_hr(', '__PRIVATE_CAN_MANAGE_HR__(');
    new_qual := replace(new_qual, 'private.can_manage_reception(', '__PRIVATE_CAN_MANAGE_RECEPTION__(');
    new_qual := replace(new_qual, 'private.can_manage_school_data(', '__PRIVATE_CAN_MANAGE_SCHOOL_DATA__(');
    new_qual := replace(new_qual, 'private.can_manage_sports(', '__PRIVATE_CAN_MANAGE_SPORTS__(');
    new_qual := replace(new_qual, 'private.can_record_payments(', '__PRIVATE_CAN_RECORD_PAYMENTS__(');
    new_qual := replace(new_qual, 'private.current_user_school_id(', '__PRIVATE_CURRENT_USER_SCHOOL_ID__(');
    new_qual := replace(new_qual, 'private.has_role(', '__PRIVATE_HAS_ROLE__(');
    new_qual := replace(new_qual, 'private.is_diocese_admin(', '__PRIVATE_IS_DIOCESE_ADMIN__(');
    new_qual := replace(new_qual, 'private.is_staff_of_school(', '__PRIVATE_IS_STAFF_OF_SCHOOL__(');

    new_check := replace(new_check, 'private.has_role_in_school(', '__PRIVATE_HAS_ROLE_IN_SCHOOL__(');
    new_check := replace(new_check, 'private.can_manage_boarding(', '__PRIVATE_CAN_MANAGE_BOARDING__(');
    new_check := replace(new_check, 'private.can_manage_clinic(', '__PRIVATE_CAN_MANAGE_CLINIC__(');
    new_check := replace(new_check, 'private.can_manage_discipline(', '__PRIVATE_CAN_MANAGE_DISCIPLINE__(');
    new_check := replace(new_check, 'private.can_manage_hr(', '__PRIVATE_CAN_MANAGE_HR__(');
    new_check := replace(new_check, 'private.can_manage_reception(', '__PRIVATE_CAN_MANAGE_RECEPTION__(');
    new_check := replace(new_check, 'private.can_manage_school_data(', '__PRIVATE_CAN_MANAGE_SCHOOL_DATA__(');
    new_check := replace(new_check, 'private.can_manage_sports(', '__PRIVATE_CAN_MANAGE_SPORTS__(');
    new_check := replace(new_check, 'private.can_record_payments(', '__PRIVATE_CAN_RECORD_PAYMENTS__(');
    new_check := replace(new_check, 'private.current_user_school_id(', '__PRIVATE_CURRENT_USER_SCHOOL_ID__(');
    new_check := replace(new_check, 'private.has_role(', '__PRIVATE_HAS_ROLE__(');
    new_check := replace(new_check, 'private.is_diocese_admin(', '__PRIVATE_IS_DIOCESE_ADMIN__(');
    new_check := replace(new_check, 'private.is_staff_of_school(', '__PRIVATE_IS_STAFF_OF_SCHOOL__(');

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

    new_qual := replace(new_qual, '__PRIVATE_HAS_ROLE_IN_SCHOOL__(', 'private.has_role_in_school(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_BOARDING__(', 'private.can_manage_boarding(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_CLINIC__(', 'private.can_manage_clinic(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_DISCIPLINE__(', 'private.can_manage_discipline(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_HR__(', 'private.can_manage_hr(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_RECEPTION__(', 'private.can_manage_reception(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_SCHOOL_DATA__(', 'private.can_manage_school_data(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_MANAGE_SPORTS__(', 'private.can_manage_sports(');
    new_qual := replace(new_qual, '__PRIVATE_CAN_RECORD_PAYMENTS__(', 'private.can_record_payments(');
    new_qual := replace(new_qual, '__PRIVATE_CURRENT_USER_SCHOOL_ID__(', 'private.current_user_school_id(');
    new_qual := replace(new_qual, '__PRIVATE_HAS_ROLE__(', 'private.has_role(');
    new_qual := replace(new_qual, '__PRIVATE_IS_DIOCESE_ADMIN__(', 'private.is_diocese_admin(');
    new_qual := replace(new_qual, '__PRIVATE_IS_STAFF_OF_SCHOOL__(', 'private.is_staff_of_school(');

    new_check := replace(new_check, '__PRIVATE_HAS_ROLE_IN_SCHOOL__(', 'private.has_role_in_school(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_BOARDING__(', 'private.can_manage_boarding(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_CLINIC__(', 'private.can_manage_clinic(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_DISCIPLINE__(', 'private.can_manage_discipline(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_HR__(', 'private.can_manage_hr(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_RECEPTION__(', 'private.can_manage_reception(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_SCHOOL_DATA__(', 'private.can_manage_school_data(');
    new_check := replace(new_check, '__PRIVATE_CAN_MANAGE_SPORTS__(', 'private.can_manage_sports(');
    new_check := replace(new_check, '__PRIVATE_CAN_RECORD_PAYMENTS__(', 'private.can_record_payments(');
    new_check := replace(new_check, '__PRIVATE_CURRENT_USER_SCHOOL_ID__(', 'private.current_user_school_id(');
    new_check := replace(new_check, '__PRIVATE_HAS_ROLE__(', 'private.has_role(');
    new_check := replace(new_check, '__PRIVATE_IS_DIOCESE_ADMIN__(', 'private.is_diocese_admin(');
    new_check := replace(new_check, '__PRIVATE_IS_STAFF_OF_SCHOOL__(', 'private.is_staff_of_school(');

    IF new_qual IS NOT NULL AND new_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)', p.policyname, p.schemaname, p.tablename, new_qual, new_check);
    ELSIF new_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    ELSIF new_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining
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
