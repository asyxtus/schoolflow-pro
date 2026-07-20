import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAttendanceForClass,
  listClassNames,
  markAttendance,
  bulkMarkAttendance,
  type AttendanceStatus,
} from "@/lib/attendance.functions";
import { listClassSubjects, listClasses } from "@/lib/classes-admin.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
  absent: "bg-red-600 hover:bg-red-700 text-white border-red-600",
  late: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
  excused: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600",
};
const STATUS_LETTER: Record<AttendanceStatus, string> = {
  present: "P", absent: "A", late: "L", excused: "E",
};

function AttendancePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [className, setClassName] = useState<string>("");
  const [subject, setSubject] = useState<string>("__day__");
  const qc = useQueryClient();

  const fetchClassNames = useServerFn(listClassNames);
  const fetchClasses = useServerFn(listClasses);
  const fetchSubjects = useServerFn(listClassSubjects);
  const fetchRoster = useServerFn(getAttendanceForClass);
  const markOne = useServerFn(markAttendance);
  const markAll = useServerFn(bulkMarkAttendance);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => fetchClassNames() });
  const classListQ = useQuery({ queryKey: ["classes-list"], queryFn: () => fetchClasses() });
  const classId = classListQ.data?.find((c) => c.name === className)?.id;
  const subjectsQ = useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: () => fetchSubjects({ data: { classId: classId! } }),
    enabled: !!classId,
  });
  const subjectValue = subject === "__day__" ? null : subject;
  const rosterQ = useQuery({
    queryKey: ["attendance", className, date, subject],
    queryFn: () => fetchRoster({ data: { className, date, subject: subjectValue } }),
    enabled: !!className,
  });

  const markMut = useMutation({
    mutationFn: (v: { studentId: string; status: AttendanceStatus }) =>
      markOne({ data: { ...v, date, subject: subjectValue } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", className, date, subject] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (status: AttendanceStatus) => {
      const entries = (rosterQ.data ?? []).map((s) => ({ studentId: s.id, status }));
      return markAll({ data: { date, subject: subjectValue, entries } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", className, date, subject] });
      toast.success("Attendance updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roster = rosterQ.data ?? [];
  const counts = roster.reduce(
    (acc, r) => {
      if (r.status) acc[r.status] = (acc[r.status] ?? 0) + 1;
      else acc.pending += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0, pending: 0 } as Record<string, number>,
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
      <PageHeader
        title="Attendance"
        description="One tap per learner — daily or per subject"
      />

      <Card className="mb-3 sm:mb-4">
        <CardContent className="grid gap-3 p-3 sm:grid-cols-3 sm:p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={(v) => { setClassName(v); setSubject("__day__"); }}>
              <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Select value={subject} onValueChange={setSubject} disabled={!className}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__day__">Whole day (register)</SelectItem>
                {(subjectsQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.subject}>{s.subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full" />
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a class to open the register.</CardContent></Card>
      ) : rosterQ.isLoading ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : !roster.length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No active students in this class.</CardContent></Card>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-3 mb-3 flex flex-wrap items-center gap-2 bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
            <Badge variant="secondary">P {counts.present}</Badge>
            <Badge variant="secondary">A {counts.absent}</Badge>
            <Badge variant="secondary">L {counts.late}</Badge>
            <Badge variant="secondary">E {counts.excused}</Badge>
            <Badge variant="outline">· {counts.pending} pending</Badge>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-9"
              onClick={() => bulkMut.mutate("present")}
              disabled={!roster.length || bulkMut.isPending}
            >
              All present
            </Button>
          </div>
          <div className="grid gap-2">
            {roster.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.last_name} {s.first_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.matricule ?? "—"}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {STATUSES.map((st) => {
                      const active = s.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          aria-label={st}
                          onClick={() => markMut.mutate({ studentId: s.id, status: st })}
                          disabled={markMut.isPending}
                          className={
                            "grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition active:scale-95 " +
                            (active ? STATUS_STYLE[st] : "bg-background text-muted-foreground border-input hover:bg-muted")
                          }
                        >
                          {STATUS_LETTER[st]}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}