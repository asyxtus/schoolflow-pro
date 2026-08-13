
-- Add wallet_balance to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS wallet_balance BIGINT NOT NULL DEFAULT 0;

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal')),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','momo','bank','cheque','other')),
  reference TEXT,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select_staff" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));

CREATE POLICY "wallet_tx_manage" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recompute wallet balance function
CREATE OR REPLACE FUNCTION public.recompute_student_wallet(_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deposits BIGINT;
  withdrawals BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_fcfa),0) INTO deposits
    FROM public.wallet_transactions WHERE student_id = _student_id AND kind = 'deposit';
  SELECT COALESCE(SUM(amount_fcfa),0) INTO withdrawals
    FROM public.wallet_transactions WHERE student_id = _student_id AND kind = 'withdrawal';
  UPDATE public.students SET wallet_balance = GREATEST(deposits - withdrawals, 0) WHERE id = _student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_student_wallet(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_student_wallet(NEW.student_id);
    IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
      PERFORM public.recompute_student_wallet(OLD.student_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS wallet_tx_recompute ON public.wallet_transactions;
CREATE TRIGGER wallet_tx_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_wallet();

CREATE INDEX IF NOT EXISTS wallet_tx_student_idx ON public.wallet_transactions(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_school_idx ON public.wallet_transactions(school_id, occurred_at DESC);
