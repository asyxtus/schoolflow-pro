-- Migration 1: Lock down SECURITY DEFINER functions exposed through the Data API.
--
-- The current database inspection showed SECURITY DEFINER functions executable by
-- anon/authenticated. RLS does NOT protect function execution, so these functions
-- must be explicitly non-executable unless the application intentionally exposes
-- them as RPC endpoints.
--
-- IMPORTANT:
-- The role/authorization helper functions below are intentionally NOT revoked in
-- this migration because existing RLS policies call them directly. Revoking their
-- EXECUTE privilege without first moving them to a private schema would break RLS.
-- They will be handled in the next hardening step.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Administrative snapshot functions
-- These functions return platform/diocese-wide aggregates and are not ordinary
-- frontend CRUD operations. They already perform authorization checks, but a
-- SECURITY DEFINER function should not be callable through the Data API unless
-- it is intentionally exposed as an RPC.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.platform_snapshot()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.platform_schools_snapshot()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.diocese_snapshot(uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Internal recomputation functions
-- These mutate derived values and are intended for database triggers/server-side
-- workflows, not arbitrary client RPC calls.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.recompute_payroll_run(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.recompute_student_attendance(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.recompute_student_balance(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.recompute_student_wallet(uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Prevent newly-created public functions from being automatically exposed.
-- Supabase/Postgres normally grants EXECUTE broadly unless default privileges
-- are explicitly restricted.
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
