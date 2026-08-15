-- Migration 4: School isolation + targeted privilege hardening
--
-- Goals:
--   1. A normal authenticated user must never be able to SELECT another school's
--      row from public.schools.
--   2. Diocese administrators may see schools belonging to their diocese.
--   3. Super administrators may see/manage all schools.
--   4. Keep school-scoped operational access governed by RLS rather than broad
--      cross-school SELECT policies.
--   5. Remove direct browser privileges from the role-assignment table; role
--      changes remain controlled by its RLS policy and server-side/admin flows.
--
-- Migration 2 moved the RLS SECURITY DEFINER helpers into private. The live
-- database confirms the helpers are in private, so all policy references below
-- intentionally use private.* rather than public.*.
--
-- This migration is deliberately idempotent so it can be safely rerun after a
-- prior partial/manual application.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. HARDEN public.schools
-- ---------------------------------------------------------------------------
-- The previous policy had USING (true), which allowed every authenticated user
-- to read every school. Because policies are PERMISSIVE, the more restrictive
-- school/diocese policies could not prevent that access.

DROP POLICY IF EXISTS "Authenticated can view schools" ON public.schools;
DROP POLICY IF EXISTS "Users view own school" ON public.schools;
DROP POLICY IF EXISTS "Diocese admins view their schools" ON public.schools;
DROP POLICY IF EXISTS "Super admins view all schools" ON public.schools;
DROP POLICY IF EXISTS "Super admins manage schools" ON public.schools;

CREATE POLICY "Users view own school"
ON public.schools
FOR SELECT
TO authenticated
USING (
  id = private.current_user_school_id()
);

CREATE POLICY "Diocese admins view their schools"
ON public.schools
FOR SELECT
TO authenticated
USING (
  diocese_id IS NOT NULL
  AND private.is_diocese_admin(auth.uid(), diocese_id)
);

CREATE POLICY "Super admins view all schools"
ON public.schools
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Keep school management restricted to super admins.
CREATE POLICY "Super admins manage schools"
ON public.schools
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  private.has_role(auth.uid(), 'super_admin'::app_role)
);

-- ---------------------------------------------------------------------------
-- 2. Harden user_roles at the table privilege layer
-- ---------------------------------------------------------------------------
-- RLS already defines who may manage roles, but the live database was found to
-- have INSERT/UPDATE/DELETE granted to authenticated even though the intended
-- schema only granted SELECT. Remove those excess direct privileges.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.user_roles
FROM authenticated;

-- SELECT remains available only where an RLS SELECT policy permits it.
GRANT SELECT ON public.user_roles TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Defensive school-isolation check for profiles
-- ---------------------------------------------------------------------------
-- A user may update their own profile, but must not be able to move their own
-- profile into another school by changing school_id. Super admins retain full
-- management capability through the existing policy.

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
  AND (
    school_id = private.current_user_school_id()
    OR school_id IS NULL
  )
);

-- ---------------------------------------------------------------------------
-- 4. Prevent authenticated users from obtaining school-wide profile data
-- ---------------------------------------------------------------------------
-- Keep the existing same-school SELECT behaviour, but explicitly preserve the
-- user's own-profile access. The policies remain permissive but both are
-- school-bound.

DROP POLICY IF EXISTS "Users view profiles in same school" ON public.profiles;

CREATE POLICY "Users view profiles in same school"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    school_id IS NOT NULL
    AND school_id = private.current_user_school_id()
  )
);

-- ---------------------------------------------------------------------------
-- 5. Ensure anonymous clients cannot use these sensitive application tables
-- ---------------------------------------------------------------------------
-- Migration 3 is expected to have removed these grants already. These REVOKEs
-- are intentionally repeated here so Migration 4 is safe to apply against a
-- database that drifted from the repository migrations.

REVOKE ALL ON public.schools FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.student_fees FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.payment_allocations FROM anon;
REVOKE ALL ON public.wallet_transactions FROM anon;

COMMIT;
