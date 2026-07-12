
-- Fee structures per class + payments ledger
CREATE TABLE public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  label text NOT NULL,
  amount_fcfa integer NOT NULL CHECK (amount_fcfa >= 0),
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structures TO authenticated;
GRANT ALL ON public.fee_structures TO service_role;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school staff read fee_structures" ON public.fee_structures FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "school managers write fee_structures" ON public.fee_structures FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_fee_structures_updated BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.payment_method AS ENUM ('cash','momo','bank','cheque','other');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount_fcfa integer NOT NULL CHECK (amount_fcfa > 0),
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school staff read payments" ON public.payments FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "school managers write payments" ON public.payments FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_school_date ON public.payments(school_id, paid_at DESC);
