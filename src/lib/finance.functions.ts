import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";
import { openInvoicesFor, invoicesFor, allocateOldestFirst, studentCredit } from "./fee-allocation";

export type PaymentMethod = "cash" | "momo" | "bank" | "cheque" | "other";
export type FeeKind = "registration" | "tuition" | "other";
export type FeeInstallment = { label: string; amount_fcfa: number; due_date?: string | null };

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
  .inputValidator(
    (d: {
      id?: string;
      class_name: string;
      label: string;
      amount_fcfa: number;
      academic_year?: string;
      kind?: FeeKind;
      installments?: FeeInstallment[];
      required_at_registration?: boolean;
      due_date?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    // Enforce single tuition structure per class (allow editing existing one)
    if ((data.kind ?? "tuition") === "tuition") {
      const { data: existing } = await supabase
        .from("fee_structures")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_name", data.class_name)
        .eq("kind", "tuition");
      const others = (existing ?? []).filter((r) => r.id !== data.id);
      if (others.length > 0) {
        throw new Error(`A tuition fee already exists for ${data.class_name}. Edit the existing one instead of creating a new one.`);
      }
    }
    const installments = data.installments ?? [];
    const total = installments.length
      ? installments.reduce((s, i) => s + Number(i.amount_fcfa || 0), 0)
      : data.amount_fcfa;
    const row = {
      school_id: schoolId,
      class_name: data.class_name,
      label: data.label,
      amount_fcfa: total,
      academic_year: data.academic_year ?? null,
      kind: data.kind ?? "tuition",
      installments: installments as unknown as never,
      required_at_registration: data.required_at_registration ?? (data.kind === "registration"),
      due_date: data.due_date ?? null,
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
      .select("id, student_id, amount_fcfa, method, reference, note, paid_at, receipt_no, voided, void_reason, students(first_name,last_name,matricule,class_name)")
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
  .inputValidator((d: {
    student_id: string;
    amount_fcfa: number;
    method: PaymentMethod;
    reference?: string;
    note?: string;
    paid_at?: string;
    allocations?: { student_fee_id: string; amount_fcfa: number }[];
  }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    // Anti-fraud: require external reference for non-cash payments
    if (["momo", "bank", "cheque"].includes(data.method) && !(data.reference && data.reference.trim())) {
      throw new Error("A reference (transaction ID, cheque #, deposit slip) is required for non-cash payments.");
    }
    if (!(data.amount_fcfa > 0)) throw new Error("Amount must be greater than zero.");

    // Resolve the allocation plan BEFORE inserting the payment.
    const open = await openInvoicesFor(supabase, schoolId, data.student_id);
    const balanceById = new Map(open.map((i) => [i.id, i.balance_fcfa]));
    let plan: { student_fee_id: string; amount_fcfa: number }[] = [];
    if (data.allocations && data.allocations.length > 0) {
      for (const a of data.allocations) {
        const amt = Math.round(Number(a.amount_fcfa ?? 0));
        if (amt <= 0) continue;
        const bal = balanceById.get(a.student_fee_id);
        if (bal === undefined) throw new Error("An invoice in this payment does not belong to this student or is already settled.");
        if (amt > bal) throw new Error("Allocated amount exceeds the balance left on an invoice.");
        plan.push({ student_fee_id: a.student_fee_id, amount_fcfa: amt });
      }
      const sum = plan.reduce((s, p) => s + p.amount_fcfa, 0);
      if (sum > data.amount_fcfa) throw new Error("Allocations exceed the amount received.");
    } else {
      // Auto-allocate: registration first, then oldest due date.
      plan = allocateOldestFirst(open, data.amount_fcfa);
    }

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

    if (plan.length > 0 && inserted) {
      const { error: aErr } = await supabase.from("payment_allocations").insert(
        plan.map((p) => ({
          school_id: schoolId,
          payment_id: inserted.id,
          student_fee_id: p.student_fee_id,
          amount_fcfa: p.amount_fcfa,
        })),
      );
      if (aErr) throw new Error(`Payment saved but could not be applied to invoices: ${aErr.message}`);
    }
    const allocated = plan.reduce((s, p) => s + p.amount_fcfa, 0);
    return {
      ok: true,
      id: inserted?.id,
      receipt_no: inserted?.receipt_no,
      allocated,
      credit: Math.max(data.amount_fcfa - allocated, 0),
    };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    // Hard-delete is disabled to preserve the audit trail. Use voidPayment instead.
    void data;
    void context;
    throw new Error("Payments cannot be deleted. Void the payment instead (an auditable action).");
  });

// Void a payment: reversible only by re-recording. Requires a reason.
export const voidPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.reason || data.reason.trim().length < 4) throw new Error("A reason (≥ 4 chars) is required to void a payment.");
    const { data: existing, error: fErr } = await supabase
      .from("payments").select("id, voided, school_id, student_id, amount_fcfa, receipt_no").eq("id", data.id).single();
    if (fErr) throw new Error(fErr.message);
    if (existing.voided) throw new Error("This payment is already voided.");
    const { error } = await supabase
      .from("payments")
      .update({ voided: true, voided_at: new Date().toISOString(), voided_by: userId, void_reason: data.reason.trim() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.rpc("log_audit", {
      _school_id: existing.school_id,
      _action: "void_payment",
      _entity_type: "payment",
      _entity_id: data.id,
      _summary: `Voided receipt ${existing.receipt_no ?? data.id} for ${existing.amount_fcfa} FCFA — ${data.reason.trim()}`,
    });
    return { ok: true };
  });

// ─── Daily cash close ──────────────────────────────────────────────────────

export const dayReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const start = `${data.date}T00:00:00.000Z`;
    const end = `${data.date}T23:59:59.999Z`;
    const { data: pays } = await supabase
      .from("payments")
      .select("amount_fcfa, method, voided, receipt_no, students(first_name,last_name,class_name)")
      .eq("school_id", schoolId)
      .gte("paid_at", start).lte("paid_at", end);
    const totals = { cash: 0, momo: 0, bank: 0, cheque: 0, other: 0, count: 0, voided: 0 };
    for (const p of pays ?? []) {
      if (p.voided) { totals.voided += 1; continue; }
      totals.count += 1;
      const m = p.method as keyof typeof totals;
      if (m in totals) (totals[m] as number) += p.amount_fcfa ?? 0;
    }
    const { data: closure } = await supabase
      .from("cash_closures").select("*").eq("school_id", schoolId).eq("close_date", data.date).maybeSingle();
    return { totals, closure, payments: pays ?? [] };
  });

export const closeDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string; counted_cash?: number; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { data: canClose } = await supabase.rpc("can_record_payments" as never, { _user_id: userId, _school_id: schoolId } as never);
    if (!canClose) throw new Error("Only the Bursar or Principal can close the day.");
    const start = `${data.date}T00:00:00.000Z`;
    const end = `${data.date}T23:59:59.999Z`;
    const { data: pays } = await supabase
      .from("payments").select("amount_fcfa, method, voided")
      .eq("school_id", schoolId).gte("paid_at", start).lte("paid_at", end);
    const t = { cash: 0, momo: 0, bank: 0, cheque: 0, other: 0 };
    for (const p of pays ?? []) {
      if (p.voided) continue;
      const m = p.method as keyof typeof t;
      if (m in t) t[m] += p.amount_fcfa ?? 0;
    }
    const counted = data.counted_cash ?? t.cash;
    const variance = counted - t.cash;
    const { error } = await supabase.from("cash_closures").upsert({
      school_id: schoolId, close_date: data.date, closed_by: userId,
      cash_total: t.cash, momo_total: t.momo, bank_total: t.bank, cheque_total: t.cheque, other_total: t.other,
      expected_cash: counted, cash_variance: variance, notes: data.notes ?? null,
      closed_at: new Date().toISOString(),
    }, { onConflict: "school_id,close_date" });
    if (error) throw new Error(error.message);
    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: "close_day",
      _entity_type: "cash_closure",
      _entity_id: data.date,
      _summary: `Closed ${data.date}: cash ${t.cash}, momo ${t.momo}, bank ${t.bank}, cheque ${t.cheque}, variance ${variance}`,
    });
    return { ok: true, totals: t, variance };
  });

export const reopenDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { data: isPrincipal } = await supabase.rpc("has_role_in_school", {
      _user_id: userId, _school_id: schoolId, _role: "principal",
    });
    if (!isPrincipal) throw new Error("Only the Principal can re-open a closed day.");
    if (!data.reason || data.reason.trim().length < 4) throw new Error("A reason is required.");
    const { error } = await supabase.from("cash_closures")
      .delete().eq("school_id", schoolId).eq("close_date", data.date);
    if (error) throw new Error(error.message);
    await supabase.rpc("log_audit", {
      _school_id: schoolId,
      _action: "reopen_day",
      _entity_type: "cash_closure",
      _entity_id: data.date,
      _summary: `Re-opened ${data.date} — ${data.reason.trim()}`,
    });
    return { ok: true };
  });

export const financeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { collected: 0, outstanding: 0, students: 0, thisMonth: 0 };
    const [pays, studs] = await Promise.all([
      supabase.from("payments").select("amount_fcfa, paid_at").eq("school_id", schoolId).eq("voided", false),
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
      .from("student_fee_status")
      .select("id, student_id, fee_structure_id, label, kind, amount_fcfa, discount_fcfa, net_fcfa, paid_fcfa, balance_fcfa, status, academic_year, due_date, note, created_at")
      .eq("school_id", schoolId)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (data.studentId) q = q.eq("student_id", data.studentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.student_id as string)));
    const { data: studs } = ids.length
      ? await supabase.from("students").select("id, first_name, last_name, matricule, class_name").in("id", ids)
      : { data: [] as { id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null }[] };
    const map = new Map((studs ?? []).map((s) => [s.id, s]));
    const withStudent = (rows ?? []).map((r) => ({ ...r, students: map.get(r.student_id as string) ?? null }));
    return data.className
      ? withStudent.filter((r) => r.students?.class_name === data.className)
      : withStudent;
  });

/** Open invoices + credit on account for the payment dialog. */
export const getStudentBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { invoices: [], open: [], credit: 0, outstanding: 0 };
    const all = await invoicesFor(supabase, schoolId, data.studentId);
    const credit = await studentCredit(supabase, data.studentId);
    const open = all.filter((i) => i.balance_fcfa > 0);
    return {
      invoices: all,
      open,
      credit,
      outstanding: open.reduce((s, i) => s + i.balance_fcfa, 0),
    };
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