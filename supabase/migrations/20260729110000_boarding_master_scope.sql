-- =========================================================================
-- Boarding master: real permission scoping.
--
-- The boarding module already existed (dormitories, rooms, assignments,
-- roll call, exeats, visitor log), but "boarding_master" enforced nothing
-- — structural setup was gated to "any manager" (which includes bursar and
-- secretary, who have no boarding-domain reason to reassign dorm rooms),
-- and it wasn't even assignable through the Users & Roles screen at all.
--
-- This narrows structural/administrative decisions — creating dormitories,
-- rooms, and assigning students to them — to leadership + boarding_master
-- specifically. Day-to-day operational logging (roll call, exeats,
-- visitors) deliberately stays open to any staff member: those are
-- time-sensitive tasks realistically handled by whoever's on duty that
-- night, not gated to one designated person.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.can_manage_boarding(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'boarding_master')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

DROP POLICY IF EXISTS "Managers manage dorms" ON public.dormitories;
CREATE POLICY "Boarding staff manage dorms" ON public.dormitories FOR ALL
  TO authenticated
  USING (public.can_manage_boarding(auth.uid(), school_id))
  WITH CHECK (public.can_manage_boarding(auth.uid(), school_id));

DROP POLICY IF EXISTS "Managers manage rooms" ON public.dorm_rooms;
CREATE POLICY "Boarding staff manage rooms" ON public.dorm_rooms FOR ALL
  TO authenticated
  USING (public.can_manage_boarding(auth.uid(), school_id))
  WITH CHECK (public.can_manage_boarding(auth.uid(), school_id));

DROP POLICY IF EXISTS "Managers manage assignments" ON public.boarding_assignments;
CREATE POLICY "Boarding staff manage assignments" ON public.boarding_assignments FOR ALL
  TO authenticated
  USING (public.can_manage_boarding(auth.uid(), school_id))
  WITH CHECK (public.can_manage_boarding(auth.uid(), school_id));
