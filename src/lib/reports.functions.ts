import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getGradesForClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { className: string; sequence: number }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, matricule")
      .eq("school_id", schoolId)
      .eq("class_name", data.className)
      .eq("status", "active")
      .order("last_name");
    if (sErr) throw new Error(sErr.message);

    const ids = (students ?? []).map((s) => s.id);
    const { data: grades } = ids.length
      ? await supabase
          .from("grades")
          .select("id, student_id, subject, ca_score, exam_score, remark")
          .eq("school_id", schoolId)
          .eq("sequence", data.sequence)
          .in("student_id", ids)
      : { data: [] as any[] };

    return { students: students ?? [], grades: grades ?? [] };
  });

export const upsertGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      studentId: string;
      sequence: number;
      subject: string;
      ca_score?: number | null;
      exam_score?: number | null;
      remark?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("grades").upsert(
      {
        school_id: schoolId,
        student_id: data.studentId,
        sequence: data.sequence,
        subject: data.subject,
        ca_score: data.ca_score ?? null,
        exam_score: data.exam_score ?? null,
        remark: data.remark ?? null,
      },
      { onConflict: "student_id,sequence,subject" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStudentReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; sequence: number }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, matricule, class_name, section")
      .eq("school_id", schoolId)
      .eq("id", data.studentId)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: grades } = await supabase
      .from("grades")
      .select("subject, ca_score, exam_score, remark")
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .eq("sequence", data.sequence)
      .order("subject");

    return { student, grades: grades ?? [] };
  });