import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

const updateStudentSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  matricule: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  className: z.string().optional(),
  section: z.string().optional(),
  status: z.enum(["active", "inactive", "graduated", "withdrawn", "suspended"]).optional(),
  notes: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
});

type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateStudentInput) => updateStudentSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    // Verify the student belongs to the authenticated user's school before editing.
    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("id, school_id")
      .eq("id", data.id)
      .eq("school_id", schoolId)
      .single();
    if (existingError) throw existingError;

    // RLS remains the final authorization gate for the UPDATE.
    const { error: studentError } = await supabase
      .from("students")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        matricule: data.matricule?.trim() || null,
        date_of_birth: data.dateOfBirth || null,
        gender: data.gender ?? null,
        class_name: data.className || null,
        section: data.section || null,
        status: data.status ?? "active",
        notes: data.notes || null,
        guardian_phone: data.guardianPhone || null,
        guardian_email: data.guardianEmail || null,
      })
      .eq("id", existing.id)
      .eq("school_id", schoolId);
    if (studentError) throw studentError;

    const { data: guardians, error: guardianReadError } = await supabase
      .from("guardians")
      .select("id, full_name, is_primary, created_at")
      .eq("student_id", data.id)
      .eq("school_id", schoolId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (guardianReadError) throw guardianReadError;

    const primaryGuardian = guardians?.[0];
    const hasGuardianData = Boolean(
      data.guardianName?.trim() || data.guardianPhone?.trim() || data.guardianEmail?.trim(),
    );

    if (primaryGuardian && hasGuardianData) {
      const { error } = await supabase
        .from("guardians")
        .update({
          full_name: data.guardianName?.trim() || primaryGuardian.full_name,
          phone: data.guardianPhone?.trim() || null,
          email: data.guardianEmail?.trim() || null,
          relationship: data.guardianRelationship?.trim() || null,
          is_primary: true,
        })
        .eq("id", primaryGuardian.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    } else if (!primaryGuardian && data.guardianName?.trim()) {
      const { error } = await supabase.from("guardians").insert({
        school_id: schoolId,
        student_id: data.id,
        full_name: data.guardianName.trim(),
        phone: data.guardianPhone?.trim() || null,
        email: data.guardianEmail?.trim() || null,
        relationship: data.guardianRelationship?.trim() || null,
        is_primary: true,
      });
      if (error) throw error;
    }

    return { id: data.id };
  });
