import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getApplicants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data, error } = await supabase
      .from("applicants")
      .select("*")
      .eq("school_id", schoolId)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  });

const applicantSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  desiredClass: z.string().min(1, "Desired class is required"),
  previousSchool: z.string().optional(),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
  notes: z.string().optional(),
});

export const createApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => applicantSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { error } = await supabase.from("applicants").insert({
      school_id: schoolId,
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth || null,
      gender: data.gender || null,
      class_applied_for: data.desiredClass,
      prior_school: data.previousSchool || null,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
      guardian_email: data.guardianEmail || null,
      notes: data.notes || null,
      stage: "new",
    });

    if (error) throw error;
    return { ok: true };
  });
