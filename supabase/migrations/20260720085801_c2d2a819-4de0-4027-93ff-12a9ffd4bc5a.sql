ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_date_subject_key
  ON public.attendance (student_id, date, COALESCE(subject, ''));