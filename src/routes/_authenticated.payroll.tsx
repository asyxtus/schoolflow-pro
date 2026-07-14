import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banknote, Plus, Trash2, ArrowRight } from "lucide-react";
import { listPayrollRuns, createPayrollRun, deletePayrollRun } from "@/lib/hr.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const qo = queryOptions({ queryKey: ["payroll", "runs"], queryFn: () => listPayrollRuns() });

export const Route = createFileRoute("/_authenticated/payroll")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: PayrollPage,
});

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function PayrollPage() {
  const { data: runs } = useSuspenseQuery(qo);
  const router = useRouter();
  const create = useServerFn(createPayrollRun);
  const del = useServerFn(deletePayrollRun);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [notes, setNotes] = useState("");

  async function submit() {
    try { const r = await create({ data: { period, notes } }); toast.success("Payroll run created"); setOpen(false); router.navigate({ to: "/payroll/$runId", params: { runId: r.id } }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this run and all its payslips?")) return;
    await del({ data: { id } }); router.invalidate();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Banknote className="h-7 w-7 text-primary" /> Payroll</h1>
          <p className="text-sm text-muted-foreground">Monthly payroll runs generate payslips for every active staff member.</p>
        </div>
        <Button onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4" />New payroll run</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Runs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2">Period</th><th>Status</th>
              <th className="text-right">Gross</th><th className="text-right">Deductions</th><th className="text-right">Net</th>
              <th className="px-3 py-2">Notes</th><th></th>
            </tr></thead>
            <tbody>
              {runs.map(r=>(
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.period}</td>
                  <td><Badge variant={r.status==='paid'?'default':r.status==='finalized'?'secondary':'outline'} className="capitalize">{r.status}</Badge></td>
                  <td className="text-right font-mono">{fmt(r.total_gross_fcfa)}</td>
                  <td className="text-right font-mono">{fmt(r.total_deductions_fcfa)}</td>
                  <td className="text-right font-mono font-semibold">{fmt(r.total_net_fcfa)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                  <td className="text-right space-x-1">
                    <Button asChild size="sm" variant="outline"><Link to="/payroll/$runId" params={{ runId: r.id }}>Open <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                    {r.status === 'draft' && <Button size="sm" variant="ghost" onClick={()=>remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {!runs.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No payroll runs yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New payroll run</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Period (YYYY-MM)</Label><Input value={period} onChange={(e)=>setPeriod(e.target.value)} placeholder="2026-07" /></div>
            <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional" /></div>
            <p className="text-xs text-muted-foreground">Draft payslips will be generated for every active staff member using their base salary and active recurring allowances/deductions.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}