-- Migration 12: Security verification gate
--
-- This migration verifies the final high-confidence security invariants.
--
-- Important: the private RLS helper functions intentionally retain EXECUTE for
-- authenticated because PostgreSQL evaluates RLS policies as the caller and
-- those policies invoke the helpers. EXECUTE alone does not expose these
-- functions as frontend RPCs when the private schema is not usable/exposed to
-- the Data API. The security boundary is:
--   1. private schema has no USAGE for Data API roles;
--   2. anonymous has no EXECUTE on private helpers;
--   3. helpers are SECURITY DEFINER with a restricted search_path.
--
-- This migration intentionally does not blanket-enable FORCE RLS.

BEGIN;

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
  -- RLS helpers are intentionally callable by authenticated because policies
  -- invoke them. What must be impossible is direct anonymous invocation and
  -- direct access through the private schema by Data API roles.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: % private function(s) remain directly executable by anon', v_count;
  END IF;

  -- The private schema itself must not be usable by browser roles. This is the
  -- important control that prevents direct SQL/RPC access to private helpers.
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
