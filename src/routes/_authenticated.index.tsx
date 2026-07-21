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
  AlertTriangle,
  Bell,
  TrendingUp,
  Clock,
  Wallet,
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
          "Live pulse of enrolment, attendance, collections and alerts for your school.",
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
    refetchInterval: 60_000,
  });
  const school = data?.school;
  const profile = data?.profile;
  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "there";
  const locale = [school?.city, school?.region].filter(Boolean).join(" · ");
  const subtitle =
    [school?.name, locale].filter(Boolean).join(" · ") ||
    "Set up your school in Settings";

  const t = stats.today;
  const aging = stats.aging;
  const totalOverdue = aging.d0_7 + aging.d8_30 + aging.d31_60 + aging.d60p;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title={`Good morning, ${displayName}`}
        description={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm">Export</Button>
            <Button size="sm" asChild>
              <Link to="/admissions/new">New admission</Link>
            </Button>
          </>
        }
      />

      {stats.alerts.length > 0 && (
        <Card className="mb-6 border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" /> Needs your attention
              <Badge variant="secondary" className="ml-1">{stats.alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {stats.alerts.map((a) => (
              <Link
                key={a.id}
                to={a.href ?? "/"}
                className="flex items-start gap-2 rounded-md border border-border p-2.5 hover:bg-accent transition"
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    a.kind === "danger"
                      ? "text-destructive"
                      : a.kind === "warn"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Today at a glance
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              Live · auto-refresh
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Collected today</p>
            <p className="text-lg font-semibold tabular-nums">{formatFCFA(t.collectedToday)}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.paymentsCountToday} payment{t.paymentsCountToday === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Attendance taken</p>
            <p className="text-lg font-semibold tabular-nums">{t.attendanceCoverage}%</p>
            <p className="text-[11px] text-muted-foreground">
              {t.presentToday}P · {t.absentToday}A · {t.lateToday}L
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Boarders on exeat</p>
            <p className="text-lg font-semibold tabular-nums">{t.exeatsOut}</p>
            <p
              className={`text-[11px] ${
                t.exeatsOverdue > 0
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {t.exeatsOverdue} overdue return{t.exeatsOverdue === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Open admissions</p>
            <p className="text-lg font-semibold tabular-nums">{stats.openApplicants}</p>
            <p className="text-[11px] text-muted-foreground">
              {stats.pipeline.find((p) => p.stage === "interview")?.count ?? 0} awaiting interview
            </p>
          </div>
        </CardContent>
      </Card>

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
                Live · billed vs collected
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/reports/finance">
                View report <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.feeByClass.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No fees invoiced yet. Set up fee structures in Finance.
              </p>
            ) : (
              stats.feeByClass.map((r) => (
                <div key={r.class_name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{r.class_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatFCFA(r.collected)} of {formatFCFA(r.billed)} ·{" "}
                      <span className="font-medium text-foreground">{r.pct}%</span>
                    </span>
                  </div>
                  <Progress value={r.pct} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admissions pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">Live totals</p>
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Fees aging
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {aging.count} overdue · {formatFCFA(totalOverdue)}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <AgingRow label="0–7 days" amount={aging.d0_7} tone="text-amber-600" />
            <AgingRow label="8–30 days" amount={aging.d8_30} tone="text-orange-600" />
            <AgingRow label="31–60 days" amount={aging.d31_60} tone="text-red-600" />
            <AgingRow label="60+ days" amount={aging.d60p} tone="text-destructive font-semibold" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Recent payments
              </CardTitle>
              <p className="text-xs text-muted-foreground">Last {stats.recent.length}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/finance">
                Open finance <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {stats.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No payments yet.
              </p>
            ) : (
              stats.recent.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 text-sm gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.student_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.class_name} · {p.receipt_no ?? "—"} · {p.method}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular-nums font-medium">{formatFCFA(p.amount_fcfa)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming fee deadlines</CardTitle>
            <p className="text-xs text-muted-foreground">Next 14 days</p>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {stats.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming deadlines.
              </p>
            ) : (
              stats.upcoming.slice(0, 6).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2.5 text-sm gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.student_name} · {u.class_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular-nums text-foreground">
                      {formatFCFA(u.amount_fcfa)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(u.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <p className="text-xs text-muted-foreground">Jump into common tasks</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <QuickLink to="/attendance" label="Take attendance" />
            <QuickLink to="/finance" label="Record payment" />
            <QuickLink to="/students_/new" label="Add student" />
            <QuickLink to="/messages" label="Send message" />
            <QuickLink to="/reports/finance" label="Finance report" />
            <QuickLink to="/settings/audit" label="Audit log" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AgingRow({ label, amount, tone }: { label: string; amount: number; tone: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${tone}`}>{formatFCFA(amount)}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Button variant="outline" size="sm" className="justify-start" asChild>
      <Link to={to}>{label}</Link>
    </Button>
  );
}

const pipelineLabels = [
  { id: "new", label: "New applications", color: "text-chart-2" },
  { id: "review", label: "Documents review", color: "text-chart-1" },
  { id: "interview", label: "Interview scheduled", color: "text-chart-4" },
  { id: "offer", label: "Offer sent", color: "text-chart-3" },
  { id: "enrolled", label: "Enrolled", color: "text-primary" },
];
