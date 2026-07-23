import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";
import type { ExpenseMethod } from "./expenses.functions";

export const listRecurring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*, expense_categories(name), vendors(name)")
      .eq("school_id", schoolId)
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; label: string; amount_fcfa: number; method: ExpenseMethod;
    category_id?: string | null; vendor_id?: string | null;
    day_of_month: number; active: boolean; note?: string;
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
      day_of_month: data.day_of_month,
      active: data.active,
      note: data.note ?? null,
    };
    const { error } = data.id
      ? await supabase.from("recurring_expenses").update(row).eq("id", data.id)
      : await supabase.from("recurring_expenses").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("recurring_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Generate pending expense rows for any active recurring items whose current-month row hasn't been created yet. */
export const runRecurringNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { data: items, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("school_id", schoolId)
      .eq("active", true);
    if (error) throw new Error(error.message);

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let created = 0;
    for (const item of items ?? []) {
      if (item.last_generated_period === period) continue;
      const day = Math.min(item.day_of_month, 28);
      const spentAt = new Date(now.getFullYear(), now.getMonth(), day).toISOString();
      const ins = await supabase.from("expenses").insert({
        school_id: schoolId,
        label: item.label + ` · ${period}`,
        amount_fcfa: item.amount_fcfa,
        method: item.method,
        category_id: item.category_id,
        vendor_id: item.vendor_id,
        note: item.note,
        spent_at: spentAt,
        status: "pending",
        recorded_by: userId,
      });
      if (ins.error) continue;
      await supabase.from("recurring_expenses").update({ last_generated_period: period }).eq("id", item.id);
      created++;
    }
    return { created };
  });