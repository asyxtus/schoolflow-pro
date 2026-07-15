import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { financeReport } from "@/lib/reports-finance.functions";
import { Wallet, TrendingUp, AlertCircle, Banknote, Bus, Wrench, PiggyBank } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

const qo = (from?: string, to?: string) =>
  queryOptions({ queryKey: ["finance-report", from, to], queryFn: () => financeReport({ data: { from, to } }) });

export const Route = createFileRoute("/_authenticated/reports/finance")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: FinanceReportPage,
});

function FinanceReportPage() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const fetchFn = useServerFn(financeReport);
  const { data } = useSuspenseQuery(qo());
  const [report, setReport] = useState(data);

  async function refresh() {
    const r = await fetchFn({ data: { from: from || undefined, to: to || undefined } });
    setReport(r);
  }

  const stats = [
    { label: "Collected", value: report.totals.collected, icon: TrendingUp, tone: "text-primary" },
    { label: "Outstanding", value: report.totals.outstanding, icon: AlertCircle, tone: "text-destructive" },
    { label: "Invoiced", value: report.totals.invoiced, icon: Banknote, tone: "text-foreground" },
    { label: "Wallet Balances", value: report.totals.wallet, icon: PiggyBank, tone: "text-foreground" },
    { label: "Payroll (paid)", value: report.totals.payroll, icon: Wallet, tone: "text-foreground" },
    { label: "Transport (monthly)", value: report.totals.transport, icon: Bus, tone: "text-foreground" },
    { label: "Incident/Maintenance", value: report.totals.incidents, icon: Wrench, tone: "text-foreground" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">Consolidated view of school finances.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="text-xs text-muted-foreground">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><label className="text-xs text-muted-foreground">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={refresh}>Apply</Button>
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.tone}`} />
              </div>
              <div className={`mt-2 text-lg font-semibold ${s.tone}`}>{fmt(s.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Collected by Method</CardTitle></CardHeader>
          <CardContent>
            {report.byMethod.length === 0 ? <p className="text-sm text-muted-foreground">No payments in range.</p> : (
              <div className="space-y-2">
                {report.byMethod.map((m) => {
                  const max = Math.max(...report.byMethod.map((x) => x.total));
                  const pct = max ? (m.total / max) * 100 : 0;
                  return (
                    <div key={m.method}>
                      <div className="flex justify-between text-sm"><span className="capitalize">{m.method}</span><span>{fmt(m.total)}</span></div>
                      <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Collection</CardTitle></CardHeader>
          <CardContent>
            {report.byMonth.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
              <div className="space-y-2">
                {report.byMonth.map((m) => {
                  const max = Math.max(...report.byMonth.map((x) => x.total));
                  const pct = max ? (m.total / max) * 100 : 0;
                  return (
                    <div key={m.month}>
                      <div className="flex justify-between text-sm"><span>{m.month}</span><span>{fmt(m.total)}</span></div>
                      <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By Class</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Class</th><th className="py-2 text-right">Collected</th><th className="py-2 text-right">Outstanding</th></tr>
              </thead>
              <tbody>
                {report.byClass.map((r) => (
                  <tr key={r.class_name} className="border-t border-border">
                    <td className="py-2">{r.class_name}</td>
                    <td className="py-2 text-right">{fmt(r.collected)}</td>
                    <td className="py-2 text-right text-destructive">{fmt(r.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Receipt</th><th className="py-2">Student</th><th className="py-2">Class</th><th className="py-2">Method</th><th className="py-2">Date</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {report.recent.map((p) => {
                  const s = (p as { students?: { first_name?: string; last_name?: string; class_name?: string } }).students;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{p.receipt_no}</td>
                      <td className="py-2">{s ? `${s.first_name ?? ""} ${s.last_name ?? ""}` : "—"}</td>
                      <td className="py-2">{s?.class_name ?? "—"}</td>
                      <td className="py-2 capitalize">{p.method}</td>
                      <td className="py-2">{new Date(p.paid_at).toLocaleDateString()}</td>
                      <td className="py-2 text-right">{fmt(p.amount_fcfa ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}