
-- ============ DORMITORIES ============
CREATE TABLE public.dormitories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male','female','mixed')),
  capacity INTEGER NOT NULL DEFAULT 0,
  warden_name TEXT,
  warden_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dormitories TO authenticated;
GRANT ALL ON public.dormitories TO service_role;
ALTER TABLE public.dormitories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view dorms" ON public.dormitories FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers manage dorms" ON public.dormitories FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_dorm_upd BEFORE UPDATE ON public.dormitories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROOMS ============
CREATE TABLE public.dorm_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  dormitory_id UUID NOT NULL REFERENCES public.dormitories(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dormitory_id, room_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dorm_rooms TO authenticated;
GRANT ALL ON public.dorm_rooms TO service_role;
ALTER TABLE public.dorm_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view rooms" ON public.dorm_rooms FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers manage rooms" ON public.dorm_rooms FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_room_upd BEFORE UPDATE ON public.dorm_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ASSIGNMENTS ============
CREATE TABLE public.boarding_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  dormitory_id UUID NOT NULL REFERENCES public.dormitories(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.dorm_rooms(id) ON DELETE SET NULL,
  bed_number TEXT,
  assigned_on DATE NOT NULL DEFAULT CURRENT_DATE,
  released_on DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_active_boarding_student ON public.boarding_assignments(student_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_assignments TO authenticated;
GRANT ALL ON public.boarding_assignments TO service_role;
ALTER TABLE public.boarding_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view assignments" ON public.boarding_assignments FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers manage assignments" ON public.boarding_assignments FOR ALL TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE TRIGGER trg_assign_upd BEFORE UPDATE ON public.boarding_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROLL CALL ============
CREATE TABLE public.boarding_roll_call (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  dormitory_id UUID NOT NULL REFERENCES public.dormitories(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  roll_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session TEXT NOT NULL DEFAULT 'evening' CHECK (session IN ('morning','evening','night')),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','exeat','sick','late')),
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, roll_date, session)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_roll_call TO authenticated;
GRANT ALL ON public.boarding_roll_call TO service_role;
ALTER TABLE public.boarding_roll_call ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view rollcall" ON public.boarding_roll_call FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage rollcall" ON public.boarding_roll_call FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));

-- ============ EXEATS ============
CREATE TABLE public.boarding_exeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  destination TEXT,
  depart_at TIMESTAMPTZ NOT NULL,
  return_by TIMESTAMPTZ NOT NULL,
  actual_return_at TIMESTAMPTZ,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_approved BOOLEAN NOT NULL DEFAULT false,
  guardian_approval_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','departed','returned','overdue','cancelled')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_exeats TO authenticated;
GRANT ALL ON public.boarding_exeats TO service_role;
ALTER TABLE public.boarding_exeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view exeats" ON public.boarding_exeats FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage exeats" ON public.boarding_exeats FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
CREATE TRIGGER trg_exeat_upd BEFORE UPDATE ON public.boarding_exeats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VISITORS ============
CREATE TABLE public.boarding_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  relationship TEXT,
  id_document TEXT,
  purpose TEXT,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boarding_visitors TO authenticated;
GRANT ALL ON public.boarding_visitors TO service_role;
ALTER TABLE public.boarding_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view visitors" ON public.boarding_visitors FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Staff manage visitors" ON public.boarding_visitors FOR ALL TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id))
  WITH CHECK (public.is_staff_of_school(auth.uid(), school_id));
