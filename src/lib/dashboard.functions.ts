import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const startToday = new Date(todayISO + "T00:00:00").toISOString();
    const endToday = new Date(todayISO + "T23:59:59").toISOString();
    const in14 = new Date(today.getTime() + 14 * 86400_000).toISOString().slice(0, 10);

    const [studentsRes, applicantsRes, paysToday, attToday, exeatsOut, upcomingFees, overdueFees, recentPays, lowStock] = await Promise.all([
      supabase
        .from("students")
        .select("id, class_name, status, fee_balance, attendance_rate", { count: "exact" })
        .eq("school_id", schoolId),
      supabase
        .from("applicants")
        .select("id, stage", { count: "exact" })
        .eq("school_id", schoolId),
      supabase
        .from("payments")
        .select("amount_fcfa, method")
        .eq("school_id", schoolId)
        .gte("paid_at", startToday)
        .lte("paid_at", endToday),
      supabase
        .from("attendance")
        .select("status, student_id")
        .eq("school_id", schoolId)
        .eq("date", todayISO),
      supabase
        .from("boarding_exeats")
        .select("id, student_id, return_by, status, students(first_name,last_name,class_name)")
        .eq("school_id", schoolId)
        .in("status", ["approved", "departed"]),
      supabase
        .from("student_fees")
        .select("id, label, due_date, amount_fcfa, discount_fcfa, student_id, students(first_name,last_name,class_name,fee_balance)")
        .eq("school_id", schoolId)
        .not("due_date", "is", null)
        .gte("due_date", todayISO)
        .lte("due_date", in14)
        .order("due_date", { ascending: true })
        .limit(50),
      supabase
        .from("student_fees")
        .select("id, label, due_date, amount_fcfa, discount_fcfa, student_id, students(first_name,last_name,class_name,fee_balance)")
        .eq("school_id", schoolId)
        .not("due_date", "is", null)
        .lt("due_date", todayISO)
        .order("due_date", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("id, amount_fcfa, method, paid_at, receipt_no, students(first_name,last_name,class_name)")
        .eq("school_id", schoolId)
        .order("paid_at", { ascending: false })
        .limit(8),
      supabase
        .from("library_books")
        .select("id, title, available_copies, total_copies")
        .eq("school_id", schoolId)
        .lte("available_copies", 1)
        .limit(5),
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

    // Today pulse
    const todayPays = paysToday.data ?? [];
    const collectedToday = todayPays.reduce((s, p) => s + Number(p.amount_fcfa ?? 0), 0);
    const paymentsCountToday = todayPays.length;
    const att = attToday.data ?? [];
    const presentToday = att.filter((a) => a.status === "present").length;
    const absentToday = att.filter((a) => a.status === "absent").length;
    const lateToday = att.filter((a) => a.status === "late").length;
    const markedToday = new Set(att.map((a) => a.student_id)).size;
    const attendanceCoverage = active.length ? Math.round((markedToday / active.length) * 100) : 0;

    // Exeats: currently out + overdue returns
    const nowISO = new Date().toISOString();
    const exeats = exeatsOut.data ?? [];
    const exeatsOutCount = exeats.length;
    const exeatsOverdue = exeats.filter((e) => e.return_by < nowISO).length;

    // Fee collection by class (real)
    const classAgg = new Map<string, { billed: number; outstanding: number }>();
    for (const s of students) {
      const cn = s.class_name ?? "—";
      const c = classAgg.get(cn) ?? { billed: 0, outstanding: 0 };
      c.outstanding += Number(s.fee_balance ?? 0);
      classAgg.set(cn, c);
    }
    // Roll fees invoiced into billed
    const feesByClass = await supabase
      .from("student_fees")
      .select("amount_fcfa, discount_fcfa, students(class_name)")
      .eq("school_id", schoolId);
    for (const f of feesByClass.data ?? []) {
      const cn = (f as { students?: { class_name?: string } }).students?.class_name ?? "—";
      const c = classAgg.get(cn) ?? { billed: 0, outstanding: 0 };
      c.billed += Math.max(Number(f.amount_fcfa ?? 0) - Number(f.discount_fcfa ?? 0), 0);
      classAgg.set(cn, c);
    }
    const feeByClass = [...classAgg.entries()]
      .map(([class_name, v]) => {
        const collected = Math.max(v.billed - v.outstanding, 0);
        const pct = v.billed ? Math.round((collected / v.billed) * 100) : 0;
        return { class_name, collected, billed: v.billed, outstanding: v.outstanding, pct };
      })
      .filter((r) => r.billed > 0)
      .sort((a, b) => b.billed - a.billed)
      .slice(0, 6);

    // Aging buckets for overdue invoices — only for students still owing money
    const buckets = { d0_7: 0, d8_30: 0, d31_60: 0, d60p: 0, count: 0 };
    for (const f of overdueFees.data ?? []) {
      const bal = Number((f as { students?: { fee_balance?: number } }).students?.fee_balance ?? 0);
      if (bal <= 0) continue;
      const amt = Math.max(Number(f.amount_fcfa ?? 0) - Number(f.discount_fcfa ?? 0), 0);
      const days = Math.floor((today.getTime() - new Date(f.due_date!).getTime()) / 86400_000);
      buckets.count++;
      if (days <= 7) buckets.d0_7 += amt;
      else if (days <= 30) buckets.d8_30 += amt;
      else if (days <= 60) buckets.d31_60 += amt;
      else buckets.d60p += amt;
    }

    // Upcoming deadlines
    const upcoming = (upcomingFees.data ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      due_date: f.due_date!,
      amount_fcfa: Math.max(Number(f.amount_fcfa ?? 0) - Number(f.discount_fcfa ?? 0), 0),
      student_id: f.student_id,
      student_name: `${(f as { students?: { first_name?: string } }).students?.first_name ?? ""} ${(f as { students?: { last_name?: string } }).students?.last_name ?? ""}`.trim(),
      class_name: (f as { students?: { class_name?: string } }).students?.class_name ?? "",
    }));

    // Recent payments
    const recent = (recentPays.data ?? []).map((p) => ({
      id: p.id,
      amount_fcfa: Number(p.amount_fcfa ?? 0),
      method: p.method,
      paid_at: p.paid_at,
      receipt_no: p.receipt_no,
      student_name: `${(p as { students?: { first_name?: string } }).students?.first_name ?? ""} ${(p as { students?: { last_name?: string } }).students?.last_name ?? ""}`.trim(),
      class_name: (p as { students?: { class_name?: string } }).students?.class_name ?? "",
    }));

    // Alerts / notifications
    const alerts: { id: string; kind: "danger" | "warn" | "info"; title: string; detail: string; href?: string }[] = [];
    if (buckets.count > 0) {
      const total = buckets.d0_7 + buckets.d8_30 + buckets.d31_60 + buckets.d60p;
      alerts.push({
        id: "overdue",
        kind: "danger",
        title: `${buckets.count} overdue invoice${buckets.count === 1 ? "" : "s"}`,
        detail: `${total.toLocaleString()} FCFA past due`,
        href: "/finance",
      });
    }
    if (exeatsOverdue > 0) {
      alerts.push({
        id: "exeats",
        kind: "danger",
        title: `${exeatsOverdue} exeat${exeatsOverdue === 1 ? "" : "s"} overdue`,
        detail: "Boarders past return time",
        href: "/boarding",
      });
    }
    if (active.length > 0 && attendanceCoverage < 60) {
      alerts.push({
        id: "att",
        kind: "warn",
        title: "Attendance not taken today",
        detail: `Only ${attendanceCoverage}% of active students marked`,
        href: "/attendance",
      });
    }
    for (const b of lowStock.data ?? []) {
      alerts.push({
        id: `book-${b.id}`,
        kind: "info",
        title: `Low stock: ${b.title}`,
        detail: `${b.available_copies}/${b.total_copies} copies available`,
        href: "/library",
      });
    }

    return {
      totalEnrolment: students.length,
      activeEnrolment: active.length,
      classCount: classes.size,
      avgAttendance,
      outstandingBalance: totalBalance,
      feeCollectionRate,
      openApplicants,
      pipeline,
      today: {
        collectedToday,
        paymentsCountToday,
        presentToday,
        absentToday,
        lateToday,
        markedToday,
        attendanceCoverage,
        exeatsOut: exeatsOutCount,
        exeatsOverdue,
      },
      feeByClass,
      aging: buckets,
      upcoming,
      recent,
      alerts,
    };
  });