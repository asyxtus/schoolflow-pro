-- Migration 5: Align sensitive table privileges with the actual frontend/RLS surface
--
-- This migration is intentionally narrow.
--
-- Migrations 3 and 4 already removed anonymous table access, removed
-- TRUNCATE/REFERENCES/TRIGGER from authenticated, and tightened school/profile/
-- role RLS. The live database still shows a few authenticated CRUD privileges
-- that have no corresponding browser workflow or RLS command path:
--
--   * profiles INSERT: profiles are created by the auth trigger/server-side
--     onboarding flows, not by the browser client.
--   * profiles DELETE: there is no normal frontend profile-delete workflow;
--     profile deletion is owned by auth/admin flows.
--   * payments DELETE: the live RLS policy set has SELECT/INSERT/UPDATE only;
--     there is intentionally no authenticated DELETE policy for payments.
--
-- Keep legitimate direct frontend CRUD intact on students, student_fees,
-- payment_allocations and wallet_transactions because their RLS policies
-- explicitly govern those operations.
--
-- The statements are idempotent and safe to rerun.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Profiles: browser needs SELECT + UPDATE, not INSERT/DELETE.
-- ---------------------------------------------------------------------------
-- New profiles are created by the SECURITY DEFINER auth trigger and profile
-- onboarding uses the server-side service-role client. Removing these direct
-- privileges prevents an authenticated browser client from creating or deleting
-- profile rows outside those controlled flows.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payments: no browser DELETE capability.
-- ---------------------------------------------------------------------------
-- Payments are intentionally append/update controlled by the existing RLS
-- policies. A payment row should not be deleted through ordinary frontend CRUD.
-- Void/reversal workflows, where applicable, are handled by their dedicated
-- database/server-side controls.
REVOKE DELETE ON public.payments FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Preserve the intended operational CRUD surface explicitly.
-- ---------------------------------------------------------------------------
-- These grants document and enforce the privileges required by the existing
-- RLS policies. They do not bypass RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;

-- user_roles was intentionally reduced to SELECT in Migration 4. Keep that
-- least-privilege state explicit here as well.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Preserve the school-management surface.
-- ---------------------------------------------------------------------------
-- public.schools still needs CRUD privileges at the table layer because the
-- existing RLS policy grants FOR ALL to super_admin. RLS remains the actual
-- authorization boundary for those operations.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Keep anonymous clients completely excluded from the sensitive surface.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.schools FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.student_fees FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.payment_allocations FROM anon;
REVOKE ALL ON public.wallet_transactions FROM anon;

COMMIT;
