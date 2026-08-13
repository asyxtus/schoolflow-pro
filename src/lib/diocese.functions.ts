import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns the diocese the current user administers, or null if they don't
// administer one. A user can only meaningfully be a diocese_admin for a
// single diocese in this v1 (matches how principals are scoped to one
// school) — if they somehow have more than one grant, the first is used.
export const getMyDiocese = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("diocese_id")
      .eq("user_id", userId)
      .eq("role", "diocese_admin")
      .not("diocese_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!roleRow?.diocese_id) return null;
    const { data: diocese, error } = await supabase
      .from("dioceses")
      .select("id, name, code")
      .eq("id", roleRow.diocese_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return diocese;
  });

export const getDioceseSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dioceseId: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("diocese_snapshot", {
      _diocese_id: data.dioceseId,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
