import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type FixtureStatus = "scheduled" | "completed" | "cancelled";

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("sports_teams")
      .select("id, name, sport, gender, age_group, coach_name, academic_year")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      sport: string;
      gender?: string;
      ageGroup?: string;
      coachName?: string;
      academicYear?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.name.trim() || !data.sport.trim())
      throw new Error("Team name and sport are required");
    const row = {
      school_id: schoolId,
      name: data.name.trim(),
      sport: data.sport.trim(),
      gender: data.gender || null,
      age_group: data.ageGroup || null,
      coach_name: data.coachName || null,
      academic_year: data.academicYear || null,
    };
    const { error } = data.id
      ? await supabase.from("sports_teams").update(row).eq("id", data.id)
      : await supabase.from("sports_teams").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("sports_teams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("sports_team_members")
      .select("id, position, joined_at, student_id, students(first_name, last_name, class_name)")
      .eq("team_id", data.teamId)
      .order("joined_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string; studentId: string; position?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("sports_team_members").insert({
      school_id: schoolId,
      team_id: data.teamId,
      student_id: data.studentId,
      position: data.position || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("sports_team_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFixtures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("sports_fixtures")
      .select(
        "id, opponent, fixture_date, venue, our_score, opponent_score, status, notes, team_id, sports_teams(name, sport)",
      )
      .eq("school_id", schoolId)
      .order("fixture_date", { ascending: false });
    if (data.teamId) q = q.eq("team_id", data.teamId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      teamId: string;
      opponent: string;
      fixtureDate: string;
      venue?: string;
      ourScore?: number;
      opponentScore?: number;
      status: FixtureStatus;
      notes?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.opponent.trim()) throw new Error("Opponent is required");
    const row = {
      school_id: schoolId,
      team_id: data.teamId,
      opponent: data.opponent.trim(),
      fixture_date: data.fixtureDate,
      venue: data.venue || null,
      our_score: data.ourScore ?? null,
      opponent_score: data.opponentScore ?? null,
      status: data.status,
      notes: data.notes || null,
    };
    const { error } = data.id
      ? await supabase.from("sports_fixtures").update(row).eq("id", data.id)
      : await supabase.from("sports_fixtures").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("sports_fixtures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
