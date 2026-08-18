-- Migration 12: Security verification gate
--
-- This migration enforces and verifies the final high-confidence security
-- invariants. It is safe to rerun.
--
-- IMPORTANT: the private RLS helper functions intentionally retain EXECUTE
-- for authenticated because PostgreSQL evaluates RLS policies as the caller
-- and those policies invoke the helpers. EXECUTE alone is not the browser
-- exposure we are trying to prevent.
--
-- The actual boundary is:
--   1. private schema has NO USAGE for Data API roles;
--   2. anon has NO EXECUTE on private helpers;
--   3. helpers are SECURITY DEFINER with a restricted search_path.
--
-- We deliberately do NOT blanket-enable FORCE RLS.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Enforce the private-schema boundary before verifying it.
-- ---------------------------------------------------------------------------
-- CREATE SCHEMA normally grants USAGE to PUBLIC. Remove that inherited
-- privilege explicitly. RLS policies can still invoke already-resolved
-- private helper functions; browser roles cannot address the private schema
-- through the Data API without schema USAGE.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;

-- Keep the administrative database owner able to work with the schema.
GRANT USAGE ON SCHEMA private TO postgres;

-- No anonymous direct invocation of private helpers.
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

DO $do$
DECLARE
  v_count bigint;
BEGIN
  -- 1. Every public base table must have RLS enabled.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: % public base table(s) have RLS disabled', v_count;
  END IF;

  -- 2. Anonymous clients must have no direct CRUD on public base tables.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') OR
      pg_catalog.has_table_privilege('anon', c.oid, 'INSERT') OR
      pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE') OR
      pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: anon retains direct CRUD on % public base table(s)', v_count;
  END IF;

  -- 3. Structural table privileges must not be exposed to authenticated.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR
      pg_catalog.has_table_privilege('authenticated', c.oid, 'REFERENCES') OR
      pg_catalog.has_table_privilege('authenticated', c.oid, 'TRIGGER')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: authenticated retains structural table privileges on % table(s)', v_count;
  END IF;

  -- 4. The browser must not mutate schools, profiles, or user_roles.
  IF pg_catalog.has_table_privilege('authenticated', 'public.schools', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.schools', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.schools', 'DELETE') THEN
    RAISE EXCEPTION 'Security verification failed: authenticated can directly mutate public.schools';
  END IF;

  IF pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'Security verification failed: authenticated can directly create/delete public.profiles';
  END IF;

  IF pg_catalog.has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'Security verification failed: authenticated can directly mutate public.user_roles';
  END IF;

  -- 5. Private helper boundary.
  --
  -- Authenticated EXECUTE is intentionally retained for RLS evaluation. What
  -- must be impossible is direct anonymous execution and schema access by the
  -- Data API roles.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: % private function(s) remain directly executable by anon', v_count;
  END IF;

  IF pg_catalog.has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Security verification failed: anon retains USAGE on private schema';
  END IF;

  IF pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Security verification failed: authenticated retains USAGE on private schema';
  END IF;

  IF pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Security verification failed: service_role retains USAGE on private schema';
  END IF;

  -- 6. Only the two known trigger functions may remain SECURITY DEFINER in
  -- public. Any newly introduced public SECURITY DEFINER function requires an
  -- explicit review rather than silently becoming an RPC.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT (
      (p.proname = 'handle_new_user' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '')
      OR
      (p.proname = 'update_updated_at_column' AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: % unexpected public SECURITY DEFINER function(s) found', v_count;
  END IF;
END
$do$;

COMMIT;
