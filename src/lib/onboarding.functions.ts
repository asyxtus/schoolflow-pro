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

export type OnboardingRole =
  | "super_admin"
  | "diocese_admin"
  | "principal"
  | "vice_principal"
  | "bursar"
  | "teacher"
  | "secretary"
  | "parent"
  | "student"
  | "discipline_master"
  | "sports_master"
  | "dean_of_studies"
  | "counsellor"
  | "boarding_master"
  | "receptionist"
  | "nurse";

export type OnboardingStatus = {
  role: OnboardingRole;
  roleLabel: string;
  school: { complete: boolean; detail: string };
  team: { complete: boolean; detail: string; count: number };
  classes: { complete: boolean; detail: string; count: number };
  students: { complete: boolean; detail: string; count: number };
  finance: { complete: boolean; detail: string; count: number };
};

const ROLE_LABELS: Record<OnboardingRole, string> = {
  super_admin: "Super administrator",
  diocese_admin: "Diocese administrator",
  principal: "Principal",
  vice_principal: "Vice principal",
  bursar: "Bursar",
  teacher: "Teacher",
  secretary: "Secretary",
  parent: "Parent",
  student: "Student",
  discipline_master: "Discipline master",
  sports_master: "Sports master",
  dean_of_studies: "Dean of studies",
  counsellor: "Counsellor",
  boarding_master: "Boarding master",
  receptionist: "Receptionist",
  nurse: "Nurse",
};

/** Reads live database state so onboarding stays correct across devices. */
export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    const schoolId = profile?.school_id;
    if (!schoolId) throw new Error("No school assigned to this account");

    const [schoolRes, teamRes, classesRes, studentsRes, feesRes, rolesRes] = await Promise.all([
      supabase.from("schools").select("name, code, city, region, current_academic_year").eq("id", schoolId).maybeSingle(),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("student_fees").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("school_id", schoolId),
    ]);

    if (schoolRes.error) throw schoolRes.error;
    if (teamRes.error) throw teamRes.error;
    if (classesRes.error) throw classesRes.error;
    if (studentsRes.error) throw studentsRes.error;
    if (feesRes.error) throw feesRes.error;
    if (rolesRes.error) throw rolesRes.error;

    const school = schoolRes.data;
    const teamCount = teamRes.count ?? 0;
    const classCount = classesRes.count ?? 0;
    const studentCount = studentsRes.count ?? 0;
    const feeCount = feesRes.count ?? 0;

    const schoolComplete = Boolean(
      school?.name?.trim() &&
        school?.code?.trim() &&
        (school?.city?.trim() || school?.region?.trim() || school?.current_academic_year?.trim()),
    );

    const rolePriority: OnboardingRole[] = [
      "super_admin", "diocese_admin", "principal", "vice_principal", "bursar", "dean_of_studies",
      "secretary", "receptionist", "teacher", "discipline_master", "boarding_master", "sports_master",
      "nurse", "counsellor", "student", "parent",
    ];
    const assignedRoles = (rolesRes.data ?? []).map((r) => r.role as OnboardingRole);
    const role = rolePriority.find((candidate) => assignedRoles.includes(candidate)) ?? "principal";

    return {
      role,
      roleLabel: ROLE_LABELS[role],
      school: {
        complete: schoolComplete,
        detail: schoolComplete ? "School profile is configured" : "Add the school details",
      },
      team: {
        complete: teamCount >= 2,
        detail: teamCount >= 2 ? `${teamCount} team members assigned` : "Add at least one team member",
        count: teamCount,
      },
      classes: {
        complete: classCount > 0,
        detail: classCount > 0 ? `${classCount} class${classCount === 1 ? "" : "es"} created` : "Create your first class",
        count: classCount,
      },
      students: {
        complete: studentCount > 0,
        detail: studentCount > 0 ? `${studentCount} student${studentCount === 1 ? "" : "s"} added` : "Add your first student",
        count: studentCount,
      },
      finance: {
        complete: feeCount > 0,
        detail: feeCount > 0 ? `${feeCount} fee assignment${feeCount === 1 ? "" : "s"} created` : "Create your first fee assignment",
        count: feeCount,
      },
    } satisfies OnboardingStatus;
  });
