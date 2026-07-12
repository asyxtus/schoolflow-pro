import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type PaymentMethod = "cash" | "momo" | "bank" | "cheque" | "other";

export const listFeeStructures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("fee_structures")
      .select("*")
      .eq("school_id", schoolId)
      .order("class_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertFeeStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; class_name: string; label: string; amount_fcfa: number; academic_year?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = {
      school_id: schoolId,
      class_name: data.class_name,
      label: data.label,
      amount_fcfa: data.amount_fcfa,
      academic_year: data.academic_year ?? null,
    };
    const { error } = data.id
      ? await supabase.from("fee_structures").update(row).eq("id", data.id)
      : await supabase.from("fee_structures").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFeeStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("fee_structures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId?: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("payments")
      .select("id, student_id, amount_fcfa, method, reference, note, paid_at, students(first_name,last_name,matricule,class_name)")
      .eq("school_id", schoolId)
      .order("paid_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.studentId) q = q.eq("student_id", data.studentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string; amount_fcfa: number; method: PaymentMethod; reference?: string; note?: string; paid_at?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("payments").insert({
      school_id: schoolId,
      student_id: data.student_id,
      amount_fcfa: data.amount_fcfa,
      method: data.method,
      reference: data.reference ?? null,
      note: data.note ?? null,
      paid_at: data.paid_at ?? new Date().toISOString(),
      recorded_by: userId,
    });
    if (error) throw new Error(error.message);
    // Update student balance snapshot
    const { data: s } = await supabase.from("students").select("balance_fcfa").eq("id", data.student_id).single();
    if (s) {
      const next = Math.max(0, (s.balance_fcfa ?? 0) - data.amount_fcfa);
      await supabase.from("students").update({ balance_fcfa: next }).eq("id", data.student_id);
    }
    return { ok: true };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: p } = await supabase.from("payments").select("student_id, amount_fcfa").eq("id", data.id).single();
    const { error } = await supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (p) {
      const { data: s } = await supabase.from("students").select("balance_fcfa").eq("id", p.student_id).single();
      if (s) {
        await supabase.from("students").update({ balance_fcfa: (s.balance_fcfa ?? 0) + p.amount_fcfa }).eq("id", p.student_id);
      }
    }
    return { ok: true };
  });

export const financeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { collected: 0, outstanding: 0, students: 0, thisMonth: 0 };
    const [pays, studs] = await Promise.all([
      supabase.from("payments").select("amount_fcfa, paid_at").eq("school_id", schoolId),
      supabase.from("students").select("balance_fcfa").eq("school_id", schoolId).eq("status", "active"),
    ]);
    const collected = (pays.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = (pays.data ?? []).filter((r) => r.paid_at >= monthStart).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const outstanding = (studs.data ?? []).reduce((a, r) => a + (r.balance_fcfa ?? 0), 0);
    return { collected, outstanding, students: studs.data?.length ?? 0, thisMonth };
  });