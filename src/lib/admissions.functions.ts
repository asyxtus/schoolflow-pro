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

type ApplicantInput = z.infer<typeof applicantSchema>;

export const createApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ApplicantInput) => applicantSchema.parse(data))
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

const stageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(["new", "review", "interview", "offer", "enrolled", "rejected"]),
});

export const updateApplicantStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof stageSchema>) => stageSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { error } = await supabase
      .from("applicants")
      .update({ stage: data.stage })
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw error;
    return { ok: true };
  });

const admitSchema = z.object({
  id: z.string().uuid(),
  matricule: z.string().min(1),
  className: z.string().optional(),
});

export const admitApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof admitSchema>) => admitSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: applicant, error: aErr } = await supabase
      .from("applicants")
      .select("*")
      .eq("id", data.id)
      .eq("school_id", schoolId)
      .single();
    if (aErr) throw aErr;
    if (!applicant) throw new Error("Applicant not found");

    const { data: student, error: sErr } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        matricule: data.matricule,
        date_of_birth: applicant.date_of_birth,
        gender: applicant.gender,
        class_name: data.className || applicant.class_applied_for,
        status: "active",
      })
      .select("id")
      .single();
    if (sErr) throw sErr;

    if (applicant.guardian_name && student) {
      await supabase.from("guardians").insert({
        school_id: schoolId,
        student_id: student.id,
        full_name: applicant.guardian_name,
        phone: applicant.guardian_phone,
        email: applicant.guardian_email,
        is_primary: true,
      });
    }

    const { error: uErr } = await supabase
      .from("applicants")
      .update({ stage: "enrolled" })
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (uErr) throw uErr;

    return { studentId: student!.id };
  });
