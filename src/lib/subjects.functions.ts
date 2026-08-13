import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { includeInactive?: boolean } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("subjects")
      .select("id, name, active")
      .eq("school_id", schoolId)
      .order("name");
    if (!data.includeInactive) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Add a subject to the canonical list, or return the existing one if a
// case/whitespace-insensitive match already exists — so typing "maths" when
// "Mathematics" already exists doesn't create a near-duplicate.
export const ensureSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const name = data.name.trim();
    if (!name) throw new Error("Subject name required");
    const { data: existing } = await supabase
      .from("subjects")
      .select("id, name, active")
      .eq("school_id", schoolId)
      .ilike("name", name);
    const match = (existing ?? []).find((r) => r.name.trim().toLowerCase() === name.toLowerCase());
    if (match) {
      if (!match.active) {
        await supabase.from("subjects").update({ active: true }).eq("id", match.id);
      }
      return { id: match.id, name: match.name };
    }
    const { data: inserted, error } = await supabase
      .from("subjects")
      .insert({ school_id: schoolId, name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, name: inserted.name };
  });

export const listSubjectsForClassName = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { className: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId || !data.className) return [];
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", data.className)
      .maybeSingle();
    if (!cls) return [];
    const { data: rows } = await supabase
      .from("class_subjects")
      .select("subject")
      .eq("school_id", schoolId)
      .eq("class_id", cls.id)
      .order("subject");
    const names = Array.from(new Set((rows ?? []).map((r) => r.subject)));
    return names.map((name) => ({ id: name, name }));
  });

export const getClassSubjectAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { className: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId || !data.className) return [];
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", data.className)
      .maybeSingle();
    if (!cls) return [];
    const { data: rows } = await supabase
      .from("class_subjects")
      .select("subject, coefficient, staff(first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_id", cls.id)
      .order("subject");
    return (rows ?? []).map((r) => {
      const staffRow = (r as { staff?: { first_name?: string; last_name?: string } | null }).staff;
      const teacherName = staffRow
        ? `${staffRow.first_name ?? ""} ${staffRow.last_name ?? ""}`.trim()
        : "";
      return {
        subject: r.subject as string,
        teacherName,
        coefficient: Number(r.coefficient ?? 1),
      };
    });
  });

export const renameSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const newName = data.name.trim();
    if (!newName) throw new Error("Subject name required");

    const { data: existing, error: fErr } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", data.id)
      .single();
    if (fErr) throw new Error(fErr.message);
    const oldName = existing.name;

    const { error } = await supabase.from("subjects").update({ name: newName }).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (oldName.trim().toLowerCase() === newName.toLowerCase()) {
      return { ok: true }; // no-op rename (e.g. just fixing case) — nothing else to cascade
    }

    // Cascade into every free-text column this subject actually lives in —
    // otherwise the canonical list and the tables that drive grades,
    // attendance, coefficients, and the timetable quietly drift apart again.
    const tables = [
      "class_subjects",
      "attendance",
      "grades",
      "subject_coefficients",
      "timetable_slots",
    ] as const;
    for (const table of tables) {
      const { error: uErr } = await supabase
        .from(table)
        .update({ subject: newName })
        .eq("school_id", schoolId)
        .ilike("subject", oldName.trim());
      if (uErr) throw new Error(`Renamed, but failed to update ${table}: ${uErr.message}`);
    }
    return { ok: true };
  });

export const setSubjectActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("subjects")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
