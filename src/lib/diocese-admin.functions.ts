import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only a super admin can manage dioceses");
}

export const isSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (error) return false;
    return !!data;
  });

export const listAllDioceses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("dioceses")
      .select("id, name, code, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDiocese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; code: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (!data.name.trim() || !data.code.trim()) throw new Error("Name and code are required");
    const { data: diocese, error } = await context.supabase
      .from("dioceses")
      .insert({ name: data.name.trim(), code: data.code.trim() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_platform_audit", {
      _action: "diocese.create",
      _entity_type: "diocese",
      _entity_id: diocese.id,
      _summary: `Created diocese "${data.name.trim()}" (${data.code.trim()})`,
    });
    return { ok: true };
  });

export const listAllSchoolsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("schools")
      .select("id, name, city, diocese_id")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const assignSchoolToDiocese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string; dioceseId: string | null }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("schools")
      .update({ diocese_id: data.dioceseId })
      .eq("id", data.schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDioceseAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dioceseId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("id, user_id, created_at")
      .eq("diocese_id", data.dioceseId)
      .eq("role", "diocese_admin");
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const profilesById = new Map<string, { full_name: string | null; email: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      for (const p of profs ?? [])
        profilesById.set(p.id, { full_name: p.full_name, email: p.email });
    }
    const { data: invites } = await supabase
      .from("staff_invitations")
      .select("id, email, status, created_at")
      .eq("diocese_id", data.dioceseId)
      .eq("role", "diocese_admin")
      .eq("status", "pending");
    return {
      admins: (roles ?? []).map((r) => ({
        id: r.id,
        full_name: profilesById.get(r.user_id)?.full_name ?? null,
        email: profilesById.get(r.user_id)?.email ?? null,
      })),
      pendingInvites: invites ?? [],
    };
  });

export const addDioceseAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dioceseId: string; email: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("diocese_id", data.dioceseId)
        .eq("role", "diocese_admin")
        .maybeSingle();
      if (existingRole) return { ok: true, granted: true, alreadyHadAccount: true };
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: existingProfile.id, diocese_id: data.dioceseId, role: "diocese_admin" });
      if (error) throw new Error(error.message);
      return { ok: true, granted: true, alreadyHadAccount: true };
    }

    const { data: inv, error } = await supabase
      .from("staff_invitations")
      .insert({ diocese_id: data.dioceseId, email, role: "diocese_admin" })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, granted: false, alreadyHadAccount: false, token: inv.token };
  });
