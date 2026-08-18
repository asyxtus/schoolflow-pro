import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Was previously a hand-maintained list that had drifted out of sync with
// the actual database enum (missing discipline_master, nurse, and four
// other roles added later) — that staleness is exactly why those roles
// were never assignable through this screen despite having real permission
// logic built for them. Referencing the generated type directly means this
// can't silently drift again.
export type AppRole = Database["public"]["Enums"]["app_role"];

// Roles assignable here: any staff-level role with its own permission
// scoping. Deliberately excludes principal (special-cased below — the
// founding admin role isn't handed out casually), diocese_admin and
// super_admin (platform-level, granted only via the super admin console),
// and parent/student (not staff — no accounts issued this way).
export const MANAGEABLE_ROLES: AppRole[] = [
  "vice_principal",
  "bursar",
  "teacher",
  "secretary",
  "discipline_master",
  "nurse",
  "boarding_master",
  "receptionist",
  "sports_master",
];

async function assertManager(supabase: SupabaseClient<Database>, userId: string, schoolId: string) {
  // private.can_manage_school_data is intentionally not exposed through the
  // Supabase Data API. Use the caller's own role rows instead; the RLS policy
  // "Users view own roles" allows this exact lookup and prevents reading
  // another user's roles. Keep the school_id predicate to preserve the
  // school boundary enforced by the original helper.
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);

  const canManage = (roles ?? []).some((row) =>
    row.role === "principal" ||
    row.role === "vice_principal" ||
    row.role === "bursar" ||
    row.role === "secretary" ||
    row.role === "super_admin",
  );

  if (!canManage) throw new Error("Only principals can manage staff");
}

// ─── Staff list ────────────────────────────────────────────────────
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { staff: [], schoolId: null as string | null };

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("id, role, user_id, created_at")
      .eq("school_id", schoolId);
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
    const staff = (roles ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      role: r.role,
      created_at: r.created_at,
      full_name: profilesById.get(r.user_id)?.full_name ?? null,
      email: profilesById.get(r.user_id)?.email ?? null,
    }));
    return { staff, schoolId };
  });

// ─── Invitations ────────────────────────────────────────────────────
export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("staff_invitations")
      .select("id, email, role, status, expires_at, accepted_at, created_at, token")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: AppRole }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    await assertManager(supabase, userId, schoolId);
    if (!MANAGEABLE_ROLES.includes(data.role))
      throw new Error("That role cannot be assigned via invitation");
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");

    const { data: inv, error } = await supabase
      .from("staff_invitations")
      .insert({ school_id: schoolId, email, role: data.role, invited_by: userId })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);

    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: "invitation.create",
      _entity_type: "staff_invitation",
      _entity_id: inv.id,
      _summary: `Invited ${email} as ${data.role}`,
      _before: null,
      _after: { email, role: data.role },
    });
    return { id: inv.id, token: inv.token };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    await assertManager(supabase, userId, schoolId);
    const { data: existing } = await supabase
      .from("staff_invitations")
      .select("id, email, role, status")
      .eq("id", data.id)
      .single();
    const { error } = await supabase
      .from("staff_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: "invitation.revoke",
      _entity_type: "staff_invitation",
      _entity_id: data.id,
      _summary: `Revoked invitation for ${existing?.email ?? "unknown"}`,
      _before: existing ?? null,
      _after: null,
    });
    return { ok: true };
  });

export const getInvitationByToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: inv, error } = await supabase
      .from("staff_invitations")
      .select(
        "id, email, role, status, expires_at, accepted_at, school_id, diocese_id, schools(name, city, region), dioceses(name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return inv;
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    const { data: inv, error } = await supabase
      .from("staff_invitations")
      .select("id, email, role, status, expires_at, school_id, diocese_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation is no longer valid");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Invitation has expired");

    const userEmail = (claims.email as string | undefined)?.toLowerCase();
    if (userEmail && userEmail !== inv.email.toLowerCase()) {
      throw new Error(`This invitation is for ${inv.email}. Sign in with that email.`);
    }

    // Assign school/diocese + role using admin client (RLS blocks self-assign of roles)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (inv.diocese_id) {
      // Check-then-insert rather than upsert: the (user_id, diocese_id, role)
      // uniqueness is a partial index (WHERE diocese_id IS NOT NULL), and
      // supabase-js's onConflict can't target a partial index's predicate.
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("diocese_id", inv.diocese_id)
        .eq("role", inv.role)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, diocese_id: inv.diocese_id, role: inv.role });
      }
    } else if (inv.school_id) {
      await supabaseAdmin.from("profiles").update({ school_id: inv.school_id }).eq("id", userId);
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, school_id: inv.school_id, role: inv.role },
          { onConflict: "user_id,role,school_id" },
        );
    }

    await supabaseAdmin
      .from("staff_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", inv.id);

    if (inv.school_id) {
      await supabase.rpc("log_audit", {
        _school_id: inv.school_id,
        _action: "invitation.accept",
        _entity_type: "user_role",
        _entity_id: userId,
        _summary: `${userEmail ?? inv.email} joined as ${inv.role}`,
        _before: null,
        _after: { role: inv.role },
      });
    }
    return { ok: true, schoolId: inv.school_id, dioceseId: inv.diocese_id };
  });

// ─── Role management ───────────────────────────────────────────────
export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: AppRole; add: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    await assertManager(supabase, userId, schoolId);
    if (!MANAGEABLE_ROLES.includes(data.role) && data.role !== "principal") {
      throw new Error("That role cannot be managed here");
    }
    if (data.user_id === userId && data.role === "principal" && !data.add) {
      throw new Error("You cannot remove your own principal role");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.add) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.user_id, school_id: schoolId, role: data.role },
          { onConflict: "user_id,role,school_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("school_id", schoolId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: data.add ? "role.grant" : "role.revoke",
      _entity_type: "user_role",
      _entity_id: data.user_id,
      _summary: `${data.add ? "Granted" : "Revoked"} ${data.role}`,
      _before: null,
      _after: { role: data.role, add: data.add },
    });
    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    await assertManager(supabase, userId, schoolId);
    if (data.user_id === userId) throw new Error("You cannot remove yourself");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: "staff.remove",
      _entity_type: "user",
      _entity_id: data.user_id,
      _summary: `Removed all roles from staff`,
    });
    return { ok: true };
  });

// ─── Audit log ─────────────────────────────────────────────────────
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; action?: string; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("audit_log")
      .select(
        "id, actor_id, actor_email, action, entity_type, entity_id, summary, before, after, created_at",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.action && data.action !== "all") q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const search = (data.q ?? "").trim().toLowerCase();
    if (!search) return rows ?? [];
    return (rows ?? []).filter((r) =>
      `${r.action} ${r.entity_type} ${r.summary ?? ""} ${r.actor_email ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  });
