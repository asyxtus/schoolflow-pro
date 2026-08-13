
-- =========================================================================
-- Anti-fraud fee flow
-- =========================================================================

-- 1. Void columns on payments (never delete a receipt)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- 2. Recompute balance should ignore voided payments
CREATE OR REPLACE FUNCTION public.recompute_student_balance(_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE billed BIGINT; paid BIGINT;
BEGIN
  SELECT COALESCE(SUM(GREATEST(amount_fcfa - discount_fcfa, 0)), 0) INTO billed
    FROM public.student_fees WHERE student_id = _student_id;
  SELECT COALESCE(SUM(amount_fcfa), 0) INTO paid
    FROM public.payments WHERE student_id = _student_id AND voided = false;
  UPDATE public.students SET fee_balance = GREATEST(billed - paid, 0) WHERE id = _student_id;
END; $$;

-- 3. Narrow role check: only bursar / principal / super_admin may record or void payments
CREATE OR REPLACE FUNCTION public.can_record_payments(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('bursar','principal')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

-- 4. Daily cash closures (end-of-day lock by Bursar)
CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  close_date DATE NOT NULL,
  closed_by UUID NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cash_total BIGINT NOT NULL DEFAULT 0,
  momo_total BIGINT NOT NULL DEFAULT 0,
  bank_total BIGINT NOT NULL DEFAULT 0,
  cheque_total BIGINT NOT NULL DEFAULT 0,
  other_total BIGINT NOT NULL DEFAULT 0,
  expected_cash BIGINT,
  cash_variance BIGINT,
  notes TEXT,
  UNIQUE (school_id, close_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_closures TO authenticated;
GRANT ALL ON public.cash_closures TO service_role;
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read closures" ON public.cash_closures FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "bursar write closures" ON public.cash_closures FOR ALL
  TO authenticated
  USING (public.can_record_payments(auth.uid(), school_id))
  WITH CHECK (public.can_record_payments(auth.uid(), school_id));

-- 5. Guard: payments for a closed day cannot be inserted/updated/deleted
--    unless the caller has a principal role (override).
CREATE OR REPLACE FUNCTION public.trg_guard_closed_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_closed BOOLEAN;
  is_principal BOOLEAN;
  target_date DATE;
  target_school UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_date := (OLD.paid_at AT TIME ZONE 'UTC')::date;
    target_school := OLD.school_id;
  ELSE
    target_date := (NEW.paid_at AT TIME ZONE 'UTC')::date;
    target_school := NEW.school_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.cash_closures
    WHERE school_id = target_school AND close_date = target_date
  ) INTO is_closed;

  IF NOT is_closed THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT public.has_role_in_school(auth.uid(), target_school, 'principal')
      OR public.has_role(auth.uid(), 'super_admin')
    INTO is_principal;

  IF NOT is_principal THEN
    RAISE EXCEPTION 'Day % is closed. Only the Principal can modify payments for a closed day.', target_date;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

DROP TRIGGER IF EXISTS trg_payments_guard_closed_day ON public.payments;
CREATE TRIGGER trg_payments_guard_closed_day
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_closed_day();

-- 6. Tighten payment write RLS to bursar/principal only (was: can_manage_school_data)
DROP POLICY IF EXISTS "school managers write payments" ON public.payments;
CREATE POLICY "bursar/principal record payments" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.can_record_payments(auth.uid(), school_id));
CREATE POLICY "bursar/principal update payments" ON public.payments FOR UPDATE
  TO authenticated
  USING (public.can_record_payments(auth.uid(), school_id))
  WITH CHECK (public.can_record_payments(auth.uid(), school_id));
-- Deleting payments is not allowed anywhere (use void). Principal override is via UPDATE.

-- =========================================================================
-- Staff attendance / clock-in
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  note TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance TO authenticated;
GRANT ALL ON public.staff_attendance TO service_role;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read staff_attendance" ON public.staff_attendance FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "managers write staff_attendance" ON public.staff_attendance FOR ALL
  TO authenticated
  USING (public.can_manage_hr(auth.uid(), school_id))
  WITH CHECK (public.can_manage_hr(auth.uid(), school_id));
CREATE TRIGGER update_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
