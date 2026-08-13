import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { WifiOff, RefreshCw } from "lucide-react";

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
import {
  queueAttendanceMark,
  listQueuedMarks,
  removeQueuedMark,
  isLikelyOffline,
} from "@/lib/offline-queue";

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
  present: "P",
  absent: "A",
  late: "L",
  excused: "E",
};

function AttendancePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [className, setClassName] = useState<string>("");
  const [subject, setSubject] = useState<string>("__day__");
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
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

  const queueQ = useQuery({
    queryKey: ["attendance-offline-queue"],
    queryFn: () => listQueuedMarks(),
    // Not server data — but a plain interval refetch keeps the badge honest
    // without threading a pub/sub system through a browser-only IndexedDB store.
    refetchInterval: 3000,
  });
  const allQueued = queueQ.data ?? [];
  const queuedForView = allQueued.filter(
    (m) => m.className === className && m.date === date && m.subject === subjectValue,
  );
  const queuedByStudent = new Map(queuedForView.map((m) => [m.studentId, m]));

  // Flushes the ENTIRE queue (not just what's on screen) — a teacher may
  // have moved to a different class/date since marking these, and pending
  // work from that earlier context shouldn't get stranded.
  const flushQueue = async () => {
    const pending = await listQueuedMarks();
    if (pending.length === 0) return;
    setSyncing(true);
    let syncedAny = false;
    try {
      for (const m of pending) {
        try {
          await markOne({
            data: { studentId: m.studentId, status: m.status, date: m.date, subject: m.subject },
          });
          await removeQueuedMark(m.id);
          syncedAny = true;
        } catch (e) {
          if (isLikelyOffline(e)) break; // still offline — stop, try again later
          // A real validation error: drop it rather than retry forever, and
          // tell the teacher so the mark doesn't just silently vanish.
          await removeQueuedMark(m.id);
          toast.error(`Couldn't sync ${m.studentLabel}'s attendance: ${(e as Error).message}`);
        }
      }
    } finally {
      setSyncing(false);
      qc.invalidateQueries({ queryKey: ["attendance-offline-queue"] });
      qc.invalidateQueries({ queryKey: ["attendance"], exact: false });
      if (syncedAny) toast.success("Offline attendance synced");
    }
  };

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (typeof navigator !== "undefined" && navigator.onLine) flushQueue();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markMut = useMutation({
    mutationFn: async (v: {
      studentId: string;
      studentLabel: string;
      status: AttendanceStatus;
    }) => {
      try {
        await markOne({
          data: { studentId: v.studentId, status: v.status, date, subject: subjectValue },
        });
        return { queued: false };
      } catch (e) {
        if (!isLikelyOffline(e)) throw e;
        await queueAttendanceMark({
          studentId: v.studentId,
          studentLabel: v.studentLabel,
          status: v.status,
          date,
          subject: subjectValue,
          className,
        });
        return { queued: true };
      }
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["attendance", className, date, subject] });
      if (r.queued) qc.invalidateQueries({ queryKey: ["attendance-offline-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: async (status: AttendanceStatus) => {
      const entries = (rosterQ.data ?? []).map((s) => ({ studentId: s.id, status }));
      try {
        await markAll({ data: { date, subject: subjectValue, entries } });
        return { queued: false };
      } catch (e) {
        if (!isLikelyOffline(e)) throw e;
        for (const s of rosterQ.data ?? []) {
          await queueAttendanceMark({
            studentId: s.id,
            studentLabel: `${s.last_name} ${s.first_name}`,
            status,
            date,
            subject: subjectValue,
            className,
          });
        }
        return { queued: true };
      }
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["attendance", className, date, subject] });
      if (r.queued) {
        qc.invalidateQueries({ queryKey: ["attendance-offline-queue"] });
        toast.success("Saved offline — will sync when reconnected");
      } else {
        toast.success("Attendance updated");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roster = (rosterQ.data ?? []).map((s) => {
    const queued = queuedByStudent.get(s.id);
    return queued
      ? { ...s, status: queued.status, pendingSync: true }
      : { ...s, pendingSync: false };
  });
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
      <PageHeader title="Attendance" description="One tap per learner — daily or per subject" />

      {(!isOnline || allQueued.length > 0) && (
        <Card className="mb-3 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            {!isOnline ? (
              <>
                <WifiOff className="h-4 w-4 text-amber-700" />
                <span className="text-amber-800 dark:text-amber-200">
                  Offline — marks are saved on this device and will sync automatically once you're
                  back online.
                </span>
              </>
            ) : (
              <span className="text-amber-800 dark:text-amber-200">
                {allQueued.length} attendance mark{allQueued.length === 1 ? "" : "s"} saved offline,
                not yet synced.
              </span>
            )}
            {isOnline && allQueued.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-8"
                onClick={flushQueue}
                disabled={syncing}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-3 sm:mb-4">
        <CardContent className="grid gap-3 p-3 sm:grid-cols-3 sm:p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select
              value={className}
              onValueChange={(v) => {
                setClassName(v);
                setSubject("__day__");
              }}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Select value={subject} onValueChange={setSubject} disabled={!className}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__day__">Whole day (register)</SelectItem>
                {(subjectsQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.subject}>
                    {s.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Select a class to open the register.
          </CardContent>
        </Card>
      ) : rosterQ.isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : !roster.length ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No active students in this class.
          </CardContent>
        </Card>
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
              <Card
                key={s.id}
                className={`overflow-hidden ${s.pendingSync ? "border-amber-400 dark:border-amber-700" : ""}`}
              >
                <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {s.last_name} {s.first_name}
                      {s.pendingSync && (
                        <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                          not yet synced
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {s.matricule ?? "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {STATUSES.map((st) => {
                      const active = s.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          aria-label={st}
                          onClick={() =>
                            markMut.mutate({
                              studentId: s.id,
                              studentLabel: `${s.last_name} ${s.first_name}`,
                              status: st,
                            })
                          }
                          disabled={markMut.isPending}
                          className={
                            "grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition active:scale-95 " +
                            (active
                              ? STATUS_STYLE[st]
                              : "bg-background text-muted-foreground border-input hover:bg-muted")
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
