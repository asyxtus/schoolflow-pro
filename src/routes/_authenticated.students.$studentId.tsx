import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Printer,
  ShieldAlert,
  Wallet,
  Link as LinkIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStudentById } from "@/lib/students.functions";
import { getOrCreatePortalToken } from "@/lib/portal.functions";
import { getStudentBilling, recordPayment, type PaymentMethod } from "@/lib/finance.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { formatFCFA } from "@/lib/mock/students";
import type { Tables } from "@/integrations/supabase/types";
import {
  listDisciplineForStudent,
  resolveDisciplineIncident,
  reopenDisciplineIncident,
} from "@/lib/discipline.functions";
import { ReportIncidentDialog } from "@/components/report-incident-dialog";
import {
  listClinicVisitsForStudent,
  getHealthProfile,
  upsertHealthProfile,
} from "@/lib/clinic.functions";
import { RecordVisitDialog } from "@/components/record-visit-dialog";
import { DocumentVaultCard } from "@/components/document-vault-card";

/** Invalidate every cache that could show stale money numbers for this student, everywhere in the app. */
function invalidateAfterPayment(qc: ReturnType<typeof useQueryClient>, studentId: string) {
  qc.invalidateQueries({ queryKey: ["student", studentId] });
  qc.invalidateQueries({ queryKey: ["student-billing", studentId] });
  qc.invalidateQueries({ queryKey: ["finance-summary"] });
  qc.invalidateQueries({ queryKey: ["payments"] });
  qc.invalidateQueries({ queryKey: ["students"] });
  qc.invalidateQueries({ queryKey: ["student-fees"] });
  qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
}

const studentQueryOptions = (id: string) => ({
  queryKey: ["student", id] as const,
  queryFn: () => getStudentById({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/students/$studentId")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(studentQueryOptions(params.studentId));
  },
  component: StudentProfile,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Student not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This matricule doesn't exist in the roster.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/students">Back to students</Link>
      </Button>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Couldn't load student</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function StudentProfile() {
  const { studentId } = Route.useParams();
  const { data: student } = useSuspenseQuery(studentQueryOptions(studentId));
  const initials = student.first_name[0] + student.last_name[0];
  const feeTotal = student.total_billed ?? 0;
  const feePaid = student.total_paid ?? 0;
  const feePercent = feeTotal > 0 ? Math.round((Math.min(feePaid, feeTotal) / feeTotal) * 100) : 0;
  const regOwed = student.registration_owed ?? 0;
  const att = student.attendance_counts ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  const primaryGuardian = student.guardians?.find((g) => g.is_primary) ?? student.guardians?.[0];

  const tokenFn = useServerFn(getOrCreatePortalToken);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const genLink = useMutation({
    mutationFn: (rotate: boolean) => tokenFn({ data: { studentId, rotate } }),
    onSuccess: ({ token }) => {
      setPortalUrl(`${window.location.origin}/portal/${token}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/students">
            <ArrowLeft className="mr-1 h-4 w-4" /> All students
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${student.last_name} ${student.first_name}`}
        description={`${student.matricule} · ${student.class_name ?? "—"}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => genLink.mutate(false)}
              disabled={genLink.isPending}
            >
              <LinkIcon className="mr-2 h-4 w-4" /> Portal link
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Print profile
            </Button>
            <StudentPaymentDialog
              studentId={studentId}
              studentName={`${student.first_name} ${student.last_name}`}
              trigger={
                <Button size="sm">
                  <Wallet className="mr-2 h-4 w-4" /> Record payment
                </Button>
              }
            />
          </>
        }
      />

      {regOwed > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" />
            <span>
              <span className="font-semibold">Registration fee unpaid</span> — {formatFCFA(regOwed)}{" "}
              outstanding.
            </span>
          </div>
          <StudentPaymentDialog
            studentId={studentId}
            studentName={`${student.first_name} ${student.last_name}`}
            trigger={
              <Button size="sm" variant="destructive">
                Record payment
              </Button>
            }
          />
        </div>
      )}

      <Dialog open={!!portalUrl} onOpenChange={(o) => !o && setPortalUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardian portal link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share this private link with the family. Anyone with it can view fees, grades,
            attendance and messages for this student.
          </p>
          <Input readOnly value={portalUrl ?? ""} onFocus={(e) => e.currentTarget.select()} />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (portalUrl) {
                  navigator.clipboard.writeText(portalUrl);
                  toast.success("Copied");
                }
              }}
            >
              Copy link
            </Button>
            <Button
              variant="destructive"
              onClick={() => genLink.mutate(true)}
              disabled={genLink.isPending}
            >
              Rotate link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="h-2 bg-primary" />
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-base font-semibold text-foreground">
                {student.last_name} {student.first_name}
              </div>
              <div className="text-xs text-muted-foreground">
                Enrolled{" "}
                {student.enrolment_date
                  ? new Date(student.enrolment_date).toLocaleDateString()
                  : "—"}
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/10 capitalize text-primary"
            >
              {student.status}
            </Badge>
            <Separator />
            <dl className="w-full space-y-2 text-left text-sm">
              <InfoRow icon={GraduationCap} label="Class" value={student.class_name ?? "—"} />
              <InfoRow
                icon={CalendarDays}
                label="Date of birth"
                value={
                  student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"
                }
              />
              <InfoRow icon={MapPin} label="Section" value={student.section ?? "—"} />
              <InfoRow icon={ShieldAlert} label="Notes" value={student.notes ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Attendance (term)"
              value={att.total > 0 ? `${Number(student.attendance_rate ?? 0)}%` : "—"}
              tone={
                att.total === 0
                  ? "muted"
                  : Number(student.attendance_rate ?? 0) >= 90
                    ? "primary"
                    : "warning"
              }
            />
            <MetricCard label="Records logged" value={String(att.total)} tone="muted" />
            <MetricCard
              label="Fee balance"
              value={
                (student.fee_balance ?? 0) === 0 ? "Cleared" : formatFCFA(student.fee_balance ?? 0)
              }
              tone={(student.fee_balance ?? 0) === 0 ? "primary" : "warning"}
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="guardians">Guardians</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="discipline">Discipline</TabsTrigger>
              <TabsTrigger value="clinic">Clinic</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Academic snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <Row label="Section" value={student.section ?? "—"} />
                  <Row
                    label="Gender"
                    value={
                      student.gender === "male"
                        ? "Male"
                        : student.gender === "female"
                          ? "Female"
                          : "—"
                    }
                  />
                  <Row label="Emergency contact" value={student.guardian_phone ?? "—"} />
                  <Row
                    label="Enrolment date"
                    value={
                      student.enrolment_date
                        ? new Date(student.enrolment_date).toLocaleDateString()
                        : "—"
                    }
                  />
                  <Row label="Total invoiced" value={formatFCFA(feeTotal)} />
                  <Row label="Total paid" value={formatFCFA(feePaid)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guardians" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Guardians</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {student.guardians && student.guardians.length > 0 ? (
                    student.guardians.map((g) => (
                      <div key={g.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{g.full_name}</span>
                          {g.is_primary && (
                            <Badge variant="outline" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground capitalize">
                          {g.relationship ?? "Guardian"}
                        </div>
                        <div className="mt-2 space-y-1">
                          {g.phone && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {g.phone}
                            </div>
                          )}
                          {g.email && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {g.email}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : primaryGuardian ? (
                    <>
                      <Row label="Name" value={primaryGuardian.full_name} />
                      <Row
                        label="Phone"
                        value={
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {primaryGuardian.phone ?? "—"}
                          </span>
                        }
                      />
                      {primaryGuardian.email && (
                        <Row
                          label="Email"
                          value={
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {primaryGuardian.email}
                            </span>
                          }
                        />
                      )}
                      <Row label="Relationship" value={primaryGuardian.relationship ?? "—"} />
                    </>
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No guardian records on file.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fees" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Fees summary</CardTitle>
                  <StudentPaymentDialog
                    studentId={studentId}
                    studentName={`${student.first_name} ${student.last_name}`}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Wallet className="mr-2 h-4 w-4" /> Record payment
                      </Button>
                    }
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Paid</div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatFCFA(feePaid)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total invoiced</div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatFCFA(feeTotal)}
                      </div>
                    </div>
                  </div>
                  <Progress value={feePercent} />
                  <div className="text-xs text-muted-foreground">
                    {feeTotal > 0
                      ? `${feePercent}% collected`
                      : "No invoices yet — will be generated from the class fee structure."}
                    {regOwed > 0 && ` · Registration outstanding: ${formatFCFA(regOwed)}`}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Attendance — this term</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Days present" value={String(att.present)} />
                  <Row label="Days absent" value={String(att.absent)} />
                  <Row label="Late arrivals" value={String(att.late)} />
                  <Row label="Excused" value={String(att.excused)} />
                  <Row label="Records logged" value={String(att.total)} />
                  <Row
                    label="Attendance rate"
                    value={att.total > 0 ? `${Number(student.attendance_rate ?? 0)}%` : "—"}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="discipline" className="mt-4">
              <StudentDisciplineTab
                studentId={studentId}
                studentName={`${student.first_name} ${student.last_name}`}
              />
            </TabsContent>

            <TabsContent value="clinic" className="mt-4">
              <StudentClinicTab
                studentId={studentId}
                studentName={`${student.first_name} ${student.last_name}`}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <DocumentVaultCard ownerType="student" ownerId={studentId} />
            </TabsContent>

            <TabsContent value="reports" className="mt-4">
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Termly report cards will appear here once scores are entered.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function StudentPaymentDialog({
  studentId,
  studentName,
  trigger,
}: {
  studentId: string;
  studentName: string;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const billingFn = useServerFn(getStudentBilling);
  const recFn = useServerFn(recordPayment);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const billingQ = useQuery({
    queryKey: ["student-billing", studentId],
    queryFn: () => billingFn({ data: { studentId } }),
    enabled: open,
  });
  const open_ = billingQ.data?.open ?? [];
  const credit = billingQ.data?.credit ?? 0;
  const outstanding = billingQ.data?.outstanding ?? 0;
  const amt = Number(amount) || 0;

  useEffect(() => {
    if (manual || open_.length === 0) return;
    let remaining = amt;
    const next: Record<string, string> = {};
    for (const inv of open_) {
      const take = Math.max(Math.min(remaining, inv.balance_fcfa), 0);
      next[inv.id] = take > 0 ? String(take) : "";
      remaining -= take;
    }
    setAllocs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, manual, billingQ.data]);

  const allocatedTotal = open_.reduce((s, i) => s + (Number(allocs[i.id]) || 0), 0);
  const unallocated = Math.max(amt - allocatedTotal, 0);
  const overAllocated = allocatedTotal > amt;

  const reset = () => {
    setAmount("");
    setAllocs({});
    setManual(false);
    setReference("");
    setNote("");
    setMethod("cash");
  };

  const submit = async () => {
    if (amt <= 0) {
      toast.error("Enter an amount received");
      return;
    }
    if (overAllocated) {
      toast.error("Allocations exceed the amount received");
      return;
    }
    if (["momo", "bank", "cheque"].includes(method) && !reference.trim()) {
      toast.error("A reference is required for this payment method");
      return;
    }
    const allocations = open_
      .map((i) => ({ student_fee_id: i.id, amount_fcfa: Number(allocs[i.id]) || 0 }))
      .filter((a) => a.amount_fcfa > 0);
    setBusy(true);
    try {
      const res = await recFn({
        data: {
          student_id: studentId,
          amount_fcfa: amt,
          method,
          reference: reference || undefined,
          note: note || undefined,
          allocations: allocations.length > 0 ? allocations : undefined,
        },
      });
      invalidateAfterPayment(qc, studentId);
      toast.success(
        res?.credit
          ? `Payment recorded · ${formatFCFA(res.credit)} kept as credit`
          : "Payment recorded",
      );
      setOpen(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment — {studentName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Amount received (FCFA)</Label>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setManual(false);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {billingQ.isLoading
                  ? "Loading invoices…"
                  : open_.length === 0
                    ? "No open invoices"
                    : "Applied to (registration & oldest due first — adjust if needed)"}
              </span>
              <span className="text-muted-foreground">Owing {formatFCFA(outstanding)}</span>
            </div>
            {credit > 0 && (
              <div className="mb-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                {formatFCFA(credit)} credit already on this student's account
              </div>
            )}
            {open_.length > 0 && (
              <>
                <div className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
                  {open_.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          {i.label}
                          {i.kind === "registration" && (
                            <Badge variant="outline" className="ml-2">
                              Registration
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Balance {formatFCFA(i.balance_fcfa)}
                          {i.due_date && ` · Due ${new Date(i.due_date).toLocaleDateString()}`}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={i.balance_fcfa}
                        className="h-8 w-32"
                        value={allocs[i.id] ?? ""}
                        onChange={(e) => {
                          setManual(true);
                          setAllocs((s) => ({ ...s, [i.id]: e.target.value }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Applied to invoices</span>
                    <span
                      className={overAllocated ? "font-semibold text-destructive" : "font-semibold"}
                    >
                      {formatFCFA(allocatedTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Kept as credit</span>
                    <span className="font-semibold">{formatFCFA(unallocated)}</span>
                  </div>
                  {overAllocated && (
                    <p className="text-xs text-destructive">
                      Allocations exceed the amount received.
                    </p>
                  )}
                  {manual && (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => setManual(false)}
                    >
                      Reset to automatic allocation
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>
              Reference {["momo", "bank", "cheque"].includes(method) ? "(required)" : "(optional)"}
            </Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="MoMo txn ID, cheque no., deposit slip"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || overAllocated}>
            {busy ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentClinicTab({ studentId, studentName }: { studentId: string; studentName: string }) {
  const qc = useQueryClient();
  const fetchVisits = useServerFn(listClinicVisitsForStudent);
  const fetchProfile = useServerFn(getHealthProfile);
  const saveProfile = useServerFn(upsertHealthProfile);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const visitsQ = useQuery({
    queryKey: ["clinic-visits-for-student", studentId],
    queryFn: () => fetchVisits({ data: { studentId } }),
  });
  const profileQ = useQuery({
    queryKey: ["health-profile", studentId],
    queryFn: () => fetchProfile({ data: { studentId } }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["clinic-visits-for-student", studentId] });

  const startEditingProfile = () => {
    setBloodGroup(profileQ.data?.blood_group ?? "");
    setAllergies(profileQ.data?.allergies ?? "");
    setChronicConditions(profileQ.data?.chronic_conditions ?? "");
    setEmergencyNotes(profileQ.data?.emergency_medical_notes ?? "");
    setEditingProfile(true);
  };

  const saveHealthProfile = async () => {
    setSavingProfile(true);
    try {
      await saveProfile({
        data: {
          studentId,
          bloodGroup,
          allergies,
          chronicConditions,
          emergencyMedicalNotes: emergencyNotes,
        },
      });
      qc.invalidateQueries({ queryKey: ["health-profile", studentId] });
      setEditingProfile(false);
      toast.success("Health profile saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const hasProfileData =
    profileQ.data &&
    (profileQ.data.blood_group ||
      profileQ.data.allergies ||
      profileQ.data.chronic_conditions ||
      profileQ.data.emergency_medical_notes);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Health profile</CardTitle>
          {!editingProfile && (
            <Button size="sm" variant="outline" onClick={startEditingProfile}>
              {hasProfileData ? "Edit" : "Add"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingProfile ? (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Blood group</Label>
                <Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Allergies</Label>
                <Textarea
                  rows={2}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Chronic conditions</Label>
                <Textarea
                  rows={2}
                  value={chronicConditions}
                  onChange={(e) => setChronicConditions(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Emergency medical notes</Label>
                <Textarea
                  rows={2}
                  value={emergencyNotes}
                  onChange={(e) => setEmergencyNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveHealthProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : !hasProfileData ? (
            <p className="text-sm text-muted-foreground">No health information on file.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {profileQ.data?.blood_group && (
                <Row label="Blood group" value={profileQ.data.blood_group} />
              )}
              {profileQ.data?.allergies && (
                <Row label="Allergies" value={profileQ.data.allergies} />
              )}
              {profileQ.data?.chronic_conditions && (
                <Row label="Chronic conditions" value={profileQ.data.chronic_conditions} />
              )}
              {profileQ.data?.emergency_medical_notes && (
                <Row label="Emergency notes" value={profileQ.data.emergency_medical_notes} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Visit history</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRecordOpen(true)}>
            Record visit
          </Button>
        </CardHeader>
        <CardContent>
          {visitsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (visitsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits recorded.</p>
          ) : (
            <div className="divide-y">
              {(visitsQ.data ?? []).map((v) => (
                <div key={v.id} className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{v.complaint}</span>
                    {v.referred_out && <Badge variant="destructive">Referred</Badge>}
                    {v.follow_up_needed && <Badge variant="secondary">Follow-up needed</Badge>}
                  </div>
                  {v.treatment_given && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Treatment: {v.treatment_given}
                    </p>
                  )}
                  {v.temperature_c != null && (
                    <p className="mt-1 text-xs text-muted-foreground">Temp: {v.temperature_c}°C</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(v.visited_on).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordVisitDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        fixedStudent={{ id: studentId, name: studentName }}
        onRecorded={invalidate}
      />
    </div>
  );
}

function StudentDisciplineTab({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const qc = useQueryClient();
  const fetchIncidents = useServerFn(listDisciplineForStudent);
  const resolveFn = useServerFn(resolveDisciplineIncident);
  const reopenFn = useServerFn(reopenDisciplineIncident);
  const [reportOpen, setReportOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ["discipline-for-student", studentId],
    queryFn: () => fetchIncidents({ data: { studentId } }),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["discipline-for-student", studentId] });

  const severityColor: Record<string, string> = {
    minor: "text-muted-foreground",
    moderate: "text-amber-600",
    major: "text-destructive",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Discipline record</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
          Report incident
        </Button>
      </CardHeader>
      <CardContent>
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (listQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No incidents recorded.</p>
        ) : (
          <div className="divide-y">
            {(listQ.data ?? []).map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{i.category}</span>
                    <span className={`text-xs capitalize ${severityColor[i.severity] ?? ""}`}>
                      {i.severity}
                    </span>
                    <Badge variant={i.status === "open" ? "destructive" : "secondary"}>
                      {i.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                  {i.action_taken && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Action taken: {i.action_taken}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(i.occurred_on).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      if (i.status === "open") await resolveFn({ data: { id: i.id } });
                      else await reopenFn({ data: { id: i.id } });
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {i.status === "open" ? "Resolve" : "Reopen"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ReportIncidentDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        fixedStudent={{ id: studentId, name: studentName }}
        onReported={invalidate}
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "warning" | "muted";
}) {
  const accent =
    tone === "primary" ? "bg-primary" : tone === "warning" ? "bg-accent" : "bg-muted-foreground/40";
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
