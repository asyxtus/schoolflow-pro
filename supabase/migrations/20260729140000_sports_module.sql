-- =========================================================================
-- Sports module.
--
-- Teams, rosters, and fixtures/results. Unlike Boarding or Reception,
-- writes here are gated to sports_master + leadership across the board,
-- not left open to any staff — team setup and match results are a
-- dedicated specialist's domain, not a time-critical task realistically
-- handled by whoever happens to be on duty. Viewing stays open to all
-- staff, matching Discipline: a form teacher checking whether their
-- student's team won is a completely normal thing to want.
-- =========================================================================

CREATE TABLE public.sports_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  gender TEXT,
  age_group TEXT,
  coach_name TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sports_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  position TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id)
);

CREATE TYPE public.fixture_status AS ENUM ('scheduled', 'completed', 'cancelled');

CREATE TABLE public.sports_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  fixture_date DATE NOT NULL,
  venue TEXT,
  our_score INT,
  opponent_score INT,
  status public.fixture_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sports_team_members_team ON public.sports_team_members(team_id);
CREATE INDEX idx_sports_fixtures_team_date ON public.sports_fixtures(team_id, fixture_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_fixtures TO authenticated;
GRANT ALL ON public.sports_teams TO service_role;
GRANT ALL ON public.sports_team_members TO service_role;
GRANT ALL ON public.sports_fixtures TO service_role;
ALTER TABLE public.sports_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fixtures ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_sports(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role IN ('principal', 'vice_principal', 'sports_master')
  ) OR public.has_role(_user_id, 'super_admin');
$$;

DROP POLICY IF EXISTS "Staff view teams" ON public.sports_teams;
CREATE POLICY "Staff view teams" ON public.sports_teams FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Sports staff manage teams" ON public.sports_teams;
CREATE POLICY "Sports staff manage teams" ON public.sports_teams FOR ALL
  TO authenticated
  USING (public.can_manage_sports(auth.uid(), school_id))
  WITH CHECK (public.can_manage_sports(auth.uid(), school_id));

DROP POLICY IF EXISTS "Staff view rosters" ON public.sports_team_members;
CREATE POLICY "Staff view rosters" ON public.sports_team_members FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Sports staff manage rosters" ON public.sports_team_members;
CREATE POLICY "Sports staff manage rosters" ON public.sports_team_members FOR ALL
  TO authenticated
  USING (public.can_manage_sports(auth.uid(), school_id))
  WITH CHECK (public.can_manage_sports(auth.uid(), school_id));

DROP POLICY IF EXISTS "Staff view fixtures" ON public.sports_fixtures;
CREATE POLICY "Staff view fixtures" ON public.sports_fixtures FOR SELECT
  TO authenticated USING (public.is_staff_of_school(auth.uid(), school_id));
DROP POLICY IF EXISTS "Sports staff manage fixtures" ON public.sports_fixtures;
CREATE POLICY "Sports staff manage fixtures" ON public.sports_fixtures FOR ALL
  TO authenticated
  USING (public.can_manage_sports(auth.uid(), school_id))
  WITH CHECK (public.can_manage_sports(auth.uid(), school_id));
