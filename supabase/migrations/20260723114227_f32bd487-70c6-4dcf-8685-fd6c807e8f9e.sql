
-- =========================================================
-- MONEY PICTURE: budgets, recurring expenses, receipt column
-- =========================================================
CREATE TABLE public.expense_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT, -- NULL = annual budget, 1-12 = monthly
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, category_id, period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_budgets TO authenticated;
GRANT ALL ON public.expense_budgets TO service_role;
ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read budgets" ON public.expense_budgets FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers write budgets" ON public.expense_budgets FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_expense_budgets_updated BEFORE UPDATE ON public.expense_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  method TEXT NOT NULL DEFAULT 'bank',
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  day_of_month INT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  last_generated_period TEXT, -- 'YYYY-MM'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read recurring" ON public.recurring_expenses FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers write recurring" ON public.recurring_expenses FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_recurring_expenses_updated BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Receipt attachment column
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- =========================================================
-- PARENT PORTAL: shared magic-link tokens per student
-- =========================================================
CREATE TABLE public.student_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_accessed_at TIMESTAMPTZ,
  access_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);
CREATE INDEX idx_portal_tokens_token ON public.student_portal_tokens(token) WHERE active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_portal_tokens TO authenticated;
GRANT ALL ON public.student_portal_tokens TO service_role;
ALTER TABLE public.student_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read tokens" ON public.student_portal_tokens FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers write tokens" ON public.student_portal_tokens FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_portal_tokens_updated BEFORE UPDATE ON public.student_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
