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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, RotateCcw, Lock, Unlock } from "lucide-react";
import {
  getPayrollRun,
  setRunStatus,
  markPayslipPaid,
  unmarkPayslipPaid,
  type PayMethod,
} from "@/lib/hr.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const qo = (id: string) =>
  queryOptions({
    queryKey: ["payroll", "run", id],
    queryFn: () => getPayrollRun({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/payroll/$runId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qo(params.runId)),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const { data } = useSuspenseQuery(qo(runId));
  const router = useRouter();
  const setStatus = useServerFn(setRunStatus);
  const markPaid = useServerFn(markPayslipPaid);
  const unmark = useServerFn(unmarkPayslipPaid);

  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("bank");
  const [ref, setRef] = useState("");

  if (!data?.run) return <div className="p-6">Run not found.</div>;
  const r = data.run;
  const locked = r.status !== "draft";

  async function changeStatus(s: "draft" | "finalized" | "paid") {
    try {
      await setStatus({ data: { id: runId, status: s } });
      toast.success("Status updated");
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function submitPay() {
    if (!payOpen) return;
    try {
      await markPaid({ data: { id: payOpen, payment_method: method, reference: ref } });
      toast.success("Marked paid");
      setPayOpen(null);
      setRef("");
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/payroll">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All runs
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Payroll — {r.period}</h1>
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <Badge
              variant={
                r.status === "paid" ? "default" : r.status === "finalized" ? "secondary" : "outline"
              }
              className="capitalize"
            >
              {r.status}
            </Badge>
            {r.notes && <> · {r.notes}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {r.status === "draft" && (
            <Button onClick={() => changeStatus("finalized")}>
              <Lock className="mr-2 h-4 w-4" />
              Finalize
            </Button>
          )}
          {r.status === "finalized" && (
            <>
              <Button variant="outline" onClick={() => changeStatus("draft")}>
                <Unlock className="mr-2 h-4 w-4" />
                Reopen
              </Button>
              <Button onClick={() => changeStatus("paid")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark all as paid
              </Button>
            </>
          )}
          {r.status === "paid" && (
            <Button variant="outline" onClick={() => changeStatus("finalized")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert to finalized
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Payslips" value={data.payslips.length.toString()} />
        <Stat label="Gross total" value={fmt(r.total_gross_fcfa)} />
        <Stat label="Deductions" value={fmt(r.total_deductions_fcfa)} />
        <Stat label="Net total" value={fmt(r.total_net_fcfa)} accent />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">Staff</th>
                <th>Position</th>
                <th className="text-right">Base</th>
                <th className="text-right">Allowances</th>
                <th className="text-right">Deductions</th>
                <th className="text-right">Net</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.payslips.map((p) => {
                const staff = p.staff as {
                  first_name: string;
                  last_name: string;
                  matricule?: string | null;
                  position: string;
                } | null;
                const allowSum = (p.gross_fcfa ?? 0) - (p.base_salary_fcfa ?? 0);
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {staff?.first_name} {staff?.last_name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {staff?.matricule ?? "—"}
                      </div>
                    </td>
                    <td className="capitalize">{staff?.position.replace("_", " ")}</td>
                    <td className="text-right font-mono">{fmt(p.base_salary_fcfa)}</td>
                    <td className="text-right font-mono">{fmt(allowSum)}</td>
                    <td className="text-right font-mono">{fmt(p.deductions_total_fcfa)}</td>
                    <td className="text-right font-mono font-semibold">{fmt(p.net_fcfa)}</td>
                    <td>
                      <Badge
                        variant={p.status === "paid" ? "default" : "outline"}
                        className="capitalize"
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="text-right space-x-1">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/payroll/payslip/$payslipId" params={{ payslipId: p.id }}>
                          View
                        </Link>
                      </Button>
                      {locked && p.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPayOpen(p.id);
                            setMethod("bank");
                            setRef("");
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                      {p.status === "paid" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await unmark({ data: { id: p.id } });
                            router.invalidate();
                          }}
                        >
                          Undo
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.payslips.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No payslips. Add active staff, then create a new run.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="momo">MoMo</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Transfer ID / receipt no."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submitPay}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
