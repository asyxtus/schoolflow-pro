
-- Expense categories
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school staff read expense_categories" ON public.expense_categories FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "school managers write expense_categories" ON public.expense_categories FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

-- Vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school staff read vendors" ON public.vendors FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "school managers write vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa >= 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','momo','bank','cheque','other')),
  reference TEXT,
  note TEXT,
  spent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.expenses (school_id, spent_at DESC);
CREATE INDEX ON public.expenses (school_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school staff read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "school managers write expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
