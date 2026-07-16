import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("classes")
      .select("id, name, level, sections, active")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertClassSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  level: z.string().optional(),
  sections: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const upsertClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof upsertClassSchema>) => upsertClassSchema.parse(d))
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      name: data.name,
      level: data.level ?? null,
      sections: data.sections ?? [],
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("classes").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("classes").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Class subjects ──────────────────────────────────────────────────────
export const listClassSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId?: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    let q = context.supabase
      .from("class_subjects")
      .select("id, class_id, subject, coefficient, teacher_id, classes(name), staff(first_name,last_name)")
      .eq("school_id", schoolId)
      .order("subject");
    if (data.classId) q = q.eq("class_id", data.classId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertClassSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id?: string; class_id: string; subject: string; coefficient?: number; teacher_id?: string | null }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      class_id: data.class_id,
      subject: data.subject,
      coefficient: data.coefficient ?? 1,
      teacher_id: data.teacher_id ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("class_subjects").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("class_subjects").upsert(row, { onConflict: "class_id,subject" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClassSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("class_subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
