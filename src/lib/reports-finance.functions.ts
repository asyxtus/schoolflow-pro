import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const financeReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) {
      return {
        totals: { collected: 0, invoiced: 0, outstanding: 0, wallet: 0, payroll: 0, transport: 0, incidents: 0 },
        byMethod: [], byMonth: [], byClass: [], recent: [],
      };
    }
    const from = data.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
    const to = data.to ?? new Date().toISOString();

    const [pays, fees, studs, wallet, runs, subs, incidents] = await Promise.all([
      supabase.from("payments")
        .select("id, amount_fcfa, method, paid_at, receipt_no, students(first_name,last_name,class_name)")
        .eq("school_id", schoolId).gte("paid_at", from).lte("paid_at", to)
        .order("paid_at", { ascending: false }),
      supabase.from("student_fees").select("amount_fcfa, discount_fcfa, students(class_name)").eq("school_id", schoolId),
      supabase.from("students").select("class_name, fee_balance").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("students").select("wallet_balance").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("payroll_runs").select("total_net_fcfa, period_start, status").eq("school_id", schoolId),
      supabase.from("transport_subscriptions").select("monthly_fee_fcfa").eq("school_id", schoolId).eq("status", "active"),
      supabase.from("transport_incidents").select("cost_fcfa").eq("school_id", schoolId),
    ]);

    const collected = (pays.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const invoiced = (fees.data ?? []).reduce((a, r) => a + Math.max((r.amount_fcfa ?? 0) - (r.discount_fcfa ?? 0), 0), 0);
    const outstanding = (studs.data ?? []).reduce((a, r) => a + (r.fee_balance ?? 0), 0);
    const walletTotal = (wallet.data ?? []).reduce((a, r) => a + (r.wallet_balance ?? 0), 0);
    const payroll = (runs.data ?? []).reduce((a, r) => a + (r.total_net_fcfa ?? 0), 0);
    const transport = (subs.data ?? []).reduce((a, r) => a + (r.monthly_fee_fcfa ?? 0), 0);
    const incidentCost = (incidents.data ?? []).reduce((a, r) => a + (r.cost_fcfa ?? 0), 0);

    // By method
    const methodMap = new Map<string, number>();
    for (const p of pays.data ?? []) methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + (p.amount_fcfa ?? 0));
    const byMethod = [...methodMap.entries()].map(([method, total]) => ({ method, total }));

    // By month
    const monthMap = new Map<string, number>();
    for (const p of pays.data ?? []) {
      const d = new Date(p.paid_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(k, (monthMap.get(k) ?? 0) + (p.amount_fcfa ?? 0));
    }
    const byMonth = [...monthMap.entries()].sort().map(([month, total]) => ({ month, total }));

    // By class
    const classMap = new Map<string, { collected: number; outstanding: number }>();
    for (const p of pays.data ?? []) {
      const cn = (p as { students?: { class_name?: string } }).students?.class_name ?? "—";
      const c = classMap.get(cn) ?? { collected: 0, outstanding: 0 };
      c.collected += p.amount_fcfa ?? 0;
      classMap.set(cn, c);
    }
    for (const s of studs.data ?? []) {
      const cn = s.class_name ?? "—";
      const c = classMap.get(cn) ?? { collected: 0, outstanding: 0 };
      c.outstanding += s.fee_balance ?? 0;
      classMap.set(cn, c);
    }
    const byClass = [...classMap.entries()].map(([class_name, v]) => ({ class_name, ...v })).sort((a, b) => b.collected - a.collected);

    return {
      totals: { collected, invoiced, outstanding, wallet: walletTotal, payroll, transport, incidents: incidentCost },
      byMethod, byMonth, byClass,
      recent: (pays.data ?? []).slice(0, 20),
    };
  });