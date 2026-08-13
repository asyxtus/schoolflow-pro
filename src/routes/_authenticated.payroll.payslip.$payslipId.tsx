import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { getPayslip } from "@/lib/hr.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";
const qo = (id: string) =>
  queryOptions({ queryKey: ["payslip", id], queryFn: () => getPayslip({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/payroll/payslip/$payslipId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(qo(params.payslipId)),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: PayslipView,
});

type Item = { label: string; amount: number };

function PayslipView() {
  const { payslipId } = Route.useParams();
  const { data } = useSuspenseQuery(qo(payslipId));
  if (!data) return <div className="p-6">Not found.</div>;
  const staff = data.staff as {
    first_name: string;
    last_name: string;
    matricule?: string | null;
    position: string;
    department?: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    momo_number?: string | null;
  };
  const run = data.run as { period: string; status: string };
  const school = data.school as {
    name: string;
    city?: string | null;
    region?: string | null;
    code?: string | null;
  };
  const allowances = (data.allowances as Item[]) ?? [];
  const deductions = (data.deductions as Item[]) ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between mb-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payroll/$runId" params={{ runId: data.run_id }}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to run
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-8 print:border-0 print:shadow-none">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h1 className="text-2xl font-semibold">{school.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[school.city, school.region].filter(Boolean).join(", ")}
          </p>
          <p className="mt-2 text-lg font-medium">Payslip — {run.period}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Employee</div>
            <div className="font-medium">
              {staff.first_name} {staff.last_name}
            </div>
            <div className="capitalize text-muted-foreground">
              {staff.position.replace("_", " ")} · {staff.department ?? "—"}
            </div>
            <div className="font-mono text-xs mt-1">Matricule: {staff.matricule ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="capitalize font-medium">{data.status}</div>
            {data.paid_at && (
              <div className="text-xs text-muted-foreground mt-1">
                Paid: {new Date(data.paid_at).toLocaleDateString()}
              </div>
            )}
            {data.payment_method && (
              <div className="text-xs text-muted-foreground capitalize">
                Method: {data.payment_method}
              </div>
            )}
            {data.reference && (
              <div className="text-xs text-muted-foreground">Ref: {data.reference}</div>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Earnings</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">Base salary</td>
              <td className="text-right font-mono">{fmt(data.base_salary_fcfa)}</td>
            </tr>
            {allowances.map((a, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{a.label}</td>
                <td className="text-right font-mono">{fmt(a.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2">Gross</td>
              <td className="text-right font-mono">{fmt(data.gross_fcfa)}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Deductions</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {deductions.length ? (
              deductions.map((a, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{a.label}</td>
                  <td className="text-right font-mono">{fmt(a.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2 text-muted-foreground" colSpan={2}>
                  None
                </td>
              </tr>
            )}
            <tr className="font-semibold">
              <td className="py-2">Total deductions</td>
              <td className="text-right font-mono">{fmt(data.deductions_total_fcfa)}</td>
            </tr>
          </tbody>
        </table>

        <div className="rounded-md border-l-4 border-primary bg-primary/5 p-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Net pay</div>
          <div className="text-2xl font-semibold text-primary">{fmt(data.net_fcfa)}</div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-10 text-xs text-muted-foreground">
          <div>
            <div className="border-t pt-2">Employee signature</div>
          </div>
          <div>
            <div className="border-t pt-2">Bursar signature</div>
          </div>
        </div>
      </div>

      <style>{`@media print { body { background: white; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}
