import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type OpenInvoice = {
  id: string;
  label: string;
  kind: string | null;
  due_date: string | null;
  net_fcfa: number;
  paid_fcfa: number;
  balance_fcfa: number;
  status: string;
  created_at: string;
};

/** Every open (not fully paid) invoice for a student, ordered registration-first then oldest due. */
export async function openInvoicesFor(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  studentId: string,
): Promise<OpenInvoice[]> {
  const rows = await invoicesFor(supabase, schoolId, studentId);
  return rows.filter((r) => r.balance_fcfa > 0);
}

/** All invoices for a student with live paid/balance/status, ordered registration-first then oldest due. */
export async function invoicesFor(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  studentId: string,
): Promise<OpenInvoice[]> {
  const { data, error } = await supabase
    .from("student_fee_status")
    .select("id, label, kind, due_date, net_fcfa, paid_fcfa, balance_fcfa, status, created_at")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    label: (r.label as string) ?? "",
    kind: (r.kind as string | null) ?? null,
    due_date: (r.due_date as string | null) ?? null,
    net_fcfa: Number(r.net_fcfa ?? 0),
    paid_fcfa: Number(r.paid_fcfa ?? 0),
    balance_fcfa: Number(r.balance_fcfa ?? 0),
    status: (r.status as string) ?? "unpaid",
    created_at: (r.created_at as string) ?? "",
  }));
  return rows.sort(compareInvoices);
}

export function compareInvoices(a: OpenInvoice, b: OpenInvoice): number {
  const ra = a.kind === "registration" ? 0 : 1;
  const rb = b.kind === "registration" ? 0 : 1;
  if (ra !== rb) return ra - rb;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

/** Spread an amount across open invoices, registration first then oldest due. */
export function allocateOldestFirst(
  open: OpenInvoice[],
  amount: number,
): { student_fee_id: string; amount_fcfa: number }[] {
  let remaining = Math.round(amount);
  const plan: { student_fee_id: string; amount_fcfa: number }[] = [];
  for (const inv of [...open].sort(compareInvoices)) {
    if (remaining <= 0) break;
    if (inv.balance_fcfa <= 0) continue;
    const take = Math.min(remaining, inv.balance_fcfa);
    plan.push({ student_fee_id: inv.id, amount_fcfa: take });
    remaining -= take;
  }
  return plan;
}

/** Unallocated money already received from a student (credit on account). */
export async function studentCredit(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<number> {
  const { data } = await supabase.rpc("student_credit", { _student_id: studentId });
  return Number(data ?? 0);
}