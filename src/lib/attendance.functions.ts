import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const getAttendanceForClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { className: string; date: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, matricule, section")
      .eq("school_id", schoolId)
      .eq("class_name", data.className)
      .eq("status", "active")
      .order("last_name");
    if (sErr) throw new Error(sErr.message);

    const ids = (students ?? []).map((s) => s.id);
    const { data: att } = ids.length
      ? await supabase
          .from("attendance")
          .select("student_id, status, note")
          .eq("school_id", schoolId)
          .eq("date", data.date)
          .in("student_id", ids)
      : { data: [] as { student_id: string; status: AttendanceStatus; note: string | null }[] };

    const byId = new Map(att?.map((a) => [a.student_id, a]));
    return (students ?? []).map((s) => ({
      ...s,
      status: (byId.get(s.id)?.status ?? null) as AttendanceStatus | null,
      note: byId.get(s.id)?.note ?? null,
    }));
  });

export const listClassNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data } = await supabase
      .from("students")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("status", "active");
    const set = new Set<string>();
    for (const r of data ?? []) if (r.class_name) set.add(r.class_name);
    return Array.from(set).sort();
  });

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; date: string; status: AttendanceStatus; note?: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase
      .from("attendance")
      .upsert(
        {
          school_id: schoolId,
          student_id: data.studentId,
          date: data.date,
          status: data.status,
          note: data.note ?? null,
          recorded_by: userId,
        },
        { onConflict: "student_id,date" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkMarkAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date: string; entries: { studentId: string; status: AttendanceStatus }[] }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const rows = data.entries.map((e) => ({
      school_id: schoolId,
      student_id: e.studentId,
      date: data.date,
      status: e.status,
      recorded_by: userId,
    }));
    if (!rows.length) return { ok: true, count: 0 };
    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });