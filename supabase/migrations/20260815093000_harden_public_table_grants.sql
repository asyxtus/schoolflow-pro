-- Migration 3: Harden direct table privileges after moving RLS helpers to private.
--
-- RLS controls which rows a role may access, but it does not replace the
-- underlying table privileges. In particular, TRUNCATE is not governed by RLS.
-- The database inspection showed anon and authenticated holding broad table
-- privileges, including TRUNCATE, across sensitive school data tables.
--
-- This migration keeps the existing authenticated CRUD privileges needed by
-- the frontend, while removing unnecessary direct privileges and preventing
-- anonymous table access. RLS policies remain the authorization boundary for
-- authenticated CRUD operations.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Anonymous clients should not have direct access to application tables.
-- All current application RLS policies are intended for authenticated users,
-- and no frontend workflow identified so far requires anon table CRUD.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- -----------------------------------------------------------------------------
-- 2. Remove privileges that are not required by the browser client.
--
-- TRUNCATE is especially important: unlike DELETE, it is not filtered by RLS.
-- REFERENCES and TRIGGER are database-owner/developer capabilities, not normal
-- PostgREST CRUD capabilities.
-- -----------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM authenticated;

-- Anonymous users should also remain unable to use these capabilities if a
-- future grant accidentally gives them a narrower table privilege.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon;

-- -----------------------------------------------------------------------------
-- 3. Lock down defaults so newly-created public tables do not automatically
-- inherit the same broad privileges.
--
-- Existing migrations that intentionally expose a new table to the frontend
-- should explicitly GRANT the required privileges to authenticated.
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

COMMIT;
