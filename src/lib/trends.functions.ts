import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

type MonthPoint = { month: string; value: number };

function monthKeys(months: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function mapToMonths(
  keys: string[],
  rows: Array<{ month: string }> | null,
  valueKey: string,
): MonthPoint[] {
  const byMonth = new Map((rows ?? []).map((r) => [String(r.month).slice(0, 7), r]));
  return keys.map((k) => {
    const row = byMonth.get(k) as Record<string, unknown> | undefined;
    const raw = row?.[valueKey];
    return { month: k, value: raw == null ? 0 : Number(raw) };
  });
}

export const getTrends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { months?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    const months = data.months ?? 12;
    const keys = monthKeys(months);
    if (!schoolId) {
      const empty = keys.map((k) => ({ month: k, value: 0 }));
      return {
        months: keys,
        enrollments: empty,
        collections: empty,
        attendanceRate: empty,
        discipline: empty,
        clinicVisits: empty,
      };
    }

    const [enroll, collect, attend, disc, clinic] = await Promise.all([
      supabase.rpc("trend_enrollments", { _school_id: schoolId, _months: months }),
      supabase.rpc("trend_collections", { _school_id: schoolId, _months: months }),
      supabase.rpc("trend_attendance", { _school_id: schoolId, _months: months }),
      supabase.rpc("trend_discipline", { _school_id: schoolId, _months: months }),
      supabase.rpc("trend_clinic_visits", { _school_id: schoolId, _months: months }),
    ]);
    for (const r of [enroll, collect, attend, disc, clinic]) {
      if (r.error) throw new Error(r.error.message);
    }

    return {
      months: keys,
      enrollments: mapToMonths(keys, enroll.data, "new_students"),
      collections: mapToMonths(keys, collect.data, "amount_fcfa"),
      attendanceRate: mapToMonths(keys, attend.data, "present_rate"),
      discipline: mapToMonths(keys, disc.data, "incidents"),
      clinicVisits: mapToMonths(keys, clinic.data, "visits"),
    };
  });

export const getBoardReportSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const [studentsRes, staffRes, disciplineRes, clinicRes, schoolRes] = await Promise.all([
      supabase
        .from("students")
        .select("status", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("staff")
        .select("status", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("discipline_incidents")
        .select("status", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "open"),
      supabase
        .from("clinic_visits")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .gte(
          "visited_on",
          new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
        ),
      supabase
        .from("schools")
        .select("name, current_academic_year")
        .eq("id", schoolId)
        .maybeSingle(),
    ]);

    return {
      schoolName: schoolRes.data?.name ?? "",
      academicYear: schoolRes.data?.current_academic_year ?? null,
      activeStudents: studentsRes.count ?? 0,
      activeStaff: staffRes.count ?? 0,
      openDisciplineIncidents: disciplineRes.count ?? 0,
      clinicVisitsLast30Days: clinicRes.count ?? 0,
    };
  });
