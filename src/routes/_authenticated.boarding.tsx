import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, Users, LogOut, UserPlus, Plus, Trash2, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  boardingSummary, listDormitories, upsertDormitory, deleteDormitory,
  listBoardingAssignments, assignBoardingStudent, releaseBoardingAssignment,
  getRollCall, saveRollCall,
  listExeats, createExeat, updateExeatStatus, deleteExeat,
  listVisitors, checkInVisitor, checkOutVisitor,
  searchBoardingStudents,
  type DormGender, type RollStatus, type RollSession, type ExeatStatus,
} from "@/lib/boarding.functions";

export const Route = createFileRoute("/_authenticated/boarding")({
  component: BoardingPage,
});

function BoardingPage() {
  return (
    <div>
      <PageHeader title="Boarding (Internat)" description="Dormitories, roll call, exeats, and visitor log" />
      <BoardingStats />
      <Tabs defaultValue="dorms" className="mt-6">
        <TabsList>
          <TabsTrigger value="dorms">Dormitories</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="roll">Roll call</TabsTrigger>
          <TabsTrigger value="exeats">Exeats</TabsTrigger>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
        </TabsList>
        <TabsContent value="dorms" className="mt-4"><DormsTab /></TabsContent>
        <TabsContent value="assignments" className="mt-4"><AssignmentsTab /></TabsContent>
        <TabsContent value="roll" className="mt-4"><RollCallTab /></TabsContent>
        <TabsContent value="exeats" className="mt-4"><ExeatsTab /></TabsContent>
        <TabsContent value="visitors" className="mt-4"><VisitorsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function BoardingStats() {
  const fn = useServerFn(boardingSummary);
  const { data } = useQuery({ queryKey: ["boarding-summary"], queryFn: () => fn() });
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard label="Dormitories" value={String(data?.dorms ?? 0)} icon={BedDouble} />
      <StatCard label="Boarders" value={`${data?.boarders ?? 0} / ${data?.capacity ?? 0}`} icon={Users} />
      <StatCard label="On exeat" value={String(data?.exeatsOut ?? 0)} icon={LogOut} />
      <StatCard label="Visitors on site" value={String(data?.visitorsIn ?? 0)} icon={UserPlus} />
    </div>
  );
}

/* ============================ DORMS ============================ */
function DormsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDormitories);
  const upsertFn = useServerFn(upsertDormitory);
  const delFn = useServerFn(deleteDormitory);
  const { data: dorms = [] } = useQuery({ queryKey: ["dorms"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; gender: DormGender; capacity: number; warden_name: string; warden_phone: string; notes: string }>({
    name: "", gender: "male", capacity: 40, warden_name: "", warden_phone: "", notes: "",
  });

  const openNew = () => { setEditing(null); setForm({ name: "", gender: "male", capacity: 40, warden_name: "", warden_phone: "", notes: "" }); setOpen(true); };
  const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, gender: d.gender, capacity: d.capacity, warden_name: d.warden_name ?? "", warden_phone: d.warden_phone ?? "", notes: d.notes ?? "" }); setOpen(true); };

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { id: editing?.id, ...form } }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["dorms"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["dorms"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Dormitories</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />New dormitory</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} dormitory</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gender</Label>
                    <Select value={form.gender} onValueChange={(v: DormGender) => setForm({ ...form, gender: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Boys</SelectItem>
                        <SelectItem value="female">Girls</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Warden name</Label><Input value={form.warden_name} onChange={(e) => setForm({ ...form, warden_name: e.target.value })} /></div>
                  <div><Label>Warden phone</Label><Input value={form.warden_phone} onChange={(e) => setForm({ ...form, warden_phone: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dorms.map((d: any) => (
            <div key={d.id} className="border rounded-lg p-4 border-l-4 border-l-primary">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{d.gender === "male" ? "Boys" : d.gender === "female" ? "Girls" : "Mixed"} · Warden: {d.warden_name ?? "—"}</div>
                </div>
                <Badge variant="outline">{d.occupied}/{d.capacity}</Badge>
              </div>
              {d.notes && <p className="text-xs text-muted-foreground mt-2">{d.notes}</p>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {dorms.length === 0 && <div className="text-sm text-muted-foreground col-span-full py-8 text-center">No dormitories yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================ ASSIGNMENTS ============================ */
function StudentPicker({ value, onChange }: { value: { id: string; label: string } | null; onChange: (v: { id: string; label: string } | null) => void }) {
  const searchFn = useServerFn(searchBoardingStudents);
  const [q, setQ] = useState("");
  const { data: results = [] } = useQuery({ queryKey: ["search-students", q], queryFn: () => searchFn({ data: { q } }), enabled: q.length >= 2 });
  return (
    <div>
      <Label>Student</Label>
      {value ? (
        <div className="flex items-center gap-2 border rounded-md p-2">
          <span className="text-sm flex-1">{value.label}</span>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Change</Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or matricule..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          {q.length >= 2 && (
            <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
              {results.map((r: any) => (
                <button key={r.id} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { onChange({ id: r.id, label: `${r.full_name} · ${r.matricule ?? ""} · ${r.class_name ?? ""}` }); setQ(""); }}>
                  {r.full_name} <span className="text-xs text-muted-foreground">· {r.matricule} · {r.class_name}</span>
                </button>
              ))}
              {!results.length && <div className="p-2 text-xs text-muted-foreground">No matches.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AssignmentsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBoardingAssignments);
  const dormsFn = useServerFn(listDormitories);
  const assignFn = useServerFn(assignBoardingStudent);
  const releaseFn = useServerFn(releaseBoardingAssignment);

  const [filter, setFilter] = useState<{ dormitoryId: string; q: string }>({ dormitoryId: "", q: "" });
  const { data: dorms = [] } = useQuery({ queryKey: ["dorms"], queryFn: () => dormsFn() });
  const { data: rows = [] } = useQuery({
    queryKey: ["assignments", filter],
    queryFn: () => listFn({ data: { dormitoryId: filter.dormitoryId || undefined, q: filter.q } }),
  });

  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<{ id: string; label: string } | null>(null);
  const [dormId, setDormId] = useState<string>("");
  const [bed, setBed] = useState("");

  const create = useMutation({
    mutationFn: () => assignFn({ data: { student_id: student!.id, dormitory_id: dormId, bed_number: bed || null } }),
    onSuccess: () => { toast.success("Assigned"); setOpen(false); setStudent(null); setDormId(""); setBed(""); qc.invalidateQueries({ queryKey: ["assignments"] }); qc.invalidateQueries({ queryKey: ["dorms"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const release = useMutation({
    mutationFn: (id: string) => releaseFn({ data: { id } }),
    onSuccess: () => { toast.success("Released"); qc.invalidateQueries({ queryKey: ["assignments"] }); qc.invalidateQueries({ queryKey: ["dorms"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div className="flex gap-2">
            <Input placeholder="Search student..." value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="w-64" />
            <Select value={filter.dormitoryId || "all"} onValueChange={(v) => setFilter({ ...filter, dormitoryId: v === "all" ? "" : v })}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All dormitories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dormitories</SelectItem>
                {dorms.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Assign student</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign to dormitory</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <StudentPicker value={student} onChange={setStudent} />
                <div>
                  <Label>Dormitory</Label>
                  <Select value={dormId} onValueChange={setDormId}>
                    <SelectTrigger><SelectValue placeholder="Pick a dormitory" /></SelectTrigger>
                    <SelectContent>{dorms.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.occupied}/{d.capacity})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Bed number (optional)</Label><Input value={bed} onChange={(e) => setBed(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!student || !dormId || create.isPending}>Assign</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="text-left py-2 px-2">Student</th><th className="text-left py-2 px-2">Class</th>
              <th className="text-left py-2 px-2">Dormitory</th><th className="text-left py-2 px-2">Bed</th>
              <th className="text-left py-2 px-2">Since</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 px-2 font-medium">{r.students?.full_name} <span className="text-xs text-muted-foreground">{r.students?.matricule}</span></td>
                  <td className="py-2 px-2">{r.students?.class_name ?? "—"}</td>
                  <td className="py-2 px-2">{r.dormitories?.name}</td>
                  <td className="py-2 px-2">{r.bed_number ?? "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground">{r.assigned_on}</td>
                  <td className="py-2 px-2 text-right"><Button size="sm" variant="ghost" onClick={() => release.mutate(r.id)}>Release</Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No active assignments.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================ ROLL CALL ============================ */
function RollCallTab() {
  const qc = useQueryClient();
  const dormsFn = useServerFn(listDormitories);
  const getFn = useServerFn(getRollCall);
  const saveFn = useServerFn(saveRollCall);
  const { data: dorms = [] } = useQuery({ queryKey: ["dorms"], queryFn: () => dormsFn() });

  const today = new Date().toISOString().slice(0, 10);
  const [dormId, setDormId] = useState<string>("");
  const [date, setDate] = useState<string>(today);
  const [session, setSession] = useState<RollSession>("evening");
  const [entries, setEntries] = useState<Record<string, { status: RollStatus; note: string }>>({});

  const rollQ = useQuery({
    queryKey: ["roll", dormId, date, session],
    queryFn: async () => {
      const res = await getFn({ data: { dormitory_id: dormId, date, session } });
      const seeded: Record<string, { status: RollStatus; note: string }> = {};
      for (const r of res.roster as any[]) {
        const m = res.marks[r.student_id];
        seeded[r.student_id] = { status: m?.status ?? "present", note: m?.note ?? "" };
      }
      setEntries(seeded);
      return res;
    },
    enabled: !!dormId,
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { dormitory_id: dormId, date, session, entries: Object.entries(entries).map(([student_id, v]) => ({ student_id, status: v.status, note: v.note || null })) } }),
    onSuccess: () => { toast.success("Roll call saved"); qc.invalidateQueries({ queryKey: ["roll"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setAll = (status: RollStatus) => {
    const next = { ...entries };
    for (const k of Object.keys(next)) next[k] = { ...next[k], status };
    setEntries(next);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <Label>Dormitory</Label>
            <Select value={dormId} onValueChange={setDormId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Pick dormitory" /></SelectTrigger>
              <SelectContent>{dorms.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Session</Label>
            <Select value={session} onValueChange={(v: RollSession) => setSession(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="morning">Morning</SelectItem><SelectItem value="evening">Evening</SelectItem><SelectItem value="night">Night</SelectItem></SelectContent>
            </Select>
          </div>
          {dormId && (
            <>
              <Button size="sm" variant="outline" onClick={() => setAll("present")}>Mark all present</Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save roll call</Button>
            </>
          )}
        </div>
        {!dormId && <div className="text-sm text-muted-foreground py-8 text-center">Pick a dormitory to begin.</div>}
        {dormId && rollQ.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="text-left py-2 px-2">Student</th><th className="text-left py-2 px-2">Class</th>
                <th className="text-left py-2 px-2">Room/Bed</th><th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Note</th>
              </tr></thead>
              <tbody>
                {(rollQ.data.roster as any[]).map((r) => {
                  const e = entries[r.student_id] ?? { status: "present" as RollStatus, note: "" };
                  return (
                    <tr key={r.student_id} className="border-b">
                      <td className="py-2 px-2 font-medium">{r.students?.full_name} <span className="text-xs text-muted-foreground">{r.students?.matricule}</span></td>
                      <td className="py-2 px-2">{r.students?.class_name ?? "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.dorm_rooms?.room_number ?? "—"} / {r.bed_number ?? "—"}</td>
                      <td className="py-2 px-2">
                        <Select value={e.status} onValueChange={(v: RollStatus) => setEntries({ ...entries, [r.student_id]: { ...e, status: v } })}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="exeat">Exeat</SelectItem>
                            <SelectItem value="sick">Sick</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2"><Input value={e.note} onChange={(ev) => setEntries({ ...entries, [r.student_id]: { ...e, note: ev.target.value } })} className="h-8" /></td>
                    </tr>
                  );
                })}
                {(rollQ.data.roster as any[]).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No boarders assigned to this dormitory.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================ EXEATS ============================ */
function ExeatsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExeats);
  const createFn = useServerFn(createExeat);
  const statusFn = useServerFn(updateExeatStatus);
  const delFn = useServerFn(deleteExeat);

  const [filter, setFilter] = useState<{ status: ExeatStatus | "all"; q: string }>({ status: "all", q: "" });
  const { data: rows = [] } = useQuery({ queryKey: ["exeats", filter], queryFn: () => listFn({ data: filter }) });

  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<{ id: string; label: string } | null>(null);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const [form, setForm] = useState({
    reason: "", destination: "", depart_at: toLocal(now), return_by: toLocal(new Date(now.getTime() + 24 * 3600 * 1000)),
    guardian_name: "", guardian_phone: "", guardian_approved: false, guardian_approval_note: "", notes: "",
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      student_id: student!.id, reason: form.reason, destination: form.destination || null,
      depart_at: new Date(form.depart_at).toISOString(), return_by: new Date(form.return_by).toISOString(),
      guardian_name: form.guardian_name || null, guardian_phone: form.guardian_phone || null,
      guardian_approved: form.guardian_approved, guardian_approval_note: form.guardian_approval_note || null,
      notes: form.notes || null,
    } }),
    onSuccess: () => { toast.success("Exeat created"); setOpen(false); setStudent(null); qc.invalidateQueries({ queryKey: ["exeats"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: ExeatStatus }) => statusFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exeats"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exeats"] }),
  });

  const statusColor = (s: string) => ({
    pending: "bg-amber-100 text-amber-800", approved: "bg-blue-100 text-blue-800",
    denied: "bg-red-100 text-red-800", departed: "bg-indigo-100 text-indigo-800",
    returned: "bg-emerald-100 text-emerald-800", overdue: "bg-red-100 text-red-800",
    cancelled: "bg-muted text-muted-foreground",
  } as Record<string, string>)[s] ?? "";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div className="flex gap-2">
            <Input placeholder="Search..." value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="w-64" />
            <Select value={filter.status} onValueChange={(v: any) => setFilter({ ...filter, status: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["pending", "approved", "departed", "returned", "overdue", "denied", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New exeat</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Request exeat</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <StudentPicker value={student} onChange={setStudent} />
                <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Medical / Family / Weekend..." /></div>
                <div><Label>Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Depart at</Label><Input type="datetime-local" value={form.depart_at} onChange={(e) => setForm({ ...form, depart_at: e.target.value })} /></div>
                  <div><Label>Return by</Label><Input type="datetime-local" value={form.return_by} onChange={(e) => setForm({ ...form, return_by: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Guardian name</Label><Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
                  <div><Label>Guardian phone</Label><Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></div>
                </div>
                <div className="flex items-start gap-2 border rounded-md p-3 bg-muted/40">
                  <Checkbox id="gappr" checked={form.guardian_approved} onCheckedChange={(v) => setForm({ ...form, guardian_approved: !!v })} />
                  <div className="flex-1">
                    <label htmlFor="gappr" className="text-sm font-medium flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Guardian approved</label>
                    <Input placeholder="Approval note (phone call, message, in person)..." className="mt-2" value={form.guardian_approval_note} onChange={(e) => setForm({ ...form, guardian_approval_note: e.target.value })} disabled={!form.guardian_approved} />
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!student || !form.reason || create.isPending}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="text-left py-2 px-2">Student</th><th className="text-left py-2 px-2">Reason</th>
              <th className="text-left py-2 px-2">Depart</th><th className="text-left py-2 px-2">Return by</th>
              <th className="text-left py-2 px-2">Guardian</th><th className="text-left py-2 px-2">Status</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 px-2 font-medium">{r.students?.full_name} <span className="text-xs text-muted-foreground">{r.students?.class_name}</span></td>
                  <td className="py-2 px-2">{r.reason}<div className="text-xs text-muted-foreground">{r.destination}</div></td>
                  <td className="py-2 px-2 text-xs">{new Date(r.depart_at).toLocaleString()}</td>
                  <td className="py-2 px-2 text-xs">{new Date(r.return_by).toLocaleString()}</td>
                  <td className="py-2 px-2 text-xs">{r.guardian_name ?? "—"}{r.guardian_approved && <Badge variant="outline" className="ml-1">OK</Badge>}<div className="text-muted-foreground">{r.guardian_phone}</div></td>
                  <td className="py-2 px-2"><Badge className={statusColor(r.status)}>{r.status}</Badge></td>
                  <td className="py-2 px-2 text-right">
                    <Select value="" onValueChange={(v: ExeatStatus) => setStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="denied">Deny</SelectItem>
                        <SelectItem value="departed">Mark departed</SelectItem>
                        <SelectItem value="returned">Mark returned</SelectItem>
                        <SelectItem value="cancelled">Cancel</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No exeats.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================ VISITORS ============================ */
function VisitorsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVisitors);
  const checkInFn = useServerFn(checkInVisitor);
  const checkOutFn = useServerFn(checkOutVisitor);

  const [filter, setFilter] = useState<{ q: string; activeOnly: boolean }>({ q: "", activeOnly: false });
  const { data: rows = [] } = useQuery({ queryKey: ["visitors", filter], queryFn: () => listFn({ data: filter }) });

  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<{ id: string; label: string } | null>(null);
  const [form, setForm] = useState({ visitor_name: "", visitor_phone: "", relationship: "", id_document: "", purpose: "" });

  const create = useMutation({
    mutationFn: () => checkInFn({ data: { student_id: student?.id ?? null, ...form } }),
    onSuccess: () => { toast.success("Visitor checked in"); setOpen(false); setStudent(null); setForm({ visitor_name: "", visitor_phone: "", relationship: "", id_document: "", purpose: "" }); qc.invalidateQueries({ queryKey: ["visitors"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const checkOut = useMutation({
    mutationFn: (id: string) => checkOutFn({ data: { id } }),
    onSuccess: () => { toast.success("Checked out"); qc.invalidateQueries({ queryKey: ["visitors"] }); qc.invalidateQueries({ queryKey: ["boarding-summary"] }); },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div className="flex gap-2 items-center">
            <Input placeholder="Search..." value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="w-64" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={filter.activeOnly} onCheckedChange={(v) => setFilter({ ...filter, activeOnly: !!v })} />
              On site only
            </label>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Check in visitor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Check in visitor</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <StudentPicker value={student} onChange={setStudent} />
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Visitor name</Label><Input value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} /></div>
                  <div><Label>Relationship</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Parent, Guardian..." /></div>
                  <div><Label>ID document</Label><Input value={form.id_document} onChange={(e) => setForm({ ...form, id_document: e.target.value })} placeholder="CNI number..." /></div>
                </div>
                <div><Label>Purpose</Label><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.visitor_name || create.isPending}>Check in</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="text-left py-2 px-2">Visitor</th><th className="text-left py-2 px-2">Student</th>
              <th className="text-left py-2 px-2">Relationship</th><th className="text-left py-2 px-2">Purpose</th>
              <th className="text-left py-2 px-2">Check-in</th><th className="text-left py-2 px-2">Check-out</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 px-2 font-medium">{r.visitor_name}<div className="text-xs text-muted-foreground">{r.visitor_phone}</div></td>
                  <td className="py-2 px-2">{r.students?.full_name ?? "—"}<div className="text-xs text-muted-foreground">{r.students?.class_name}</div></td>
                  <td className="py-2 px-2">{r.relationship ?? "—"}</td>
                  <td className="py-2 px-2 text-xs">{r.purpose ?? "—"}</td>
                  <td className="py-2 px-2 text-xs">{new Date(r.check_in_at).toLocaleString()}</td>
                  <td className="py-2 px-2 text-xs">{r.check_out_at ? new Date(r.check_out_at).toLocaleString() : <Badge variant="outline">On site</Badge>}</td>
                  <td className="py-2 px-2 text-right">{!r.check_out_at && <Button size="sm" variant="outline" onClick={() => checkOut.mutate(r.id)}>Check out</Button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No visitors.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}