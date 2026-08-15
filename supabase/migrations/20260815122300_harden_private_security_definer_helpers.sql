-- Migration: Harden private SECURITY DEFINER RLS helpers
--
-- Goals:
--   1. Keep RLS authorization helpers isolated in the private schema.
--   2. Remove public-schema name resolution from SECURITY DEFINER functions.
--   3. Prevent anon/public clients from executing the helpers directly.
--   4. Preserve frontend RLS operation by granting EXECUTE to authenticated.
--
-- These functions are intentionally SECURITY DEFINER because they inspect
-- authorization tables from inside RLS policies without recursively applying
-- those same RLS policies.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Restrict the function execution surface
-- ---------------------------------------------------------------------------
-- PUBLIC normally has EXECUTE on newly-created PostgreSQL functions. Remove
-- that default exposure explicitly, then grant execution only to authenticated.

REVOKE ALL ON FUNCTION private.can_manage_boarding(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_clinic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_discipline(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_hr(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_reception(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_school_data(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_sports(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_record_payments(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_school_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role_in_school(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_diocese_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff_of_school(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pin SECURITY DEFINER search_path
-- ---------------------------------------------------------------------------
-- All application objects referenced by these helpers are schema-qualified
-- (public.*, private.*, auth.*). Therefore pg_catalog is sufficient and avoids
-- resolving attacker-controlled objects through a writable application schema.

ALTER FUNCTION private.can_manage_boarding(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_clinic(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_discipline(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_hr(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_reception(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_school_data(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_manage_sports(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.can_record_payments(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.current_user_school_id()
  SET search_path = pg_catalog;

ALTER FUNCTION private.has_role(uuid, public.app_role)
  SET search_path = pg_catalog;

ALTER FUNCTION private.has_role_in_school(uuid, uuid, public.app_role)
  SET search_path = pg_catalog;

ALTER FUNCTION private.is_diocese_admin(uuid, uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION private.is_staff_of_school(uuid, uuid)
  SET search_path = pg_catalog;

COMMIT;
