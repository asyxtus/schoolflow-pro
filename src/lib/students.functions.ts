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
  .validator(studentByIdSchema)
  .middleware([requireSupabaseAuth])
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
