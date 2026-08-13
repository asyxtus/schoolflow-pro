
-- 1. Attendance rate: switch to live computation via trigger
CREATE OR REPLACE FUNCTION public.compute_attendance_rate(_student_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('present','late','excused'))::numeric
      / NULLIF(COUNT(*)::numeric, 0),
      2
    )
  END
  FROM public.attendance
  WHERE student_id = _student_id;
$$;

CREATE OR REPLACE FUNCTION public.recompute_student_attendance(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
    SET attendance_rate = public.compute_attendance_rate(_student_id)
    WHERE id = _student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_student_attendance(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_student_attendance(NEW.student_id);
    IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
      PERFORM public.recompute_student_attendance(OLD.student_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS attendance_recompute ON public.attendance;
CREATE TRIGGER attendance_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_attendance();

-- 2. Registration payment helper
CREATE OR REPLACE FUNCTION public.registration_owed(_student_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reg AS (
    SELECT COALESCE(SUM(GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0)), 0)::bigint AS billed
    FROM public.student_fees sf
    JOIN public.fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE sf.student_id = _student_id AND fs.kind = 'registration'
  ),
  pay AS (
    SELECT COALESCE(SUM(amount_fcfa), 0)::bigint AS paid
    FROM public.payments WHERE student_id = _student_id
  )
  SELECT GREATEST((SELECT billed FROM reg) - LEAST((SELECT paid FROM pay), (SELECT billed FROM reg)), 0);
$$;

-- 3. Reset default for attendance_rate to 0 (was numeric with mock defaults)
ALTER TABLE public.students ALTER COLUMN attendance_rate SET DEFAULT 0;

-- 4. Recompute every student's fee_balance and attendance_rate from real data now
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.students LOOP
    PERFORM public.recompute_student_balance(r.id);
    PERFORM public.recompute_student_attendance(r.id);
  END LOOP;
END $$;
