import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listMyApprovalRequests,
  submitApprovalRequest,
  withdrawApprovalRequest,
  type ApprovalRequestType,
} from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

const TYPE_LABELS: Record<ApprovalRequestType, string> = {
  expense: "Expense",
  fee_structure_change: "Fee structure change",
  discount: "Discount",
  budget: "Budget",
  staffing: "Staffing",
  other: "Other",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listMyApprovalRequests);
  const submitFn = useServerFn(submitApprovalRequest);
  const withdrawFn = useServerFn(withdrawApprovalRequest);

  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<ApprovalRequestType>("expense");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const listQ = useQuery({ queryKey: ["approval-requests"], queryFn: () => fetchFn({ data: {} }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["approval-requests"] });

  const reset = () => {
    setRequestType("expense");
    setTitle("");
    setDescription("");
    setAmount("");
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Enter a title");
      return;
    }
    setBusy(true);
    try {
      await submitFn({
        data: {
          requestType,
          title,
          description: description || undefined,
          amountFcfa: amount ? Number(amount) : undefined,
        },
      });
      toast.success("Request submitted");
      reset();
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await withdrawFn({ data: { id } });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeader
        title="Approvals"
        description="Requests you've submitted for review, and their status."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New request
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="w-40">Type</TableHead>
              <TableHead className="w-28">Amount</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.title}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  )}
                  {r.status !== "pending" && r.review_note && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reviewer note: {r.review_note}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{TYPE_LABELS[r.request_type]}</TableCell>
                <TableCell className="text-sm">
                  {r.amount_fcfa ? `${r.amount_fcfa.toLocaleString()} FCFA` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell>
                  {r.status === "pending" && (
                    <Button size="icon" variant="ghost" onClick={() => withdraw(r.id)}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(listQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New approval request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={requestType}
                onValueChange={(v) => setRequestType(v as ApprovalRequestType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as ApprovalRequestType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Amount (FCFA, optional)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
