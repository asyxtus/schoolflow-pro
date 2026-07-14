
-- Enums
CREATE TYPE public.staff_position AS ENUM ('teacher','principal','vice_principal','bursar','secretary','discipline_master','librarian','nurse','driver','cook','cleaner','security','maintenance','other');
CREATE TYPE public.contract_type AS ENUM ('permanent','fixed_term','part_time','volunteer','intern');
CREATE TYPE public.staff_status AS ENUM ('active','on_leave','suspended','terminated');
CREATE TYPE public.payroll_status AS ENUM ('draft','finalized','paid');
CREATE TYPE public.payslip_status AS ENUM ('pending','paid');
CREATE TYPE public.pay_method AS ENUM ('cash','bank','momo','check');

-- Helper: bursar-or-above access
CREATE OR REPLACE FUNCTION public.can_manage_hr(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal','vice_principal','bursar')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

-- Staff table
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  matricule text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  national_id text,
  position public.staff_position NOT NULL DEFAULT 'teacher',
  department text,
  contract_type public.contract_type NOT NULL DEFAULT 'permanent',
  status public.staff_status NOT NULL DEFAULT 'active',
  hire_date date,
  end_date date,
  base_salary_fcfa bigint NOT NULL DEFAULT 0,
  bank_name text,
  bank_account text,
  momo_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR can view staff" ON public.staff FOR SELECT TO authenticated USING (public.can_manage_hr(auth.uid(), school_id));
CREATE POLICY "HR can manage staff" ON public.staff FOR ALL TO authenticated USING (public.can_manage_hr(auth.uid(), school_id)) WITH CHECK (public.can_manage_hr(auth.uid(), school_id));
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_staff_school ON public.staff(school_id);

-- Recurring allowances
CREATE TABLE public.staff_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'allowance', -- 'allowance' or 'deduction'
  amount_fcfa bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_allowances TO authenticated;
GRANT ALL ON public.staff_allowances TO service_role;
ALTER TABLE public.staff_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view allowances" ON public.staff_allowances FOR SELECT TO authenticated USING (public.can_manage_hr(auth.uid(), school_id));
CREATE POLICY "HR manage allowances" ON public.staff_allowances FOR ALL TO authenticated USING (public.can_manage_hr(auth.uid(), school_id)) WITH CHECK (public.can_manage_hr(auth.uid(), school_id));
CREATE TRIGGER trg_staff_allowances_updated BEFORE UPDATE ON public.staff_allowances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_staff_allowances_staff ON public.staff_allowances(staff_id);

-- Payroll runs
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period text NOT NULL, -- YYYY-MM
  status public.payroll_status NOT NULL DEFAULT 'draft',
  notes text,
  total_gross_fcfa bigint NOT NULL DEFAULT 0,
  total_deductions_fcfa bigint NOT NULL DEFAULT 0,
  total_net_fcfa bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.can_manage_hr(auth.uid(), school_id));
CREATE POLICY "HR manage runs" ON public.payroll_runs FOR ALL TO authenticated USING (public.can_manage_hr(auth.uid(), school_id)) WITH CHECK (public.can_manage_hr(auth.uid(), school_id));
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payslips
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  base_salary_fcfa bigint NOT NULL DEFAULT 0,
  allowances jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, amount}]
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, amount}]
  gross_fcfa bigint NOT NULL DEFAULT 0,
  deductions_total_fcfa bigint NOT NULL DEFAULT 0,
  net_fcfa bigint NOT NULL DEFAULT 0,
  status public.payslip_status NOT NULL DEFAULT 'pending',
  payment_method public.pay_method,
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view payslips" ON public.payslips FOR SELECT TO authenticated USING (public.can_manage_hr(auth.uid(), school_id));
CREATE POLICY "HR manage payslips" ON public.payslips FOR ALL TO authenticated USING (public.can_manage_hr(auth.uid(), school_id)) WITH CHECK (public.can_manage_hr(auth.uid(), school_id));
CREATE TRIGGER trg_payslips_updated BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payslips_run ON public.payslips(run_id);
CREATE INDEX idx_payslips_staff ON public.payslips(staff_id);

-- Recompute totals on a run
CREATE OR REPLACE FUNCTION public.recompute_payroll_run(_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g bigint; d bigint; n bigint;
BEGIN
  SELECT COALESCE(SUM(gross_fcfa),0), COALESCE(SUM(deductions_total_fcfa),0), COALESCE(SUM(net_fcfa),0)
    INTO g, d, n FROM public.payslips WHERE run_id = _run_id;
  UPDATE public.payroll_runs SET total_gross_fcfa = g, total_deductions_fcfa = d, total_net_fcfa = n WHERE id = _run_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_payroll_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_payroll_run(OLD.run_id); RETURN OLD;
  ELSE
    PERFORM public.recompute_payroll_run(NEW.run_id); RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_payslip_totals AFTER INSERT OR UPDATE OR DELETE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_payroll_run();
