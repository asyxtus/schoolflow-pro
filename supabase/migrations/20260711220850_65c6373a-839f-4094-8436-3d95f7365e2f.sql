
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','diocese_admin','principal','vice_principal',
  'bursar','teacher','secretary','parent','student'
);

CREATE TYPE public.student_status AS ENUM ('active','inactive','graduated','withdrawn','suspended');
CREATE TYPE public.gender AS ENUM ('male','female');
CREATE TYPE public.admission_stage AS ENUM ('new','review','interview','offer','enrolled','rejected');

-- =========================================================
-- SHARED HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- SCHOOLS
-- =========================================================
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  city TEXT,
  region TEXT,
  motto TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role (any school)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- has_role_in_school
CREATE OR REPLACE FUNCTION public.has_role_in_school(_user_id UUID, _school_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id AND role = _role
  );
$$;

-- user_school_id: primary school of the current user
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- is_staff_of_school: any staff-level role in given school
CREATE OR REPLACE FUNCTION public.is_staff_of_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal','vice_principal','bursar','teacher','secretary','diocese_admin')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

-- can_manage_school_data: principals/VPs/bursars/secretaries + super_admin
CREATE OR REPLACE FUNCTION public.can_manage_school_data(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal','vice_principal','bursar','secretary')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

-- =========================================================
-- POLICIES: schools
-- =========================================================
CREATE POLICY "Authenticated can view schools" ON public.schools
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage schools" ON public.schools
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- POLICIES: profiles
-- =========================================================
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users view profiles in same school" ON public.profiles
  FOR SELECT TO authenticated
  USING (school_id IS NOT NULL AND school_id = public.current_user_school_id());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Super admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- POLICIES: user_roles
-- =========================================================
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Principals view roles in their school" ON public.user_roles
  FOR SELECT TO authenticated
  USING (school_id IS NOT NULL AND public.has_role_in_school(auth.uid(), school_id, 'principal'));
CREATE POLICY "Super admins & principals manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (school_id IS NOT NULL AND public.has_role_in_school(auth.uid(), school_id, 'principal'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (school_id IS NOT NULL AND public.has_role_in_school(auth.uid(), school_id, 'principal'))
  );

-- =========================================================
-- STUDENTS
-- =========================================================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  matricule TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender public.gender,
  class_name TEXT,
  section TEXT,
  enrolment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.student_status NOT NULL DEFAULT 'active',
  guardian_phone TEXT,
  guardian_email TEXT,
  fee_balance NUMERIC(12,0) NOT NULL DEFAULT 0,
  attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 100,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, matricule)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_students_class ON public.students(school_id, class_name);
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff view students in own school" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Managers update students" ON public.students
  FOR UPDATE TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Principals delete students" ON public.students
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_school(auth.uid(), school_id, 'principal')
  );

-- =========================================================
-- GUARDIANS
-- =========================================================
CREATE TABLE public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  occupation TEXT,
  address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_guardians_student ON public.guardians(student_id);
CREATE TRIGGER trg_guardians_updated_at BEFORE UPDATE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff view guardians in own school" ON public.guardians
  FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers insert guardians" ON public.guardians
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Managers update guardians" ON public.guardians
  FOR UPDATE TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Principals delete guardians" ON public.guardians
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_school(auth.uid(), school_id, 'principal')
  );

-- =========================================================
-- APPLICANTS (Admissions pipeline)
-- =========================================================
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  reference_no TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender public.gender,
  prior_school TEXT,
  class_applied_for TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  score NUMERIC(5,2),
  stage public.admission_stage NOT NULL DEFAULT 'new',
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_applicants_school_stage ON public.applicants(school_id, stage);
CREATE TRIGGER trg_applicants_updated_at BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff view applicants in own school" ON public.applicants
  FOR SELECT TO authenticated
  USING (public.is_staff_of_school(auth.uid(), school_id));
CREATE POLICY "Managers insert applicants" ON public.applicants
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Managers update applicants" ON public.applicants
  FOR UPDATE TO authenticated
  USING (public.can_manage_school_data(auth.uid(), school_id))
  WITH CHECK (public.can_manage_school_data(auth.uid(), school_id));
CREATE POLICY "Principals delete applicants" ON public.applicants
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role_in_school(auth.uid(), school_id, 'principal')
  );
