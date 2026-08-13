import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type WalletMethod = "cash" | "momo" | "bank" | "cheque" | "other";
export type WalletKind = "deposit" | "withdrawal";

export type WalletLimits = {
  per_txn: number | null;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
};

function startOf(kind: "day" | "week" | "month"): string {
  const now = new Date();
  if (kind === "day")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (kind === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday start
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const walletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId)
      return { totalBalance: 0, students: 0, depositsThisMonth: 0, withdrawalsThisMonth: 0 };
    const [studs, txs] = await Promise.all([
      supabase
        .from("students")
        .select("wallet_balance")
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("wallet_transactions")
        .select("kind, amount_fcfa, occurred_at")
        .eq("school_id", schoolId),
    ]);
    const totalBalance = (studs.data ?? []).reduce((a, r) => a + (r.wallet_balance ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let depositsThisMonth = 0,
      withdrawalsThisMonth = 0;
    for (const t of txs.data ?? []) {
      if (t.occurred_at < monthStart) continue;
      if (t.kind === "deposit") depositsThisMonth += t.amount_fcfa;
      else withdrawalsThisMonth += t.amount_fcfa;
    }
    return {
      totalBalance,
      students: studs.data?.length ?? 0,
      depositsThisMonth,
      withdrawalsThisMonth,
    };
  });

export const getSchoolWalletDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;
    const { data } = await supabase
      .from("schools")
      .select(
        "wallet_default_per_txn_limit, wallet_default_daily_limit, wallet_default_weekly_limit, wallet_default_monthly_limit",
      )
      .eq("id", schoolId)
      .single();
    return {
      per_txn: data?.wallet_default_per_txn_limit ?? null,
      daily: data?.wallet_default_daily_limit ?? null,
      weekly: data?.wallet_default_weekly_limit ?? null,
      monthly: data?.wallet_default_monthly_limit ?? null,
    } as WalletLimits;
  });

export const updateSchoolWalletDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: WalletLimits) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase
      .from("schools")
      .update({
        wallet_default_per_txn_limit: data.per_txn,
        wallet_default_daily_limit: data.daily,
        wallet_default_weekly_limit: data.weekly,
        wallet_default_monthly_limit: data.monthly,
      })
      .eq("id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStudentWalletLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string } & WalletLimits) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("students")
      .update({
        wallet_per_txn_limit: data.per_txn,
        wallet_daily_limit: data.daily,
        wallet_weekly_limit: data.weekly,
        wallet_monthly_limit: data.monthly,
      })
      .eq("id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStudentWalletContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const [{ data: st }, { data: sch }] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, first_name, last_name, wallet_balance, wallet_per_txn_limit, wallet_daily_limit, wallet_weekly_limit, wallet_monthly_limit",
        )
        .eq("id", data.student_id)
        .single(),
      supabase
        .from("schools")
        .select(
          "wallet_default_per_txn_limit, wallet_default_daily_limit, wallet_default_weekly_limit, wallet_default_monthly_limit",
        )
        .eq("id", schoolId)
        .single(),
    ]);
    if (!st) throw new Error("Student not found");
    const overrides: WalletLimits = {
      per_txn: st.wallet_per_txn_limit ?? null,
      daily: st.wallet_daily_limit ?? null,
      weekly: st.wallet_weekly_limit ?? null,
      monthly: st.wallet_monthly_limit ?? null,
    };
    const defaults: WalletLimits = {
      per_txn: sch?.wallet_default_per_txn_limit ?? null,
      daily: sch?.wallet_default_daily_limit ?? null,
      weekly: sch?.wallet_default_weekly_limit ?? null,
      monthly: sch?.wallet_default_monthly_limit ?? null,
    };
    const effective: WalletLimits = {
      per_txn: overrides.per_txn ?? defaults.per_txn,
      daily: overrides.daily ?? defaults.daily,
      weekly: overrides.weekly ?? defaults.weekly,
      monthly: overrides.monthly ?? defaults.monthly,
    };
    const [dayStart, weekStart, monthStart] = [startOf("day"), startOf("week"), startOf("month")];
    const { data: recent } = await supabase
      .from("wallet_transactions")
      .select("amount_fcfa, occurred_at, kind")
      .eq("student_id", data.student_id)
      .eq("kind", "withdrawal")
      .gte("occurred_at", monthStart);
    const usage = {
      day: { count: 0, sum: 0 },
      week: { count: 0, sum: 0 },
      month: { count: 0, sum: 0 },
    };
    for (const r of recent ?? []) {
      usage.month.count++;
      usage.month.sum += r.amount_fcfa;
      if (r.occurred_at >= weekStart) {
        usage.week.count++;
        usage.week.sum += r.amount_fcfa;
      }
      if (r.occurred_at >= dayStart) {
        usage.day.count++;
        usage.day.sum += r.amount_fcfa;
      }
    }
    return { student: st, overrides, defaults, effective, usage };
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      studentId?: string;
      kind?: WalletKind | "all";
      from?: string;
      to?: string;
      q?: string;
      limit?: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("wallet_transactions")
      .select(
        "id, student_id, kind, amount_fcfa, method, reference, note, occurred_at, students(first_name,last_name,matricule,class_name)",
      )
      .eq("school_id", schoolId)
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.studentId) q = q.eq("student_id", data.studentId);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const s = (data.q ?? "").trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r) => {
      const st = (
        r as {
          students?: {
            first_name?: string;
            last_name?: string;
            matricule?: string;
            class_name?: string;
          };
        }
      ).students;
      const hay =
        `${st?.first_name ?? ""} ${st?.last_name ?? ""} ${st?.matricule ?? ""} ${st?.class_name ?? ""} ${r.reference ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  });

export const recordWalletTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      student_id: string;
      kind: WalletKind;
      amount_fcfa: number;
      method: WalletMethod;
      reference?: string;
      note?: string;
      occurred_at?: string;
      guardian_approved?: boolean;
      guardian_approval_note?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    let overLimit = false;
    if (data.kind === "withdrawal") {
      const { data: st } = await supabase
        .from("students")
        .select("wallet_balance, first_name, last_name")
        .eq("id", data.student_id)
        .single();
      if (!st) throw new Error("Student not found");
      if ((st.wallet_balance ?? 0) < data.amount_fcfa) {
        throw new Error(`Insufficient wallet balance for ${st.first_name} ${st.last_name}`);
      }
      // Compute effective limits and current usage
      const [{ data: stLim }, { data: sch }] = await Promise.all([
        supabase
          .from("students")
          .select(
            "wallet_per_txn_limit, wallet_daily_limit, wallet_weekly_limit, wallet_monthly_limit",
          )
          .eq("id", data.student_id)
          .single(),
        supabase
          .from("schools")
          .select(
            "wallet_default_per_txn_limit, wallet_default_daily_limit, wallet_default_weekly_limit, wallet_default_monthly_limit",
          )
          .eq("id", schoolId)
          .single(),
      ]);
      const eff = {
        per_txn: stLim?.wallet_per_txn_limit ?? sch?.wallet_default_per_txn_limit ?? null,
        daily: stLim?.wallet_daily_limit ?? sch?.wallet_default_daily_limit ?? null,
        weekly: stLim?.wallet_weekly_limit ?? sch?.wallet_default_weekly_limit ?? null,
        monthly: stLim?.wallet_monthly_limit ?? sch?.wallet_default_monthly_limit ?? null,
      };
      const reasons: string[] = [];
      if (eff.per_txn != null && data.amount_fcfa > eff.per_txn)
        reasons.push(`exceeds per-transaction limit (${eff.per_txn} FCFA)`);
      if (eff.daily != null || eff.weekly != null || eff.monthly != null) {
        const { data: recent } = await supabase
          .from("wallet_transactions")
          .select("amount_fcfa, occurred_at")
          .eq("student_id", data.student_id)
          .eq("kind", "withdrawal")
          .gte("occurred_at", startOf("month"));
        const day = startOf("day"),
          week = startOf("week");
        let dCount = 0,
          wCount = 0,
          mCount = 0;
        for (const r of recent ?? []) {
          mCount++;
          if (r.occurred_at >= week) wCount++;
          if (r.occurred_at >= day) dCount++;
        }
        if (eff.daily != null && dCount + 1 > eff.daily)
          reasons.push(`exceeds daily frequency (${eff.daily}/day)`);
        if (eff.weekly != null && wCount + 1 > eff.weekly)
          reasons.push(`exceeds weekly frequency (${eff.weekly}/week)`);
        if (eff.monthly != null && mCount + 1 > eff.monthly)
          reasons.push(`exceeds monthly frequency (${eff.monthly}/month)`);
      }
      if (reasons.length > 0) {
        overLimit = true;
        if (!data.guardian_approved) {
          throw new Error(`Guardian approval required: ${reasons.join("; ")}.`);
        }
        if (!data.guardian_approval_note?.trim()) {
          throw new Error("Please record how the guardian approved (phone call, in person, etc.).");
        }
      }
    }
    const { error } = await supabase.from("wallet_transactions").insert({
      school_id: schoolId,
      student_id: data.student_id,
      kind: data.kind,
      amount_fcfa: data.amount_fcfa,
      method: data.method,
      reference: data.reference ?? null,
      note: data.note ?? null,
      occurred_at: data.occurred_at ?? new Date().toISOString(),
      recorded_by: userId,
      over_limit: overLimit,
      guardian_approved: data.kind === "withdrawal" ? !!data.guardian_approved : false,
      guardian_approval_note: data.guardian_approval_note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWalletTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("wallet_transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStudentWalletBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { className?: string; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("students")
      .select(
        "id, first_name, last_name, matricule, class_name, wallet_balance, wallet_per_txn_limit, wallet_daily_limit, wallet_weekly_limit, wallet_monthly_limit",
      )
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("class_name")
      .order("last_name");
    if (data.className) q = q.eq("class_name", data.className);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const s = (data.q ?? "").trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r) =>
      `${r.first_name} ${r.last_name} ${r.matricule ?? ""}`.toLowerCase().includes(s),
    );
  });
