import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, BookOpen } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listClasses,
  upsertClass,
  deleteClass,
  listClassSubjects,
  upsertClassSubject,
  deleteClassSubject,
} from "@/lib/classes-admin.functions";
import { listStaff } from "@/lib/hr.functions";
import {
  listSubjects,
  ensureSubject,
  renameSubject,
  setSubjectActive,
} from "@/lib/subjects.functions";
import { SubjectPicker } from "@/components/subject-picker";

export const Route = createFileRoute("/_authenticated/classes/manage")({
  component: ClassesManagePage,
});

function ClassesManagePage() {
  const qc = useQueryClient();
  const fetchClasses = useServerFn(listClasses);
  const save = useServerFn(upsertClass);
  const del = useServerFn(deleteClass);
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => fetchClasses(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    level: string;
    sections: string;
    active: boolean;
  }>({ name: "", level: "", sections: "", active: true });
  const [subjectsFor, setSubjectsFor] = useState<{ id: string; name: string } | null>(null);
  const [subjectsAdminOpen, setSubjectsAdminOpen] = useState(false);

  async function submit() {
    if (!editing.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      await save({
        data: {
          id: editing.id,
          name: editing.name.trim(),
          level: editing.level || undefined,
          sections: editing.sections
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          active: editing.active,
        },
      });
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["classes-list"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/classes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Classes
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Manage classes"
        description="Create classes, add sections, and define the subjects offered per class."
        actions={
          <>
            <Button variant="outline" onClick={() => setSubjectsAdminOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Subject list
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setEditing({ name: "", level: "", sections: "", active: true })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing.id ? "Edit class" : "New class"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Form 1"
                    />
                  </div>
                  <div>
                    <Label>Level</Label>
                    <Input
                      value={editing.level}
                      onChange={(e) => setEditing({ ...editing, level: e.target.value })}
                      placeholder="Lower Secondary"
                    />
                  </div>
                  <div>
                    <Label>Sections (comma-separated)</Label>
                    <Input
                      value={editing.sections}
                      onChange={(e) => setEditing({ ...editing, sections: e.target.value })}
                      placeholder="A, B, C"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No classes yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
              <CardContent className="space-y-3 p-5 pl-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.level ?? "—"}</p>
                  </div>
                  {!c.active && <Badge variant="secondary">Archived</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(c.sections ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">No sections</span>
                  ) : (
                    (c.sections ?? []).map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSubjectsFor({ id: c.id, name: c.name })}
                  >
                    <BookOpen className="mr-1 h-3.5 w-3.5" />
                    Subjects
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing({
                        id: c.id,
                        name: c.name,
                        level: c.level ?? "",
                        sections: (c.sections ?? []).join(", "),
                        active: c.active,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        confirm(
                          `Delete class ${c.name}? Students on it will remain but lose their class assignment.`,
                        )
                      ) {
                        await del({ data: { id: c.id } });
                        qc.invalidateQueries({ queryKey: ["classes-list"] });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {subjectsFor && (
        <SubjectsDialog
          classId={subjectsFor.id}
          className={subjectsFor.name}
          onClose={() => setSubjectsFor(null)}
        />
      )}
      {subjectsAdminOpen && <SubjectsAdminDialog onClose={() => setSubjectsAdminOpen(false)} />}
    </div>
  );
}

function SubjectsDialog({
  classId,
  className,
  onClose,
}: {
  classId: string;
  className: string;
  onClose: () => void;
}) {
  const fetch = useServerFn(listClassSubjects);
  const fetchStaff = useServerFn(listStaff);
  const fetchSubjects = useServerFn(listSubjects);
  const save = useServerFn(upsertClassSubject);
  const del = useServerFn(deleteClassSubject);
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: () => fetch({ data: { classId } }),
  });
  // Unscoped, school-wide assignments — used only to show each teacher's
  // total subject load in the picker, so an admin can see at a glance who's
  // already stretched thin before assigning them another class.
  const { data: allAssignments = [] } = useQuery({
    queryKey: ["class-subjects", "all"],
    queryFn: () => fetch({ data: {} }),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => fetchStaff(),
  });
  const ensureFn = useServerFn(ensureSubject);
  const { data: subjectOptions = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchSubjects({ data: {} }),
  });
  const teachers = staff.filter(
    (s) =>
      s.status === "active" &&
      ["teacher", "vice_principal", "principal"].includes(s.position as string),
  );
  const loadByTeacher = new Map<string, number>();
  for (const a of allAssignments) {
    const tid = (a as { teacher_id?: string | null }).teacher_id;
    if (!tid) continue;
    loadByTeacher.set(tid, (loadByTeacher.get(tid) ?? 0) + 1);
  }

  const [subject, setSubject] = useState("");
  const [coefficient, setCoefficient] = useState(1);
  const [teacherId, setTeacherId] = useState<string>("");

  async function add() {
    if (!subject.trim()) {
      toast.error("Subject required");
      return;
    }
    try {
      const canonical = await ensureFn({ data: { name: subject.trim() } });
      await save({
        data: {
          class_id: classId,
          subject: canonical.name,
          coefficient,
          teacher_id: teacherId || null,
        },
      });
      setSubject("");
      setCoefficient(1);
      setTeacherId("");
      qc.invalidateQueries({ queryKey: ["class-subjects"], exact: false });
      qc.invalidateQueries({ queryKey: ["subjects"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reassign(row: (typeof subjects)[number], newTeacherId: string) {
    try {
      await save({
        data: {
          id: row.id,
          class_id: classId,
          subject: row.subject,
          coefficient: row.coefficient,
          teacher_id: newTeacherId || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["class-subjects"], exact: false });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subjects · {className}</DialogTitle>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Subject</Label>
            <SubjectPicker value={subject} onChange={setSubject} subjects={subjectOptions} />
          </div>
          <div className="w-24">
            <Label>Coefficient</Label>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={coefficient}
              onChange={(e) => setCoefficient(Number(e.target.value))}
            />
          </div>
          <div className="w-56">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => {
                  const load = loadByTeacher.get(t.id) ?? 0;
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                      {load > 0 ? ` — teaches ${load} already` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No subjects yet.</div>
            ) : (
              <div className="divide-y">
                {subjects.map((s) => {
                  const teacherName = (s as { staff?: { first_name?: string; last_name?: string } })
                    .staff
                    ? `${(s as { staff?: { first_name?: string } }).staff?.first_name ?? ""} ${(s as { staff?: { last_name?: string } }).staff?.last_name ?? ""}`.trim()
                    : "";
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{s.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          Coeff. {s.coefficient}
                          {!teacherName && " · No teacher assigned"}
                        </div>
                      </div>
                      <div className="w-56">
                        <Select value={s.teacher_id ?? ""} onValueChange={(v) => reassign(s, v)}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map((t) => {
                              const load = loadByTeacher.get(t.id) ?? 0;
                              const isThisRow = t.id === s.teacher_id;
                              const shown = isThisRow ? Math.max(load - 1, 0) : load;
                              return (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.first_name} {t.last_name}
                                  {shown > 0 ? ` — teaches ${shown} already` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await del({ data: { id: s.id } });
                          qc.invalidateQueries({ queryKey: ["class-subjects"], exact: false });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

function SubjectsAdminDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fetchSubjects = useServerFn(listSubjects);
  const renameFn = useServerFn(renameSubject);
  const setActiveFn = useServerFn(setSubjectActive);
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", "all"],
    queryFn: () => fetchSubjects({ data: { includeInactive: true } }),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subjects"], exact: false });
    qc.invalidateQueries({ queryKey: ["class-subjects"], exact: false });
  };

  async function saveRename(id: string) {
    if (!editingName.trim()) {
      toast.error("Subject name required");
      return;
    }
    try {
      await renameFn({ data: { id, name: editingName.trim() } });
      setEditingId(null);
      invalidate();
      toast.success("Renamed — every class using this subject now shows the new name");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await setActiveFn({ data: { id, active } });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Subject list</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The shared list every class, timetable slot, and gradebook picks subjects from. Renaming
          here updates the name everywhere it's used — it's the fix for two screens spelling the
          same subject differently.
        </p>
        <Card>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No subjects yet — add one from a class's subject list.
              </div>
            ) : (
              <div className="divide-y">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-3">
                    {editingId === s.id ? (
                      <>
                        <Input
                          className="h-8 flex-1"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => saveRename(s.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-sm">
                          {s.name}
                          {!s.active && (
                            <Badge variant="secondary" className="ml-2">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Rename"
                          onClick={() => {
                            setEditingId(s.id);
                            setEditingName(s.name);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(s.id, !s.active)}
                        >
                          {s.active ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
