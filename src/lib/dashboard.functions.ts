import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const [studentsRes, applicantsRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, class_name, status, fee_balance, attendance_rate", { count: "exact" })
        .eq("school_id", schoolId),
      supabase
        .from("applicants")
        .select("id, stage", { count: "exact" })
        .eq("school_id", schoolId),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (applicantsRes.error) throw applicantsRes.error;

    const students = studentsRes.data ?? [];
    const applicants = applicantsRes.data ?? [];

    const active = students.filter((s) => s.status === "active");
    const classes = new Set(students.map((s) => s.class_name).filter(Boolean));
    const totalBalance = students.reduce((sum, s) => sum + Number(s.fee_balance ?? 0), 0);
    const paidStudents = students.filter((s) => Number(s.fee_balance ?? 0) === 0).length;
    const feeCollectionRate = students.length
      ? Math.round((paidStudents / students.length) * 100)
      : 0;
    const avgAttendance = active.length
      ? Math.round(
          active.reduce((sum, s) => sum + Number(s.attendance_rate ?? 0), 0) / active.length,
        )
      : 0;

    const pipeline = ["new", "review", "interview", "offer", "enrolled", "rejected"].map(
      (stage) => ({
        stage,
        count: applicants.filter((a) => a.stage === stage).length,
      }),
    );
    const openApplicants = applicants.filter(
      (a) => a.stage !== "enrolled" && a.stage !== "rejected",
    ).length;

    return {
      totalEnrolment: students.length,
      activeEnrolment: active.length,
      classCount: classes.size,
      avgAttendance,
      outstandingBalance: totalBalance,
      feeCollectionRate,
      openApplicants,
      pipeline,
    };
  });