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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAttendanceForClass,
  listClassNames,
  markAttendance,
  bulkMarkAttendance,
  type AttendanceStatus,
} from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function AttendancePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [className, setClassName] = useState<string>("");
  const qc = useQueryClient();

  const listClasses = useServerFn(listClassNames);
  const fetchRoster = useServerFn(getAttendanceForClass);
  const markOne = useServerFn(markAttendance);
  const markAll = useServerFn(bulkMarkAttendance);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => listClasses() });
  const rosterQ = useQuery({
    queryKey: ["attendance", className, date],
    queryFn: () => fetchRoster({ data: { className, date } }),
    enabled: !!className,
  });

  const markMut = useMutation({
    mutationFn: (v: { studentId: string; status: AttendanceStatus }) =>
      markOne({ data: { ...v, date } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", className, date] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (status: AttendanceStatus) => {
      const entries = (rosterQ.data ?? []).map((s) => ({ studentId: s.id, status }));
      return markAll({ data: { date, entries } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", className, date] });
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
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Attendance"
        description="Daily register — one tap per learner"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          {className && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkMut.mutate("present")} disabled={!roster.length || bulkMut.isPending}>
                Mark all present
              </Button>
            </div>
          )}
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
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Present {counts.present}</Badge>
            <Badge variant="secondary">Absent {counts.absent}</Badge>
            <Badge variant="secondary">Late {counts.late}</Badge>
            <Badge variant="secondary">Excused {counts.excused}</Badge>
            <Badge variant="outline">Pending {counts.pending}</Badge>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.matricule ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {STATUSES.map((st) => (
                          <Button
                            key={st}
                            size="sm"
                            variant={s.status === st ? "default" : "outline"}
                            className="h-7 px-2 text-xs capitalize"
                            onClick={() => markMut.mutate({ studentId: s.id, status: st })}
                            disabled={markMut.isPending}
                          >
                            {st}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}