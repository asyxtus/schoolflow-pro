-- Migration 8
-- Final public/anonymous privilege lockdown
--
-- Idempotent. Anonymous clients receive no direct application-table access.
-- Authenticated access remains governed by RLS.

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', r.schemaname, r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- Preserve normal authenticated frontend CRUD; RLS controls row access.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO authenticated',
      r.schemaname, r.tablename
    );
  END LOOP;
END
$$;

-- Deliberately restricted browser write surfaces.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.schools FROM authenticated;
GRANT SELECT ON public.schools TO authenticated;

COMMIT;
