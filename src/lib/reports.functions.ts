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
    const className = student.class_name;
    if (!className) throw new Error("Student has no class assigned");

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

// ---------- Bulletins ----------

export const listCoefficients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { className: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { data: rows, error } = await supabase
      .from("subject_coefficients")
      .select("id, subject, coefficient, teacher_name")
      .eq("school_id", schoolId)
      .eq("class_name", data.className)
      .order("subject");
    if (error) throw new Error(error.message);
    return { coefficients: rows ?? [] };
  });

export const upsertCoefficient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      className: string;
      subject: string;
      coefficient: number;
      teacher_name?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("subject_coefficients").upsert(
      {
        school_id: schoolId,
        class_name: data.className,
        subject: data.subject,
        coefficient: data.coefficient,
        teacher_name: data.teacher_name ?? null,
      },
      { onConflict: "school_id,class_name,subject" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCoefficient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("subject_coefficients")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertBulletinMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      studentId: string;
      sequence: number;
      conduct?: string;
      absences_justified?: number;
      absences_unjustified?: number;
      head_teacher_remark?: string;
      principal_remark?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("bulletin_meta").upsert(
      {
        school_id: schoolId,
        student_id: data.studentId,
        sequence: data.sequence,
        conduct: data.conduct ?? null,
        absences_justified: data.absences_justified ?? 0,
        absences_unjustified: data.absences_unjustified ?? 0,
        head_teacher_remark: data.head_teacher_remark ?? null,
        principal_remark: data.principal_remark ?? null,
      },
      { onConflict: "student_id,sequence" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function appreciation(avg: number | null): string {
  if (avg === null) return "—";
  if (avg >= 16) return "Excellent";
  if (avg >= 14) return "Very Good";
  if (avg >= 12) return "Good";
  if (avg >= 10) return "Fair";
  if (avg >= 8) return "Weak";
  return "Very Weak";
}

export const computeBulletin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; sequence: number }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, matricule, class_name, section, gender, date_of_birth")
      .eq("school_id", schoolId)
      .eq("id", data.studentId)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: school } = await supabase
      .from("schools")
      .select("name, city, region, code, motto")
      .eq("id", schoolId)
      .single();

    const { data: coefs } = await supabase
      .from("subject_coefficients")
      .select("subject, coefficient, teacher_name")
      .eq("school_id", schoolId)
      .eq("class_name", className);

    const coefMap = new Map<string, { coefficient: number; teacher_name: string | null }>();
    (coefs ?? []).forEach((c) =>
      coefMap.set(c.subject, {
        coefficient: Number(c.coefficient) || 1,
        teacher_name: c.teacher_name,
      }),
    );

    // Fetch all grades for the whole class in this sequence to compute ranks
    const { data: classStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("class_name", className)
      .eq("status", "active");

    const classIds = (classStudents ?? []).map((s) => s.id);
    const { data: allGrades } = classIds.length
      ? await supabase
          .from("grades")
          .select("student_id, subject, ca_score, exam_score, remark")
          .eq("school_id", schoolId)
          .eq("sequence", data.sequence)
          .in("student_id", classIds)
      : { data: [] as any[] };

    // Compute per-student per-subject mark and total
    type Row = { subject: string; mark: number | null; coef: number; teacher: string | null; remark: string | null };
    const perStudent = new Map<string, { subjects: Map<string, number>; totalWeighted: number; totalCoef: number }>();
    (allGrades ?? []).forEach((g) => {
      const coef = coefMap.get(g.subject)?.coefficient ?? 1;
      const ca = g.ca_score;
      const ex = g.exam_score;
      let mark: number | null = null;
      if (ca !== null && ex !== null) mark = Number(ca) * 0.4 + Number(ex) * 0.6;
      else if (ex !== null) mark = Number(ex);
      else if (ca !== null) mark = Number(ca);
      if (mark === null) return;
      const entry = perStudent.get(g.student_id) ?? {
        subjects: new Map(),
        totalWeighted: 0,
        totalCoef: 0,
      };
      entry.subjects.set(g.subject, mark);
      entry.totalWeighted += mark * coef;
      entry.totalCoef += coef;
      perStudent.set(g.student_id, entry);
    });

    // Build rank arrays per subject and overall
    const subjectRanks = new Map<string, Array<{ studentId: string; mark: number }>>();
    perStudent.forEach((v, sid) => {
      v.subjects.forEach((mark, subj) => {
        const arr = subjectRanks.get(subj) ?? [];
        arr.push({ studentId: sid, mark });
        subjectRanks.set(subj, arr);
      });
    });
    subjectRanks.forEach((arr) => arr.sort((a, b) => b.mark - a.mark));

    const overallArr = Array.from(perStudent.entries()).map(([sid, v]) => ({
      studentId: sid,
      avg: v.totalCoef > 0 ? v.totalWeighted / v.totalCoef : 0,
      totalWeighted: v.totalWeighted,
      totalCoef: v.totalCoef,
    }));
    overallArr.sort((a, b) => b.avg - a.avg);
    const overallRankMap = new Map(overallArr.map((r, i) => [r.studentId, i + 1]));

    // Compute this student's rows
    const myEntry = perStudent.get(data.studentId);
    const myGrades = (allGrades ?? []).filter((g) => g.student_id === data.studentId);
    const rows: Array<Row & { rank: number | null; classAvg: number | null }> = [];
    const subjectSet = new Set<string>([
      ...Array.from(coefMap.keys()),
      ...myGrades.map((g) => g.subject),
    ]);
    subjectSet.forEach((subj) => {
      const g = myGrades.find((x) => x.subject === subj);
      const coef = coefMap.get(subj)?.coefficient ?? 1;
      const teacher = coefMap.get(subj)?.teacher_name ?? null;
      let mark: number | null = null;
      if (g) {
        const ca = g.ca_score;
        const ex = g.exam_score;
        if (ca !== null && ex !== null) mark = Number(ca) * 0.4 + Number(ex) * 0.6;
        else if (ex !== null) mark = Number(ex);
        else if (ca !== null) mark = Number(ca);
      }
      // rank in subject
      const rankArr = subjectRanks.get(subj) ?? [];
      const rank = mark !== null
        ? rankArr.findIndex((r) => r.studentId === data.studentId) + 1 || null
        : null;
      const classAvg = rankArr.length
        ? rankArr.reduce((s, r) => s + r.mark, 0) / rankArr.length
        : null;
      rows.push({
        subject: subj,
        mark,
        coef,
        teacher,
        remark: g?.remark ?? null,
        rank,
        classAvg,
      });
    });
    rows.sort((a, b) => a.subject.localeCompare(b.subject));

    const totalWeighted = myEntry?.totalWeighted ?? 0;
    const totalCoef = myEntry?.totalCoef ?? 0;
    const overallAvg = totalCoef > 0 ? totalWeighted / totalCoef : null;
    const overallRank = overallRankMap.get(data.studentId) ?? null;
    const classSize = overallArr.length;
    const classAvgOverall = classSize > 0
      ? overallArr.reduce((s, r) => s + r.avg, 0) / classSize
      : null;

    const { data: meta } = await supabase
      .from("bulletin_meta")
      .select("conduct, absences_justified, absences_unjustified, head_teacher_remark, principal_remark")
      .eq("student_id", data.studentId)
      .eq("sequence", data.sequence)
      .maybeSingle();

    return {
      student,
      school,
      sequence: data.sequence,
      rows,
      totals: {
        totalWeighted,
        totalCoef,
        overallAvg,
        overallRank,
        classSize,
        classAvgOverall,
        appreciation: appreciation(overallAvg),
      },
      meta: meta ?? null,
    };
  });