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
  if (!data) throw new Error("Only a super admin can access this");
}

export const getPlatformSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("platform_snapshot");
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  });

export const getPlatformSchoolsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("platform_schools_snapshot");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const searchPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const q = data.query.trim();
    if (q.length < 2) return [];

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    if (!profiles?.length) return [];

    const ids = profiles.map((p) => p.id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, school_id, diocese_id, schools(name), dioceses(name)")
      .in("user_id", ids);

    return profiles.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      roles: (roles ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => ({
          role: r.role,
          scope:
            (r as { schools?: { name?: string } }).schools?.name ??
            (r as { dioceses?: { name?: string } }).dioceses?.name ??
            (r.role === "super_admin" ? "Platform-wide" : null),
        })),
    }));
  });

export const getRecentSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const [schoolsRes, profilesRes] = await Promise.all([
      supabase
        .from("schools")
        .select("id, name, city, created_at, is_active")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("profiles")
        .select("id, full_name, email, created_at, school_id, schools(name)")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    if (schoolsRes.error) throw new Error(schoolsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    return {
      schools: schoolsRes.data ?? [],
      users: (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        school_name: (p as { schools?: { name?: string } | null }).schools?.name ?? null,
      })),
    };
  });

export const setSchoolActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId: string; active: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", data.schoolId)
      .maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("schools")
      .update({ is_active: data.active })
      .eq("id", data.schoolId);
    if (error) throw new Error(error.message);
    await supabase.rpc("log_audit", {
      _school_id: data.schoolId,
      _action: data.active ? "school.activate" : "school.deactivate",
      _entity_type: "school",
      _entity_id: data.schoolId,
      _summary: `${data.active ? "Activated" : "Deactivated"} ${school?.name ?? "school"}`,
      _before: null,
      _after: { is_active: data.active },
    });
    return { ok: true };
  });

export const listPlatformAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; q?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_log")
      .select(
        "id, school_id, actor_email, action, entity_type, entity_id, summary, created_at, schools(name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    const search = (data.q ?? "").trim().toLowerCase();
    const mapped = (rows ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      summary: r.summary,
      actor_email: r.actor_email,
      created_at: r.created_at,
      school_name: (r as { schools?: { name?: string } | null }).schools?.name ?? "Platform",
    }));
    if (!search) return mapped;
    return mapped.filter((r) =>
      `${r.action} ${r.entity_type} ${r.summary ?? ""} ${r.actor_email ?? ""} ${r.school_name}`
        .toLowerCase()
        .includes(search),
    );
  });

export const setSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; grant: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase, userId } = context;
    if (data.userId === userId && !data.grant) {
      throw new Error("You cannot revoke your own super admin access");
    }
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    if (data.grant) {
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", data.userId)
        .eq("role", "super_admin")
        .is("school_id", null)
        .is("diocese_id", null)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: data.userId, role: "super_admin" });
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "super_admin")
        .is("school_id", null)
        .is("diocese_id", null);
      if (error) throw new Error(error.message);
    }
    await supabase.rpc("log_platform_audit", {
      _action: data.grant ? "super_admin.grant" : "super_admin.revoke",
      _entity_type: "user",
      _entity_id: data.userId,
      _summary: `${data.grant ? "Granted" : "Revoked"} super admin ${data.grant ? "to" : "from"} ${targetProfile?.email ?? data.userId}`,
    });
    return { ok: true };
  });
