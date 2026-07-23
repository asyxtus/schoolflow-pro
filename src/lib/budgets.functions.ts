import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month?: number | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { rows: [] as Array<{ category_id: string; name: string; budget: number; spent: number }> };

    const [budgets, cats, exps] = await Promise.all([
      supabase.from("expense_budgets").select("*").eq("school_id", schoolId).eq("period_year", data.year),
      supabase.from("expense_categories").select("id,name").eq("school_id", schoolId).order("name"),
      supabase.from("expenses")
        .select("amount_fcfa, spent_at, category_id, status")
        .eq("school_id", schoolId).eq("status", "approved"),
    ]);
    if (budgets.error) throw new Error(budgets.error.message);
    if (cats.error) throw new Error(cats.error.message);
    if (exps.error) throw new Error(exps.error.message);

    const spentByCat = new Map<string, number>();
    for (const e of exps.data ?? []) {
      if (!e.category_id) continue;
      const d = new Date(e.spent_at);
      if (d.getFullYear() !== data.year) continue;
      if (data.month && d.getMonth() + 1 !== data.month) continue;
      spentByCat.set(e.category_id, (spentByCat.get(e.category_id) ?? 0) + (e.amount_fcfa ?? 0));
    }

    const rows = (cats.data ?? []).map((c) => {
      const budget = (budgets.data ?? []).find(
        (b) => b.category_id === c.id && (data.month ? b.period_month === data.month : b.period_month === null),
      );
      return {
        category_id: c.id,
        name: c.name,
        budget: budget?.amount_fcfa ?? 0,
        spent: spentByCat.get(c.id) ?? 0,
        budget_id: budget?.id ?? null,
      };
    });

    return { rows };
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { category_id: string; year: number; month: number | null; amount_fcfa: number }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = {
      school_id: schoolId,
      category_id: data.category_id,
      period_year: data.year,
      period_month: data.month,
      amount_fcfa: data.amount_fcfa,
    };
    const { error } = await supabase.from("expense_budgets").upsert(row, {
      onConflict: "school_id,category_id,period_year,period_month",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });