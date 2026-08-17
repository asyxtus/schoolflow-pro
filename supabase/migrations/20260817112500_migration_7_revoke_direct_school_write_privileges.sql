-- Migration 7: Remove direct browser write privileges on public.schools
--
-- Prerequisite:
--   Migration 6 established explicit INSERT/UPDATE/DELETE RLS policies for
--   super_admin, and the remaining trusted server-side school mutations have
--   been moved to the service-role/admin client.
--
-- Security boundary after this migration:
--   * authenticated clients may SELECT schools subject to RLS;
--   * authenticated clients cannot INSERT, UPDATE, or DELETE schools directly;
--   * trusted server-side/admin operations use the service-role client;
--   * RLS remains enabled and continues to protect reads and any privileged
--     database path that uses a non-service-role role.
--
-- This migration is intentionally narrow and idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Remove direct authenticated write privileges from schools.
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.schools
FROM authenticated;

-- Keep only the privilege required for the authenticated frontend's RLS-
-- protected school reads.
GRANT SELECT ON public.schools TO authenticated;

-- Anonymous clients must remain completely excluded.
REVOKE ALL ON public.schools FROM anon;

-- ---------------------------------------------------------------------------
-- 2. Keep RLS explicitly enabled.
-- ---------------------------------------------------------------------------

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

COMMIT;
