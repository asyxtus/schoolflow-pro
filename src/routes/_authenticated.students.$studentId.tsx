import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
import { formatFCFA, getStudent } from "@/lib/mock/students";

export const Route = createFileRoute("/_authenticated/students/$studentId")({
  loader: ({ params }) => {
    const student = getStudent(params.studentId);
    if (!student) throw notFound();
    return { student };
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
  const { student } = Route.useLoaderData();
  const initials = student.firstName[0] + student.lastName[0];
  const feeTotal = 250_000;
  const feePaid = feeTotal - student.feeBalance;
  const feePercent = Math.round((feePaid / feeTotal) * 100);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/students"><ArrowLeft className="mr-1 h-4 w-4" /> All students</Link>
        </Button>
      </div>

      <PageHeader
        title={`${student.lastName} ${student.firstName}`}
        description={`${student.matricule} · ${student.className}`}
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
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-base font-semibold text-foreground">
                {student.lastName} {student.firstName}
              </div>
              <div className="text-xs text-muted-foreground">Enrolled {student.enrolledOn}</div>
            </div>
            <Badge variant="outline" className="capitalize bg-primary/10 text-primary border-primary/20">
              {student.status}
            </Badge>
            <Separator />
            <dl className="w-full space-y-2 text-left text-sm">
              <InfoRow icon={GraduationCap} label="Class" value={student.className} />
              <InfoRow icon={CalendarDays} label="Date of birth" value={student.dateOfBirth} />
              <InfoRow icon={MapPin} label="Address" value={student.address} />
              <InfoRow icon={ShieldAlert} label="Blood group" value={student.bloodGroup ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Attendance (term)" value={`${student.attendanceRate}%`} tone="primary" />
            <MetricCard label="Discipline flags" value="0" tone="muted" />
            <MetricCard
              label="Fee balance"
              value={student.feeBalance === 0 ? "Cleared" : formatFCFA(student.feeBalance)}
              tone={student.feeBalance === 0 ? "primary" : "warning"}
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
                  <Row label="Form master" value={student.formMaster} />
                  <Row label="Religion" value={student.religion ?? "—"} />
                  <Row label="Emergency contact" value={student.emergencyContact ?? "—"} />
                  <Row label="Sequence 1 average" value="14.2 / 20" />
                  <Row label="Class rank" value="8th of 42" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guardians" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Primary guardian</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row label="Name" value={student.guardianName} />
                  <Row
                    label="Phone"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {student.guardianPhone}
                      </span>
                    }
                  />
                  {student.guardianEmail && (
                    <Row
                      label="Email"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {student.guardianEmail}
                        </span>
                      }
                    />
                  )}
                  <Row label="Address" value={student.address} />
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
                  <Row label="Attendance rate" value={`${student.attendanceRate}%`} />
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