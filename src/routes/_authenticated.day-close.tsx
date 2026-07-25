import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock, Wallet, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { dayReconciliation, closeDay, reopenDay } from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/day-close")({
  component: DayClosePage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

function DayClosePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  const reconFn = useServerFn(dayReconciliation);
  const closeFn = useServerFn(closeDay);
  const reopenFn = useServerFn(reopenDay);

  const q = useQuery({ queryKey: ["day-close", date], queryFn: () => reconFn({ data: { date } }) });
  const totals = q.data?.totals;
  const closure = q.data?.closure;

  const closeMut = useMutation({
    mutationFn: async () => closeFn({ data: { date, counted_cash: countedCash ? Number(countedCash) : undefined, notes } }),
    onSuccess: () => { toast.success("Day closed"); qc.invalidateQueries({ queryKey: ["day-close"] }); setCountedCash(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMut = useMutation({
    mutationFn: async () => reopenFn({ data: { date, reason: reopenReason } }),
    onSuccess: () => { toast.success("Day re-opened"); qc.invalidateQueries({ queryKey: ["day-close"] }); setReopenReason(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const expected = totals?.cash ?? 0;
  const counted = countedCash ? Number(countedCash) : expected;
  const variance = counted - expected;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6">
      <PageHeader title="Daily cash close" description="End-of-day reconciliation — locks that day's payments once closed." />

      <div className="flex items-end gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        {closure && (
          <Badge variant="secondary" className="mb-2">
            <Lock className="mr-1 h-3 w-3" /> Closed on {new Date(closure.closed_at).toLocaleString()}
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Totals recorded on {date}</h2>
          {q.isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(["cash","momo","bank","cheque","other"] as const).map((k) => (
                <div key={k} className="rounded-md border p-3">
                  <div className="text-xs uppercase text-muted-foreground">{k}</div>
                  <div className="font-semibold">{fmt((totals?.[k] as number) ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {totals?.count ?? 0} payment(s) · {totals?.voided ?? 0} voided
          </div>
        </CardContent>
      </Card>

      {!closure ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">Close the day</h2>
            <p className="text-sm text-muted-foreground">
              After closing, only the Principal can modify payments dated {date}. Enter counted cash to check for variance.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Counted cash on hand (FCFA)</Label>
                <Input inputMode="numeric" value={countedCash} onChange={(e) => setCountedCash(e.target.value.replace(/\D/g, ""))} placeholder={String(expected)} />
              </div>
              <div>
                <Label className="text-xs">Variance (counted − expected)</Label>
                <div className={`mt-2 font-semibold ${variance === 0 ? "text-primary" : "text-amber-700"}`}>
                  {variance > 0 ? "+" : ""}{fmt(variance)}
                  {variance !== 0 && <AlertTriangle className="ml-2 inline h-4 w-4" />}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything unusual?" rows={2} />
            </div>
            <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              <Lock className="mr-2 h-4 w-4" /> Close day
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Re-open (Principal only)</h2>
            {closure.cash_variance !== null && closure.cash_variance !== 0 && (
              <div className="text-sm text-amber-700">Recorded variance: {fmt(closure.cash_variance)}</div>
            )}
            {closure.notes && <div className="text-sm text-muted-foreground">Notes: {closure.notes}</div>}
            <div>
              <Label className="text-xs">Reason</Label>
              <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Why are you re-opening?" />
            </div>
            <Button variant="outline" onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending || reopenReason.trim().length < 4}>
              <Unlock className="mr-2 h-4 w-4" /> Re-open day
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}