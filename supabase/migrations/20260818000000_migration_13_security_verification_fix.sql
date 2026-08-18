-- Migration 13: Security verification gate (corrected)
--
-- Purpose:
--   Replace the over-strict Migration 12 verification gate with checks that
--   match the SchoolFlow security architecture actually in use.
--
-- Key rules:
--   * RLS helpers live in private and remain SECURITY DEFINER.
--   * Data API roles must not have USAGE on private.
--   * anon must not be able to execute private helpers.
--   * authenticated EXECUTE on private helpers is NOT treated as an error:
--     RLS policy evaluation may legitimately depend on these routines.
--   * public SECURITY DEFINER functions are audited, not blanket-rejected;
--     some are legitimate application RPCs or trigger functions.
--   * FORCE RLS is deliberately not enabled by this migration.
--   * Direct schools/profile/user_roles mutation remains restricted.
--
-- This migration is idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Re-establish the private-schema boundary.
-- ---------------------------------------------------------------------------
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO postgres;

-- Private helpers are policy implementation details, not anonymous RPCs.
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      r.oid::regprocedure
    );
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 2. Verification helpers.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_count bigint;
  v_public_sd text;
BEGIN
  -- Every public base table must have RLS enabled.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Security verification failed: % public base table(s) have RLS disabled',
      v_count;
  END IF;

  -- Anonymous clients must have no direct CRUD on public base tables.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      has_table_privilege('anon', c.oid, 'SELECT') OR
      has_table_privilege('anon', c.oid, 'INSERT') OR
      has_table_privilege('anon', c.oid, 'UPDATE') OR
      has_table_privilege('anon', c.oid, 'DELETE')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Security verification failed: anon retains direct CRUD on % public base table(s)',
      v_count;
  END IF;

  -- Structural privileges should never be exposed to the browser role.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR
      has_table_privilege('authenticated', c.oid, 'REFERENCES') OR
      has_table_privilege('authenticated', c.oid, 'TRIGGER')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Security verification failed: authenticated retains structural privileges on % public table(s)',
      v_count;
  END IF;

  -- The schools table is administrative data. Browser clients must not mutate it.
  IF has_table_privilege('authenticated', 'public.schools', 'INSERT')
     OR has_table_privilege('authenticated', 'public.schools', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.schools', 'DELETE') THEN
    RAISE EXCEPTION
      'Security verification failed: authenticated can directly mutate public.schools';
  END IF;

  -- Profiles: users may update their own row, but creation/deletion is not a
  -- normal browser operation.
  IF has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION
      'Security verification failed: authenticated can directly create/delete public.profiles';
  END IF;

  -- Role assignments are security-sensitive. They must not be directly
  -- inserted/updated/deleted by the browser.
  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION
      'Security verification failed: authenticated can directly mutate public.user_roles';
  END IF;

  -- Private schema must be unreachable through the Data API roles.
  IF has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION
      'Security verification failed: anon retains USAGE on private schema';
  END IF;

  IF has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION
      'Security verification failed: authenticated retains USAGE on private schema';
  END IF;

  IF has_schema_privilege('service_role', 'private', 'USAGE') THEN
    RAISE EXCEPTION
      'Security verification failed: service_role retains USAGE on private schema';
  END IF;

  -- No private helper may be directly executable by anon.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Security verification failed: % private function(s) remain executable by anon',
      v_count;
  END IF;

  -- All private helpers must remain SECURITY DEFINER and use a restricted
  -- search_path. This protects the privileged execution context from search
  -- path object substitution.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND (
      NOT p.prosecdef OR
      NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg = 'search_path=pg_catalog'
      )
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Security verification failed: % private helper(s) are not SECURITY DEFINER with search_path=pg_catalog',
      v_count;
  END IF;

  -- Public SECURITY DEFINER functions are intentionally NOT rejected here.
  -- They may be legitimate frontend RPCs or trigger functions. Surface them
  -- for explicit review instead of treating every public SECURITY DEFINER
  -- routine as a vulnerability.
  SELECT string_agg(
           format('%s(%s)', p.oid::regprocedure,
                  pg_get_function_identity_arguments(p.oid)),
           ', '
           ORDER BY n.nspname, p.proname, p.oid
         )
  INTO v_public_sd
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef;

  IF v_public_sd IS NOT NULL THEN
    RAISE NOTICE
      'SECURITY DEFINER review list (public): %',
      v_public_sd;
  ELSE
    RAISE NOTICE 'SECURITY DEFINER review list (public): none';
  END IF;

  -- Public SECURITY DEFINER routines should not be silently owned by a
  -- non-privileged application role. Keep postgres ownership as the expected
  -- baseline for this deployment.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND r.rolname <> 'postgres';

  IF v_count > 0 THEN
    RAISE WARNING
      'Security review required: % public SECURITY DEFINER function(s) are not owned by postgres',
      v_count;
  END IF;

  RAISE NOTICE 'Migration 13 security verification passed.';
END
$verify$;

COMMIT;
