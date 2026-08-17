-- Migration 10
-- Final SchoolFlow security verification
--
-- Assertions only. This migration makes no schema, data, or privilege changes.

DO $$
DECLARE
  v_bad_rls integer;
  v_bad_anon_tables integer;
  v_bad_helper_execute integer;
  v_bad_school_write integer;
BEGIN
  SELECT count(*) INTO v_bad_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> 'spatial_ref_sys'
    AND NOT rowsecurity;

  IF v_bad_rls > 0 THEN
    RAISE EXCEPTION 'SECURITY CHECK FAILED: % public tables do not have RLS enabled', v_bad_rls;
  END IF;

  SELECT count(*) INTO v_bad_anon_tables
  FROM information_schema.role_table_grants
  WHERE grantee = 'anon'
    AND table_schema = 'public';

  IF v_bad_anon_tables > 0 THEN
    RAISE EXCEPTION 'SECURITY CHECK FAILED: anon still has % public table privileges', v_bad_anon_tables;
  END IF;

  SELECT count(*) INTO v_bad_helper_execute
  FROM information_schema.routine_privileges
  WHERE grantee = 'anon'
    AND routine_schema = 'private'
    AND privilege_type = 'EXECUTE';

  IF v_bad_helper_execute > 0 THEN
    RAISE EXCEPTION 'SECURITY CHECK FAILED: anon retains EXECUTE on % private routines', v_bad_helper_execute;
  END IF;

  SELECT count(*) INTO v_bad_school_write
  FROM information_schema.role_table_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND table_name = 'schools'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  IF v_bad_school_write > 0 THEN
    RAISE EXCEPTION 'SECURITY CHECK FAILED: authenticated retains direct schools write privileges';
  END IF;

  RAISE NOTICE 'SchoolFlow security verification PASSED';
END
$$;
