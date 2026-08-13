import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type StaffPosition =
  | "teacher"
  | "principal"
  | "vice_principal"
  | "bursar"
  | "secretary"
  | "discipline_master"
  | "librarian"
  | "nurse"
  | "driver"
  | "cook"
  | "cleaner"
  | "security"
  | "maintenance"
  | "other";
export type ContractType = "permanent" | "fixed_term" | "part_time" | "volunteer" | "intern";
export type StaffStatus = "active" | "on_leave" | "suspended" | "terminated";
export type PayrollStatus = "draft" | "finalized" | "paid";
export type PayslipStatus = "pending" | "paid";
export type PayMethod = "cash" | "bank" | "momo" | "check";

export type StaffInput = {
  id?: string;
  matricule?: string | null;
  first_name: string;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  national_id?: string | null;
  position: StaffPosition;
  department?: string | null;
  contract_type: ContractType;
  status: StaffStatus;
  hire_date?: string | null;
  end_date?: string | null;
  base_salary_fcfa: number;
  bank_name?: string | null;
  bank_account?: string | null;
  momo_number?: string | null;
  notes?: string | null;
};

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;
    const [staff, allowances] = await Promise.all([
      supabase.from("staff").select("*").eq("id", data.id).eq("school_id", schoolId).maybeSingle(),
      supabase.from("staff_allowances").select("*").eq("staff_id", data.id).order("created_at"),
    ]);
    if (staff.error) throw new Error(staff.error.message);
    return { staff: staff.data, allowances: allowances.data ?? [] };
  });

export const upsertStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StaffInput) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const payload = { ...data, school_id: schoolId };
    if (data.id) {
      const { error } = await supabase
        .from("staff")
        .update(payload)
        .eq("id", data.id)
        .eq("school_id", schoolId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("staff").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      staff_id: string;
      label: string;
      kind: "allowance" | "deduction";
      amount_fcfa: number;
      active?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const payload = { ...data, school_id: schoolId, active: data.active ?? true };
    if (data.id) {
      const { error } = await supabase.from("staff_allowances").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("staff_allowances")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("staff_allowances").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Payroll ---------- */

export const listPayrollRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("school_id", schoolId)
      .order("period", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period: string; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    // Create run
    const { data: run, error } = await supabase
      .from("payroll_runs")
      .insert({
        school_id: schoolId,
        period: data.period,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Load active staff + their allowances/deductions
    const [{ data: staff }, { data: allowances }] = await Promise.all([
      supabase
        .from("staff")
        .select("id, base_salary_fcfa")
        .eq("school_id", schoolId)
        .eq("status", "active"),
      supabase
        .from("staff_allowances")
        .select("staff_id, label, kind, amount_fcfa, active")
        .eq("school_id", schoolId)
        .eq("active", true),
    ]);
    const byStaff = new Map<
      string,
      {
        allowances: { label: string; amount: number }[];
        deductions: { label: string; amount: number }[];
      }
    >();
    for (const a of allowances ?? []) {
      const b = byStaff.get(a.staff_id) ?? { allowances: [], deductions: [] };
      if (a.kind === "deduction") b.deductions.push({ label: a.label, amount: a.amount_fcfa });
      else b.allowances.push({ label: a.label, amount: a.amount_fcfa });
      byStaff.set(a.staff_id, b);
    }

    const rows = (staff ?? []).map((s) => {
      const bucket = byStaff.get(s.id) ?? { allowances: [], deductions: [] };
      const allowTotal = bucket.allowances.reduce((x, y) => x + y.amount, 0);
      const dedTotal = bucket.deductions.reduce((x, y) => x + y.amount, 0);
      const gross = (s.base_salary_fcfa ?? 0) + allowTotal;
      const net = Math.max(gross - dedTotal, 0);
      return {
        school_id: schoolId,
        run_id: run.id,
        staff_id: s.id,
        base_salary_fcfa: s.base_salary_fcfa ?? 0,
        allowances: bucket.allowances,
        deductions: bucket.deductions,
        gross_fcfa: gross,
        deductions_total_fcfa: dedTotal,
        net_fcfa: net,
      };
    });
    if (rows.length) {
      const { error: e2 } = await supabase.from("payslips").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return { id: run.id };
  });

export const getPayrollRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;
    const [run, slips] = await Promise.all([
      supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", data.id)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("payslips")
        .select(
          "*, staff:staff_id(id, first_name, last_name, matricule, position, bank_account, momo_number)",
        )
        .eq("run_id", data.id)
        .order("created_at"),
    ]);
    if (run.error) throw new Error(run.error.message);
    if (slips.error) throw new Error(slips.error.message);
    return { run: run.data, payslips: slips.data ?? [] };
  });

export const setRunStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: PayrollStatus }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const patch: { status: PayrollStatus; finalized_at?: string } = { status: data.status };
    if (data.status === "finalized") patch.finalized_at = new Date().toISOString();
    const { error } = await supabase
      .from("payroll_runs")
      .update(patch)
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase
      .from("payroll_runs")
      .delete()
      .eq("id", data.id)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPayslipPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      payment_method: PayMethod;
      reference?: string | null;
      paid_at?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("payslips")
      .update({
        status: "paid",
        payment_method: data.payment_method,
        reference: data.reference ?? null,
        paid_at: data.paid_at ?? new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unmarkPayslipPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("payslips")
      .update({ status: "pending", paid_at: null, payment_method: null, reference: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPayslip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return null;
    const { data: slip, error } = await supabase
      .from("payslips")
      .select("*, staff:staff_id(*), run:run_id(*), school:school_id(name, city, region, code)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return slip;
  });
