import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Receipt, TrendingUp, Users, Plus, Trash2, Printer, Download, RefreshCw, FileText, Pencil, AlertTriangle, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { getStudents } from "@/lib/students.functions";
import {
  financeSummary, listFeeStructures, upsertFeeStructure, deleteFeeStructure,
  listPayments, recordPayment, voidPayment, type PaymentMethod,
  type FeeKind, type FeeInstallment,
  listStudentFees, upsertStudentFee, deleteStudentFee, bulkAssignFee,
  recomputeAllBalances,
} from "@/lib/finance.functions";
import { useClassOptions } from "@/hooks/use-classes";

export const Route = createFileRoute("/_authenticated/finance/")({
  component: FinancePage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const METHODS: Array<PaymentMethod> = ["cash", "momo", "bank", "cheque", "other"];

type Student = { id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null; fee_balance: number };

function FinancePage() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(financeSummary);
  const feesFn = useServerFn(listFeeStructures);
  const upsertFee = useServerFn(upsertFeeStructure);
  const delFee = useServerFn(deleteFeeStructure);
  const paysFn = useServerFn(listPayments);
  const recFn = useServerFn(recordPayment);
  const voidPay = useServerFn(voidPayment);
  const studentsFn = useServerFn(getStudents);
  const invFn = useServerFn(listStudentFees);
  const upsertInv = useServerFn(upsertStudentFee);
  const delInv = useServerFn(deleteStudentFee);
  const bulkFn = useServerFn(bulkAssignFee);
  const recompute = useServerFn(recomputeAllBalances);

  const [filter, setFilter] = useState<{ q: string; method: PaymentMethod | "all"; from: string; to: string }>({
    q: "", method: "all", from: "", to: "",
  });

  const summaryQ = useQuery({ queryKey: ["finance-summary"], queryFn: () => summaryFn() });
  const feesQ = useQuery({ queryKey: ["fee-structures"], queryFn: () => feesFn() });
  const paysQ = useQuery({
    queryKey: ["payments", filter],
    queryFn: () => paysFn({ data: { limit: 500, q: filter.q, method: filter.method, from: filter.from || undefined, to: filter.to || undefined } }),
  });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => studentsFn() });
  const invQ = useQuery({ queryKey: ["student-fees"], queryFn: () => invFn({ data: {} }) });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["student-fees"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const classNames = useMemo(() => {
    const set = new Set<string>();
    (studentsQ.data ?? []).forEach((s) => { if (s.class_name) set.add(s.class_name); });
    return Array.from(set).sort();
  }, [studentsQ.data]);

  const exportPaymentsCsv = () => {
    const rows = paysQ.data ?? [];
    const header = ["Receipt", "Date", "Student", "Matricule", "Class", "Method", "Reference", "Amount FCFA", "Note"];
    const csv = [header.join(",")].concat(
      rows.map((p) => {
        const s = (p as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
        return [
          p.receipt_no ?? "",
          new Date(p.paid_at).toISOString(),
          `${s?.first_name ?? ""} ${s?.last_name ?? ""}`.trim(),
          s?.matricule ?? "",
          s?.class_name ?? "",
          p.method,
          p.reference ?? "",
          String(p.amount_fcfa),
          (p.note ?? "").replace(/[\n,]/g, " "),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      })
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payments-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openReceipt = (id: string) => {
    window.open(`/finance/receipt/${id}`, "_blank", "noopener");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
      <PageHeader
        title="Finance"
        description="Fee structures, payments, and collection tracking"
        actions={
          <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/finance/aging"><AlertTriangle className="mr-2 h-4 w-4" />Fees aging</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/expenses"><TrendingDown className="mr-2 h-4 w-4" />Expenses</Link>
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={async () => {
              await recompute();
              refetchAll();
              toast.success("Balances recomputed");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />Recompute balances
          </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected (all time)" value={fmt(summaryQ.data?.collected ?? 0)} icon={Wallet} />
        <StatCard label="This month" value={fmt(summaryQ.data?.thisMonth ?? 0)} icon={TrendingUp} tone="accent" />
        <StatCard label="Outstanding" value={fmt(summaryQ.data?.outstanding ?? 0)} icon={Receipt} />
        <StatCard label="Active students" value={String(summaryQ.data?.students ?? 0)} icon={Users} />
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Search</Label>
              <Input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Name, receipt, ref…" className="h-9 w-56" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Method</Label>
              <Select value={filter.method} onValueChange={(v) => setFilter({ ...filter, method: v as PaymentMethod | "all" })}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} className="h-9 w-40" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} className="h-9 w-40" />
            </div>
            <div className="ml-auto flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={exportPaymentsCsv} disabled={!paysQ.data?.length}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            <RecordPaymentDialog
              students={studentsQ.data ?? []}
              onSubmit={async (v) => {
                const res = await recFn({ data: v });
                refetchAll();
                qc.invalidateQueries({ queryKey: ["payments"] });
                toast.success(res?.credit ? `Payment recorded · ${fmt(res.credit)} kept as credit` : "Payment recorded", {
                  action: res?.id ? { label: "Print receipt", onClick: () => openReceipt(res.id!) } : undefined,
                });
              }}
            />
            </div>
          </div>
          {paysQ.isLoading ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : !(paysQ.data?.length) ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No payments match your filters.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {paysQ.data.map((p) => {
                    const s = (p as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-4">
                        <div className="flex-1">
                          <div className="font-medium">
                            {s?.first_name} {s?.last_name}
                            <span className="ml-2 text-xs text-muted-foreground">{s?.matricule} · {s?.class_name}</span>
                            {(p as { voided?: boolean }).voided && (
                              <Badge variant="destructive" className="ml-2">VOIDED</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.receipt_no && <span className="mr-2 font-mono">{p.receipt_no}</span>}
                            {new Date(p.paid_at).toLocaleString()} · {p.method.toUpperCase()}
                            {p.reference && ` · Ref ${p.reference}`}
                          </div>
                          {p.note && <div className="mt-1 text-sm text-foreground/80">{p.note}</div>}
                          {(p as { voided?: boolean; void_reason?: string | null }).voided && (p as { void_reason?: string | null }).void_reason && (
                            <div className="mt-1 text-xs text-destructive">Void reason: {(p as { void_reason?: string | null }).void_reason}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${(p as { voided?: boolean }).voided ? "text-muted-foreground line-through" : "text-primary"}`}>{fmt(p.amount_fcfa)}</div>
                        </div>
                        <Button size="icon" variant="ghost" aria-label="Receipt" onClick={() => openReceipt(p.id)}>
                          <Printer className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {!(p as { voided?: boolean }).voided && <Button
                          size="icon" variant="ghost"
                          onClick={async () => {
                            const reason = window.prompt("Reason for voiding this payment (audit-logged)?");
                            if (!reason || reason.trim().length < 4) return;
                            try {
                              await voidPay({ data: { id: p.id, reason: reason.trim() } });
                              refetchAll();
                              qc.invalidateQueries({ queryKey: ["payments"] });
                              toast.success("Payment voided");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                          aria-label="Void"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t p-3 text-right text-sm">
                  Total: <span className="font-semibold text-foreground">{fmt(paysQ.data.reduce((a, r) => a + r.amount_fcfa, 0))}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <BulkAssignDialog
              classNames={classNames}
              feeStructures={feesQ.data ?? []}
              onSubmit={async (v) => {
                const r = await bulkFn({ data: v });
                refetchAll();
                toast.success(`Assigned to ${r.count} students`);
              }}
            />
            <InvoiceDialog
              students={studentsQ.data ?? []}
              feeStructures={feesQ.data ?? []}
              onSubmit={async (v) => {
                await upsertInv({ data: v });
                refetchAll();
                toast.success("Invoice saved");
              }}
            />
          </div>
          {!(invQ.data?.length) ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No fee assignments yet. Create one or bulk-assign a fee structure to a class.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0"><div className="divide-y">
              {invQ.data.map((r) => {
                const s = (r as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
                const net = Number(r.net_fcfa ?? 0);
                const paid = Number(r.paid_fcfa ?? 0);
                const balance = Number(r.balance_fcfa ?? 0);
                const status = (r.status ?? "unpaid") as "paid" | "partial" | "overdue" | "unpaid";
                return (
                  <div key={r.id} className="flex items-center gap-3 p-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {s?.first_name} {s?.last_name}
                        <span className="ml-2 text-xs text-muted-foreground">{s?.matricule} · {s?.class_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.label}
                        {r.academic_year && ` · ${r.academic_year}`}
                        {r.due_date && ` · Due ${new Date(r.due_date).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Badge variant={status === "paid" ? "secondary" : status === "overdue" ? "destructive" : "outline"}>
                      {status === "paid" ? "Paid" : status === "partial" ? "Partly paid" : status === "overdue" ? "Overdue" : "Unpaid"}
                    </Badge>
                    <div className="text-right">
                      <div className="font-semibold">{fmt(balance)}</div>
                      <div className="text-xs text-muted-foreground">
                        {paid > 0 ? `${fmt(paid)} paid of ${fmt(net)}` : `of ${fmt(net)}`}
                        {Number(r.discount_fcfa ?? 0) > 0 && ` · -${fmt(Number(r.discount_fcfa))} discount`}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Delete"
                      disabled={paid > 0}
                      title={paid > 0 ? "This invoice has payments applied to it and cannot be deleted" : "Delete invoice"}
                      onClick={async () => { await delInv({ data: { id: r.id as string } }); refetchAll(); }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="structures" className="space-y-3">
          <div className="flex justify-end">
            <FeeStructureDialog
              onSubmit={async (v) => {
                await upsertFee({ data: v });
                qc.invalidateQueries({ queryKey: ["fee-structures"] });
                toast.success("Fee structure saved");
              }}
            />
          </div>
          {!(feesQ.data?.length) ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No fee structures yet.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0"><div className="divide-y">
              {feesQ.data.map((f) => {
                const inst = (Array.isArray(f.installments) ? (f.installments as unknown as FeeInstallment[]) : []);
                const kind = ((f.kind as FeeKind | null | undefined) ?? "tuition") as FeeKind;
                const req = f.required_at_registration;
                return (
                  <div key={f.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{f.class_name}</Badge>
                      <Badge variant={kind === "registration" ? "default" : "outline"} className="capitalize">{kind}</Badge>
                      {req && <Badge variant="destructive">Required at registration</Badge>}
                      <div className="flex-1">
                        <div className="font-medium">{f.label}</div>
                        {f.academic_year && <div className="text-xs text-muted-foreground">{f.academic_year}</div>}
                      </div>
                      <div className="font-semibold">{fmt(f.amount_fcfa)}</div>
                      <FeeStructureDialog
                        trigger={
                          <Button size="icon" variant="ghost" aria-label="Edit"><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                        }
                        initial={{
                          id: f.id, class_name: f.class_name, label: f.label,
                          academic_year: f.academic_year ?? "", kind,
                          required_at_registration: !!req,
                          installments: inst.length ? inst : [{ label: f.label, amount_fcfa: f.amount_fcfa, due_date: f.due_date ?? "" }],
                        }}
                        onSubmit={async (v) => {
                          await upsertFee({ data: v });
                          qc.invalidateQueries({ queryKey: ["fee-structures"] });
                          toast.success("Fee structure updated");
                        }}
                      />
                      <Button size="icon" variant="ghost"
                        onClick={async () => { await delFee({ data: { id: f.id } }); qc.invalidateQueries({ queryKey: ["fee-structures"] }); }}
                        aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {inst.length > 1 && (
                      <div className="mt-3 ml-1 grid gap-1 text-xs text-muted-foreground">
                        {inst.map((i, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
                            <span className="font-medium text-foreground/80">{i.label}</span>
                            <span>· {fmt(Number(i.amount_fcfa || 0))}</span>
                            {i.due_date && <span>· Due {new Date(i.due_date).toLocaleDateString()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <BalancesTable students={studentsQ.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecordPaymentDialog({
  students, onSubmit,
}: {
  students: Array<{ id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null; fee_balance: number }>;
  onSubmit: (v: {
    student_id: string; amount_fcfa: number; method: PaymentMethod; reference?: string; note?: string;
    allocations?: { student_fee_id: string; amount_fcfa: number }[];
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const billingFn = useServerFn(getStudentBilling);
  const billingQ = useQuery({
    queryKey: ["student-billing", studentId],
    queryFn: () => billingFn({ data: { studentId } }),
    enabled: !!studentId,
  });
  const open_ = billingQ.data?.open ?? [];
  const credit = billingQ.data?.credit ?? 0;
  const outstanding = billingQ.data?.outstanding ?? 0;

  const amt = Number(amount) || 0;

  // Auto-allocate oldest-due-first until the bursar overrides an amount.
  useEffect(() => {
    if (manual || open_.length === 0) return;
    let remaining = amt;
    const next: Record<string, string> = {};
    for (const inv of open_) {
      const take = Math.max(Math.min(remaining, inv.balance_fcfa), 0);
      next[inv.id] = take > 0 ? String(take) : "";
      remaining -= take;
    }
    setAllocs(next);
  }, [amt, manual, billingQ.data]);

  const allocatedTotal = open_.reduce((s, i) => s + (Number(allocs[i.id]) || 0), 0);
  const unallocated = Math.max(amt - allocatedTotal, 0);
  const overAllocated = allocatedTotal > amt;

  const reset = () => {
    setStudentId(""); setAmount(""); setAllocs({}); setManual(false);
    setReference(""); setNote(""); setMethod("cash");
  };

  const submit = async () => {
    if (!studentId || amt <= 0) { toast.error("Pick a student and an amount"); return; }
    if (overAllocated) { toast.error("Allocations exceed the amount received"); return; }
    const allocations = open_
      .map((i) => ({ student_fee_id: i.id, amount_fcfa: Number(allocs[i.id]) || 0 }))
      .filter((a) => a.amount_fcfa > 0);
    setBusy(true);
    try {
      await onSubmit({
        student_id: studentId, amount_fcfa: amt, method,
        reference: reference || undefined, note: note || undefined,
        allocations: allocations.length > 0 ? allocations : undefined,
      });
      setOpen(false); reset();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Record payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={(v) => { setStudentId(v); setAllocs({}); setManual(false); setAmount(""); }}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} — {s.class_name ?? "—"} {s.fee_balance > 0 ? `(owes ${fmt(s.fee_balance)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Amount received (FCFA)</Label>
              <Input type="number" min="0" value={amount}
                onChange={(e) => { setAmount(e.target.value); setManual(false); }} />
            </div>
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="momo">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {studentId && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {billingQ.isLoading ? "Loading invoices…" : open_.length === 0 ? "No open invoices" : "Applied to (oldest due first — you can adjust)"}
                </span>
                <span className="text-muted-foreground">Owing {fmt(outstanding)}</span>
              </div>
              {credit > 0 && (
                <div className="mb-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                  {fmt(credit)} credit already on this student's account
                </div>
              )}
              {open_.length > 0 && (
                <>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
                    {open_.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            {i.label}
                            {i.kind === "registration" && <Badge variant="outline" className="ml-2">Registration</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Balance {fmt(i.balance_fcfa)}
                            {i.due_date && ` · Due ${new Date(i.due_date).toLocaleDateString()}`}
                            {i.paid_fcfa > 0 && ` · ${fmt(i.paid_fcfa)} already paid`}
                          </div>
                        </div>
                        <Input
                          type="number" min="0" max={i.balance_fcfa}
                          className="h-8 w-32"
                          value={allocs[i.id] ?? ""}
                          onChange={(e) => { setManual(true); setAllocs((s) => ({ ...s, [i.id]: e.target.value })); }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Applied to invoices</span>
                      <span className={overAllocated ? "font-semibold text-destructive" : "font-semibold"}>{fmt(allocatedTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Kept as credit</span>
                      <span className="font-semibold">{fmt(unallocated)}</span>
                    </div>
                    {overAllocated && <p className="text-xs text-destructive">Allocations exceed the amount received.</p>}
                    {manual && (
                      <button type="button" className="text-xs text-primary underline"
                        onClick={() => setManual(false)}>Reset to automatic allocation</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Reference {["momo", "bank", "cheque"].includes(method) ? "(required)" : "(optional)"}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo txn ID, cheque no., deposit slip" />
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || overAllocated}>{busy ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeeStructureDialog({
  onSubmit, initial, trigger,
}: {
  onSubmit: (v: { id?: string; class_name: string; label: string; amount_fcfa: number; academic_year?: string; kind?: FeeKind; installments?: FeeInstallment[]; required_at_registration?: boolean; due_date?: string | null }) => Promise<void>;
  initial?: { id?: string; class_name?: string; label?: string; academic_year?: string; kind?: FeeKind; required_at_registration?: boolean; installments?: FeeInstallment[] };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const classesQ = useClassOptions();
  const [className, setClassName] = useState(initial?.class_name ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [year, setYear] = useState(initial?.academic_year ?? "");
  const [kind, setKind] = useState<FeeKind>(initial?.kind ?? "tuition");
  const [required, setRequired] = useState(initial?.required_at_registration ?? false);
  const [installments, setInstallments] = useState<FeeInstallment[]>(
    initial?.installments && initial.installments.length > 0
      ? initial.installments
      : [{ label: "Installment 1", amount_fcfa: 0, due_date: "" }]
  );
  const [busy, setBusy] = useState(false);

  const total = installments.reduce((s, i) => s + Number(i.amount_fcfa || 0), 0);

  const update = (idx: number, patch: Partial<FeeInstallment>) => {
    setInstallments((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setInstallments((p) => [...p, { label: `Installment ${p.length + 1}`, amount_fcfa: 0, due_date: "" }]);
  const removeRow = (idx: number) => setInstallments((p) => p.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!className || !label) { toast.error("Class and label are required"); return; }
    if (!total) { toast.error("Add at least one installment amount"); return; }
    setBusy(true);
    try {
      const cleaned = installments.map((i) => ({ label: i.label, amount_fcfa: Number(i.amount_fcfa || 0), due_date: i.due_date || null }));
      const firstDue = cleaned.find((i) => i.due_date)?.due_date ?? null;
      await onSubmit({
        id: initial?.id,
        class_name: className, label, amount_fcfa: total,
        academic_year: year || undefined, kind,
        installments: cleaned,
        required_at_registration: kind === "registration" ? true : required,
        due_date: firstDue,
      });
      setOpen(false);
      if (!initial?.id) {
        setClassName(""); setLabel(""); setYear(""); setKind("tuition"); setRequired(false);
        setInstallments([{ label: "Installment 1", amount_fcfa: 0, due_date: "" }]);
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" />New fee structure</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit fee structure" : "New fee structure"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Class</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {(classesQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FeeKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="registration">Registration</SelectItem>
                  <SelectItem value="tuition">Tuition</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Academic year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "registration" ? "Registration fee" : "Tuition — 2025/2026"} />
          </div>

          {kind !== "registration" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              Required before admission
            </label>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Installments &amp; deadlines</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addRow}><Plus className="mr-1 h-3 w-3" />Add</Button>
            </div>
            <div className="space-y-2">
              {installments.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_160px_auto] gap-2 items-end">
                  <div className="grid gap-1"><Label className="text-xs">Label</Label><Input value={row.label} onChange={(e) => update(idx, { label: e.target.value })} /></div>
                  <div className="grid gap-1"><Label className="text-xs">Amount FCFA</Label><Input type="number" min="0" value={row.amount_fcfa || ""} onChange={(e) => update(idx, { amount_fcfa: Number(e.target.value) })} /></div>
                  <div className="grid gap-1"><Label className="text-xs">Due date</Label><Input type="date" value={row.due_date ?? ""} onChange={(e) => update(idx, { due_date: e.target.value })} /></div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)} disabled={installments.length === 1} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right text-sm">Total: <span className="font-semibold">{fmt(total)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BalancesTable({ students }: { students: Array<{ id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null; fee_balance: number }> }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return students
      .filter((r) => !s || `${r.first_name} ${r.last_name} ${r.matricule ?? ""} ${r.class_name ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) => (b.fee_balance ?? 0) - (a.fee_balance ?? 0));
  }, [students, q]);
  const total = rows.reduce((a, r) => a + (r.fee_balance ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="text-sm text-muted-foreground ml-auto">Total outstanding: <span className="font-semibold text-foreground">{fmt(total)}</span></div>
      </div>
      <Card><CardContent className="p-0"><div className="divide-y">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <div className="font-medium">{s.first_name} {s.last_name}</div>
              <div className="text-xs text-muted-foreground">{s.matricule} · {s.class_name ?? "—"}</div>
            </div>
            <div className={s.fee_balance > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
              {fmt(s.fee_balance ?? 0)}
            </div>
          </div>
        ))}
        {!rows.length && <div className="p-8 text-center text-sm text-muted-foreground">No students.</div>}
      </div></CardContent></Card>
    </div>
  );
}

type FeeStructure = { id: string; class_name: string; label: string; amount_fcfa: number; academic_year: string | null };

function InvoiceDialog({
  students, feeStructures, onSubmit,
}: {
  students: Student[];
  feeStructures: FeeStructure[];
  onSubmit: (v: { student_id: string; fee_structure_id?: string | null; label: string; amount_fcfa: number; discount_fcfa?: number; academic_year?: string; due_date?: string; note?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [structureId, setStructureId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const applyStructure = (id: string) => {
    setStructureId(id);
    const s = feeStructures.find((f) => f.id === id);
    if (s) { setLabel(s.label); setAmount(String(s.amount_fcfa)); }
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!studentId || !label || !amt) { toast.error("Fill student, label and amount"); return; }
    setBusy(true);
    try {
      await onSubmit({
        student_id: studentId,
        fee_structure_id: structureId || null,
        label,
        amount_fcfa: amt,
        discount_fcfa: Number(discount) || 0,
        due_date: dueDate || undefined,
        note: note || undefined,
      });
      setOpen(false);
      setStudentId(""); setStructureId(""); setLabel(""); setAmount(""); setDiscount(""); setDueDate(""); setNote("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New invoice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign fee to student</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} — {s.class_name ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {feeStructures.length > 0 && (
            <div className="grid gap-1.5">
              <Label>From fee structure (optional)</Label>
              <Select value={structureId} onValueChange={applyStructure}>
                <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
                <SelectContent>
                  {feeStructures.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.class_name} · {f.label} — {fmt(f.amount_fcfa)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tuition — Term 1" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5"><Label>Amount (FCFA)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Discount (FCFA)</Label><Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAssignDialog({
  classNames, feeStructures, onSubmit,
}: {
  classNames: string[];
  feeStructures: FeeStructure[];
  onSubmit: (v: { class_name: string; fee_structure_id?: string; label?: string; amount_fcfa?: number; academic_year?: string; due_date?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [structureId, setStructureId] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [year, setYear] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!className) { toast.error("Pick a class"); return; }
    if (!structureId && (!label || !amount)) { toast.error("Pick a fee structure or provide label + amount"); return; }
    setBusy(true);
    try {
      await onSubmit({
        class_name: className,
        fee_structure_id: structureId || undefined,
        label: label || undefined,
        amount_fcfa: amount ? Number(amount) : undefined,
        academic_year: year || undefined,
        due_date: dueDate || undefined,
      });
      setOpen(false);
      setClassName(""); setStructureId(""); setLabel(""); setAmount(""); setYear(""); setDueDate("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Users className="mr-2 h-4 w-4" />Bulk assign to class</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign fee to a whole class</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {feeStructures.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Fee structure</Label>
              <Select value={structureId} onValueChange={setStructureId}>
                <SelectTrigger><SelectValue placeholder="Optional template" /></SelectTrigger>
                <SelectContent>
                  {feeStructures.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.class_name} · {f.label} — {fmt(f.amount_fcfa)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="text-xs text-muted-foreground">Or override:</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tuition — Term 1" /></div>
            <div className="grid gap-1.5"><Label>Amount (FCFA)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Academic year</Label><Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" /></div>
            <div className="grid gap-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Assigning…" : "Assign to class"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}