
-- ─── Staff invitations ──────────────────────────────────────────────
CREATE TABLE public.staff_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_invitations_school ON public.staff_invitations(school_id);
CREATE INDEX idx_staff_invitations_email ON public.staff_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invitations TO authenticated;
GRANT SELECT ON public.staff_invitations TO anon;
GRANT ALL ON public.staff_invitations TO service_role;

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view school invitations"
  ON public.staff_invitations FOR SELECT TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id));

CREATE POLICY "Public token lookup"
  ON public.staff_invitations FOR SELECT TO anon
  USING (true);

CREATE POLICY "Managers create invitations"
  ON public.staff_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));

CREATE POLICY "Managers update invitations"
  ON public.staff_invitations FOR UPDATE TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id));

CREATE POLICY "Managers delete invitations"
  ON public.staff_invitations FOR DELETE TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id));

CREATE TRIGGER trg_staff_invitations_updated_at
  BEFORE UPDATE ON public.staff_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Audit log ──────────────────────────────────────────────────────
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_school_created ON public.audit_log(school_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School staff view audit"
  ON public.audit_log FOR SELECT TO authenticated
  USING (school_id IS NOT NULL AND public.is_staff_of_school(auth.uid(), school_id));

-- Helper for server functions to insert audit rows (SECURITY DEFINER to bypass INSERT policy)
CREATE OR REPLACE FUNCTION public.log_audit(
  _school_id UUID,
  _action TEXT,
  _entity_type TEXT,
  _entity_id TEXT,
  _summary TEXT,
  _before JSONB DEFAULT NULL,
  _after JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _email TEXT;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_log(school_id, actor_id, actor_email, action, entity_type, entity_id, summary, before, after)
  VALUES (_school_id, auth.uid(), _email, _action, _entity_type, _entity_id, _summary, _before, _after)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Allow authenticated users to invoke the logger; the function itself is SECURITY DEFINER
GRANT EXECUTE ON FUNCTION public.log_audit(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
