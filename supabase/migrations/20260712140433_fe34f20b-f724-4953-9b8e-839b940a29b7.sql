
CREATE TABLE public.subject_coefficients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1,
  teacher_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_name, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_coefficients TO authenticated;
GRANT ALL ON public.subject_coefficients TO service_role;
ALTER TABLE public.subject_coefficients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view subject coefficients" ON public.subject_coefficients
  FOR SELECT USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage subject coefficients" ON public.subject_coefficients
  FOR ALL USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER update_subject_coefficients_updated_at BEFORE UPDATE ON public.subject_coefficients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bulletin_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  conduct TEXT,
  absences_justified INTEGER DEFAULT 0,
  absences_unjustified INTEGER DEFAULT 0,
  head_teacher_remark TEXT,
  principal_remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, sequence)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulletin_meta TO authenticated;
GRANT ALL ON public.bulletin_meta TO service_role;
ALTER TABLE public.bulletin_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view bulletin meta" ON public.bulletin_meta
  FOR SELECT USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage bulletin meta" ON public.bulletin_meta
  FOR ALL USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER update_bulletin_meta_updated_at BEFORE UPDATE ON public.bulletin_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
