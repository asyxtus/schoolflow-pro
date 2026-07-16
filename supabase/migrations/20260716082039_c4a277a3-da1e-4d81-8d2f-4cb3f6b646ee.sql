
-- 1. Extend app_role enum with additional staff roles (idempotent)
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['discipline_master','sports_master','dean_of_studies','counsellor','boarding_master','receptionist','nurse']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel=r) THEN
      EXECUTE format('ALTER TYPE public.app_role ADD VALUE %L', r);
    END IF;
  END LOOP;
END $$;

-- 2. Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text,
  sections text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read classes" ON public.classes FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Leadership manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed classes from existing student class_name values
INSERT INTO public.classes (school_id, name)
SELECT DISTINCT school_id, class_name
FROM public.students
WHERE class_name IS NOT NULL AND class_name <> ''
ON CONFLICT (school_id, name) DO NOTHING;

-- 3. Class subjects
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  coefficient numeric NOT NULL DEFAULT 1,
  teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read class subjects" ON public.class_subjects FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Leadership manage class subjects" ON public.class_subjects FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER class_subjects_updated_at BEFORE UPDATE ON public.class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Extend fee_structures with kind / installments / registration flags / due_date
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'tuition',
  ADD COLUMN IF NOT EXISTS installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_at_registration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_date date;

-- Ensure kind is constrained to known values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_structures_kind_check') THEN
    ALTER TABLE public.fee_structures
      ADD CONSTRAINT fee_structures_kind_check CHECK (kind IN ('registration','tuition','other'));
  END IF;
END $$;
