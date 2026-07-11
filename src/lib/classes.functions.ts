import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data, error } = await supabase
      .from("students")
      .select("class_name, section, status, gender, fee_balance, attendance_rate")
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const map = new Map<string, {
      className: string;
      sections: Set<string>;
      total: number;
      active: number;
      male: number;
      female: number;
      balance: number;
      attendanceSum: number;
      attendanceCount: number;
    }>();

    for (const s of rows) {
      const key = s.class_name || "Unassigned";
      const entry = map.get(key) ?? {
        className: key,
        sections: new Set<string>(),
        total: 0, active: 0, male: 0, female: 0,
        balance: 0, attendanceSum: 0, attendanceCount: 0,
      };
      entry.total += 1;
      if (s.status === "active") entry.active += 1;
      if (s.section) entry.sections.add(s.section);
      if (s.gender === "male") entry.male += 1;
      if (s.gender === "female") entry.female += 1;
      entry.balance += Number(s.fee_balance ?? 0);
      if (s.attendance_rate != null) {
        entry.attendanceSum += Number(s.attendance_rate);
        entry.attendanceCount += 1;
      }
      map.set(key, entry);
    }

    return Array.from(map.values())
      .map((e) => ({
        className: e.className,
        sections: Array.from(e.sections).sort(),
        total: e.total,
        active: e.active,
        male: e.male,
        female: e.female,
        outstanding: e.balance,
        avgAttendance: e.attendanceCount
          ? Math.round(e.attendanceSum / e.attendanceCount)
          : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  });
