-- =========================================================================
-- Clinic module.
--
-- Two tables: clinic_visits (an append-only log of each time a student is
-- seen) and student_health_profiles (persistent context — allergies,
-- chronic conditions, blood group — that isn't tied to a single visit).
--
-- Unlike Discipline, this is restricted to the nurse and leadership only,
-- not all staff. A behavioral incident benefits from broad visibility (a
-- teacher should know a student's pattern); health data is more sensitive
-- and narrower access is the right default. Uses the 'nurse' app_role that
-- was already reserved in the schema for this.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.clinic_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  visited_on DATE NOT NULL DEFAULT CURRENT_DATE,
  complaint TEXT NOT NULL,
  treatment_given TEXT,
  temperature_c NUMERIC(4, 1),
  referred_out BOOLEAN NOT NULL DEFAULT false,
  follow_up_needed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_visits_student ON public.clinic_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_school_date ON public.clinic_visits(school_id, visited_on);

CREATE TABLE IF NOT EXISTS public.student_health_profiles (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  blood_group TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  emergency_medical_notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_visits TO authenticated;
GRANT ALL ON public.clinic_visits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_health_profiles TO authenticated;
GRANT ALL ON public.student_health_profiles TO service_role;
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_health_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS clinic_visits_updated_at ON public.clinic_visits;
CREATE TRIGGER clinic_visits_updated_at BEFORE UPDATE ON public.clinic_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS student_health_profiles_updated_at ON public.student_health_profiles;
CREATE TRIGGER student_health_profiles_updated_at BEFORE UPDATE ON public.student_health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_manage_clinic(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'nurse')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

DROP POLICY IF EXISTS "Clinic staff manage visits" ON public.clinic_visits;
CREATE POLICY "Clinic staff manage visits" ON public.clinic_visits FOR ALL
  TO authenticated
  USING (public.can_manage_clinic(auth.uid(), school_id))
  WITH CHECK (public.can_manage_clinic(auth.uid(), school_id));

DROP POLICY IF EXISTS "Clinic staff manage health profiles" ON public.student_health_profiles;
CREATE POLICY "Clinic staff manage health profiles" ON public.student_health_profiles FOR ALL
  TO authenticated
  USING (public.can_manage_clinic(auth.uid(), school_id))
  WITH CHECK (public.can_manage_clinic(auth.uid(), school_id));
