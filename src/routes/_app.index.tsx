import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_app/")({
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
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Good morning, Sister Marie"
        description="Sacred Heart College · Bamenda · Term 2, 2025/2026"
        actions={
          <>
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button size="sm">New admission</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total enrolment"
          value="1,284"
          hint="Across 24 classes"
          delta={{ value: "+12", direction: "up" }}
          icon={Users}
        />
        <StatCard
          label="Attendance today"
          value="94.2%"
          hint="1,210 present · 74 absent"
          delta={{ value: "+0.8%", direction: "up" }}
          icon={UserCheck}
        />
        <StatCard
          label="Fee collection"
          value="XAF 42.6M"
          hint="of XAF 58.4M expected"
          delta={{ value: "-3.1%", direction: "down" }}
          icon={Banknote}
          tone="accent"
        />
        <StatCard
          label="Open admissions"
          value="87"
          hint="23 awaiting interview"
          delta={{ value: "+9", direction: "up" }}
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
            {pipeline.map((p) => (
              <div
                key={p.stage}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Circle className={`h-2 w-2 fill-current ${p.color}`} />
                  <span className="text-sm text-foreground">{p.stage}</span>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {p.count}
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

const pipeline = [
  { stage: "New applications", count: 34, color: "text-chart-2" },
  { stage: "Documents review", count: 18, color: "text-chart-1" },
  { stage: "Interview scheduled", count: 12, color: "text-chart-4" },
  { stage: "Offer sent", count: 9, color: "text-chart-3" },
  { stage: "Enrolled", count: 14, color: "text-primary" },
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