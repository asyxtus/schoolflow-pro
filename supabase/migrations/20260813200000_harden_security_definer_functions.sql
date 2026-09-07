-- Harden SECURITY DEFINER functions exposed through PostgREST/Supabase RPC.
--
-- Goals:
--   1. Remove the default EXECUTE privilege inherited from PUBLIC.
--   2. Explicitly deny direct execution to anon.
--   3. Keep authenticated EXECUTE only where functions are used by RLS
--      policies or intentionally exposed as read/authorization helpers.
--   4. Keep trigger/internal functions out of the RPC surface.
--   5. Use a deterministic search_path for every SECURITY DEFINER function.
--
-- SECURITY DEFINER is still required for the RLS authorization helpers because
-- they must be able to inspect user_roles without being blocked by RLS.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Lock down the default function EXECUTE privilege.
-- ---------------------------------------------------------------------------
-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default.
-- Revoke that privilege first so future callers cannot inherit access.

REVOKE EXECUTE ON FUNCTION public.can_manage_boarding(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_clinic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_discipline(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_hr(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_reception(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_school_data(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_sports(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_record_payments(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_attendance_rate(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_school_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diocese_snapshot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role_in_school(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_diocese_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_of_school(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_platform_audit(text, text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_matricule(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_schools_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_book_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_payroll_run(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_student_attendance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_student_balance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_student_wallet(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registration_owed(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.student_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trend_attendance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trend_clinic_visits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trend_collections(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trend_discipline(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trend_enrollments(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_allocation_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_closed_day() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_discount_reason() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_invoice_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_invoice_void() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_guard_tuition_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_payment_receipt_no() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_attendance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_alloc() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_fees() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_book_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_payroll_run() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_wallet() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_students_auto_matricule() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_subject() FROM PUBLIC;

-- Never expose these internal functions through RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_attendance_rate(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_platform_audit(text, text, text, text, jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_matricule(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_book_counts(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_payroll_run(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_attendance(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_balance(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_wallet(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_allocation_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_closed_day() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_discount_reason() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_invoice_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_invoice_void() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_guard_tuition_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_payment_receipt_no() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_attendance() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_alloc() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_fees() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_balance_payments() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_book_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_payroll_run() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_wallet() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_students_auto_matricule() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_subject() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Explicit authenticated RPC surface.
-- ---------------------------------------------------------------------------
-- These functions are referenced by RLS policies, so authenticated must retain
-- EXECUTE. They do not grant access by themselves; their authorization logic
-- still decides whether the current user may act on a school/diocese.

GRANT EXECUTE ON FUNCTION public.can_manage_boarding(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_discipline(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_hr(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_reception(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_school_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_sports(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_record_payments(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_school(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_diocese_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_of_school(uuid, uuid) TO authenticated;

-- Intentionally exposed read/analytics helpers for signed-in users.
GRANT EXECUTE ON FUNCTION public.diocese_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_schools_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registration_owed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trend_attendance(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trend_clinic_visits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trend_collections(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trend_discipline(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trend_enrollments(uuid, integer) TO authenticated;

-- Do not expose any of the above to anonymous callers.
REVOKE EXECUTE ON FUNCTION public.can_manage_boarding(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_clinic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_discipline(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_hr(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_reception(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_school_data(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_sports(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_record_payments(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_school_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role_in_school(uuid, uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_diocese_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_of_school(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diocese_snapshot(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_schools_snapshot() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_snapshot() FROM anon;
REVOKE EXECUTE ON FUNCTION public.registration_owed(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.student_credit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trend_attendance(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trend_clinic_visits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trend_collections(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trend_discipline(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trend_enrollments(uuid, integer) FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Deterministic search_path for every SECURITY DEFINER function.
-- ---------------------------------------------------------------------------
-- public is retained because these functions use public objects; pg_catalog
-- is explicit so built-in names resolve predictably. Auth is referenced as
-- auth.uid(), so it does not need to be placed in the search_path.

ALTER FUNCTION public.can_manage_boarding(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_clinic(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_discipline(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_hr(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_reception(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_school_data(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_manage_sports(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.can_record_payments(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.compute_attendance_rate(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.current_user_school_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.diocese_snapshot(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = pg_catalog, public;
ALTER FUNCTION public.has_role_in_school(uuid, uuid, public.app_role) SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_diocese_admin(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_staff_of_school(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_audit(uuid, text, text, text, text, jsonb, jsonb) SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_platform_audit(text, text, text, text, jsonb, jsonb) SET search_path = pg_catalog, public;
ALTER FUNCTION public.next_matricule(uuid, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.platform_schools_snapshot() SET search_path = pg_catalog, public;
ALTER FUNCTION public.platform_snapshot() SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_book_counts(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_payroll_run(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_student_attendance(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_student_balance(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.recompute_student_wallet(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.registration_owed(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.student_credit(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trend_attendance(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trend_clinic_visits(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trend_collections(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trend_discipline(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trend_enrollments(uuid, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_allocation_limit() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_closed_day() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_discount_reason() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_invoice_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_invoice_void() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_guard_tuition_change() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_payment_receipt_no() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_attendance() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_balance_alloc() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_balance_fees() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_balance_payments() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_book_counts() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_payroll_run() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_recompute_wallet() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_students_auto_matricule() SET search_path = pg_catalog, public;
ALTER FUNCTION public.trg_sync_subject() SET search_path = pg_catalog, public;

COMMIT;
