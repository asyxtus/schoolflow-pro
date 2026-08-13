-- =========================================================================
-- Close the invoice-deletion theft hole.
--
-- Payments are already append-only (void with a reason, never hard-deleted,
-- audit-logged). Invoices (student_fees) were not: any manager-level role
-- (principal, vice_principal, bursar, secretary) could hard-delete an
-- invoice at any time, and payment_allocations.student_fee_id is
-- ON DELETE CASCADE — so deleting an invoice that already had a payment
-- applied to it silently erased that allocation too. A staff member could
-- bill a student, collect the cash, then delete the invoice and leave no
-- trace that money was ever billed or received for it. The client already
-- disabled the delete button once a payment existed, but that was a
-- UI-only check against a snapshot that could be stale — never enforced by
-- the database itself.
--
-- This migration:
--   1. Adds void columns to student_fees, mirroring payments.
--   2. Blocks hard-deleting any invoice that has ever had a payment
--      allocated to it, at the database level (not just the UI).
--   3. Restricts voiding an invoice (like voiding a payment) to
--      bursar/principal/super_admin, even though broader roles can still
--      create and edit unpaid invoices.
--   4. Updates the invoice-status view and the credit calculation so a
--      voided invoice stops counting as billed, and any payment already
--      applied to it becomes credit on the account again — the money is
--      never lost, just freed up to apply elsewhere.
-- =========================================================================

ALTER TABLE public.student_fees
  ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- 1. Block hard delete once any payment has ever been allocated to this invoice.
CREATE OR REPLACE FUNCTION public.trg_guard_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_allocations BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.payment_allocations WHERE student_fee_id = OLD.id
  ) INTO has_allocations;
  IF has_allocations THEN
    RAISE EXCEPTION
      'This invoice has payments applied to it and cannot be deleted. Void it instead (an auditable action) — any money already applied will be freed up as credit on the account.';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_student_fees_guard_delete ON public.student_fees;
CREATE TRIGGER trg_student_fees_guard_delete
BEFORE DELETE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_invoice_delete();

-- 2. Only a bursar/principal/super_admin may void an invoice (creating and
--    editing unpaid invoices stays open to the broader manager roles).
CREATE OR REPLACE FUNCTION public.trg_guard_invoice_void()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.voided = true AND OLD.voided = false THEN
    IF NOT public.can_record_payments(auth.uid(), NEW.school_id) THEN
      RAISE EXCEPTION 'Only a bursar or principal can void an invoice.';
    END IF;
    IF NEW.void_reason IS NULL OR length(trim(NEW.void_reason)) < 4 THEN
      RAISE EXCEPTION 'A reason (>= 4 characters) is required to void an invoice.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_student_fees_guard_void ON public.student_fees;
CREATE TRIGGER trg_student_fees_guard_void
BEFORE UPDATE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_invoice_void();

-- 3. Voided invoices stop counting as billed; keep paid_fcfa visible for audit.
CREATE OR REPLACE VIEW public.student_fee_status WITH (security_invoker=on) AS
SELECT
  sf.id, sf.school_id, sf.student_id, sf.fee_structure_id, sf.label,
  sf.amount_fcfa, sf.discount_fcfa, sf.academic_year, sf.due_date, sf.note, sf.created_at,
  fs.kind,
  CASE WHEN sf.voided THEN 0 ELSE GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0) END::bigint AS net_fcfa,
  COALESCE(a.paid, 0)::bigint AS paid_fcfa,
  CASE WHEN sf.voided THEN 0
       ELSE GREATEST(GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0) - COALESCE(a.paid, 0), 0)
  END::bigint AS balance_fcfa,
  CASE
    WHEN sf.voided THEN 'voided'
    WHEN COALESCE(a.paid,0) >= GREATEST(sf.amount_fcfa - sf.discount_fcfa, 0) THEN 'paid'
    WHEN sf.due_date IS NOT NULL AND sf.due_date < CURRENT_DATE THEN 'overdue'
    WHEN COALESCE(a.paid,0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS status,
  sf.voided
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

-- 4. Credit on account: money already applied to a now-voided invoice
--    becomes unallocated credit again instead of vanishing.
CREATE OR REPLACE FUNCTION public.student_credit(_student_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    COALESCE((SELECT SUM(amount_fcfa) FROM public.payments WHERE student_id = _student_id AND voided = false), 0)
    - COALESCE((SELECT SUM(pa.amount_fcfa) FROM public.payment_allocations pa
                JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
                JOIN public.student_fees sf ON sf.id = pa.student_fee_id AND sf.voided = false
                WHERE p.student_id = _student_id), 0), 0)::bigint;
$$;

-- Recompute now that voided invoices/credit definitions changed.
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.students LOOP
    PERFORM public.recompute_student_balance(s.id);
  END LOOP;
END $$;
