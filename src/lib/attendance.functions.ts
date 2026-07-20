import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const getAttendanceForClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { className: string; date: string; subject?: string | null }) => data)
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
    let attQuery = ids.length
      ? supabase
          .from("attendance")
          .select("student_id, status, note, subject")
          .eq("school_id", schoolId)
          .eq("date", data.date)
          .in("student_id", ids)
      : null;
    if (attQuery) {
      if (data.subject) attQuery = attQuery.eq("subject", data.subject);
      else attQuery = attQuery.is("subject", null);
    }
    const { data: att } = attQuery
      ? await attQuery
      : { data: [] as { student_id: string; status: AttendanceStatus; note: string | null; subject: string | null }[] };

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
  .inputValidator((data: { studentId: string; date: string; status: AttendanceStatus; note?: string; subject?: string | null }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const subject = data.subject ?? null;
    // Manual upsert to handle nullable subject in the composite uniqueness
    const existing = await supabase
      .from("attendance")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .eq("date", data.date)
      .is(subject ? "subject" : "subject", subject as never)
      .maybeSingle();
    let q;
    if (subject) {
      q = supabase.from("attendance").select("id").eq("school_id", schoolId).eq("student_id", data.studentId).eq("date", data.date).eq("subject", subject).maybeSingle();
    } else {
      q = supabase.from("attendance").select("id").eq("school_id", schoolId).eq("student_id", data.studentId).eq("date", data.date).is("subject", null).maybeSingle();
    }
    const { data: found } = await q;
    void existing;
    if (found?.id) {
      const { error } = await supabase
        .from("attendance")
        .update({ status: data.status, note: data.note ?? null, recorded_by: userId })
        .eq("id", found.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("attendance").insert({
        school_id: schoolId,
        student_id: data.studentId,
        date: data.date,
        subject,
        status: data.status,
        note: data.note ?? null,
        recorded_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const bulkMarkAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date: string; subject?: string | null; entries: { studentId: string; status: AttendanceStatus }[] }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const subject = data.subject ?? null;
    if (!data.entries.length) return { ok: true, count: 0 };
    // Fetch existing rows for this date+subject
    const ids = data.entries.map((e) => e.studentId);
    let existQ = supabase
      .from("attendance")
      .select("id, student_id")
      .eq("school_id", schoolId)
      .eq("date", data.date)
      .in("student_id", ids);
    existQ = subject ? existQ.eq("subject", subject) : existQ.is("subject", null);
    const { data: existing } = await existQ;
    const byStudent = new Map((existing ?? []).map((r) => [r.student_id, r.id]));
    type AttInsert = {
      school_id: string;
      student_id: string;
      date: string;
      subject: string | null;
      status: AttendanceStatus;
      recorded_by: string;
    };
    const toInsert: AttInsert[] = [];
    for (const e of data.entries) {
      const rid = byStudent.get(e.studentId);
      if (rid) {
        await supabase.from("attendance").update({ status: e.status, recorded_by: userId }).eq("id", rid);
      } else {
        toInsert.push({
          school_id: schoolId,
          student_id: e.studentId,
          date: data.date,
          subject,
          status: e.status,
          recorded_by: userId,
        });
      }
    }
    if (toInsert.length) {
      const { error } = await supabase.from("attendance").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.entries.length };
  });