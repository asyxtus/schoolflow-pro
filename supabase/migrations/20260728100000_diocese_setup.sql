-- =========================================================================
-- Diocese setup infrastructure. Idempotent — safe to re-run.
-- =========================================================================

ALTER TABLE public.staff_invitations ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS diocese_id UUID REFERENCES public.dioceses(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.staff_invitations
    ADD CONSTRAINT chk_staff_invitations_scope
    CHECK ((school_id IS NOT NULL) <> (diocese_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Diocese admins view diocese invitations" ON public.staff_invitations;
CREATE POLICY "Diocese admins view diocese invitations" ON public.staff_invitations FOR SELECT
  TO authenticated USING (diocese_id IS NOT NULL AND public.is_diocese_admin(auth.uid(), diocese_id));

DROP POLICY IF EXISTS "Diocese admins create diocese invitations" ON public.staff_invitations;
CREATE POLICY "Diocese admins create diocese invitations" ON public.staff_invitations FOR INSERT
  TO authenticated WITH CHECK (diocese_id IS NOT NULL AND public.is_diocese_admin(auth.uid(), diocese_id));

DROP POLICY IF EXISTS "Diocese admins update diocese invitations" ON public.staff_invitations;
CREATE POLICY "Diocese admins update diocese invitations" ON public.staff_invitations FOR UPDATE
  TO authenticated USING (diocese_id IS NOT NULL AND public.is_diocese_admin(auth.uid(), diocese_id));

DROP POLICY IF EXISTS "Diocese admins delete diocese invitations" ON public.staff_invitations;
CREATE POLICY "Diocese admins delete diocese invitations" ON public.staff_invitations FOR DELETE
  TO authenticated USING (diocese_id IS NOT NULL AND public.is_diocese_admin(auth.uid(), diocese_id));
