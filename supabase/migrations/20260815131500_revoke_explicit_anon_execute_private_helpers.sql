-- Migration: revoke explicit anonymous EXECUTE on private SECURITY DEFINER helpers
--
-- The earlier hardening migration revoked EXECUTE from PUBLIC. The live
-- database still reports anon with EXECUTE, which means anon has an explicit
-- grant that must also be revoked. Keep authenticated execution because the
-- frontend RLS policies use these helpers for authenticated requests.

BEGIN;

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

COMMIT;
