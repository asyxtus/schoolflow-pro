-- =========================================================================
-- Diocese roll-up. Idempotent — safe to re-run.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.dioceses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dioceses TO authenticated;
GRANT ALL ON public.dioceses TO service_role;
ALTER TABLE public.dioceses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS diocese_id UUID REFERENCES public.dioceses(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS diocese_id UUID REFERENCES public.dioceses(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_roles_diocese
  ON public.user_roles(user_id, diocese_id, role) WHERE diocese_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_diocese_admin(_user_id UUID, _diocese_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND diocese_id = _diocese_id AND role = 'diocese_admin'
  ) OR public.has_role(_user_id, 'super_admin');
$$;

DROP POLICY IF EXISTS "Diocese admins view their diocese" ON public.dioceses;
CREATE POLICY "Diocese admins view their diocese" ON public.dioceses FOR SELECT
  TO authenticated USING (public.is_diocese_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Diocese admins view their schools" ON public.schools;
CREATE POLICY "Diocese admins view their schools" ON public.schools FOR SELECT
  TO authenticated USING (
    diocese_id IS NOT NULL AND public.is_diocese_admin(auth.uid(), diocese_id)
  );

DROP POLICY IF EXISTS "Super admins manage dioceses" ON public.dioceses;
CREATE POLICY "Super admins manage dioceses" ON public.dioceses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.diocese_snapshot(_diocese_id UUID)
RETURNS TABLE(
  school_id UUID,
  school_name TEXT,
  active_students BIGINT,
  active_staff BIGINT,
  fee_collected_mtd BIGINT,
  fee_outstanding BIGINT,
  open_discipline_incidents BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_diocese_admin(auth.uid(), _diocese_id) THEN
    RAISE EXCEPTION 'Not authorized for this diocese';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    (SELECT count(*) FROM public.students st WHERE st.school_id = s.id AND st.status = 'active'),
    (SELECT count(*) FROM public.staff sf WHERE sf.school_id = s.id AND sf.status = 'active'),
    (SELECT COALESCE(sum(p.amount_fcfa), 0) FROM public.payments p
       WHERE p.school_id = s.id AND p.voided = false
         AND p.paid_at >= date_trunc('month', now())),
    (SELECT COALESCE(sum(st.fee_balance), 0)::bigint FROM public.students st
       WHERE st.school_id = s.id AND st.status = 'active'),
    (SELECT count(*) FROM public.discipline_incidents di
       WHERE di.school_id = s.id AND di.status = 'open')
  FROM public.schools s
  WHERE s.diocese_id = _diocese_id
  ORDER BY s.name;
END;
$$;
