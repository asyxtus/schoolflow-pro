-- =========================================================================
-- Discipline module.
--
-- Per-student incident log. Any staff member can report an incident and
-- see a student's history (a teacher needs to know if a student has a
-- pattern). Editing, resolving, or deleting an incident is restricted to
-- leadership or the discipline master — using the staff_position value
-- ('discipline_master') that was already reserved in the schema for
-- exactly this, plus principal/vice_principal as overseers.
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discipline_severity') THEN
    CREATE TYPE public.discipline_severity AS ENUM ('minor', 'moderate', 'major');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discipline_status') THEN
    CREATE TYPE public.discipline_status AS ENUM ('open', 'resolved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.discipline_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  severity public.discipline_severity NOT NULL DEFAULT 'minor',
  description TEXT NOT NULL,
  action_taken TEXT,
  points INT NOT NULL DEFAULT 0,
  status public.discipline_status NOT NULL DEFAULT 'open',
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discipline_incidents_student ON public.discipline_incidents(student_id);
CREATE INDEX IF NOT EXISTS idx_discipline_incidents_school_status ON public.discipline_incidents(school_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_incidents TO authenticated;
GRANT ALL ON public.discipline_incidents TO service_role;
ALTER TABLE public.discipline_incidents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS discipline_incidents_updated_at ON public.discipline_incidents;
CREATE TRIGGER discipline_incidents_updated_at BEFORE UPDATE ON public.discipline_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_manage_discipline(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'discipline_master')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

DROP POLICY IF EXISTS "Staff view discipline incidents" ON public.discipline_incidents;
CREATE POLICY "Staff view discipline incidents" ON public.discipline_incidents FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Staff report discipline incidents" ON public.discipline_incidents;
CREATE POLICY "Staff report discipline incidents" ON public.discipline_incidents FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Discipline leads edit incidents" ON public.discipline_incidents;
CREATE POLICY "Discipline leads edit incidents" ON public.discipline_incidents FOR UPDATE
  TO authenticated
  USING (public.can_manage_discipline(auth.uid(), school_id))
  WITH CHECK (public.can_manage_discipline(auth.uid(), school_id));
DROP POLICY IF EXISTS "Discipline leads delete incidents" ON public.discipline_incidents;
CREATE POLICY "Discipline leads delete incidents" ON public.discipline_incidents FOR DELETE
  TO authenticated USING (public.can_manage_discipline(auth.uid(), school_id));
