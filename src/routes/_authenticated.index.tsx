import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  Banknote,
  ClipboardList,
  ArrowRight,
  Circle,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getCurrentSchool } from "@/lib/school.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { formatFCFA } from "@/lib/mock/students";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard · SchoolERP Cameroon" },
      {
        name: "description",
        content:
          "Enrolment, attendance, fee collection and admissions at a glance for your school.",
      },
    ],
  }),
});

function DashboardPage() {
  const fetchSchool = useServerFn(getCurrentSchool);
  const fetchStats = useServerFn(getDashboardStats);
  const { data } = useSuspenseQuery({
    queryKey: ["current-school"],
    queryFn: () => fetchSchool(),
  });
  const { data: stats } = useSuspenseQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
  });
  const school = data?.school;
  const profile = data?.profile;
  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "there";
  const locale = [school?.city, school?.region].filter(Boolean).join(" · ");
  const subtitle = [school?.name, locale].filter(Boolean).join(" · ") ||
    "Set up your school in Settings";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title={`Good morning, ${displayName}`}
        description={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button size="sm" asChild>
              <Link to="/admissions/new">New admission</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total enrolment"
          value={stats.totalEnrolment.toLocaleString()}
          hint={`Across ${stats.classCount} class${stats.classCount === 1 ? "" : "es"}`}
          icon={Users}
        />
        <StatCard
          label="Avg. attendance"
          value={`${stats.avgAttendance}%`}
          hint={`${stats.activeEnrolment} active students`}
          icon={UserCheck}
        />
        <StatCard
          label="Fees collected"
          value={`${stats.feeCollectionRate}%`}
          hint={
            stats.outstandingBalance > 0
              ? `${formatFCFA(stats.outstandingBalance)} outstanding`
              : "All balances cleared"
          }
          icon={Banknote}
          tone="accent"
        />
        <StatCard
          label="Open admissions"
          value={stats.openApplicants.toLocaleString()}
          hint={`${stats.pipeline.find((p) => p.stage === "interview")?.count ?? 0} awaiting interview`}
          icon={ClipboardList}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Fee collection by class</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Term 2 progress · updated 2 min ago
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              View report <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {feeRows.map((r) => (
              <div key={r.class} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{r.class}</span>
                  <span className="tabular-nums text-muted-foreground">
                    XAF {r.collected.toLocaleString()} ·{" "}
                    <span className="font-medium text-foreground">{r.pct}%</span>
                  </span>
                </div>
                <Progress value={r.pct} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admissions pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelineLabels.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Circle className={`h-2 w-2 fill-current ${p.color}`} />
                  <span className="text-sm text-foreground">{p.label}</span>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {stats.pipeline.find((s) => s.stage === p.id)?.count ?? 0}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance flags</CardTitle>
            <p className="text-xs text-muted-foreground">
              Students with 3+ consecutive absences
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {absences.map((a) => (
              <div
                key={a.name}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.class}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-foreground">{a.days} days</p>
                  <p className="text-xs text-muted-foreground">{a.last}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calendar</CardTitle>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendar.map((c) => (
              <div key={c.title} className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-secondary text-center">
                  <span className="text-[10px] font-medium uppercase text-muted-foreground">
                    {c.month}
                  </span>
                  <span className="text-sm font-semibold leading-none text-foreground">
                    {c.day}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const feeRows = [
  { class: "Form 1A", collected: 4_200_000, pct: 92 },
  { class: "Form 2B", collected: 3_850_000, pct: 84 },
  { class: "Form 3A", collected: 3_100_000, pct: 71 },
  { class: "Form 4C", collected: 2_700_000, pct: 63 },
  { class: "Upper 6 Sci.", collected: 2_100_000, pct: 48 },
];

const pipelineLabels = [
  { id: "new", label: "New applications", color: "text-chart-2" },
  { id: "review", label: "Documents review", color: "text-chart-1" },
  { id: "interview", label: "Interview scheduled", color: "text-chart-4" },
  { id: "offer", label: "Offer sent", color: "text-chart-3" },
  { id: "enrolled", label: "Enrolled", color: "text-primary" },
];

const absences = [
  { name: "Ngwa Beltrand", class: "Form 3A", days: 5, last: "Mon, absent" },
  { name: "Fon Adeline", class: "Form 2B", days: 4, last: "Mon, absent" },
  { name: "Tabi Junior", class: "Form 1A", days: 3, last: "Tue, absent" },
  { name: "Njoya Sandrine", class: "Upper 6 Arts", days: 3, last: "Tue, absent" },
];

const calendar = [
  {
    month: "Mar",
    day: "12",
    title: "Mid-term exams begin",
    detail: "Forms 1–4 · Main hall",
  },
  {
    month: "Mar",
    day: "15",
    title: "PTA general meeting",
    detail: "3:00 pm · Auditorium",
  },
  {
    month: "Mar",
    day: "18",
    title: "Fee deadline · Term 2",
    detail: "Late fees apply after this date",
  },
  {
    month: "Mar",
    day: "20",
    title: "Founder's Day mass",
    detail: "8:00 am · Chapel",
  },
];