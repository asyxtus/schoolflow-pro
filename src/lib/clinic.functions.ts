import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const listClinicVisitsForStudent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data: rows, error } = await supabase
      .from("clinic_visits")
      .select(
        "id, visited_on, complaint, treatment_given, temperature_c, referred_out, follow_up_needed, notes",
      )
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .order("visited_on", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listClinicVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { className?: string; followUpOnly?: boolean } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("clinic_visits")
      .select(
        "id, visited_on, complaint, treatment_given, referred_out, follow_up_needed, student_id, students(first_name, last_name, class_name)",
      )
      .eq("school_id", schoolId)
      .order("visited_on", { ascending: false });
    if (data.followUpOnly) q = q.eq("follow_up_needed", true);
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

export const recordClinicVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      studentId: string;
      visitedOn: string;
      complaint: string;
      treatmentGiven?: string;
      temperatureC?: number;
      referredOut?: boolean;
      followUpNeeded?: boolean;
      notes?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.complaint.trim()) throw new Error("Complaint / reason for visit is required");
    const { error } = await supabase.from("clinic_visits").insert({
      school_id: schoolId,
      student_id: data.studentId,
      visited_on: data.visitedOn,
      complaint: data.complaint.trim(),
      treatment_given: data.treatmentGiven?.trim() || null,
      temperature_c: data.temperatureC ?? null,
      referred_out: data.referredOut ?? false,
      follow_up_needed: data.followUpNeeded ?? false,
      notes: data.notes?.trim() || null,
      recorded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveClinicFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("clinic_visits")
      .update({ follow_up_needed: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClinicVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("clinic_visits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHealthProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;
    const { data: row, error } = await supabase
      .from("student_health_profiles")
      .select("blood_group, allergies, chronic_conditions, emergency_medical_notes")
      .eq("school_id", schoolId)
      .eq("student_id", data.studentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      studentId: string;
      bloodGroup?: string;
      allergies?: string;
      chronicConditions?: string;
      emergencyMedicalNotes?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("student_health_profiles").upsert(
      {
        student_id: data.studentId,
        school_id: schoolId,
        blood_group: data.bloodGroup?.trim() || null,
        allergies: data.allergies?.trim() || null,
        chronic_conditions: data.chronicConditions?.trim() || null,
        emergency_medical_notes: data.emergencyMedicalNotes?.trim() || null,
        updated_by: userId,
      },
      { onConflict: "student_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
