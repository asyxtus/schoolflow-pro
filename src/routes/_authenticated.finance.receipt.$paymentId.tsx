import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaymentReceipt } from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/finance/receipt/$paymentId")({
  component: ReceiptPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

function ReceiptPage() {
  const { paymentId } = Route.useParams();
  const fn = useServerFn(getPaymentReceipt);
  const { data, isLoading } = useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: () => fn({ data: { id: paymentId } }),
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 300);
  }, [data]);

  if (isLoading || !data?.payment) {
    return <div className="p-10 text-center text-muted-foreground">Loading receipt…</div>;
  }
  const p = data.payment;
  const s = (p as { students?: { first_name?: string; last_name?: string; matricule?: string; class_name?: string; fee_balance?: number } }).students;
  const school = data.school;

  return (
    <div className="min-h-screen bg-muted/30 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl bg-white shadow-sm print:shadow-none">
        <div className="flex items-center justify-end gap-2 p-3 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>
        <div className="border-t border-b p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold">{school?.name}</div>
              <div className="text-xs text-muted-foreground">
                {[school?.city, school?.region].filter(Boolean).join(", ")}
              </div>
              {school?.code && <div className="text-xs text-muted-foreground">Code: {school.code}</div>}
              {school?.motto && <div className="mt-1 text-xs italic text-muted-foreground">« {school.motto} »</div>}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</div>
              <div className="font-mono text-sm">{p.receipt_no ?? "—"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleString()}</div>
            </div>
          </div>

          <h1 className="mt-8 text-center text-lg font-semibold uppercase tracking-wider">
            Payment Receipt
          </h1>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Student</dt>
            <dd className="font-medium">{s?.first_name} {s?.last_name}</dd>
            <dt className="text-muted-foreground">Matricule</dt>
            <dd>{s?.matricule ?? "—"}</dd>
            <dt className="text-muted-foreground">Class</dt>
            <dd>{s?.class_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Method</dt>
            <dd className="uppercase">{p.method}</dd>
            {p.reference && (<><dt className="text-muted-foreground">Reference</dt><dd>{p.reference}</dd></>)}
            {p.note && (<><dt className="text-muted-foreground">Note</dt><dd>{p.note}</dd></>)}
          </dl>

          <div className="mt-8 flex items-end justify-between rounded-md border bg-muted/40 p-4">
            <div className="text-xs uppercase text-muted-foreground">Amount received</div>
            <div className="text-2xl font-semibold text-primary">{fmt(p.amount_fcfa)}</div>
          </div>
          <div className="mt-2 text-right text-xs text-muted-foreground">
            Remaining balance: <span className="font-medium">{fmt(s?.fee_balance ?? 0)}</span>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
            <div>
              <div className="border-t pt-2">Cashier</div>
              <div className="mt-1">{data.cashier?.full_name ?? "—"}</div>
            </div>
            <div>
              <div className="border-t pt-2">Payer signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}