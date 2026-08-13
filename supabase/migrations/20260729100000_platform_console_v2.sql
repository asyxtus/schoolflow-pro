-- =========================================================================
-- Super admin console v2: school activation, platform-level audit trail.
-- Idempotent — safe to re-run.
-- =========================================================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Platform-level audit rows (actions with no single owning school — creating
-- a diocese, granting super_admin, adding a diocese admin) reuse the
-- existing audit_log table with school_id = NULL, rather than a parallel
-- table. The existing "School staff view audit" policy requires
-- school_id IS NOT NULL, so it can never surface these rows to anyone —
-- this adds the matching policy for super_admin specifically.
DROP POLICY IF EXISTS "Super admins view platform-level audit" ON public.audit_log;
CREATE POLICY "Super admins view platform-level audit" ON public.audit_log FOR SELECT
  TO authenticated USING (school_id IS NULL AND public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.log_platform_audit(
  _action TEXT,
  _entity_type TEXT,
  _entity_id TEXT,
  _summary TEXT,
  _before JSONB DEFAULT NULL,
  _after JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id UUID;
  _email TEXT;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_log(school_id, actor_id, actor_email, action, entity_type, entity_id, summary, before, after)
  VALUES (NULL, auth.uid(), _email, _action, _entity_type, _entity_id, _summary, _before, _after)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_platform_audit(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
