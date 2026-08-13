-- =========================================================================
-- Close a race-condition gap in fee collection.
--
-- recordPayment() checks in application code that a new allocation does not
-- exceed an invoice's remaining balance. That check reads the balance, then
-- writes the allocation, as two separate steps. Two payments recorded for
-- the same invoice at nearly the same instant (two staff at once, a
-- double-click, a retried request after a slow network) can both pass that
-- read-then-write check against the same stale balance and both get
-- inserted — over-crediting the invoice, or masking a shortfall a dishonest
-- cashier could exploit deliberately.
--
-- This trigger makes the limit a hard database invariant instead of an
-- application-level suggestion: it locks the target invoice row for the
-- duration of the transaction, so a second concurrent allocation against the
-- same invoice must wait for the first to commit and then sees the
-- up-to-date total before deciding whether it still fits. Whichever
-- transaction loses the race gets a clear, actionable error instead of a
-- silently corrupted balance.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.trg_guard_allocation_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fee_net BIGINT;
  fee_label TEXT;
  already_allocated BIGINT;
BEGIN
  -- Serialize concurrent allocations against the same invoice: any other
  -- transaction inserting/updating an allocation for this student_fee_id
  -- will block here until this transaction commits or rolls back.
  PERFORM 1 FROM public.student_fees WHERE id = NEW.student_fee_id FOR UPDATE;

  SELECT GREATEST(amount_fcfa - discount_fcfa, 0), label INTO fee_net, fee_label
    FROM public.student_fees WHERE id = NEW.student_fee_id;

  IF fee_net IS NULL THEN
    RAISE EXCEPTION 'Invoice % does not exist.', NEW.student_fee_id;
  END IF;

  SELECT COALESCE(SUM(pa.amount_fcfa), 0) INTO already_allocated
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id AND p.voided = false
    WHERE pa.student_fee_id = NEW.student_fee_id
      AND pa.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF already_allocated + NEW.amount_fcfa > fee_net THEN
    RAISE EXCEPTION
      'Cannot apply % to "%": only % of the % balance remains unallocated. Someone may have just recorded another payment for this student — refresh and try again.',
      NEW.amount_fcfa, fee_label, GREATEST(fee_net - already_allocated, 0), fee_net;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_payment_allocations_guard_limit ON public.payment_allocations;
CREATE TRIGGER trg_payment_allocations_guard_limit
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_allocation_limit();
