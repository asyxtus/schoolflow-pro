import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type WalletMethod = "cash" | "momo" | "bank" | "cheque" | "other";
export type WalletKind = "deposit" | "withdrawal";

export const walletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { totalBalance: 0, students: 0, depositsThisMonth: 0, withdrawalsThisMonth: 0 };
    const [studs, txs] = await Promise.all([
      supabase.from("students").select("wallet_balance").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("wallet_transactions").select("kind, amount_fcfa, occurred_at").eq("school_id", schoolId),
    ]);
    const totalBalance = (studs.data ?? []).reduce((a, r) => a + (r.wallet_balance ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let depositsThisMonth = 0, withdrawalsThisMonth = 0;
    for (const t of txs.data ?? []) {
      if (t.occurred_at < monthStart) continue;
      if (t.kind === "deposit") depositsThisMonth += t.amount_fcfa;
      else withdrawalsThisMonth += t.amount_fcfa;
    }
    return { totalBalance, students: studs.data?.length ?? 0, depositsThisMonth, withdrawalsThisMonth };
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId?: string; kind?: WalletKind | "all"; from?: string; to?: string; q?: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("wallet_transactions")
      .select("id, student_id, kind, amount_fcfa, method, reference, note, occurred_at, students(first_name,last_name,matricule,class_name)")
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
      const st = (r as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
      const hay = `${st?.first_name ?? ""} ${st?.last_name ?? ""} ${st?.matricule ?? ""} ${st?.class_name ?? ""} ${r.reference ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  });

export const recordWalletTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string; kind: WalletKind; amount_fcfa: number; method: WalletMethod; reference?: string; note?: string; occurred_at?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (data.kind === "withdrawal") {
      const { data: st } = await supabase.from("students").select("wallet_balance, first_name, last_name").eq("id", data.student_id).single();
      if (!st) throw new Error("Student not found");
      if ((st.wallet_balance ?? 0) < data.amount_fcfa) {
        throw new Error(`Insufficient wallet balance for ${st.first_name} ${st.last_name}`);
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
      .select("id, first_name, last_name, matricule, class_name, wallet_balance")
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
      `${r.first_name} ${r.last_name} ${r.matricule ?? ""}`.toLowerCase().includes(s)
    );
  });
