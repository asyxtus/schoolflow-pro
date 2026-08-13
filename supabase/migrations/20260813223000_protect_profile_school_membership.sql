-- A user's profile.school_id is security-sensitive because several RLS helpers
-- use it as the user's current school. Ordinary users must never be able to
-- move themselves into another school by editing their own profile.

CREATE OR REPLACE FUNCTION public.guard_profile_school_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.school_id IS DISTINCT FROM OLD.school_id
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Users cannot change their school assignment';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_school_change ON public.profiles;
CREATE TRIGGER trg_guard_profile_school_change
BEFORE UPDATE OF school_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_school_change();
