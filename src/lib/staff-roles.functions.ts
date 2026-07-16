import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ALL_ROLES: { value: AppRole; label: string; category: string }[] = [
  { value: "principal", label: "Principal", category: "Leadership" },
  { value: "vice_principal", label: "Vice Principal", category: "Leadership" },
  { value: "bursar", label: "Bursar", category: "Leadership" },
  { value: "secretary", label: "Secretary", category: "Administration" },
  { value: "receptionist", label: "Receptionist", category: "Administration" },
  { value: "dean_of_studies", label: "Dean of Studies", category: "Academics" },
  { value: "teacher", label: "Teacher", category: "Academics" },
  { value: "discipline_master", label: "Discipline Master/Mistress", category: "Student Life" },
  { value: "boarding_master", label: "Boarding Master/Mistress", category: "Student Life" },
  { value: "counsellor", label: "Counsellor", category: "Student Life" },
  { value: "sports_master", label: "Sports Master/Mistress", category: "Student Life" },
  { value: "nurse", label: "Nurse", category: "Student Life" },
];

export const listSchoolUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await context.supabase.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] as { id: string; email: string; full_name: string }[] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const map = new Map<string, { user_id: string; email: string; full_name: string; roles: AppRole[] }>();
    for (const r of roles ?? []) {
      const p = profileMap.get(r.user_id);
      if (!p) continue;
      const entry = map.get(p.id) ?? { user_id: p.id, email: p.email ?? "", full_name: p.full_name ?? p.email ?? "Unknown", roles: [] };
      entry.roles.push(r.role as AppRole);
      map.set(p.id, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; roles: AppRole[] }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    // authorization: only leadership/super_admin can change roles
    const { data: canManage } = await context.supabase.rpc("can_manage_school_data", {
      _user_id: context.userId,
      _school_id: schoolId,
    });
    if (!canManage) throw new Error("Not authorized");
    // delete existing rows for this user+school
    await context.supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("school_id", schoolId);
    if (data.roles.length > 0) {
      const rows = data.roles.map((role) => ({ user_id: data.user_id, school_id: schoolId, role }));
      const { error } = await context.supabase.from("user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role as AppRole);
  });
