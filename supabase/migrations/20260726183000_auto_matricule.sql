-- =========================================================================
-- Automatic matricule assignment.
--
-- Matricule already has a UNIQUE(school_id, matricule) constraint, so a
-- true duplicate could never actually be saved — but staff still had to
-- invent a unique code by hand every time (createStudent and
-- enrollApplicant both required it as free text), which is exactly where
-- typos, informal ad-hoc numbering, and "that one's already taken, let me
-- try again" friction come from.
--
-- This makes matricule auto-fill when left blank, using an atomic
-- per-school-per-year counter — safe under concurrent admissions (two
-- students enrolled at the same instant can never get the same number),
-- unlike a naive "COUNT(*) + 1" which can race. A manually-typed matricule
-- (e.g. transferring a number from a previous system) is still respected
-- and still protected by the existing uniqueness constraint.
-- =========================================================================

CREATE TABLE public.matricule_sequences (
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (school_id, year)
);

ALTER TABLE public.matricule_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read matricule sequences" ON public.matricule_sequences FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
-- No direct write policy: only the SECURITY DEFINER function below writes
-- to this table, the same way other internal counters in this schema work.

CREATE OR REPLACE FUNCTION public.next_matricule(_school_id UUID, _prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM now())::int;
  n INT;
BEGIN
  INSERT INTO public.matricule_sequences (school_id, year, last_number)
  VALUES (_school_id, yr, 1)
  ON CONFLICT (school_id, year)
    DO UPDATE SET last_number = public.matricule_sequences.last_number + 1
  RETURNING last_number INTO n;

  RETURN COALESCE(NULLIF(btrim(_prefix), ''), 'STU') || '-' || yr || '-' || LPAD(n::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_students_auto_matricule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix TEXT;
BEGIN
  IF NEW.matricule IS NULL OR btrim(NEW.matricule) = '' THEN
    SELECT code INTO prefix FROM public.schools WHERE id = NEW.school_id;
    NEW.matricule := public.next_matricule(NEW.school_id, prefix);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_auto_matricule ON public.students;
CREATE TRIGGER trg_students_auto_matricule
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.trg_students_auto_matricule();
