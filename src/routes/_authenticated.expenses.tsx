import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, CheckCircle2, XCircle, TrendingDown, TrendingUp, Wallet, Building2, Tag, Receipt, Download } from "lucide-react";
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
import {
  listExpenseCategories, upsertExpenseCategory, deleteExpenseCategory,
  listVendors, upsertVendor, deleteVendor,
  listExpenses, upsertExpense, deleteExpense, setExpenseStatus,
  cashPosition, type ExpenseMethod, type ExpenseStatus,
} from "@/lib/expenses.functions";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const METHODS: ExpenseMethod[] = ["cash", "momo", "bank", "cheque", "other"];

function ExpensesPage() {
  const qc = useQueryClient();
  const catsFn = useServerFn(listExpenseCategories);
  const upsertCatFn = useServerFn(upsertExpenseCategory);
  const delCatFn = useServerFn(deleteExpenseCategory);
  const vendorsFn = useServerFn(listVendors);
  const upsertVendorFn = useServerFn(upsertVendor);
  const delVendorFn = useServerFn(deleteVendor);
  const expsFn = useServerFn(listExpenses);
  const upsertExpFn = useServerFn(upsertExpense);
  const delExpFn = useServerFn(deleteExpense);
  const setStatusFn = useServerFn(setExpenseStatus);
  const cashFn = useServerFn(cashPosition);

  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const catsQ = useQuery({ queryKey: ["expense-categories"], queryFn: () => catsFn() });
  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: () => vendorsFn() });
  const expsQ = useQuery({
    queryKey: ["expenses", statusFilter, catFilter],
    queryFn: () => expsFn({ data: { status: statusFilter, categoryId: catFilter === "all" ? undefined : catFilter } }),
  });
  const cashQ = useQuery({ queryKey: ["cash-position"], queryFn: () => cashFn({ data: {} }) });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["cash-position"] });
    qc.invalidateQueries({ queryKey: ["expense-categories"] });
    qc.invalidateQueries({ queryKey: ["vendors"] });
  };

  const totals = cashQ.data?.totals;

  // ── Expense dialog ────────────────────────────────────────────────
  const [expOpen, setExpOpen] = useState(false);
  const [expEdit, setExpEdit] = useState<null | { id?: string; label: string; amount_fcfa: number; method: ExpenseMethod; category_id: string; vendor_id: string; reference: string; note: string; spent_at: string; status: ExpenseStatus }>(null);
  const openExpNew = () => {
    setExpEdit({ label: "", amount_fcfa: 0, method: "cash", category_id: "", vendor_id: "", reference: "", note: "", spent_at: new Date().toISOString().slice(0, 10), status: "approved" });
    setExpOpen(true);
  };

  const saveExp = useMutation({
    mutationFn: () => upsertExpFn({ data: {
      id: expEdit!.id,
      label: expEdit!.label,
      amount_fcfa: Number(expEdit!.amount_fcfa),
      method: expEdit!.method,
      category_id: expEdit!.category_id || null,
      vendor_id: expEdit!.vendor_id || null,
      reference: expEdit!.reference || undefined,
      note: expEdit!.note || undefined,
      spent_at: expEdit!.spent_at ? new Date(expEdit!.spent_at).toISOString() : undefined,
      status: expEdit!.status,
    } }),
    onSuccess: () => { toast.success("Expense saved"); setExpOpen(false); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delExp = useMutation({
    mutationFn: (id: string) => delExpFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ExpenseStatus }) => setStatusFn({ data: { id, status } }),
    onSuccess: () => { toast.success("Updated"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Category dialog ───────────────────────────────────────────────
  const [catOpen, setCatOpen] = useState(false);
  const [catEdit, setCatEdit] = useState<{ id?: string; name: string; description: string }>({ name: "", description: "" });
  const saveCat = useMutation({
    mutationFn: () => upsertCatFn({ data: { id: catEdit.id, name: catEdit.name, description: catEdit.description || undefined } }),
    onSuccess: () => { toast.success("Category saved"); setCatOpen(false); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delCat = useMutation({
    mutationFn: (id: string) => delCatFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Vendor dialog ─────────────────────────────────────────────────
  const [venOpen, setVenOpen] = useState(false);
  const [venEdit, setVenEdit] = useState<{ id?: string; name: string; phone: string; email: string; note: string }>({ name: "", phone: "", email: "", note: "" });
  const saveVen = useMutation({
    mutationFn: () => upsertVendorFn({ data: { id: venEdit.id, name: venEdit.name, phone: venEdit.phone || undefined, email: venEdit.email || undefined, note: venEdit.note || undefined } }),
    onSuccess: () => { toast.success("Vendor saved"); setVenOpen(false); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delVen = useMutation({
    mutationFn: (id: string) => delVendorFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const header = ["Date", "Label", "Category", "Vendor", "Method", "Amount FCFA", "Status", "Reference", "Note"];
    const rows = (expsQ.data ?? []).map((e) => [
      new Date(e.spent_at).toISOString().slice(0, 10),
      e.label,
      (e as { expense_categories?: { name?: string } }).expense_categories?.name ?? "",
      (e as { vendors?: { name?: string } }).vendors?.name ?? "",
      e.method,
      String(e.amount_fcfa),
      e.status,
      e.reference ?? "",
      (e.note ?? "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & cash position"
        description="Track outgoing money and see how much cash the school actually has."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={openExpNew}><Plus className="mr-1 h-4 w-4" />New expense</Button>
          </div>
        }
      />

      {/* Cash position */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Collected (YTD)" value={fmt(totals?.collected ?? 0)} icon={TrendingUp} tone="accent" />
        <StatCard label="Expenses (YTD)" value={fmt(totals?.expenses ?? 0)} icon={TrendingDown} />
        <StatCard label="Payroll paid" value={fmt(totals?.payroll ?? 0)} icon={Receipt} />
        <StatCard label="Net cash position" value={fmt(totals?.net ?? 0)} icon={Wallet} tone="accent" hint={totals?.pendingExpenses ? `${fmt(totals.pendingExpenses)} pending` : undefined} />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses"><Receipt className="mr-1 h-4 w-4" />Expenses</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="mr-1 h-4 w-4" />Categories</TabsTrigger>
          <TabsTrigger value="vendors"><Building2 className="mr-1 h-4 w-4" />Vendors</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        {/* Expenses list */}
        <TabsContent value="expenses" className="space-y-3">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ExpenseStatus | "all")}>
                <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="md:w-[220px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(catsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {expsQ.isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : (expsQ.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No expenses recorded yet.</p>
              ) : (
                <ul className="divide-y">
                  {(expsQ.data ?? []).map((e) => {
                    const catName = (e as { expense_categories?: { name?: string } }).expense_categories?.name;
                    const venName = (e as { vendors?: { name?: string } }).vendors?.name;
                    return (
                      <li key={e.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{e.label}</p>
                            {catName && <Badge variant="secondary">{catName}</Badge>}
                            {venName && <Badge variant="outline">{venName}</Badge>}
                            <Badge variant="outline" className="uppercase">{e.method}</Badge>
                            <Badge className={
                              e.status === "approved" ? "bg-emerald-100 text-emerald-900" :
                              e.status === "pending" ? "bg-amber-100 text-amber-900" :
                              "bg-red-100 text-red-900"
                            }>{e.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(e.spent_at).toLocaleDateString()} {e.reference ? `· Ref ${e.reference}` : ""}
                            {e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold">{fmt(e.amount_fcfa)}</p>
                          {e.status === "pending" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: e.id, status: "approved" })} title="Approve">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: e.id, status: "rejected" })} title="Reject">
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => {
                            setExpEdit({
                              id: e.id, label: e.label, amount_fcfa: e.amount_fcfa, method: e.method as ExpenseMethod,
                              category_id: e.category_id ?? "", vendor_id: e.vendor_id ?? "",
                              reference: e.reference ?? "", note: e.note ?? "",
                              spent_at: new Date(e.spent_at).toISOString().slice(0, 10),
                              status: e.status as ExpenseStatus,
                            });
                            setExpOpen(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this expense?")) delExp.mutate(e.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setCatEdit({ name: "", description: "" }); setCatOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />New category
            </Button>
          </div>
          <Card><CardContent className="p-0">
            {(catsQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No categories yet. Common examples: Utilities, Supplies, Maintenance, Food, Transport, Cleaning.</p>
            ) : (
              <ul className="divide-y">
                {(catsQ.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setCatEdit({ id: c.id, name: c.name, description: c.description ?? "" }); setCatOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete category?")) delCat.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Vendors */}
        <TabsContent value="vendors" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setVenEdit({ name: "", phone: "", email: "", note: "" }); setVenOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />New vendor
            </Button>
          </div>
          <Card><CardContent className="p-0">
            {(vendorsQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No vendors yet. Add your regular suppliers to link them to expenses.</p>
            ) : (
              <ul className="divide-y">
                {(vendorsQ.data ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[v.phone, v.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setVenEdit({ id: v.id, name: v.name, phone: v.phone ?? "", email: v.email ?? "", note: v.note ?? "" }); setVenOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete vendor?")) delVen.mutate(v.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Breakdown */}
        <TabsContent value="breakdown" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Card><CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">By category</p>
              {(cashQ.data?.byCategory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(cashQ.data?.byCategory ?? []).map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="font-medium">{fmt(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">By payment method</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Money in</p>
                  <ul className="space-y-1 text-sm">
                    {(cashQ.data?.byMethodIn ?? []).map((m) => (
                      <li key={m.method} className="flex justify-between"><span className="capitalize">{m.method}</span><span className="text-emerald-700">{fmt(m.total)}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Money out</p>
                  <ul className="space-y-1 text-sm">
                    {(cashQ.data?.byMethodOut ?? []).map((m) => (
                      <li key={m.method} className="flex justify-between"><span className="capitalize">{m.method}</span><span className="text-red-700">{fmt(m.total)}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent></Card>
          </div>
          <Card><CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">Monthly cash flow</p>
            {(cashQ.data?.byMonth ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in the selected range.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(cashQ.data?.byMonth ?? []).map((m) => (
                  <li key={m.month} className="grid grid-cols-4 gap-2">
                    <span className="font-medium">{m.month}</span>
                    <span className="text-emerald-700">+ {fmt(m.in)}</span>
                    <span className="text-red-700">− {fmt(m.out)}</span>
                    <span className="text-right font-semibold">{fmt(m.in - m.out)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Expense dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{expEdit?.id ? "Edit expense" : "New expense"}</DialogTitle></DialogHeader>
          {expEdit && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Label</Label>
                <Input value={expEdit.label} onChange={(e) => setExpEdit({ ...expEdit, label: e.target.value })} placeholder="e.g. Electricity bill – October" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Amount (FCFA)</Label>
                  <Input type="number" min={0} value={expEdit.amount_fcfa} onChange={(e) => setExpEdit({ ...expEdit, amount_fcfa: Number(e.target.value) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={expEdit.spent_at} onChange={(e) => setExpEdit({ ...expEdit, spent_at: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Method</Label>
                  <Select value={expEdit.method} onValueChange={(v) => setExpEdit({ ...expEdit, method: v as ExpenseMethod })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={expEdit.status} onValueChange={(v) => setExpEdit({ ...expEdit, status: v as ExpenseStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Category</Label>
                  <Select value={expEdit.category_id || "none"} onValueChange={(v) => setExpEdit({ ...expEdit, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {(catsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Vendor</Label>
                  <Select value={expEdit.vendor_id || "none"} onValueChange={(v) => setExpEdit({ ...expEdit, vendor_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No vendor</SelectItem>
                      {(vendorsQ.data ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Reference</Label>
                <Input value={expEdit.reference} onChange={(e) => setExpEdit({ ...expEdit, reference: e.target.value })} placeholder="Invoice / receipt number" />
              </div>
              <div className="grid gap-1.5">
                <Label>Note</Label>
                <Textarea rows={2} value={expEdit.note} onChange={(e) => setExpEdit({ ...expEdit, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpOpen(false)}>Cancel</Button>
            <Button onClick={() => saveExp.mutate()} disabled={!expEdit?.label || !expEdit?.amount_fcfa}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catEdit.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={catEdit.name} onChange={(e) => setCatEdit({ ...catEdit, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={2} value={catEdit.description} onChange={(e) => setCatEdit({ ...catEdit, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button onClick={() => saveCat.mutate()} disabled={!catEdit.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor dialog */}
      <Dialog open={venOpen} onOpenChange={setVenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{venEdit.id ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={venEdit.name} onChange={(e) => setVenEdit({ ...venEdit, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={venEdit.phone} onChange={(e) => setVenEdit({ ...venEdit, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={venEdit.email} onChange={(e) => setVenEdit({ ...venEdit, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Note</Label><Textarea rows={2} value={venEdit.note} onChange={(e) => setVenEdit({ ...venEdit, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenOpen(false)}>Cancel</Button>
            <Button onClick={() => saveVen.mutate()} disabled={!venEdit.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}