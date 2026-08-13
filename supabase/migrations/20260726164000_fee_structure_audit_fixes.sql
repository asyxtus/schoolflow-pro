-- =========================================================================
-- Fee-structure audit fixes.
--
-- 1. Duplicate fee structures. Admission-time invoice generation
--    (enrollApplicant) loops over every fee_structures row matching a
--    class and bills one invoice set per row. Nothing stopped two
--    "Registration Fee" (or any non-tuition) rows from existing for the
--    same class — a duplicate click, a copy-paste template, a second
--    staff member setting one up not realizing it existed — and every
--    new admission into that class would then be silently billed twice.
--    The app already blocks duplicate *tuition* rows; this closes the
--    gap for every kind, at the database level.
--
-- 2. Undocumented discounts. student_fees.discount_fcfa lets any of the
--    four manager roles (not just bursar/principal) reduce what a family
--    owes, with no reason required and no audit trail — indistinguishable
--    from a legitimate scholarship and a quiet favor. This requires a
--    note whenever a discount is applied or changed.
-- =========================================================================

-- 1. One fee structure per (class, kind, label, year) per school.
--    COALESCE folds NULL academic_year to a fixed sentinel so two
--    still-unscoped-by-year rows can't collide with real distinct years.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fee_structure
  ON public.fee_structures (school_id, class_name, kind, label, COALESCE(academic_year, ''));

-- 2. Require a note whenever a discount is set or changed on an invoice.
CREATE OR REPLACE FUNCTION public.trg_guard_discount_reason()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.discount_fcfa > 0
     AND (TG_OP = 'INSERT' OR NEW.discount_fcfa IS DISTINCT FROM OLD.discount_fcfa)
     AND (NEW.note IS NULL OR length(trim(NEW.note)) < 4) THEN
    RAISE EXCEPTION 'A note explaining the discount is required whenever one is applied.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_student_fees_guard_discount ON public.student_fees;
CREATE TRIGGER trg_student_fees_guard_discount
BEFORE INSERT OR UPDATE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_discount_reason();
