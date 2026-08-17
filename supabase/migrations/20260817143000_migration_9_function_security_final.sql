-- Migration 9
-- Final SECURITY DEFINER/RPC hardening
--
-- Keep authenticated EXECUTE because these helpers are referenced by RLS.
-- Remove anonymous EXECUTE and lock the private schema down.

BEGIN;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;

REVOKE EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.current_user_school_id() FROM anon;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) TO authenticated;

ALTER FUNCTION private.can_manage_boarding(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_clinic(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_discipline(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_hr(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_reception(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_school_data(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_manage_sports(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.can_record_payments(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.current_user_school_id() SET search_path = pg_catalog;
ALTER FUNCTION private.has_role(uuid, app_role) SET search_path = pg_catalog;
ALTER FUNCTION private.has_role_in_school(uuid, uuid, app_role) SET search_path = pg_catalog;
ALTER FUNCTION private.is_diocese_admin(uuid, uuid) SET search_path = pg_catalog;
ALTER FUNCTION private.is_staff_of_school(uuid, uuid) SET search_path = pg_catalog;

COMMIT;
