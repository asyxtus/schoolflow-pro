-- =========================================================================
-- Receptionist module.
--
-- Two tables: a general visitor log (front-gate visitors — vendors,
-- prospective parents, anyone — distinct from boarding_visitors, which is
-- specifically people visiting boarding students), and a message/callback
-- intake log for staff who are unavailable.
--
-- Both stay broadly staff-writable, matching the Discipline pattern:
-- anyone might need to sign in a visitor or take a message when the
-- receptionist is away. Deletion is the one thing narrowed to
-- receptionist + leadership.
-- =========================================================================

CREATE TABLE public.visitor_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  purpose TEXT,
  host_name TEXT,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitor_log_school_checkin ON public.visitor_log(school_id, check_in_at);

CREATE TABLE public.message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  for_staff_name TEXT NOT NULL,
  caller_name TEXT NOT NULL,
  caller_phone TEXT,
  message TEXT NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_log_school_delivered ON public.message_log(school_id, delivered);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_log TO authenticated;
GRANT ALL ON public.visitor_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_log TO authenticated;
GRANT ALL ON public.message_log TO service_role;
ALTER TABLE public.visitor_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_reception(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'receptionist')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

-- Visitor log: any staff can view/log/check-out; delete is narrowed.
DROP POLICY IF EXISTS "Staff view visitor log" ON public.visitor_log;
CREATE POLICY "Staff view visitor log" ON public.visitor_log FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Staff log visitors" ON public.visitor_log;
CREATE POLICY "Staff log visitors" ON public.visitor_log FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Staff update visitor log" ON public.visitor_log;
CREATE POLICY "Staff update visitor log" ON public.visitor_log FOR UPDATE
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Reception staff delete visitor entries" ON public.visitor_log;
CREATE POLICY "Reception staff delete visitor entries" ON public.visitor_log FOR DELETE
  TO authenticated USING (public.can_manage_reception(auth.uid(), school_id));

-- Message log: same pattern.
DROP POLICY IF EXISTS "Staff view messages" ON public.message_log;
CREATE POLICY "Staff view messages" ON public.message_log FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Staff log messages" ON public.message_log;
CREATE POLICY "Staff log messages" ON public.message_log FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Staff update messages" ON public.message_log;
CREATE POLICY "Staff update messages" ON public.message_log FOR UPDATE
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Reception staff delete messages" ON public.message_log;
CREATE POLICY "Reception staff delete messages" ON public.message_log FOR DELETE
  TO authenticated USING (public.can_manage_reception(auth.uid(), school_id));
