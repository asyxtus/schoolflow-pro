-- Migration 6: Make the public.schools write boundary explicit
--
-- Scope:
--   * public.schools is readable only through the school/diocese/super-admin
--     SELECT policies established by Migration 4.
--   * Only super_admin may INSERT, UPDATE, or DELETE school rows.
--   * The write rules are split by command instead of relying on one broad
--     FOR ALL policy. This makes the authorization surface explicit and easier
--     to audit as the application grows.
--
-- Important:
--   We intentionally do NOT revoke INSERT/UPDATE/DELETE table privileges from
--   authenticated in this migration. The repository still contains trusted
--   server functions that perform school writes through an authenticated
--   Supabase client. Removing those table privileges before those functions are
--   moved to the service-role/admin client would break existing server flows.
--   RLS remains the authorization boundary: having a table privilege does not
--   grant a user access to rows that fail these policies.
--
-- The migration is idempotent and preserves the current intended behavior:
--   * onboarding creates schools with the server-side service-role client;
--   * super admins can manage schools;
--   * ordinary school users and diocese admins cannot mutate school rows.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Replace the broad schools FOR ALL policy with explicit write policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admins manage schools" ON public.schools;

DROP POLICY IF EXISTS "Super admins insert schools" ON public.schools;
CREATE POLICY "Super admins insert schools"
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Super admins update schools" ON public.schools;
CREATE POLICY "Super admins update schools"
ON public.schools
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Super admins delete schools" ON public.schools;
CREATE POLICY "Super admins delete schools"
ON public.schools
FOR DELETE
TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
);

-- ---------------------------------------------------------------------------
-- 2. Keep anonymous access explicitly disabled.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.schools FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Ensure RLS remains enabled.
-- ---------------------------------------------------------------------------

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

COMMIT;
