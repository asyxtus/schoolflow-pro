-- =========================================================================
-- Real enforcement: tuition changes at diocese-linked schools.
--
-- Of the approval_request_type values (expense, fee_structure_change,
-- discount, budget, staffing, other), tuition changes are the clearest
-- candidate for a hard gate: a family shouldn't see their fees change
-- because one school unilaterally raised tuition with no oversight. The
-- others (expenses, discounts, budget, staffing) stay as a paper-trail
-- workflow for now — expenses in particular record money already spent,
-- so "blocking" the record after the fact doesn't map cleanly onto an
-- approval gate the way a rate change does.
--
-- This is enforced with a trigger on fee_structures itself, not just a
-- check in upsertFeeStructure — an app-level-only check can be bypassed by
-- calling the Supabase API directly. A school with no diocese is
-- completely unaffected; this only applies once diocese_id is set.
-- =========================================================================

ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE OR REPLACE FUNCTION public.trg_guard_tuition_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_diocese BOOLEAN;
  approved_exists BOOLEAN;
BEGIN
  IF NEW.kind IS DISTINCT FROM 'tuition' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.amount_fcfa = OLD.amount_fcfa THEN RETURN NEW; END IF;

  SELECT (diocese_id IS NOT NULL) INTO has_diocese
    FROM public.schools WHERE id = NEW.school_id;
  IF NOT has_diocese THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE school_id = NEW.school_id
      AND request_type = 'fee_structure_change'
      AND status = 'approved'
      AND payload->>'class_name' = NEW.class_name
      AND payload->>'label' = NEW.label
      AND (payload->>'new_amount_fcfa')::bigint = NEW.amount_fcfa
      AND reviewed_at >= now() - interval '1 day'
  ) INTO approved_exists;

  IF NOT approved_exists THEN
    RAISE EXCEPTION
      'This school requires diocese approval before changing tuition. Submit a fee structure change request and wait for it to be approved.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fee_structures_guard_tuition ON public.fee_structures;
CREATE TRIGGER trg_fee_structures_guard_tuition
BEFORE INSERT OR UPDATE ON public.fee_structures
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_tuition_change();
