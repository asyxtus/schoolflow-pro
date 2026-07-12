import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { listClassNames } from "@/lib/attendance.functions";
import { getTimetable, upsertTimetableSlot, deleteTimetableSlot } from "@/lib/timetable.functions";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: TimetablePage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function TimetablePage() {
  const [className, setClassName] = useState("");
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const qc = useQueryClient();

  const listClasses = useServerFn(listClassNames);
  const fetchTt = useServerFn(getTimetable);
  const saveSlot = useServerFn(upsertTimetableSlot);
  const delSlot = useServerFn(deleteTimetableSlot);

  const classesQ = useQuery({ queryKey: ["class-names"], queryFn: () => listClasses() });
  const ttQ = useQuery({
    queryKey: ["timetable", className],
    queryFn: () => fetchTt({ data: { className } }),
    enabled: !!className,
  });

  const saveMut = useMutation({
    mutationFn: (v: { day: number; period: number; subject: string; teacher: string; room: string }) =>
      saveSlot({ data: { className, day_of_week: v.day, period: v.period, subject: v.subject, teacher: v.teacher, room: v.room } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timetable", className] }); toast.success("Saved"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delSlot({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable", className] }),
  });

  const slotMap = new Map<string, (typeof ttQ.data extends (infer T)[] | undefined ? T : never)>();
  for (const s of ttQ.data ?? []) slotMap.set(`${s.day_of_week}-${s.period}`, s);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader title="Timetable" description="Weekly schedule per class" />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Class</label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!className ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select a class to view its schedule.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Period</th>
                  {DAYS.map((d, i) => <th key={i} className="p-3 text-left">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p} className="border-t">
                    <td className="p-3 font-medium">P{p}</td>
                    {DAYS.map((_, di) => {
                      const day = di + 1;
                      const slot = slotMap.get(`${day}-${p}`);
                      return (
                        <td key={di} className="p-2 align-top">
                          {slot ? (
                            <div className="group relative rounded-md border bg-primary/5 p-2">
                              <div className="font-medium">{slot.subject}</div>
                              <div className="text-xs text-muted-foreground">{slot.teacher ?? "—"}</div>
                              {slot.room && <div className="text-xs text-muted-foreground">Room {slot.room}</div>}
                              <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing({ day, period: p })}>Edit</Button>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => delMut.mutate(slot.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-16 w-full border border-dashed text-muted-foreground" onClick={() => setEditing({ day, period: p })}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <SlotDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          initial={slotMap.get(`${editing.day}-${editing.period}`)}
          day={editing.day}
          period={editing.period}
          onSave={(v) => saveMut.mutate({ day: editing.day, period: editing.period, ...v })}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}

function SlotDialog({
  open, onClose, initial, day, period, onSave, saving,
}: {
  open: boolean; onClose: () => void;
  initial?: { subject: string; teacher: string | null; room: string | null };
  day: number; period: number;
  onSave: (v: { subject: string; teacher: string; room: string }) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [teacher, setTeacher] = useState(initial?.teacher ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{DAYS[day - 1]} · Period {period}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Teacher</Label><Input value={teacher} onChange={(e) => setTeacher(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ subject, teacher, room })} disabled={!subject.trim() || saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}