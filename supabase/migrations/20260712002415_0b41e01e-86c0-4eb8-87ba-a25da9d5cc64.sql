
-- 1. student_fees (invoices)
CREATE TABLE public.student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa >= 0),
  discount_fcfa INTEGER NOT NULL DEFAULT 0 CHECK (discount_fcfa >= 0),
  academic_year TEXT,
  due_date DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_fees_student ON public.student_fees(student_id);
CREATE INDEX idx_student_fees_school ON public.student_fees(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fees TO authenticated;
GRANT ALL ON public.student_fees TO service_role;

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view school fee assignments" ON public.student_fees
  FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));

CREATE POLICY "Managers can manage fee assignments" ON public.student_fees
  FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER update_student_fees_updated_at
  BEFORE UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Receipt numbers on payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_no TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt_no ON public.payments(school_id, receipt_no) WHERE receipt_no IS NOT NULL;

-- 3. Recompute student fee_balance from invoices - payments
CREATE OR REPLACE FUNCTION public.recompute_student_balance(_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billed BIGINT;
  paid BIGINT;
BEGIN
  SELECT COALESCE(SUM(GREATEST(amount_fcfa - discount_fcfa, 0)), 0) INTO billed
    FROM public.student_fees WHERE student_id = _student_id;
  SELECT COALESCE(SUM(amount_fcfa), 0) INTO paid
    FROM public.payments WHERE student_id = _student_id;
  UPDATE public.students
    SET fee_balance = GREATEST(billed - paid, 0)
    WHERE id = _student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_balance_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_student_balance(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_student_balance(NEW.student_id);
    IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
      PERFORM public.recompute_student_balance(OLD.student_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_balance_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_student_balance(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_student_balance(NEW.student_id);
    IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
      PERFORM public.recompute_student_balance(OLD.student_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS student_fees_recompute ON public.student_fees;
CREATE TRIGGER student_fees_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_fees();

DROP TRIGGER IF EXISTS payments_recompute ON public.payments;
CREATE TRIGGER payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_payments();

-- 4. Auto-generate receipt number per school
CREATE OR REPLACE FUNCTION public.trg_payment_receipt_no()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n BIGINT;
BEGIN
  IF NEW.receipt_no IS NULL THEN
    SELECT COUNT(*) + 1 INTO n FROM public.payments WHERE school_id = NEW.school_id;
    NEW.receipt_no := 'R-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(n::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_receipt_no ON public.payments;
CREATE TRIGGER payments_receipt_no
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payment_receipt_no();
