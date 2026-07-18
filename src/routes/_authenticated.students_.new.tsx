import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { createStudent } from "@/lib/students.functions";
import { recordPayment, type PaymentMethod } from "@/lib/finance.functions";
import { useClassOptions } from "@/hooks/use-classes";

export const Route = createFileRoute("/_authenticated/students_/new")({
  component: NewStudentPage,
});

function NewStudentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: classes = [] } = useClassOptions();
  const [payFor, setPayFor] = useState<null | { studentId: string; invoices: Array<{ label: string; amount_fcfa: number; due_date: string | null }> }>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    matricule: "",
    dateOfBirth: "",
    gender: "" as "" | "male" | "female",
    className: "",
    section: "",
    status: "active" as const,
    feeBalance: "",
    notes: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof createStudent>[0]) => createStudent(input),
    onSuccess: async ({ id, invoices }) => {
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await qc.invalidateQueries({ queryKey: ["student-fees"] });
      toast.success("Student added");
      if (invoices && invoices.length > 0) {
        setPayFor({ studentId: id, invoices });
      } else {
        navigate({ to: "/students/$studentId", params: { studentId: id } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.matricule) {
      toast.error("First name, last name and matricule are required");
      return;
    }
    mutation.mutate({
      data: {
        firstName: form.firstName,
        lastName: form.lastName,
        matricule: form.matricule,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        className: form.className || undefined,
        section: form.section || undefined,
        status: form.status,
        feeBalance: form.feeBalance ? Number(form.feeBalance) : undefined,
        notes: form.notes || undefined,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        guardianEmail: form.guardianEmail || undefined,
        guardianRelationship: form.guardianRelationship || undefined,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeader
        title="Add student"
        description="Register a new learner into your school"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/students">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name" required>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
            <Field label="Matricule" required>
              <Input value={form.matricule} onChange={(e) => set("matricule", e.target.value)} placeholder="SHC-2025-001" />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => set("gender", v as "male" | "female")}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Class">
              {classes.length > 0 ? (
                <Select value={form.className} onValueChange={(v) => { set("className", v); set("section", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                  <SelectContent>
                    {classes.filter((c) => c.active).map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.className} onChange={(e) => set("className", e.target.value)} placeholder="Form 1" />
              )}
            </Field>
            <Field label="Section">
              {(() => {
                const sections = classes.find((c) => c.name === form.className)?.sections ?? [];
                return sections.length > 0 ? (
                  <Select value={form.section} onValueChange={(v) => set("section", v)}>
                    <SelectTrigger><SelectValue placeholder="Select section…" /></SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.section} onChange={(e) => set("section", e.target.value)} placeholder="A" />
                );
              })()}
            </Field>
            <Field label="Fee balance (FCFA)">
              <Input type="number" min={0} value={form.feeBalance} onChange={(e) => set("feeBalance", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Primary guardian (optional)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
            </Field>
            <Field label="Relationship">
              <Input value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} placeholder="Father / Mother / Uncle" />
            </Field>
            <Field label="Phone">
              <Input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} placeholder="+237 6…" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Health, boarding, scholarships…" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/students">Cancel</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Add student"}
          </Button>
        </div>
      </form>

      {payFor && (
        <InitialPaymentDialog
          studentId={payFor.studentId}
          invoices={payFor.invoices}
          onDone={() => {
            const sid = payFor.studentId;
            setPayFor(null);
            qc.invalidateQueries({ queryKey: ["students"] });
            qc.invalidateQueries({ queryKey: ["payments"] });
            navigate({ to: "/students/$studentId", params: { studentId: sid } });
          }}
        />
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

function InitialPaymentDialog({
  studentId, invoices, onDone,
}: {
  studentId: string;
  invoices: Array<{ label: string; amount_fcfa: number; due_date: string | null }>;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    // Default: pre-select registration/required fees
    const initial: Record<number, boolean> = {};
    invoices.forEach((inv, idx) => {
      if (/registration|inscription/i.test(inv.label)) initial[idx] = true;
    });
    return initial;
  });
  const selectedTotal = invoices.reduce((s, i, idx) => s + (selected[idx] ? i.amount_fcfa : 0), 0);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const effectiveAmount = amountTouched ? amount : String(selectedTotal || "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(effectiveAmount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    const picked = invoices.filter((_, idx) => selected[idx]);
    const note = picked.length > 0 ? `Applied to: ${picked.map((p) => p.label).join("; ")}` : undefined;
    setBusy(true);
    try {
      await recordPayment({ data: { student_id: studentId, amount_fcfa: amt, method, reference: reference || undefined, note } });
      toast.success("Payment recorded");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onDone(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record initial payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-2">Select the fees being paid</div>
            <div className="space-y-1.5 text-sm">
              {invoices.map((i, idx) => (
                <label key={idx} className="flex items-center justify-between gap-3 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={!!selected[idx]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [idx]: !!v }))}
                    />
                    <span className="truncate">
                      {i.label}
                      {i.due_date && <span className="text-xs text-muted-foreground"> · Due {new Date(i.due_date).toLocaleDateString()}</span>}
                    </span>
                  </div>
                  <span className="font-medium whitespace-nowrap">{fmt(i.amount_fcfa)}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selected total</span>
              <span className="font-semibold">{fmt(selectedTotal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Amount to pay now (FCFA)</Label>
              <Input
                type="number"
                min="0"
                value={effectiveAmount}
                onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="momo">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo txn ID, receipt no." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone} disabled={busy}>Skip for now</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}