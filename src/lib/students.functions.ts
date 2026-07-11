import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });

const studentByIdSchema = z.object({ id: z.string().uuid() });

export const getStudentById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => studentByIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: student, error } = await supabase
      .from("students")
      .select("*, guardians(*)")
      .eq("id", data.id)
      .eq("school_id", schoolId)
      .single();

    if (error) throw error;
    return student;
  });

const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  matricule: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  className: z.string().optional(),
  section: z.string().optional(),
  status: z.enum(["active", "inactive", "graduated", "withdrawn", "suspended"]).optional(),
  feeBalance: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
});

type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStudentInput) => createStudentSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        first_name: data.firstName,
        last_name: data.lastName,
        matricule: data.matricule,
        date_of_birth: data.dateOfBirth || null,
        gender: data.gender ?? null,
        class_name: data.className || null,
        section: data.section || null,
        status: data.status ?? "active",
        fee_balance: data.feeBalance ?? 0,
        notes: data.notes || null,
        guardian_phone: data.guardianPhone || null,
        guardian_email: data.guardianEmail || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (data.guardianName && student) {
      const { error: gErr } = await supabase.from("guardians").insert({
        school_id: schoolId,
        student_id: student.id,
        full_name: data.guardianName,
        phone: data.guardianPhone || null,
        email: data.guardianEmail || null,
        relationship: data.guardianRelationship || null,
        is_primary: true,
      });
      if (gErr) throw gErr;
    }

    return { id: student!.id };
  });
