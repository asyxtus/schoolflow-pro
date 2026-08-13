-- =========================================================================
-- Canonical subjects list.
--
-- "subject" is currently a free-text string typed independently in five
-- places: class_subjects, attendance, grades, subject_coefficients, and
-- timetable_slots. Nothing guarantees "Mathematics" typed in one screen
-- matches "Maths" typed in another — they silently fail to cross-reference,
-- with no error, just quietly incomplete numbers (e.g. a teacher's
-- attendance-taking rate undercounting because the subject string on their
-- timetable slot doesn't exactly match the one on their class assignment).
--
-- This adds a real per-school subjects table as the source of truth, and
-- back-fills it from every distinct value already in use. It does NOT
-- change the five existing "subject text" columns or the tables that read
-- them — every existing query keeps working unchanged. Instead, a sync
-- trigger on each of the five tables keeps the subjects table current
-- automatically, so the canonical list never falls behind even before
-- every entry-point UI is switched over to picking from it. UI surfaces get
-- moved onto the shared picker one at a time, and each one immediately
-- benefits without waiting for the others.
-- =========================================================================

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case/whitespace-insensitive uniqueness: "Maths" and " maths " collide.
CREATE UNIQUE INDEX uniq_subjects_school_name
  ON public.subjects (school_id, lower(btrim(name)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read subjects" ON public.subjects FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Leadership manage subjects" ON public.subjects FOR ALL
  TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Back-fill from every existing free-text source.
INSERT INTO public.subjects (school_id, name)
SELECT DISTINCT school_id, btrim(subject) FROM public.class_subjects
WHERE subject IS NOT NULL AND btrim(subject) <> ''
ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;

INSERT INTO public.subjects (school_id, name)
SELECT DISTINCT school_id, btrim(subject) FROM public.attendance
WHERE subject IS NOT NULL AND btrim(subject) <> ''
ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;

INSERT INTO public.subjects (school_id, name)
SELECT DISTINCT school_id, btrim(subject) FROM public.grades
WHERE subject IS NOT NULL AND btrim(subject) <> ''
ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;

INSERT INTO public.subjects (school_id, name)
SELECT DISTINCT school_id, btrim(subject) FROM public.subject_coefficients
WHERE subject IS NOT NULL AND btrim(subject) <> ''
ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;

INSERT INTO public.subjects (school_id, name)
SELECT DISTINCT school_id, btrim(subject) FROM public.timetable_slots
WHERE subject IS NOT NULL AND btrim(subject) <> ''
ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;

-- Keep the canonical list current automatically: whenever any of the five
-- tables gets a new or changed subject string, make sure it exists in
-- subjects too (matched case/whitespace-insensitively so near-duplicates
-- don't pile up). This does not validate or block the write — it just
-- ensures the picker never falls behind an entry point that hasn't been
-- switched over to it yet.
CREATE OR REPLACE FUNCTION public.trg_sync_subject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subject IS NOT NULL AND btrim(NEW.subject) <> '' THEN
    INSERT INTO public.subjects (school_id, name)
    VALUES (NEW.school_id, btrim(NEW.subject))
    ON CONFLICT (school_id, lower(btrim(name))) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_class_subjects_sync_subject ON public.class_subjects;
CREATE TRIGGER trg_class_subjects_sync_subject
BEFORE INSERT OR UPDATE OF subject ON public.class_subjects
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subject();

DROP TRIGGER IF EXISTS trg_attendance_sync_subject ON public.attendance;
CREATE TRIGGER trg_attendance_sync_subject
BEFORE INSERT OR UPDATE OF subject ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subject();

DROP TRIGGER IF EXISTS trg_grades_sync_subject ON public.grades;
CREATE TRIGGER trg_grades_sync_subject
BEFORE INSERT OR UPDATE OF subject ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subject();

DROP TRIGGER IF EXISTS trg_subject_coefficients_sync_subject ON public.subject_coefficients;
CREATE TRIGGER trg_subject_coefficients_sync_subject
BEFORE INSERT OR UPDATE OF subject ON public.subject_coefficients
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subject();

DROP TRIGGER IF EXISTS trg_timetable_slots_sync_subject ON public.timetable_slots;
CREATE TRIGGER trg_timetable_slots_sync_subject
BEFORE INSERT OR UPDATE OF subject ON public.timetable_slots
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subject();
