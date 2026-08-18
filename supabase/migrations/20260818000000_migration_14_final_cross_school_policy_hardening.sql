-- Migration 14: Final cross-school policy hardening
--
-- Goals:
--   1. Browser policies for bulletin_meta and subject_coefficients are explicitly
--      limited to authenticated users rather than PUBLIC.
--   2. A message sender may delete only a message belonging to a school in which
--      the sender is currently staff; school managers retain their existing
--      school-scoped delete capability.
--   3. Make the changes idempotent so the migration can safely be reapplied.
--
-- This migration deliberately does NOT blanket-enable FORCE ROW LEVEL SECURITY,
-- does NOT alter the established school-management helper functions, and does
-- NOT rewrite unrelated operational policies.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. bulletin_meta: remove PUBLIC policy exposure
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff manage bulletin meta" ON public.bulletin_meta;
DROP POLICY IF EXISTS "Staff view bulletin meta" ON public.bulletin_meta;

CREATE POLICY "Staff manage bulletin meta"
ON public.bulletin_meta
FOR ALL
TO authenticated
USING (
  private.can_manage_school_data(auth.uid(), school_id)
)
WITH CHECK (
  private.can_manage_school_data(auth.uid(), school_id)
);

CREATE POLICY "Staff view bulletin meta"
ON public.bulletin_meta
FOR SELECT
TO authenticated
USING (
  private.is_staff_of_school(auth.uid(), school_id)
);

-- ---------------------------------------------------------------------------
-- 2. subject_coefficients: remove PUBLIC policy exposure
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff manage subject coefficients" ON public.subject_coefficients;
DROP POLICY IF EXISTS "Staff view subject coefficients" ON public.subject_coefficients;

CREATE POLICY "Staff manage subject coefficients"
ON public.subject_coefficients
FOR ALL
TO authenticated
USING (
  private.can_manage_school_data(auth.uid(), school_id)
)
WITH CHECK (
  private.can_manage_school_data(auth.uid(), school_id)
);

CREATE POLICY "Staff view subject coefficients"
ON public.subject_coefficients
FOR SELECT
TO authenticated
USING (
  private.is_staff_of_school(auth.uid(), school_id)
);

-- ---------------------------------------------------------------------------
-- 3. messages: tighten sender DELETE to the sender's current school
-- ---------------------------------------------------------------------------
--
-- The existing sender exception was effectively:
--   sender_id = auth.uid()
--
-- That can allow a user to mutate an old message from a school they no longer
-- belong to. The sender branch is therefore made school-aware.
--
-- We do not depend on the historical policy name. Instead, remove existing
-- authenticated DELETE policies on messages whose predicate contains the
-- sender_id condition, then recreate the canonical policy below.

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND cmd = 'DELETE'
      AND roles @> ARRAY['authenticated']::name[]
      AND (
        COALESCE(qual, '') ILIKE '%sender_id%'
        OR COALESCE(with_check, '') ILIKE '%sender_id%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.messages',
      p.policyname
    );
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "Sender or managers delete messages" ON public.messages;
DROP POLICY IF EXISTS "Senders or managers delete messages" ON public.messages;
DROP POLICY IF EXISTS "Users or managers delete messages" ON public.messages;

CREATE POLICY "Sender or managers delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (
  (
    sender_id = auth.uid()
    AND private.is_staff_of_school(auth.uid(), school_id)
  )
  OR private.can_manage_school_data(auth.uid(), school_id)
);

-- ---------------------------------------------------------------------------
-- 4. Final local verification for the objects changed by this migration
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  public_policy_count integer;
  message_policy_count integer;
BEGIN
  SELECT count(*)
  INTO public_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('bulletin_meta', 'subject_coefficients')
    AND 'public' = ANY(roles);

  IF public_policy_count <> 0 THEN
    RAISE EXCEPTION
      'Migration 14 verification failed: % PUBLIC policy/policies remain on bulletin_meta or subject_coefficients',
      public_policy_count;
  END IF;

  SELECT count(*)
  INTO message_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'messages'
    AND policyname = 'Sender or managers delete messages'
    AND cmd = 'DELETE'
    AND 'authenticated' = ANY(roles);

  IF message_policy_count <> 1 THEN
    RAISE EXCEPTION
      'Migration 14 verification failed: canonical messages DELETE policy was not created';
  END IF;
END
$$;

COMMIT;
