-- =========================================================================
-- Consolidate subject_coefficients into class_subjects.
--
-- class_subjects (subject + coefficient + teacher_id, driven by the
-- Classes → Manage UI) and subject_coefficients (subject + coefficient +
-- teacher_name, driven by the separate Reports → Coefficients page) have
-- been two independent tables modeling the same thing. Worse: the bulletin
-- engine (computeBulletin) reads coefficients ONLY from subject_coefficients
-- — so a school that set up subjects, coefficients, and teachers in
-- Classes → Manage would see every subject silently default to coefficient
-- 1 on report cards unless they separately re-entered everything on the
-- old Coefficients page, with no warning that the two were out of sync.
--
-- This migration makes class_subjects the single source of truth:
--   1. Any subject_coefficients row with no matching class_subjects row
--      becomes a new class_subjects row (best-effort teacher match by name).
--   2. Any class_subjects row still at the default coefficient (1) gets
--      updated from a matching subject_coefficients row that has a real
--      value — but only if class_subjects hasn't already been deliberately
--      set to something else.
--   3. Any class_subjects row with no teacher assigned gets one filled in
--      from subject_coefficients' teacher_name, if it matches exactly one
--      staff member in the school.
-- Nothing already deliberately set in class_subjects is ever overwritten.
-- subject_coefficients itself is left in place (unused going forward, but
-- not dropped) so no historical data is destroyed.
-- =========================================================================

-- 1. Create missing class_subjects rows from subject_coefficients-only data.
INSERT INTO public.class_subjects (school_id, class_id, subject, coefficient, teacher_id)
SELECT
  sc.school_id,
  c.id,
  sc.subject,
  sc.coefficient,
  (
    SELECT st.id FROM public.staff st
    WHERE st.school_id = sc.school_id
      AND lower(btrim(st.first_name || ' ' || st.last_name)) = lower(btrim(sc.teacher_name))
    LIMIT 1
  )
FROM public.subject_coefficients sc
JOIN public.classes c ON c.school_id = sc.school_id AND c.name = sc.class_name
LEFT JOIN public.class_subjects cs
  ON cs.class_id = c.id AND lower(btrim(cs.subject)) = lower(btrim(sc.subject))
WHERE cs.id IS NULL
ON CONFLICT (class_id, subject) DO NOTHING;

-- 2. Fill in a real coefficient where class_subjects is still at the
--    untouched default and subject_coefficients has a deliberate value.
UPDATE public.class_subjects cs
SET coefficient = sc.coefficient
FROM public.subject_coefficients sc
JOIN public.classes c ON c.school_id = sc.school_id AND c.name = sc.class_name
WHERE cs.class_id = c.id
  AND lower(btrim(cs.subject)) = lower(btrim(sc.subject))
  AND cs.coefficient = 1
  AND sc.coefficient <> 1;

-- 3. Fill in a teacher where class_subjects has none and subject_coefficients'
--    teacher_name matches exactly one staff member in the school.
UPDATE public.class_subjects cs
SET teacher_id = st.id
FROM public.subject_coefficients sc
JOIN public.classes c ON c.school_id = sc.school_id AND c.name = sc.class_name
JOIN public.staff st ON st.school_id = sc.school_id
  AND lower(btrim(st.first_name || ' ' || st.last_name)) = lower(btrim(sc.teacher_name))
WHERE cs.class_id = c.id
  AND lower(btrim(cs.subject)) = lower(btrim(sc.subject))
  AND cs.teacher_id IS NULL
  AND sc.teacher_name IS NOT NULL
  AND (
    SELECT count(*) FROM public.staff st2
    WHERE st2.school_id = sc.school_id
      AND lower(btrim(st2.first_name || ' ' || st2.last_name)) = lower(btrim(sc.teacher_name))
  ) = 1;
