-- Defense-in-depth for multi-tenant integrity.
-- RLS controls who may access rows; these triggers prevent a permitted writer
-- from attaching a row in school A to a student/fee belonging to school B.

CREATE OR REPLACE FUNCTION public.enforce_student_school_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE expected_school uuid;
BEGIN
  IF TG_TABLE_NAME = 'payment_allocations' THEN
    SELECT sf.school_id
      INTO expected_school
      FROM public.student_fees sf
     WHERE sf.id = NEW.student_fee_id;
  ELSE
    SELECT s.school_id
      INTO expected_school
      FROM public.students s
     WHERE s.id = NEW.student_id;
  END IF;

  IF expected_school IS NULL THEN
    RAISE EXCEPTION 'Referenced student/fee does not exist';
  END IF;

  IF NEW.school_id IS DISTINCT FROM expected_school THEN
    RAISE EXCEPTION 'Cross-school relationship is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_student_school_payments ON public.payments;
CREATE TRIGGER trg_enforce_student_school_payments
BEFORE INSERT OR UPDATE OF student_id, school_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_school_match();

DROP TRIGGER IF EXISTS trg_enforce_student_school_fees ON public.student_fees;
CREATE TRIGGER trg_enforce_student_school_fees
BEFORE INSERT OR UPDATE OF student_id, school_id ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_school_match();

DROP TRIGGER IF EXISTS trg_enforce_student_school_wallet ON public.wallet_transactions;
CREATE TRIGGER trg_enforce_student_school_wallet
BEFORE INSERT OR UPDATE OF student_id, school_id ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_school_match();

DROP TRIGGER IF EXISTS trg_enforce_student_school_portal ON public.student_portal_tokens;
CREATE TRIGGER trg_enforce_student_school_portal
BEFORE INSERT OR UPDATE OF student_id, school_id ON public.student_portal_tokens
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_school_match();

DROP TRIGGER IF EXISTS trg_enforce_student_school_allocations ON public.payment_allocations;
CREATE TRIGGER trg_enforce_student_school_allocations
BEFORE INSERT OR UPDATE OF student_fee_id, school_id ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_school_match();

-- These tables are accessed by authenticated staff and the portal through
-- server-side/service-role code. Anonymous table privileges add no useful
-- capability and weaken defense-in-depth, so remove them.
REVOKE ALL ON TABLE
  public.payments,
  public.student_fees,
  public.payment_allocations,
  public.wallet_transactions,
  public.student_portal_tokens
FROM anon;
