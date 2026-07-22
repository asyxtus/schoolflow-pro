import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type AgingBucket = "current" | "1_7" | "8_30" | "31_60" | "60_plus";

function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 7) return "1_7";
  if (daysOverdue <= 30) return "8_30";
  if (daysOverdue <= 60) return "31_60";
  return "60_plus";
}

export const listFeesAging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { className?: string; bucket?: AgingBucket | "all"; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { rows: [], totals: { current: 0, "1_7": 0, "8_30": 0, "31_60": 0, "60_plus": 0, total: 0 } };

    // Load students with a balance and their guardians
    const { data: students, error: se } = await supabase
      .from("students")
      .select("id, first_name, last_name, matricule, class_name, fee_balance, guardian_phone, guardian_name, guardians(full_name, phone, relationship)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .gt("fee_balance", 0)
      .order("fee_balance", { ascending: false });
    if (se) throw new Error(se.message);

    // Load unpaid-ish student_fees to compute earliest overdue date per student
    const { data: fees, error: fe } = await supabase
      .from("student_fees")
      .select("student_id, amount_fcfa, discount_fcfa, due_date")
      .eq("school_id", schoolId)
      .not("due_date", "is", null);
    if (fe) throw new Error(fe.message);

    const now = new Date();
    const earliestOverdue = new Map<string, string>();
    for (const f of fees ?? []) {
      if (!f.due_date) continue;
      const d = new Date(f.due_date);
      if (d > now) continue;
      const prev = earliestOverdue.get(f.student_id);
      if (!prev || new Date(prev) > d) earliestOverdue.set(f.student_id, f.due_date);
    }

    type Row = {
      id: string; first_name: string; last_name: string; matricule: string | null;
      class_name: string | null; fee_balance: number;
      guardian_name: string | null; guardian_phone: string | null; guardian_relationship: string | null;
      earliest_due: string | null; days_overdue: number; bucket: AgingBucket;
    };

    const rows: Row[] = (students ?? []).map((s) => {
      const g = (s.guardians as { full_name?: string; phone?: string; relationship?: string }[] | null)?.[0];
      const earliest = earliestOverdue.get(s.id) ?? null;
      const days = earliest ? Math.floor((now.getTime() - new Date(earliest).getTime()) / 86400000) : 0;
      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        matricule: s.matricule,
        class_name: s.class_name,
        fee_balance: s.fee_balance ?? 0,
        guardian_name: g?.full_name ?? s.guardian_name ?? null,
        guardian_phone: g?.phone ?? s.guardian_phone ?? null,
        guardian_relationship: g?.relationship ?? null,
        earliest_due: earliest,
        days_overdue: Math.max(days, 0),
        bucket: bucketFor(days),
      };
    });

    const totals = { current: 0, "1_7": 0, "8_30": 0, "31_60": 0, "60_plus": 0, total: 0 };
    for (const r of rows) {
      totals[r.bucket] += r.fee_balance;
      totals.total += r.fee_balance;
    }

    let filtered = rows;
    if (data.className) filtered = filtered.filter((r) => r.class_name === data.className);
    if (data.bucket && data.bucket !== "all") filtered = filtered.filter((r) => r.bucket === data.bucket);
    const search = (data.q ?? "").trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((r) =>
        `${r.first_name} ${r.last_name} ${r.matricule ?? ""} ${r.class_name ?? ""} ${r.guardian_name ?? ""} ${r.guardian_phone ?? ""}`
          .toLowerCase().includes(search)
      );
    }

    return { rows: filtered, totals };
  });