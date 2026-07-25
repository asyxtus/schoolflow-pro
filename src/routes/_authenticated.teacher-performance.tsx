import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { teacherPerformance } from "@/lib/staff-attendance.functions";

export const Route = createFileRoute("/_authenticated/teacher-performance")({
  component: TeacherPerformancePage,
});

function pct(taken: number, expected: number): number | null {
  if (!expected) return null;
  return Math.round((100 * taken) / expected);
}

function TeacherPerformancePage() {
  const [days, setDays] = useState("30");
  const fn = useServerFn(teacherPerformance);
  const q = useQuery({ queryKey: ["teacher-perf", days], queryFn: () => fn({ data: { days: Number(days) } }) });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 space-y-5">
      <PageHeader title="Teacher performance" description="Attendance-taking, grade timeliness, class average and own punctuality." />
      <div className="flex items-end gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Window</div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !q.data?.length ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No teachers assigned to any subject yet. Assign teachers in Classes → Manage.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Teacher</th>
                  <th className="p-3">Classes · Subjects</th>
                  <th className="p-3">Attendance taken</th>
                  <th className="p-3">Grades entered</th>
                  <th className="p-3">Class avg /20</th>
                  <th className="p-3">Punctuality</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((t) => {
                  const p = pct(t.attendance_taken, t.attendance_expected);
                  return (
                    <tr key={t.staff_id} className="border-t">
                      <td className="p-3 font-medium">{t.name}</td>
                      <td className="p-3 text-xs">
                        {t.classes.length ? t.classes.join(", ") : "—"}
                        <div className="text-muted-foreground">{t.subjects.join(", ") || "no subjects"}</div>
                      </td>
                      <td className="p-3">
                        {p === null ? <span className="text-muted-foreground">n/a</span> : (
                          <Badge variant={p >= 80 ? "default" : p >= 50 ? "secondary" : "destructive"}>{p}%</Badge>
                        )}
                        <div className="text-xs text-muted-foreground">{t.attendance_taken} / {t.attendance_expected}</div>
                      </td>
                      <td className="p-3">{t.grades_entered}</td>
                      <td className="p-3">{t.class_average === null ? "—" : t.class_average.toFixed(2)}</td>
                      <td className="p-3">
                        {t.punctuality_pct === null ? <span className="text-muted-foreground">n/a</span> : (
                          <Badge variant={t.punctuality_pct >= 90 ? "default" : t.punctuality_pct >= 70 ? "secondary" : "destructive"}>{t.punctuality_pct}%</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}