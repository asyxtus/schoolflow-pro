-- Migration 2: Move RLS SECURITY DEFINER authorization helpers out of the
-- PostgREST-exposed public schema into a private schema.
--
-- Migration 1 revoked EXECUTE on the administrative/recomputation functions,
-- but intentionally left these RLS helpers in public because policies still
-- depended on them. This migration moves the existing function objects into
-- private, updates their internal helper references, and keeps RLS working.
--
-- The functions are moved with ALTER FUNCTION ... SET SCHEMA, preserving their
-- OIDs and therefore preserving existing policy dependencies. PostgreSQL will
-- consequently expose the policy expressions as private.* functions without
-- requiring a destructive drop/recreate of the policies.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

-- Do not make the private schema generally usable. RLS evaluation by the
-- client roles needs schema USAGE, but the schema is intentionally outside the
-- normal PostgREST public schema surface.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- Move the RLS-only helpers.
ALTER FUNCTION public.can_manage_boarding(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_clinic(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_discipline(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_hr(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_reception(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_school_data(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_manage_sports(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.can_record_payments(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.current_user_school_id() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.has_role_in_school(uuid, uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_diocese_admin(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_staff_of_school(uuid, uuid) SET SCHEMA private;

-- ALTER FUNCTION SET SCHEMA preserves the function body. The manager helpers
-- previously called public.has_role(), so replace those bodies with the new
-- private-qualified helper. Explicit public qualification keeps SECURITY
-- DEFINER execution safe from search_path manipulation.
CREATE OR REPLACE FUNCTION private.can_manage_boarding(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'boarding_master')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_clinic(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'nurse')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_discipline(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'discipline_master')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_hr(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'bursar')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_reception(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'receptionist')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_school_data(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal','vice_principal','bursar','secretary')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_sports(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'sports_master')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.can_record_payments(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('bursar','principal')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION private.has_role_in_school(_user_id uuid, _school_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_diocese_admin(_user_id uuid, _diocese_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND diocese_id = _diocese_id AND role = 'diocese_admin'
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION private.is_staff_of_school(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal','vice_principal','bursar','teacher','secretary','diocese_admin')
  ) OR private.has_role(_user_id, 'super_admin');
$function$;

-- The RLS helpers must remain callable during policy evaluation. They are not
-- frontend RPCs because they now live outside the exposed public schema.
GRANT EXECUTE ON FUNCTION private.can_manage_boarding(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_clinic(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_discipline(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_hr(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_reception(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_school_data(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_sports(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.can_record_payments(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.current_user_school_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_role_in_school(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_diocese_admin(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_staff_of_school(uuid, uuid) TO authenticated, anon;

-- Prevent future private-schema functions from inheriting broad EXECUTE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
