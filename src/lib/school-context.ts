import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function getUserSchoolId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .single();

  if (profile?.school_id) return profile.school_id;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", userId)
    .not("school_id", "is", null)
    .limit(1);

  return roles?.[0]?.school_id ?? null;
}
