import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function getUserSchoolId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, schools(is_active)")
    .eq("id", userId)
    .single();

  if (profile?.school_id) {
    const school = (profile as { schools?: { is_active?: boolean } | null }).schools;
    if (school?.is_active === false) return null;
    return profile.school_id;
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("school_id, schools(is_active)")
    .eq("user_id", userId)
    .not("school_id", "is", null)
    .limit(1);

  const row = roles?.[0];
  if (!row?.school_id) return null;
  const school = (row as { schools?: { is_active?: boolean } | null }).schools;
  if (school?.is_active === false) return null;
  return row.school_id;
}
