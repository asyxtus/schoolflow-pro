
-- 1. Allocations
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  student_fee_id UUID NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, student_fee_id)
);
CREATE INDEX idx_payment_allocations_fee ON public.payment_allocations(student_fee_id);
CREATE INDEX idx_payment_allocations_payment ON public.payment_allocations(payment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view allocations" ON public.payment_allocations
  FOR SELECT TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Bursars manage allocations" ON public.payment_allocations
  FOR ALL TO authenticated
  USING (public.can_record_payments(auth.uid(), school_id))
  WITH CHECK (public.can_record_payments(auth.uid(), school_id));

-- 2. No duplicate billing of the same structure+label to a student
CREATE UNIQUE INDEX uniq_student_fee_line
  ON public.student_fees(student_id, fee_structure_id, label)
  WHERE fee_structure_id IS NOT NULL;

-- 3. Canonical invoice status view
CREATE VIEW public.student_fee_status WITH (security_invoker=on) AS
SELECT
  sf.id, sf.school_id, sf.student_id, sf.fee_structure_id, sf.label,
  sf.amount_fcfa, sf.discount_fcfa, sf.academic_year, sf.due_date, sf.note, sf.created_at,
  fs.kind,
  GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0)::bigint AS net_fcfa,
  COALESCE(a.paid, 0)::bigint AS paid_fcfa,
  GREATEST(GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0) - COALESCE(a.paid, 0), 0)::bigint AS balance_fcfa,
  CASE
    WHEN COALESCE(a.paid,0) >= GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0) THEN 'paid'
    WHEN sf.due_date IS NOT NULL AND sf.due_date < CURRENT_DATE THEN 'overdue'
    WHEN COALESCE(a.paid,0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS status
FROM public.student_fees sf
LEFT JOIN public.fee_structures fs ON fs.id = sf.fee_structure_id
LEFT JOIN LATERAL (
  SELECT SUM(pa.amount_fcfa) AS paid
  FROM public.payment_allocations pa
  JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
  WHERE pa.student_fee_id = sf.id
) a ON TRUE;

GRANT SELECT ON public.student_fee_status TO authenticated;
GRANT ALL ON public.student_fee_status TO service_role;

-- 4. Credit on account = valid payments not yet allocated
CREATE OR REPLACE FUNCTION public.student_credit(_student_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    COALESCE((SELECT SUM(amount_fcfa) FROM public.payments WHERE student_id = _student_id AND voided = false), 0)
    - COALESCE((SELECT SUM(pa.amount_fcfa) FROM public.payment_allocations pa
                JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
                WHERE p.student_id = _student_id), 0), 0)::bigint;
$$;

-- 5. Balance = sum of unpaid invoice balances (voids respected)
CREATE OR REPLACE FUNCTION public.recompute_student_balance(_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE outstanding BIGINT; credit BIGINT;
BEGIN
  SELECT COALESCE(SUM(balance_fcfa), 0) INTO outstanding
    FROM public.student_fee_status WHERE student_id = _student_id;
  credit := public.student_credit(_student_id);
  UPDATE public.students SET fee_balance = GREATEST(outstanding - credit, 0) WHERE id = _student_id;
END; $$;

-- 6. Registration owed from allocations, not guesswork
CREATE OR REPLACE FUNCTION public.registration_owed(_student_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(COALESCE((
    SELECT SUM(balance_fcfa) FROM public.student_fee_status
    WHERE student_id = _student_id AND kind = 'registration'
  ), 0) - public.student_credit(_student_id), 0)::bigint;
$$;

-- 7. Recompute when allocations change
CREATE OR REPLACE FUNCTION public.trg_recompute_balance_alloc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT student_id INTO sid FROM public.student_fees
    WHERE id = COALESCE(NEW.student_fee_id, OLD.student_fee_id);
  IF sid IS NOT NULL THEN PERFORM public.recompute_student_balance(sid); END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE TRIGGER trg_alloc_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_alloc();

CREATE TRIGGER trg_fees_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_fees();

CREATE TRIGGER trg_payments_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_payments();

CREATE TRIGGER trg_payments_guard_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_closed_day();

CREATE TRIGGER trg_payments_receipt_no
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payment_receipt_no();

-- 8. Backfill: apply existing payments oldest-due-first
DO $$
DECLARE p RECORD; f RECORD; remaining BIGINT; take BIGINT;
BEGIN
  FOR p IN SELECT * FROM public.payments WHERE voided = false ORDER BY paid_at ASC LOOP
    remaining := p.amount_fcfa;
    FOR f IN
      SELECT sf.id, GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0)
             - COALESCE((SELECT SUM(pa.amount_fcfa) FROM public.payment_allocations pa WHERE pa.student_fee_id = sf.id), 0) AS bal
      FROM public.student_fees sf
      LEFT JOIN public.fee_structures fs ON fs.id = sf.fee_structure_id
      WHERE sf.student_id = p.student_id
      ORDER BY (fs.kind = 'registration') DESC, sf.due_date ASC NULLS LAST, sf.created_at ASC
    LOOP
      EXIT WHEN remaining <= 0;
      IF f.bal > 0 THEN
        take := LEAST(remaining, f.bal);
        INSERT INTO public.payment_allocations(school_id, payment_id, student_fee_id, amount_fcfa)
        VALUES (p.school_id, p.id, f.id, take)
        ON CONFLICT (payment_id, student_fee_id) DO NOTHING;
        remaining := remaining - take;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 9. Refresh all balances
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.students LOOP
    PERFORM public.recompute_student_balance(s.id);
  END LOOP;
END $$;
