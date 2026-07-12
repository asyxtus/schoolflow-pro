import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Receipt, TrendingUp, Users, Plus, Trash2, Printer, Download, RefreshCw, FileText } from "lucide-react";
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
import { getStudents } from "@/lib/students.functions";
import {
  financeSummary, listFeeStructures, upsertFeeStructure, deleteFeeStructure,
  listPayments, recordPayment, deletePayment, type PaymentMethod,
  listStudentFees, upsertStudentFee, deleteStudentFee, bulkAssignFee,
  recomputeAllBalances,
} from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/finance")({
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
  const delPay = useServerFn(deletePayment);
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
                toast.success("Payment recorded", {
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
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.receipt_no && <span className="mr-2 font-mono">{p.receipt_no}</span>}
                            {new Date(p.paid_at).toLocaleString()} · {p.method.toUpperCase()}
                            {p.reference && ` · Ref ${p.reference}`}
                          </div>
                          {p.note && <div className="mt-1 text-sm text-foreground/80">{p.note}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">{fmt(p.amount_fcfa)}</div>
                        </div>
                        <Button size="icon" variant="ghost" aria-label="Receipt" onClick={() => openReceipt(p.id)}>
                          <Printer className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          onClick={async () => {
                            await delPay({ data: { id: p.id } });
                            refetchAll();
                            qc.invalidateQueries({ queryKey: ["payments"] });
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
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
                const net = Math.max(0, r.amount_fcfa - (r.discount_fcfa ?? 0));
                const overdue = r.due_date && new Date(r.due_date) < new Date();
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
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                    <div className="text-right">
                      <div className="font-semibold">{fmt(net)}</div>
                      {r.discount_fcfa > 0 && <div className="text-xs text-muted-foreground">-{fmt(r.discount_fcfa)} discount</div>}
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Delete"
                      onClick={async () => { await delInv({ data: { id: r.id } }); refetchAll(); }}>
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
              {feesQ.data.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-4">
                  <Badge variant="secondary">{f.class_name}</Badge>
                  <div className="flex-1">
                    <div className="font-medium">{f.label}</div>
                    {f.academic_year && <div className="text-xs text-muted-foreground">{f.academic_year}</div>}
                  </div>
                  <div className="font-semibold">{fmt(f.amount_fcfa)}</div>
                  <Button size="icon" variant="ghost"
                    onClick={async () => { await delFee({ data: { id: f.id } }); qc.invalidateQueries({ queryKey: ["fee-structures"] }); }}
                    aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
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
}: { students: Array<{ id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null; fee_balance: number }>; onSubmit: (v: { student_id: string; amount_fcfa: number; method: PaymentMethod; reference?: string; note?: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!studentId || !amt || amt <= 0) { toast.error("Pick a student and amount"); return; }
    setBusy(true);
    try {
      await onSubmit({ student_id: studentId, amount_fcfa: amt, method, reference: reference || undefined, note: note || undefined });
      setOpen(false); setStudentId(""); setAmount(""); setReference(""); setNote(""); setMethod("cash");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
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
              <Label>Amount (FCFA)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
          <div className="grid gap-1.5">
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo txn ID, receipt no." />
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeeStructureDialog({
  onSubmit,
}: { onSubmit: (v: { class_name: string; label: string; amount_fcfa: number; academic_year?: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!className || !label || !amt) { toast.error("Fill all fields"); return; }
    setBusy(true);
    try {
      await onSubmit({ class_name: className, label, amount_fcfa: amt, academic_year: year || undefined });
      setOpen(false); setClassName(""); setLabel(""); setAmount(""); setYear("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />New fee structure</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New fee structure</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Class</Label><Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Form 1" /></div>
            <div className="grid gap-1.5"><Label>Academic year</Label><Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" /></div>
          </div>
          <div className="grid gap-1.5"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tuition — Term 1" /></div>
          <div className="grid gap-1.5"><Label>Amount (FCFA)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
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