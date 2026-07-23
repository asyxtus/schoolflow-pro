import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getStudentById } from "@/lib/students.functions";
import { getOrCreatePortalToken } from "@/lib/portal.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatFCFA } from "@/lib/mock/students";
import type { Tables } from "@/integrations/supabase/types";

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
  const feeTotal = 250_000;
  const feePaid = Math.max(0, feeTotal - (student.fee_balance ?? 0));
  const feePercent = Math.round((feePaid / feeTotal) * 100);
  const primaryGuardian = student.guardians?.find((g) => g.is_primary) ?? student.guardians?.[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/students"><ArrowLeft className="mr-1 h-4 w-4" /> All students</Link>
        </Button>
      </div>

      <PageHeader
        title={`${student.last_name} ${student.first_name}`}
        description={`${student.matricule} · ${student.class_name ?? "—"}`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Print profile
            </Button>
            <Button size="sm">
              <Wallet className="mr-2 h-4 w-4" /> Record payment
            </Button>
          </>
        }
      />

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
                Enrolled {student.enrolment_date ? new Date(student.enrolment_date).toLocaleDateString() : "—"}
              </div>
            </div>
            <Badge variant="outline" className="border-primary/20 bg-primary/10 capitalize text-primary">
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
              value={`${student.attendance_rate ?? 0}%`}
              tone="primary"
            />
            <MetricCard label="Discipline flags" value="0" tone="muted" />
            <MetricCard
              label="Fee balance"
              value={(student.fee_balance ?? 0) === 0 ? "Cleared" : formatFCFA(student.fee_balance ?? 0)}
              tone={(student.fee_balance ?? 0) === 0 ? "primary" : "warning"}
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="guardians">Guardians</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Academic snapshot</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <Row label="Section" value={student.section ?? "—"} />
                  <Row label="Gender" value={student.gender === "male" ? "Male" : student.gender === "female" ? "Female" : "—"} />
                  <Row label="Emergency contact" value={student.guardian_phone ?? "—"} />
                  <Row label="Sequence 1 average" value="14.2 / 20" />
                  <Row label="Class rank" value="8th of 42" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guardians" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Guardians</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {student.guardians && student.guardians.length > 0 ? (
                    student.guardians.map((g) => (
                      <div key={g.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{g.full_name}</span>
                          {g.is_primary && (
                            <Badge variant="outline" className="text-xs">Primary</Badge>
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
                <CardHeader><CardTitle className="text-sm">Tuition — 2025 / 2026</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Paid</div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatFCFA(feePaid)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total due</div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatFCFA(feeTotal)}
                      </div>
                    </div>
                  </div>
                  <Progress value={feePercent} />
                  <div className="text-xs text-muted-foreground">
                    {feePercent}% collected · Next installment due 15 Oct 2026
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Attendance — this term</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Days present" value="58" />
                  <Row label="Days absent" value="4" />
                  <Row label="Late arrivals" value="2" />
                  <Row label="Attendance rate" value={`${student.attendance_rate ?? 0}%`} />
                </CardContent>
              </Card>
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
    tone === "primary"
      ? "bg-primary"
      : tone === "warning"
        ? "bg-accent"
        : "bg-muted-foreground/40";
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
