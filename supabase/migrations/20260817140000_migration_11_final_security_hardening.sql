-- Migration 11: Final privilege alignment + security audit surface
--
-- Goals:
--   1. Remove broad authenticated CRUD grants from public base tables.
--   2. Re-grant only operations represented by authenticated/PUBLIC RLS policies.
--   3. Preserve the intentionally server-controlled boundaries for schools,
--      profiles, and user_roles.
--   4. Remove anonymous access from all public base tables.
--   5. Keep RLS enabled without blanket FORCE RLS.
--   6. Add a private, non-frontend security audit RPC for ongoing verification.
--
-- This is idempotent. It is deliberately catalog-driven so newly added public
-- tables are not silently given broad authenticated CRUD privileges.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure RLS is enabled on every public base table.
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schema_name, r.table_name
    );
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 2. Reset browser table privileges to least privilege.
-- ---------------------------------------------------------------------------
-- RLS does not replace table grants; the caller needs both a table privilege
-- and a matching policy. PostgreSQL's pg_policies exposes the command/roles
-- covered by each policy, so the next block derives authenticated grants from
-- that policy surface instead of maintaining a fragile hand-written list.
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      r.schema_name, r.table_name
    );
  END LOOP;
END
$do$;

-- Anonymous clients get no direct table access anywhere in public.
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM anon',
      r.schema_name, r.table_name
    );
  END LOOP;
END
$do$;

-- Grant only operations for which an authenticated/PUBLIC RLS policy exists.
DO $do$
DECLARE
  r record;
  grant_list text;
BEGIN
  FOR r IN
    SELECT
      schemaname AS schema_name,
      tablename AS table_name,
      bool_or(cmd IN ('SELECT', 'ALL') AND
        (roles @> ARRAY['authenticated'::name] OR roles @> ARRAY['public'::name])) AS can_select,
      bool_or(cmd IN ('INSERT', 'ALL') AND
        (roles @> ARRAY['authenticated'::name] OR roles @> ARRAY['public'::name])) AS can_insert,
      bool_or(cmd IN ('UPDATE', 'ALL') AND
        (roles @> ARRAY['authenticated'::name] OR roles @> ARRAY['public'::name])) AS can_update,
      bool_or(cmd IN ('DELETE', 'ALL') AND
        (roles @> ARRAY['authenticated'::name] OR roles @> ARRAY['public'::name])) AS can_delete
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
  LOOP
    grant_list := concat_ws(', ',
      CASE WHEN r.can_select THEN 'SELECT' END,
      CASE WHEN r.can_insert THEN 'INSERT' END,
      CASE WHEN r.can_update THEN 'UPDATE' END,
      CASE WHEN r.can_delete THEN 'DELETE' END
    );

    IF grant_list IS NOT NULL AND grant_list <> '' THEN
      EXECUTE format(
        'GRANT %s ON TABLE %I.%I TO authenticated',
        grant_list, r.schema_name, r.table_name
      );
    END IF;
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 3. Explicit server-controlled exceptions.
-- ---------------------------------------------------------------------------
-- These tables contain RLS policies for privileged/admin roles, but ordinary
-- browser clients must not receive the corresponding write privilege merely
-- because a super-admin policy exists.

-- Schools: browser read only; school creation/update/deletion is trusted-server
-- or service-role work. Super-admin RLS policies remain intact for trusted paths.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.schools FROM authenticated;
GRANT SELECT ON public.schools TO authenticated;
REVOKE ALL ON public.schools FROM PUBLIC, anon;

-- Profiles: browser read/update only. Creation is handled by auth onboarding;
-- deletion is an admin/auth flow.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
REVOKE ALL ON public.profiles FROM PUBLIC, anon;

-- User roles: browser read only. Role assignment is a trusted admin/server flow.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
REVOKE ALL ON public.user_roles FROM PUBLIC, anon;

-- No browser table needs these structural privileges for ordinary CRUD.
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM authenticated',
      r.schema_name, r.table_name
    );
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- 4a. Close the two known public SECURITY DEFINER trigger functions.
-- ---------------------------------------------------------------------------
-- They are not frontend RPCs. They exist for auth/profile automation and
-- timestamp triggers, so callers must not be able to invoke them through the
-- Data API. Their search_path is restricted to trusted schemas.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public';
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public';
    EXECUTE 'REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 4b. Prevent default privileges from silently reopening the Data API surface.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Create a private security audit function.
-- ---------------------------------------------------------------------------
-- The function is intentionally not exposed to anon/authenticated/service_role.
-- It is for postgres/admin SQL verification and CI/manual database audits.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.security_audit()
RETURNS TABLE (
  category text,
  schema_name text,
  table_name text,
  object_name text,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  -- RLS coverage.
  RETURN QUERY
  SELECT
    'rls_not_enabled'::text,
    n.nspname::text,
    c.relname::text,
    NULL::text,
    'Public base table does not have RLS enabled.'::text
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity;

  -- FORCE RLS is reported, but never imposed by this migration.
  RETURN QUERY
  SELECT
    'force_rls_enabled'::text,
    n.nspname::text,
    c.relname::text,
    NULL::text,
    'FORCE RLS is enabled; review intentionally rather than treating it as a blanket requirement.'::text
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relforcerowsecurity;

  -- Anonymous direct table privileges.
  RETURN QUERY
  SELECT
    'anon_table_privilege'::text,
    n.nspname::text,
    c.relname::text,
    NULL::text,
    'anon retains direct table privilege(s).'::text
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

  -- Authenticated structural privileges that should never be part of the
  -- ordinary browser CRUD surface.
  RETURN QUERY
  SELECT
    'authenticated_structural_privilege'::text,
    n.nspname::text,
    c.relname::text,
    NULL::text,
    'authenticated retains TRUNCATE/REFERENCES/TRIGGER.'::text
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR
      pg_catalog.has_table_privilege('authenticated', c.oid, 'REFERENCES') OR
      pg_catalog.has_table_privilege('authenticated', c.oid, 'TRIGGER')
    );

  -- School-scoped policy review. A policy on a table carrying school_id should
  -- normally constrain by school_id or by the caller identity. This is a review
  -- signal, not an automatic blocker, because some identity-owned rows (for
  -- example user_roles/profile rows) are intentionally keyed by auth.uid().
  RETURN QUERY
  SELECT
    'school_policy_review'::text,
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    coalesce(p.qual::text, '') || CASE
      WHEN p.with_check IS NOT NULL THEN ' | WITH CHECK: ' || p.with_check::text
      ELSE ''
    END
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE col.table_schema = p.schemaname
        AND col.table_name = p.tablename
        AND col.column_name = 'school_id'
    )
    AND (p.roles @> ARRAY['authenticated'::name] OR p.roles @> ARRAY['public'::name])
    AND lower(coalesce(p.qual::text, '') || ' ' || coalesce(p.with_check::text, '')) NOT LIKE '%school_id%'
    AND lower(coalesce(p.qual::text, '') || ' ' || coalesce(p.with_check::text, '')) NOT LIKE '%auth.uid()%';

  -- Public SECURITY DEFINER functions are high-value review targets.
  RETURN QUERY
  SELECT
    'public_security_definer'::text,
    n.nspname::text,
    NULL::text,
    p.proname::text || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    'SECURITY DEFINER function remains in public schema.'::text
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef;

  -- Database RPCs that appear to mutate schools. These require explicit review
  -- because application Edge/server code is outside PostgreSQL's catalogs.
  RETURN QUERY
  SELECT
    'school_mutating_rpc'::text,
    n.nspname::text,
    NULL::text,
    p.proname::text || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    'Function body contains INSERT/UPDATE/DELETE against public.schools; verify it is trusted/admin-only.'::text
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND lower(pg_catalog.pg_get_functiondef(p.oid)) ~ '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?schools';
END;
$function$;

REVOKE ALL ON FUNCTION private.security_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.security_audit() FROM anon;
REVOKE ALL ON FUNCTION private.security_audit() FROM authenticated, service_role;
-- Deliberately leave execution to the postgres/admin SQL role only.

COMMIT;
