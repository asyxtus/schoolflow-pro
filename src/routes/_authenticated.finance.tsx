import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Receipt, TrendingUp, Users, Plus, Trash2 } from "lucide-react";
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
} from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

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

  const summaryQ = useQuery({ queryKey: ["finance-summary"], queryFn: () => summaryFn() });
  const feesQ = useQuery({ queryKey: ["fee-structures"], queryFn: () => feesFn() });
  const paysQ = useQuery({ queryKey: ["payments"], queryFn: () => paysFn({ data: { limit: 200 } }) });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => studentsFn() });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
      <PageHeader
        title="Finance"
        description="Fee structures, payments, and collection tracking"
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
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-3">
          <div className="flex justify-end">
            <RecordPaymentDialog
              students={studentsQ.data ?? []}
              onSubmit={async (v) => {
                await recFn({ data: v });
                refetchAll();
                qc.invalidateQueries({ queryKey: ["payments"] });
                toast.success("Payment recorded");
              }}
            />
          </div>
          {paysQ.isLoading ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : !(paysQ.data?.length) ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No payments recorded yet.</CardContent></Card>
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
                            {new Date(p.paid_at).toLocaleString()} · {p.method.toUpperCase()}
                            {p.reference && ` · Ref ${p.reference}`}
                          </div>
                          {p.note && <div className="mt-1 text-sm text-foreground/80">{p.note}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-primary">{fmt(p.amount_fcfa)}</div>
                        </div>
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
              </CardContent>
            </Card>
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