import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Users, Plus, Trash2, Settings, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  walletSummary, listWalletTransactions, recordWalletTransaction,
  deleteWalletTransaction, listStudentWalletBalances,
  getSchoolWalletDefaults, updateSchoolWalletDefaults, updateStudentWalletLimits, getStudentWalletContext,
  type WalletMethod, type WalletKind,
  type WalletLimits,
} from "@/lib/wallet.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const METHODS: WalletMethod[] = ["cash", "momo", "bank", "cheque", "other"];

function WalletPage() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(walletSummary);
  const txFn = useServerFn(listWalletTransactions);
  const recordFn = useServerFn(recordWalletTransaction);
  const delFn = useServerFn(deleteWalletTransaction);
  const balancesFn = useServerFn(listStudentWalletBalances);
  const defaultsFn = useServerFn(getSchoolWalletDefaults);
  const saveDefaultsFn = useServerFn(updateSchoolWalletDefaults);
  const saveLimitsFn = useServerFn(updateStudentWalletLimits);
  const ctxFn = useServerFn(getStudentWalletContext);

  const [filter, setFilter] = useState<{ q: string; kind: WalletKind | "all"; from: string; to: string }>({
    q: "", kind: "all", from: "", to: "",
  });
  const [balFilter, setBalFilter] = useState<{ q: string; className: string }>({ q: "", className: "" });

  const summaryQ = useQuery({ queryKey: ["wallet-summary"], queryFn: () => summaryFn() });
  const txQ = useQuery({
    queryKey: ["wallet-tx", filter],
    queryFn: () => txFn({ data: { q: filter.q, kind: filter.kind, from: filter.from || undefined, to: filter.to || undefined, limit: 500 } }),
  });
  const balQ = useQuery({
    queryKey: ["wallet-balances", balFilter],
    queryFn: () => balancesFn({ data: { q: balFilter.q, className: balFilter.className || undefined } }),
  });
  const defaultsQ = useQuery({ queryKey: ["wallet-defaults"], queryFn: () => defaultsFn() });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    qc.invalidateQueries({ queryKey: ["wallet-balances"] });
    qc.invalidateQueries({ queryKey: ["wallet-defaults"] });
  };

  const record = useMutation({
    mutationFn: (v: Parameters<typeof recordFn>[0]["data"]) => recordFn({ data: v }),
    onSuccess: () => { toast.success("Transaction recorded"); refetchAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Transaction removed"); refetchAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveDefaults = useMutation({
    mutationFn: (v: WalletLimits) => saveDefaultsFn({ data: v }),
    onSuccess: () => { toast.success("Default limits saved"); refetchAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveLimits = useMutation({
    mutationFn: (v: { student_id: string } & WalletLimits) => saveLimitsFn({ data: v }),
    onSuccess: () => { toast.success("Student limits saved"); refetchAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const classNames = useMemo(() => {
    const s = new Set<string>();
    (balQ.data ?? []).forEach((r) => { if (r.class_name) s.add(r.class_name); });
    return Array.from(s).sort();
  }, [balQ.data]);

  const summary = summaryQ.data;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Student Wallet"
        description="Track pocket-money deposits and withdrawals per student"
        actions={
          <div className="flex gap-2">
            <DefaultsDialog defaults={defaultsQ.data ?? null} onSave={(v) => saveDefaults.mutate(v)} />
            <TransactionDialog
              students={balQ.data ?? []}
              onSubmit={(v) => record.mutate(v)}
              fetchContext={(id) => ctxFn({ data: { student_id: id } })}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total wallet balance" value={fmt(summary?.totalBalance ?? 0)} icon={Wallet} />
        <StatCard label="Active students" value={String(summary?.students ?? 0)} icon={Users} />
        <StatCard label="Deposits this month" value={fmt(summary?.depositsThisMonth ?? 0)} icon={ArrowDownCircle} />
        <StatCard label="Withdrawals this month" value={fmt(summary?.withdrawalsThisMonth ?? 0)} icon={ArrowUpCircle} />
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="balances">Student balances</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <Input placeholder="Search student / matricule / reference" value={filter.q}
                onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} className="w-72" />
              <Select value={filter.kind} onValueChange={(v) => setFilter((f) => ({ ...f, kind: v as WalletKind | "all" }))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className="w-40" />
              <Input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className="w-40" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Approval</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(txQ.data ?? []).map((t) => {
                      const s = (t as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string } }).students;
                      const tx = t as typeof t & { over_limit?: boolean; guardian_approved?: boolean; guardian_approval_note?: string | null };
                      return (
                        <tr key={t.id} className="border-t border-border/60">
                          <td className="px-4 py-3">{new Date(t.occurred_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">{s?.first_name} {s?.last_name}<div className="text-xs text-muted-foreground">{s?.matricule}</div></td>
                          <td className="px-4 py-3">{s?.class_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={t.kind === "deposit" ? "default" : "secondary"} className="capitalize">
                              {t.kind}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 capitalize">{t.method}</td>
                          <td className="px-4 py-3 text-muted-foreground">{t.reference ?? "—"}</td>
                          <td className={`px-4 py-3 text-right font-mono ${t.kind === "deposit" ? "text-emerald-600" : "text-amber-700"}`}>
                            {t.kind === "deposit" ? "+" : "−"}{fmt(t.amount_fcfa)}
                          </td>
                          <td className="px-4 py-3">
                            {tx.over_limit ? (
                              <div className="flex items-center gap-1 text-xs">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-muted-foreground" title={tx.guardian_approval_note ?? ""}>Guardian OK</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this transaction?")) remove.mutate(t.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!txQ.data?.length && (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No transactions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <Input placeholder="Search student" value={balFilter.q}
                onChange={(e) => setBalFilter((f) => ({ ...f, q: e.target.value }))} className="w-72" />
              <Select value={balFilter.className || "all"} onValueChange={(v) => setBalFilter((f) => ({ ...f, className: v === "all" ? "" : v }))}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Matricule</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3 text-right">Wallet balance</th>
                      <th className="px-4 py-3">Limits</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(balQ.data ?? []).map((s) => {
                      const st = s as typeof s & { wallet_per_txn_limit: number | null; wallet_daily_limit: number | null; wallet_weekly_limit: number | null; wallet_monthly_limit: number | null };
                      return (
                      <tr key={s.id} className="border-t border-border/60">
                        <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.matricule ?? "—"}</td>
                        <td className="px-4 py-3">{s.class_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(s.wallet_balance ?? 0)}</td>
                        <td className="px-4 py-3">
                          <LimitsDialog
                            student={{ id: s.id, name: `${s.first_name} ${s.last_name}` }}
                            limits={{ per_txn: st.wallet_per_txn_limit, daily: st.wallet_daily_limit, weekly: st.wallet_weekly_limit, monthly: st.wallet_monthly_limit }}
                            defaults={defaultsQ.data ?? null}
                            onSave={(v) => saveLimits.mutate({ student_id: s.id, ...v })}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <QuickTxButtons
                            student={{ id: s.id, first_name: s.first_name, last_name: s.last_name, matricule: s.matricule, class_name: s.class_name, wallet_balance: s.wallet_balance ?? 0 }}
                            onSubmit={(v) => record.mutate(v)}
                            fetchContext={(id) => ctxFn({ data: { student_id: id } })}
                          />
                        </td>
                      </tr>
                    );})}
                    {!balQ.data?.length && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No students found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type StudentLite = { id: string; first_name: string; last_name: string; matricule: string | null; class_name: string | null; wallet_balance: number };
type TxInput = { student_id: string; kind: WalletKind; amount_fcfa: number; method: WalletMethod; reference?: string; note?: string; occurred_at?: string; guardian_approved?: boolean; guardian_approval_note?: string };
type WalletCtx = Awaited<ReturnType<typeof getStudentWalletContext>>;

function TransactionDialog({ students, onSubmit, presetStudent, presetKind, triggerLabel, triggerVariant, fetchContext }: {
  students: StudentLite[];
  onSubmit: (v: TxInput) => void;
  presetStudent?: StudentLite;
  presetKind?: WalletKind;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  fetchContext: (studentId: string) => Promise<WalletCtx>;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(presetStudent?.id ?? "");
  const [kind, setKind] = useState<WalletKind>(presetKind ?? "deposit");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<WalletMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [guardianOk, setGuardianOk] = useState(false);
  const [guardianNote, setGuardianNote] = useState("");
  const [ctx, setCtx] = useState<WalletCtx | null>(null);

  const effStudentId = presetStudent?.id ?? studentId;
  const ctxQ = useQuery({
    queryKey: ["wallet-ctx", effStudentId],
    queryFn: () => fetchContext(effStudentId),
    enabled: open && kind === "withdrawal" && !!effStudentId,
  });
  const currentCtx = ctxQ.data ?? ctx;
  void setCtx;

  const amt = Number(amount) || 0;
  const reasons = useMemo(() => {
    if (kind !== "withdrawal" || !currentCtx || !amt) return [] as string[];
    const e = currentCtx.effective, u = currentCtx.usage;
    const r: string[] = [];
    if (e.per_txn != null && amt > e.per_txn) r.push(`Amount exceeds per-transaction limit (${fmt(e.per_txn)})`);
    if (e.daily != null && u.day.count + 1 > e.daily) r.push(`Exceeds daily frequency (${u.day.count}/${e.daily} today)`);
    if (e.weekly != null && u.week.count + 1 > e.weekly) r.push(`Exceeds weekly frequency (${u.week.count}/${e.weekly} this week)`);
    if (e.monthly != null && u.month.count + 1 > e.monthly) r.push(`Exceeds monthly frequency (${u.month.count}/${e.monthly} this month)`);
    return r;
  }, [kind, currentCtx, amt]);

  const reset = () => { setStudentId(presetStudent?.id ?? ""); setKind(presetKind ?? "deposit"); setAmount(""); setMethod("cash"); setReference(""); setNote(""); setGuardianOk(false); setGuardianNote(""); };

  const submit = () => {
    const sid = presetStudent?.id ?? studentId;
    if (!sid) return;
    if (!amt || amt <= 0) return;
    onSubmit({
      student_id: sid, kind, amount_fcfa: amt, method,
      reference: reference || undefined, note: note || undefined,
      guardian_approved: reasons.length > 0 ? guardianOk : undefined,
      guardian_approval_note: reasons.length > 0 ? guardianNote : undefined,
    });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant ?? "default"} size={presetStudent ? "sm" : "default"}>
          <Plus className="mr-2 h-4 w-4" />{triggerLabel ?? "New transaction"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{presetStudent ? `${kind === "deposit" ? "Deposit to" : "Withdraw from"} ${presetStudent.first_name} ${presetStudent.last_name}` : "New wallet transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {!presetStudent && (
            <div className="grid gap-1">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} — {s.class_name ?? "—"} ({fmt(s.wallet_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as WalletKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as WalletMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Amount (FCFA)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {kind === "withdrawal" && currentCtx && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-medium text-foreground">Wallet balance: {fmt(currentCtx.student.wallet_balance ?? 0)}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                <span>Per-txn limit</span><span>{currentCtx.effective.per_txn != null ? fmt(currentCtx.effective.per_txn) : "None"}</span>
                <span>Today</span><span>{currentCtx.usage.day.count} / {currentCtx.effective.daily ?? "∞"}</span>
                <span>This week</span><span>{currentCtx.usage.week.count} / {currentCtx.effective.weekly ?? "∞"}</span>
                <span>This month</span><span>{currentCtx.usage.month.count} / {currentCtx.effective.monthly ?? "∞"}</span>
              </div>
            </div>
          )}
          {reasons.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <div className="mb-2 flex items-center gap-1.5 font-medium text-amber-900">
                <ShieldAlert className="h-4 w-4" /> Guardian permission required
              </div>
              <ul className="mb-2 list-disc space-y-0.5 pl-4 text-amber-900/80">
                {reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <label className="flex items-start gap-2">
                <Checkbox checked={guardianOk} onCheckedChange={(v) => setGuardianOk(!!v)} />
                <span className="text-foreground">Guardian has approved this withdrawal</span>
              </label>
              <div className="mt-2 grid gap-1">
                <Label className="text-xs">How was approval given?</Label>
                <Input value={guardianNote} onChange={(e) => setGuardianNote(e.target.value)} placeholder="e.g. Phone call with mother at 10:30" />
              </div>
            </div>
          )}
          <div className="grid gap-1">
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo TxID, cheque #, etc." />
          </div>
          <div className="grid gap-1">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={reasons.length > 0 && (!guardianOk || !guardianNote.trim())}>Save transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickTxButtons({ student, onSubmit, fetchContext }: { student: StudentLite; onSubmit: (v: TxInput) => void; fetchContext: (id: string) => Promise<WalletCtx> }) {
  return (
    <div className="flex justify-end gap-2">
      <TransactionDialog students={[]} presetStudent={student} presetKind="deposit" onSubmit={onSubmit} triggerLabel="Deposit" triggerVariant="outline" fetchContext={fetchContext} />
      <TransactionDialog students={[]} presetStudent={student} presetKind="withdrawal" onSubmit={onSubmit} triggerLabel="Withdraw" triggerVariant="ghost" fetchContext={fetchContext} />
    </div>
  );
}

function LimitInput({ label, value, onChange, placeholder }: { label: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value ?? ""} placeholder={placeholder ?? "No limit"}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </div>
  );
}

function DefaultsDialog({ defaults, onSave }: { defaults: WalletLimits | null; onSave: (v: WalletLimits) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<WalletLimits>({ per_txn: null, daily: null, weekly: null, monthly: null });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(defaults ?? { per_txn: null, daily: null, weekly: null, monthly: null }); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings className="mr-2 h-4 w-4" />Default limits</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>School-wide default withdrawal limits</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Leave blank to allow unrestricted withdrawals. Per-student overrides always win.</p>
        <div className="grid grid-cols-2 gap-3">
          <LimitInput label="Max per transaction (FCFA)" value={v.per_txn} onChange={(x) => setV((s) => ({ ...s, per_txn: x }))} />
          <LimitInput label="Max withdrawals per day" value={v.daily} onChange={(x) => setV((s) => ({ ...s, daily: x }))} />
          <LimitInput label="Max withdrawals per week" value={v.weekly} onChange={(x) => setV((s) => ({ ...s, weekly: x }))} />
          <LimitInput label="Max withdrawals per month" value={v.monthly} onChange={(x) => setV((s) => ({ ...s, monthly: x }))} />
        </div>
        <DialogFooter>
          <Button onClick={() => { onSave(v); setOpen(false); }}>Save defaults</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LimitsDialog({ student, limits, defaults, onSave }: { student: { id: string; name: string }; limits: WalletLimits; defaults: WalletLimits | null; onSave: (v: WalletLimits) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<WalletLimits>(limits);
  const has = limits.per_txn != null || limits.daily != null || limits.weekly != null || limits.monthly != null;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(limits); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {has ? <><ShieldCheck className="mr-1 h-3.5 w-3.5" />Custom</> : <><Settings className="mr-1 h-3.5 w-3.5" />Default</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Withdrawal limits — {student.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Leave a field blank to inherit the school default
          {defaults ? ` (per-txn ${defaults.per_txn ?? "∞"}, ${defaults.daily ?? "∞"}/day, ${defaults.weekly ?? "∞"}/wk, ${defaults.monthly ?? "∞"}/mo)` : ""}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <LimitInput label="Max per transaction (FCFA)" value={v.per_txn} onChange={(x) => setV((s) => ({ ...s, per_txn: x }))} />
          <LimitInput label="Max per day" value={v.daily} onChange={(x) => setV((s) => ({ ...s, daily: x }))} />
          <LimitInput label="Max per week" value={v.weekly} onChange={(x) => setV((s) => ({ ...s, weekly: x }))} />
          <LimitInput label="Max per month" value={v.monthly} onChange={(x) => setV((s) => ({ ...s, monthly: x }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onSave({ per_txn: null, daily: null, weekly: null, monthly: null }); setOpen(false); }}>Clear overrides</Button>
          <Button onClick={() => { onSave(v); setOpen(false); }}>Save limits</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
