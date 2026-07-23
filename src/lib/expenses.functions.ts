import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type ExpenseMethod = "cash" | "momo" | "bank" | "cheque" | "other";
export type ExpenseStatus = "pending" | "approved" | "rejected";

export const listExpenseCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertExpenseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; description?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = { school_id: schoolId, name: data.name, description: data.description ?? null };
    const { error } = data.id
      ? await supabase.from("expense_categories").update(row).eq("id", data.id)
      : await supabase.from("expense_categories").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpenseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("expense_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; phone?: string; email?: string; note?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = {
      school_id: schoolId,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      note: data.note ?? null,
    };
    const { error } = data.id
      ? await supabase.from("vendors").update(row).eq("id", data.id)
      : await supabase.from("vendors").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string; status?: ExpenseStatus | "all"; categoryId?: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("expenses")
      .select("*, expense_categories(name), vendors(name)")
      .eq("school_id", schoolId)
      .order("spent_at", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.from) q = q.gte("spent_at", data.from);
    if (data.to) q = q.lte("spent_at", data.to);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    label: string;
    amount_fcfa: number;
    method: ExpenseMethod;
    category_id?: string | null;
    vendor_id?: string | null;
    reference?: string;
    note?: string;
    spent_at?: string;
    status?: ExpenseStatus;
    receipt_url?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = {
      school_id: schoolId,
      label: data.label,
      amount_fcfa: data.amount_fcfa,
      method: data.method,
      category_id: data.category_id ?? null,
      vendor_id: data.vendor_id ?? null,
      reference: data.reference ?? null,
      note: data.note ?? null,
      spent_at: data.spent_at ?? new Date().toISOString(),
      status: data.status ?? "approved",
      recorded_by: userId,
      receipt_url: data.receipt_url ?? null,
    };
    const { error } = data.id
      ? await supabase.from("expenses").update(row).eq("id", data.id)
      : await supabase.from("expenses").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setExpenseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: ExpenseStatus }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("expenses")
      .update({
        status: data.status,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cashPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) {
      return {
        totals: { collected: 0, expenses: 0, payroll: 0, net: 0, pendingExpenses: 0 },
        byMethodIn: [], byMethodOut: [], byCategory: [], byMonth: [],
      };
    }
    const from = data.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
    const to = data.to ?? new Date().toISOString();

    const [pays, exps, runs, pending] = await Promise.all([
      supabase.from("payments").select("amount_fcfa, method, paid_at")
        .eq("school_id", schoolId).gte("paid_at", from).lte("paid_at", to),
      supabase.from("expenses").select("amount_fcfa, method, spent_at, status, expense_categories(name)")
        .eq("school_id", schoolId).eq("status", "approved").gte("spent_at", from).lte("spent_at", to),
      supabase.from("payroll_runs").select("total_net_fcfa, status, period")
        .eq("school_id", schoolId),
      supabase.from("expenses").select("amount_fcfa")
        .eq("school_id", schoolId).eq("status", "pending"),
    ]);

    const collected = (pays.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const expenses = (exps.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const payroll = (runs.data ?? [])
      .filter((r) => r.status === "finalized")
      .reduce((a, r) => a + (r.total_net_fcfa ?? 0), 0);
    const pendingExpenses = (pending.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);

    const inMap = new Map<string, number>();
    for (const p of pays.data ?? []) inMap.set(p.method, (inMap.get(p.method) ?? 0) + (p.amount_fcfa ?? 0));
    const outMap = new Map<string, number>();
    for (const e of exps.data ?? []) outMap.set(e.method, (outMap.get(e.method) ?? 0) + (e.amount_fcfa ?? 0));
    const catMap = new Map<string, number>();
    for (const e of exps.data ?? []) {
      const name = (e as { expense_categories?: { name?: string } }).expense_categories?.name ?? "Uncategorized";
      catMap.set(name, (catMap.get(name) ?? 0) + (e.amount_fcfa ?? 0));
    }
    const monthMap = new Map<string, { in: number; out: number }>();
    for (const p of pays.data ?? []) {
      const d = new Date(p.paid_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = monthMap.get(k) ?? { in: 0, out: 0 };
      m.in += p.amount_fcfa ?? 0;
      monthMap.set(k, m);
    }
    for (const e of exps.data ?? []) {
      const d = new Date(e.spent_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = monthMap.get(k) ?? { in: 0, out: 0 };
      m.out += e.amount_fcfa ?? 0;
      monthMap.set(k, m);
    }

    return {
      totals: { collected, expenses, payroll, net: collected - expenses - payroll, pendingExpenses },
      byMethodIn: [...inMap.entries()].map(([method, total]) => ({ method, total })),
      byMethodOut: [...outMap.entries()].map(([method, total]) => ({ method, total })),
      byCategory: [...catMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      byMonth: [...monthMap.entries()].sort().map(([month, v]) => ({ month, ...v })),
    };
  });