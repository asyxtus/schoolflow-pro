import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type StaffAttStatus = "present" | "absent" | "late" | "leave" | "sick";

export const listStaffAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data: staff } = await supabase
      .from("staff")
      .select("id, first_name, last_name, position, matricule, status")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name");
    const ids = (staff ?? []).map((s) => s.id);
    const { data: att } = ids.length
      ? await supabase
          .from("staff_attendance")
          .select("*")
          .eq("school_id", schoolId)
          .eq("work_date", data.date)
          .in("staff_id", ids)
      : { data: [] as never[] };
    const byId = new Map((att ?? []).map((a) => [a.staff_id, a]));
    return (staff ?? []).map((s) => ({
      ...s,
      attendance: byId.get(s.id) ?? null,
    }));
  });

export const upsertStaffAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      staff_id: string;
      work_date: string;
      status: StaffAttStatus;
      clock_in?: string | null;
      clock_out?: string | null;
      note?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { error } = await supabase.from("staff_attendance").upsert(
      {
        school_id: schoolId,
        staff_id: data.staff_id,
        work_date: data.work_date,
        status: data.status,
        clock_in: data.clock_in ?? null,
        clock_out: data.clock_out ?? null,
        note: data.note ?? null,
        recorded_by: userId,
      },
      { onConflict: "school_id,staff_id,work_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Teacher performance signals ────────────────────────────────────────────
// Window is last 30 days by default.
export const teacherPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

    // 1. Teachers list (staff with position=teacher OR user linked via user_roles=teacher)
    const { data: teachers } = await supabase
      .from("staff")
      .select("id, user_id, first_name, last_name, position")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .in("position", ["teacher", "vice_principal", "principal"]);

    // 2. Class_subjects: which teacher teaches what
    const { data: cs } = await supabase
      .from("class_subjects")
      .select("class_id, subject, teacher_id, classes(name)")
      .eq("school_id", schoolId);

    // 3. Attendance rows since `since`, group by (class, subject) via students table
    const { data: att } = await supabase
      .from("attendance")
      .select("student_id, subject, date, students(class_name)")
      .eq("school_id", schoolId)
      .gte("date", since);

    // 4. Grades entered since window (created_at)
    const { data: grades } = await supabase
      .from("grades")
      .select(
        "student_id, sequence, subject, created_at, ca_score, exam_score, students(class_name)",
      )
      .eq("school_id", schoolId)
      .gte("created_at", `${since}T00:00:00Z`);

    // 5. Own punctuality
    const { data: myAtt } = await supabase
      .from("staff_attendance")
      .select("staff_id, status")
      .eq("school_id", schoolId)
      .gte("work_date", since);

    // Compute signals per teacher
    type Row = {
      staff_id: string;
      name: string;
      classes: string[];
      subjects: string[];
      attendance_taken: number; // number of (class,subject,date) tuples with any attendance recorded
      attendance_expected: number; // sessions expected — rough: unique (class,subject,date) they teach × distinct dates
      grades_entered: number;
      class_average: number | null;
      punctuality_pct: number | null;
    };
    const out: Row[] = [];
    const csByTeacher = new Map<string, { class_name: string; subject: string }[]>();
    for (const r of cs ?? []) {
      if (!r.teacher_id) continue;
      const cn = (r as { classes?: { name?: string } }).classes?.name ?? "";
      const arr = csByTeacher.get(r.teacher_id) ?? [];
      arr.push({ class_name: cn, subject: r.subject });
      csByTeacher.set(r.teacher_id, arr);
    }
    for (const t of teachers ?? []) {
      const teaches = csByTeacher.get(t.id) ?? [];
      const classes = Array.from(new Set(teaches.map((x) => x.class_name).filter(Boolean)));
      const subjects = Array.from(new Set(teaches.map((x) => x.subject).filter(Boolean)));
      // attendance-taking: for their (class,subject), count distinct dates with a row
      const relevantAtt = (att ?? []).filter((a) => {
        const cn = (a as { students?: { class_name?: string } }).students?.class_name ?? "";
        return teaches.some((x) => x.class_name === cn && x.subject === (a.subject ?? ""));
      });
      const takenKeys = new Set(
        relevantAtt.map(
          (a) =>
            `${(a as { students?: { class_name?: string } }).students?.class_name}|${a.subject}|${a.date}`,
        ),
      );
      // rough expected = teaches.length × unique dates in window with any attendance in school
      const allDates = new Set((att ?? []).map((a) => a.date));
      const expected = teaches.length * allDates.size;
      const gradesForTeacher = (grades ?? []).filter((g) => {
        const cn = (g as { students?: { class_name?: string } }).students?.class_name ?? "";
        return teaches.some((x) => x.class_name === cn && x.subject === g.subject);
      });
      const scores: number[] = [];
      for (const g of gradesForTeacher) {
        const ca = Number(g.ca_score ?? 0),
          ex = Number(g.exam_score ?? 0);
        if (g.ca_score != null || g.exam_score != null) scores.push(ca * 0.4 + ex * 0.6);
      }
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      // punctuality
      const mine = (myAtt ?? []).filter((r) => r.staff_id === t.id);
      const punct = mine.length
        ? Math.round(100 * (mine.filter((r) => r.status === "present").length / mine.length))
        : null;
      out.push({
        staff_id: t.id,
        name: `${t.first_name} ${t.last_name}`,
        classes,
        subjects,
        attendance_taken: takenKeys.size,
        attendance_expected: expected,
        grades_entered: gradesForTeacher.length,
        class_average: avg,
        punctuality_pct: punct,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });
