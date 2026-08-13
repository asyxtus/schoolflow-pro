import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyDiocese, getDioceseSnapshot } from "@/lib/diocese.functions";
import { listDioceseApprovalRequests, reviewApprovalRequest } from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/diocese")({
  component: DiocesePage,
});

function DiocesePage() {
  const fetchDiocese = useServerFn(getMyDiocese);
  const dioceseQ = useQuery({ queryKey: ["my-diocese"], queryFn: () => fetchDiocese() });

  if (dioceseQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!dioceseQ.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <PageHeader
          title="Diocese"
          description="Cross-school visibility and approvals for diocese leadership."
        />
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This account isn't set up as a diocese administrator, so there's no diocese to show.
            Diocese access is granted directly in the database — ask whoever manages your Supabase
            project to link your account to a diocese.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DioceseDashboard dioceseId={dioceseQ.data.id} dioceseName={dioceseQ.data.name} />;
}

function DioceseDashboard({ dioceseId, dioceseName }: { dioceseId: string; dioceseName: string }) {
  const qc = useQueryClient();
  const fetchSnapshot = useServerFn(getDioceseSnapshot);
  const fetchQueue = useServerFn(listDioceseApprovalRequests);
  const reviewFn = useServerFn(reviewApprovalRequest);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const snapshotQ = useQuery({
    queryKey: ["diocese-snapshot", dioceseId],
    queryFn: () => fetchSnapshot({ data: { dioceseId } }),
  });
  const queueQ = useQuery({
    queryKey: ["diocese-approval-queue", dioceseId],
    queryFn: () => fetchQueue({ data: { dioceseId } }),
  });

  const invalidateQueue = () => qc.invalidateQueries({ queryKey: ["diocese-approval-queue"] });

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setReviewingId(id);
    try {
      await reviewFn({ data: { id, decision } });
      invalidateQueue();
      toast.success(decision === "approved" ? "Approved" : "Rejected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReviewingId(null);
    }
  };

  const totals = (snapshotQ.data ?? []).reduce(
    (acc, s) => ({
      students: acc.students + s.active_students,
      staff: acc.staff + s.active_staff,
      collected: acc.collected + s.fee_collected_mtd,
      outstanding: acc.outstanding + s.fee_outstanding,
      incidents: acc.incidents + s.open_discipline_incidents,
    }),
    { students: 0, staff: 0, collected: 0, outstanding: 0, incidents: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader title={dioceseName} description="Diocese-wide roll-up across every school." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Schools</div>
            <div className="text-2xl font-semibold">{snapshotQ.data?.length ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active students</div>
            <div className="text-2xl font-semibold">{totals.students}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active staff</div>
            <div className="text-2xl font-semibold">{totals.staff}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Collected (MTD)</div>
            <div className="text-2xl font-semibold">{totals.collected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Open incidents</div>
            <div className="text-2xl font-semibold">{totals.incidents}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Schools</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead className="text-right">Active students</TableHead>
              <TableHead className="text-right">Active staff</TableHead>
              <TableHead className="text-right">Collected (MTD)</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Open incidents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(snapshotQ.data ?? []).map((s) => (
              <TableRow key={s.school_id}>
                <TableCell className="font-medium">{s.school_name}</TableCell>
                <TableCell className="text-right">{s.active_students}</TableCell>
                <TableCell className="text-right">{s.active_staff}</TableCell>
                <TableCell className="text-right">{s.fee_collected_mtd.toLocaleString()}</TableCell>
                <TableCell className="text-right">{s.fee_outstanding.toLocaleString()}</TableCell>
                <TableCell className="text-right">{s.open_discipline_incidents}</TableCell>
              </TableRow>
            ))}
            {(snapshotQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No schools linked to this diocese yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pending approvals</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Request</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(queueQ.data ?? []).map((r) => {
              const school = (r as { schools?: { name?: string } }).schools;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{school?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.title}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {r.amount_fcfa ? `${r.amount_fcfa.toLocaleString()} FCFA` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={reviewingId === r.id}
                        onClick={() => decide(r.id, "approved")}
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={reviewingId === r.id}
                        onClick={() => decide(r.id, "rejected")}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(queueQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                  Nothing pending review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
