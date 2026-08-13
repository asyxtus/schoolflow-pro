-- =========================================================================
-- Give schools a real "current academic year" instead of none at all.
--
-- Every fee_structures and student_fees row carries a free-text
-- academic_year, but nothing ever recorded which year is *actually*
-- current. Admission-time invoice generation therefore pulled every
-- fee_structures row matching a class name, with no year filter at all —
-- harmless for a school with only ever one year of data, but the moment a
-- school kept last year's structures around while adding this year's
-- (exactly what year-over-year use requires), new admissions would be
-- billed for both years at once.
--
-- This column is the missing source of truth. Invoice generation now
-- prefers structures tagged with this exact year when any exist for a
-- class, and only falls back to untagged (legacy) rows otherwise — so nothing
-- breaks for schools that haven't started tagging years yet.
-- =========================================================================

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS current_academic_year TEXT;
