
-- attendance status enum
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_audience AS ENUM ('all','class','staff','guardians');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_school_date_idx ON public.attendance(school_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TIMETABLE
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  period smallint NOT NULL CHECK (period BETWEEN 1 AND 12),
  subject text NOT NULL,
  teacher text,
  room text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_name, day_of_week, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read timetable" ON public.timetable_slots FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_timetable_updated BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  audience public.message_audience NOT NULL DEFAULT 'all',
  audience_class text,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_school_created_idx ON public.messages(school_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Sender delete messages" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.can_manage_school_data(auth.uid(), school_id));

-- GRADES
CREATE TABLE IF NOT EXISTS public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sequence smallint NOT NULL CHECK (sequence BETWEEN 1 AND 6),
  subject text NOT NULL,
  ca_score numeric(5,2) CHECK (ca_score >= 0 AND ca_score <= 100),
  exam_score numeric(5,2) CHECK (exam_score >= 0 AND exam_score <= 100),
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, sequence, subject)
);
CREATE INDEX IF NOT EXISTS grades_school_seq_idx ON public.grades(school_id, sequence);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read grades" ON public.grades FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage grades" ON public.grades FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_grades_updated BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
