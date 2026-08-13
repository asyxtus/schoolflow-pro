-- =========================================================================
-- Trends & Board Reports — monthly aggregate functions.
--
-- Each returns one row per month for the trailing N months. Computed via
-- SQL GROUP BY rather than fetching raw rows to aggregate client-side —
-- attendance alone can be thousands of rows per month for a mid-size
-- school, so doing this in the database is the only approach that stays
-- fast as a school's history grows.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.trend_enrollments(_school_id UUID, _months INT DEFAULT 12)
RETURNS TABLE(month DATE, new_students BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', created_at)::date AS month, count(*)
  FROM public.students
  WHERE school_id = _school_id
    AND created_at >= date_trunc('month', now()) - (_months || ' months')::interval
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.trend_collections(_school_id UUID, _months INT DEFAULT 12)
RETURNS TABLE(month DATE, amount_fcfa BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', paid_at)::date AS month, COALESCE(sum(amount_fcfa), 0)
  FROM public.payments
  WHERE school_id = _school_id AND voided = false
    AND paid_at >= date_trunc('month', now()) - (_months || ' months')::interval
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.trend_attendance(_school_id UUID, _months INT DEFAULT 12)
RETURNS TABLE(month DATE, present_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', date)::date AS month,
    ROUND(100.0 * count(*) FILTER (WHERE status = 'present') / NULLIF(count(*), 0), 1)
  FROM public.attendance
  WHERE school_id = _school_id
    AND date >= (date_trunc('month', now()) - (_months || ' months')::interval)::date
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.trend_discipline(_school_id UUID, _months INT DEFAULT 12)
RETURNS TABLE(month DATE, incidents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', occurred_on)::date AS month, count(*)
  FROM public.discipline_incidents
  WHERE school_id = _school_id
    AND occurred_on >= (date_trunc('month', now()) - (_months || ' months')::interval)::date
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.trend_clinic_visits(_school_id UUID, _months INT DEFAULT 12)
RETURNS TABLE(month DATE, visits BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', visited_on)::date AS month, count(*)
  FROM public.clinic_visits
  WHERE school_id = _school_id
    AND visited_on >= (date_trunc('month', now()) - (_months || ' months')::interval)::date
  GROUP BY 1 ORDER BY 1;
$$;
