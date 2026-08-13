import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "@/lib/school-context";

export const getCurrentSchool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;

    const { data: school, error } = await supabase
      .from("schools")
      .select("id, name, code, city, region, motto, current_academic_year")
      .eq("id", schoolId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    return { school, profile };
  });

const updateSchoolSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  motto: z.string().optional().nullable(),
  current_academic_year: z.string().optional().nullable(),
});

export const updateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof updateSchoolSchema>) => updateSchoolSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");
    const { error } = await supabase
      .from("schools")
      .update({
        name: data.name,
        code: data.code,
        city: data.city || null,
        region: data.region || null,
        motto: data.motto || null,
        current_academic_year: data.current_academic_year || null,
      })
      .eq("id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName: string }) =>
    z.object({ fullName: z.string().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
