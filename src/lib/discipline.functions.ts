import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type DisciplineSeverity = "minor" | "moderate" | "major";
export type DisciplineStatus = "open" | "resolved";

export const listDisciplineForStudent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data: rows, error } = await supabase
      .from("discipline_incidents")
      .select(
        "id, occurred_on, category, severity, description, action_taken, points, status, resolved_at",
      )
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .order("occurred_on", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDisciplineIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: DisciplineStatus; className?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("discipline_incidents")
      .select(
        "id, occurred_on, category, severity, description, action_taken, points, status, student_id, students(first_name, last_name, class_name, matricule)",
      )
      .eq("school_id", schoolId)
      .order("occurred_on", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const filtered = data.className
      ? (rows ?? []).filter(
          (r) =>
            (r as { students?: { class_name?: string } }).students?.class_name === data.className,
        )
      : (rows ?? []);
    return filtered;
  });

export const reportDisciplineIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      studentId: string;
      occurredOn: string;
      category: string;
      severity: DisciplineSeverity;
      description: string;
      actionTaken?: string;
      points?: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.description.trim()) throw new Error("Description is required");
    const { error } = await supabase.from("discipline_incidents").insert({
      school_id: schoolId,
      student_id: data.studentId,
      occurred_on: data.occurredOn,
      category: data.category,
      severity: data.severity,
      description: data.description.trim(),
      action_taken: data.actionTaken?.trim() || null,
      points: data.points ?? 0,
      reported_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveDisciplineIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; actionTaken?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("discipline_incidents")
      .update({
        status: "resolved",
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        ...(data.actionTaken ? { action_taken: data.actionTaken.trim() } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenDisciplineIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("discipline_incidents")
      .update({ status: "open", resolved_by: null, resolved_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDisciplineIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("discipline_incidents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const DISCIPLINE_CATEGORIES = [
  "Fighting",
  "Disrespect / Insubordination",
  "Absenteeism",
  "Cheating",
  "Vandalism",
  "Bullying",
  "Uniform / Dress code",
  "Phone / Device misuse",
  "Late arrival",
  "Other",
] as const;
