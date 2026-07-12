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
  .inputValidator((d: { studentId?: string; limit?: number; method?: PaymentMethod | "all"; from?: string; to?: string; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("payments")
      .select("id, student_id, amount_fcfa, method, reference, note, paid_at, receipt_no, students(first_name,last_name,matricule,class_name)")
      .eq("school_id", schoolId)
      .order("paid_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.studentId) q = q.eq("student_id", data.studentId);
    if (data.method && data.method !== "all") q = q.eq("method", data.method);
    if (data.from) q = q.gte("paid_at", data.from);
    if (data.to) q = q.lte("paid_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const search = (data.q ?? "").trim().toLowerCase();
    if (!search) return rows ?? [];
    return (rows ?? []).filter((r) => {
      const s = (r as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
      const hay = `${s?.first_name ?? ""} ${s?.last_name ?? ""} ${s?.matricule ?? ""} ${s?.class_name ?? ""} ${r.reference ?? ""} ${r.receipt_no ?? ""}`.toLowerCase();
      return hay.includes(search);
    });
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string; amount_fcfa: number; method: PaymentMethod; reference?: string; note?: string; paid_at?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { data: inserted, error } = await supabase.from("payments").insert({
      school_id: schoolId,
      student_id: data.student_id,
      amount_fcfa: data.amount_fcfa,
      method: data.method,
      reference: data.reference ?? null,
      note: data.note ?? null,
      paid_at: data.paid_at ?? new Date().toISOString(),
      recorded_by: userId,
    }).select("id, receipt_no").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id, receipt_no: inserted?.receipt_no };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      supabase.from("students").select("fee_balance").eq("school_id", schoolId).eq("status", "active"),
    ]);
    const collected = (pays.data ?? []).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = (pays.data ?? []).filter((r) => r.paid_at >= monthStart).reduce((a, r) => a + (r.amount_fcfa ?? 0), 0);
    const outstanding = (studs.data ?? []).reduce((a, r) => a + (r.fee_balance ?? 0), 0);
    return { collected, outstanding, students: studs.data?.length ?? 0, thisMonth };
  });

// ─── Invoices (student_fees) ────────────────────────────────────────────────

export const listStudentFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId?: string; className?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("student_fees")
      .select("id, student_id, fee_structure_id, label, amount_fcfa, discount_fcfa, academic_year, due_date, note, created_at, students(first_name,last_name,matricule,class_name)")
      .eq("school_id", schoolId)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (data.studentId) q = q.eq("student_id", data.studentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const filtered = data.className
      ? (rows ?? []).filter((r) => (r as { students?: { class_name?: string } }).students?.class_name === data.className)
      : (rows ?? []);
    return filtered;
  });

export const upsertStudentFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; student_id: string; fee_structure_id?: string | null; label: string; amount_fcfa: number; discount_fcfa?: number; academic_year?: string; due_date?: string; note?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const row = {
      school_id: schoolId,
      student_id: data.student_id,
      fee_structure_id: data.fee_structure_id ?? null,
      label: data.label,
      amount_fcfa: data.amount_fcfa,
      discount_fcfa: data.discount_fcfa ?? 0,
      academic_year: data.academic_year ?? null,
      due_date: data.due_date ?? null,
      note: data.note ?? null,
      created_by: userId,
    };
    const { error } = data.id
      ? await supabase.from("student_fees").update(row).eq("id", data.id)
      : await supabase.from("student_fees").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("student_fees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkAssignFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { class_name: string; fee_structure_id?: string; label?: string; amount_fcfa?: number; academic_year?: string; due_date?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    let label = data.label;
    let amount = data.amount_fcfa;
    let year = data.academic_year;
    if (data.fee_structure_id) {
      const { data: fs } = await supabase.from("fee_structures")
        .select("label, amount_fcfa, academic_year")
        .eq("id", data.fee_structure_id).single();
      if (fs) { label = label ?? fs.label; amount = amount ?? fs.amount_fcfa; year = year ?? fs.academic_year ?? undefined; }
    }
    if (!label || !amount) throw new Error("Missing label or amount");

    const { data: students, error: se } = await supabase
      .from("students").select("id")
      .eq("school_id", schoolId).eq("class_name", data.class_name).eq("status", "active");
    if (se) throw new Error(se.message);
    if (!students?.length) return { ok: true, count: 0 };

    const rows = students.map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      fee_structure_id: data.fee_structure_id ?? null,
      label: label!,
      amount_fcfa: amount!,
      discount_fcfa: 0,
      academic_year: year ?? null,
      due_date: data.due_date ?? null,
      created_by: userId,
    }));
    const { error } = await supabase.from("student_fees").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const getPaymentReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { data: p, error } = await supabase
      .from("payments")
      .select("id, amount_fcfa, method, reference, note, paid_at, receipt_no, student_id, students(first_name,last_name,matricule,class_name,fee_balance)")
      .eq("id", data.id).eq("school_id", schoolId).single();
    if (error) throw new Error(error.message);
    const { data: school } = await supabase
      .from("schools").select("name, code, city, region, motto").eq("id", schoolId).single();
    const { data: cashier } = await supabase
      .from("profiles").select("full_name").eq("id", userId).maybeSingle();
    return { payment: p, school, cashier };
  });

export const recomputeAllBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { data: students } = await supabase.from("students").select("id").eq("school_id", schoolId);
    for (const s of students ?? []) {
      await supabase.rpc("recompute_student_balance", { _student_id: s.id });
    }
    return { ok: true, count: students?.length ?? 0 };
  });