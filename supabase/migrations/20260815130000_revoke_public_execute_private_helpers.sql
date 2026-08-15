-- Migration: revoke public execution on private SECURITY DEFINER RLS helpers
--
-- The previous function-hardening migration correctly moved the helpers to
-- search_path=pg_catalog, but information_schema.routine_privileges shows that
-- anon still inherits EXECUTE from the default PUBLIC function privilege.
--
-- SECURITY DEFINER functions used by RLS must not be directly callable by
-- anonymous clients. Remove PUBLIC execution and grant only to authenticated
-- clients, which are the role used by the frontend RLS policies.

BEGIN;

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

COMMIT;
