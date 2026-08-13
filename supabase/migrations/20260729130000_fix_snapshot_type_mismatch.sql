-- =========================================================================
-- Fix: "structure of query does not match function result type".
--
-- students.fee_balance is NUMERIC(12,0); sum() over a numeric column
-- returns numeric in Postgres, not bigint — but both functions below
-- declared their fee_outstanding output as BIGINT. Postgres enforces exact
-- type matching for RETURN QUERY, so this failed at runtime every time
-- (not just sometimes) — payments.amount_fcfa is a genuine integer column,
-- so that sum correctly produced bigint and never tripped this.
--
-- Neither function's declared signature changes, only the internal query —
-- CREATE OR REPLACE is sufficient, no DROP FUNCTION needed here.
-- =========================================================================

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
