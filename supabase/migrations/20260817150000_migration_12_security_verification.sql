-- Migration 12: Security verification gate
--
-- This migration makes the final high-confidence security invariants executable.
-- It intentionally does not blanket-enable FORCE RLS and does not attempt to
-- guess which school-scoped policies are business exceptions. Those are exposed
-- by private.security_audit() for review.

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

  -- 5. No private helper may be directly callable by Data API roles.
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND (
      pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') OR
      pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Security verification failed: % private function(s) remain callable by Data API roles', v_count;
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
