import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schoolSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  city: z.string().max(80).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  motto: z.string().max(200).optional().nullable(),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schoolSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Guard: if user already has a school, do nothing.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.school_id) {
      return { schoolId: existingProfile.school_id, alreadyOnboarded: true };
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: data.name,
        code: data.code,
        city: data.city ?? null,
        region: data.region ?? null,
        motto: data.motto ?? null,
      })
      .select("id")
      .single();

    if (schoolError || !school) {
      throw new Error(schoolError?.message ?? "Failed to create school");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ school_id: school.id })
      .eq("id", userId);

    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, school_id: school.id, role: "principal" });

    if (roleError) throw new Error(roleError.message);

    return { schoolId: school.id, alreadyOnboarded: false };
  });
