-- =========================================================================
-- Super admin console: platform-wide aggregates.
--
-- Unlike diocese_snapshot (scoped to one diocese's schools), these cover
-- every school on the platform regardless of diocese linkage. Both check
-- super_admin authorization internally rather than relying on RLS across
-- every underlying table, the same pattern used for diocese_snapshot.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.platform_snapshot()
RETURNS TABLE(
  total_schools BIGINT,
  total_dioceses BIGINT,
  total_active_students BIGINT,
  total_active_staff BIGINT,
  fee_collected_mtd BIGINT,
  open_discipline_incidents BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.schools),
    (SELECT count(*) FROM public.dioceses),
    (SELECT count(*) FROM public.students WHERE status = 'active'),
    (SELECT count(*) FROM public.staff WHERE status = 'active'),
    (SELECT COALESCE(sum(amount_fcfa), 0) FROM public.payments
       WHERE voided = false AND paid_at >= date_trunc('month', now())),
    (SELECT count(*) FROM public.discipline_incidents WHERE status = 'open');
END;
$$;

DROP FUNCTION IF EXISTS public.platform_schools_snapshot();
CREATE OR REPLACE FUNCTION public.platform_schools_snapshot()
RETURNS TABLE(
  school_id UUID,
  school_name TEXT,
  diocese_name TEXT,
  is_active BOOLEAN,
  active_students BIGINT,
  active_staff BIGINT,
  fee_collected_mtd BIGINT,
  fee_outstanding BIGINT,
  open_discipline_incidents BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    d.name,
    s.is_active,
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
  LEFT JOIN public.dioceses d ON d.id = s.diocese_id
  ORDER BY s.name;
END;
$$;
