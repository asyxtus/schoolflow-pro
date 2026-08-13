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
    if (!schoolId)
      return {
        rows: [],
        totals: { current: 0, "1_7": 0, "8_30": 0, "31_60": 0, "60_plus": 0, total: 0 },
      };

    // Students (active) + guardians
    const { data: students, error: se } = await supabase
      .from("students")
      .select(
        "id, first_name, last_name, matricule, class_name, fee_balance, guardians(full_name, phone, relationship)",
      )
      .eq("school_id", schoolId)
      .eq("status", "active");
    if (se) throw new Error(se.message);

    // Every invoice with a remaining balance — aged individually by its own due date
    const { data: fees, error: fe } = await supabase
      .from("student_fee_status")
      .select("student_id, label, due_date, balance_fcfa")
      .eq("school_id", schoolId)
      .gt("balance_fcfa", 0);
    if (fe) throw new Error(fe.message);

    const now = new Date();
    const daysFor = (due: string | null) =>
      due ? Math.floor((now.getTime() - new Date(due).getTime()) / 86400000) : 0;

    // Per-student aggregation of per-invoice buckets
    const perStudent = new Map<
      string,
      { total: number; buckets: Record<AgingBucket, number>; earliest: string | null; days: number }
    >();
    for (const f of fees ?? []) {
      const sid = f.student_id as string;
      const bal = Number(f.balance_fcfa ?? 0);
      if (bal <= 0) continue;
      const days = daysFor(f.due_date as string | null);
      const b = bucketFor(days);
      const entry = perStudent.get(sid) ?? {
        total: 0,
        buckets: { current: 0, "1_7": 0, "8_30": 0, "31_60": 0, "60_plus": 0 },
        earliest: null,
        days: 0,
      };
      entry.total += bal;
      entry.buckets[b] += bal;
      if (
        days > 0 &&
        (!entry.earliest || new Date(entry.earliest) > new Date(f.due_date as string))
      ) {
        entry.earliest = f.due_date as string;
        entry.days = days;
      }
      perStudent.set(sid, entry);
    }

    type Row = {
      id: string;
      first_name: string;
      last_name: string;
      matricule: string | null;
      class_name: string | null;
      fee_balance: number;
      guardian_name: string | null;
      guardian_phone: string | null;
      guardian_relationship: string | null;
      earliest_due: string | null;
      days_overdue: number;
      bucket: AgingBucket;
    };

    const totals = { current: 0, "1_7": 0, "8_30": 0, "31_60": 0, "60_plus": 0, total: 0 };
    const rows: Row[] = (students ?? [])
      .map((s): Row | null => {
        const g = (
          s.guardians as { full_name?: string; phone?: string; relationship?: string }[] | null
        )?.[0];
        const e = perStudent.get(s.id);
        if (!e || e.total <= 0) return null;
        // Totals are aged per invoice, so a paid-up old invoice can't drag the whole debt into 60+.
        for (const k of ["current", "1_7", "8_30", "31_60", "60_plus"] as AgingBucket[])
          totals[k] += e.buckets[k];
        totals.total += e.total;
        // The student row is labelled by their worst (oldest) overdue invoice.
        const worst: AgingBucket =
          (["60_plus", "31_60", "8_30", "1_7", "current"] as AgingBucket[]).find(
            (k) => e.buckets[k] > 0,
          ) ?? "current";
        return {
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          matricule: s.matricule,
          class_name: s.class_name,
          fee_balance: e.total,
          guardian_name: g?.full_name ?? null,
          guardian_phone: g?.phone ?? null,
          guardian_relationship: g?.relationship ?? null,
          earliest_due: e.earliest,
          days_overdue: Math.max(e.days, 0),
          bucket: worst,
        };
      })
      .filter((r) => r !== null)
      .sort((a, b) => b.fee_balance - a.fee_balance);

    let filtered = rows;
    if (data.className) filtered = filtered.filter((r) => r.class_name === data.className);
    if (data.bucket && data.bucket !== "all")
      filtered = filtered.filter((r) => r.bucket === data.bucket);
    const search = (data.q ?? "").trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((r) =>
        `${r.first_name} ${r.last_name} ${r.matricule ?? ""} ${r.class_name ?? ""} ${r.guardian_name ?? ""} ${r.guardian_phone ?? ""}`
          .toLowerCase()
          .includes(search),
      );
    }

    return { rows: filtered, totals };
  });
