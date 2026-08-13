-- =========================================================================
-- Approval workflows. Idempotent — safe to re-run.
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_request_type AS ENUM (
    'expense', 'fee_structure_change', 'discount', 'budget', 'staffing', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  request_type public.approval_request_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount_fcfa BIGINT,
  status public.approval_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_school_status
  ON public.approval_requests(school_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own school approval requests" ON public.approval_requests;
CREATE POLICY "Staff view own school approval requests" ON public.approval_requests FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Managers submit approval requests" ON public.approval_requests;
CREATE POLICY "Managers submit approval requests" ON public.approval_requests FOR INSERT
  TO authenticated WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

DROP POLICY IF EXISTS "Managers withdraw pending requests" ON public.approval_requests;
CREATE POLICY "Managers withdraw pending requests" ON public.approval_requests FOR DELETE
  TO authenticated USING (
    status = 'pending' AND public.can_manage_school_data(auth.uid(), school_id)
  );

DROP POLICY IF EXISTS "Diocese admins view diocese approval requests" ON public.approval_requests;
CREATE POLICY "Diocese admins view diocese approval requests" ON public.approval_requests FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.schools sc WHERE sc.id = school_id AND sc.diocese_id IS NOT NULL
        AND public.is_diocese_admin(auth.uid(), sc.diocese_id)
    )
  );

DROP POLICY IF EXISTS "Diocese admins review approval requests" ON public.approval_requests;
CREATE POLICY "Diocese admins review approval requests" ON public.approval_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schools sc WHERE sc.id = school_id AND sc.diocese_id IS NOT NULL
        AND public.is_diocese_admin(auth.uid(), sc.diocese_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schools sc WHERE sc.id = school_id AND sc.diocese_id IS NOT NULL
        AND public.is_diocese_admin(auth.uid(), sc.diocese_id)
    )
  );
