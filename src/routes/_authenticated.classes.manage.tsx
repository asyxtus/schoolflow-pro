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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  listClasses, upsertClass, deleteClass,
  listClassSubjects, upsertClassSubject, deleteClassSubject,
} from "@/lib/classes-admin.functions";

export const Route = createFileRoute("/_authenticated/classes/manage")({
  component: ClassesManagePage,
});

function ClassesManagePage() {
  const qc = useQueryClient();
  const fetchClasses = useServerFn(listClasses);
  const save = useServerFn(upsertClass);
  const del = useServerFn(deleteClass);
  const { data: classes = [] } = useQuery({ queryKey: ["classes-list"], queryFn: () => fetchClasses() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name: string; level: string; sections: string; active: boolean }>({ name: "", level: "", sections: "", active: true });
  const [subjectsFor, setSubjectsFor] = useState<{ id: string; name: string } | null>(null);

  async function submit() {
    if (!editing.name.trim()) { toast.error("Name required"); return; }
    try {
      await save({ data: { id: editing.id, name: editing.name.trim(), level: editing.level || undefined, sections: editing.sections.split(",").map((s) => s.trim()).filter(Boolean), active: editing.active } });
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["classes-list"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/classes"><ArrowLeft className="mr-1 h-4 w-4" />Back to Classes</Link>
        </Button>
      </div>
      <PageHeader
        title="Manage classes"
        description="Create classes, add sections, and define the subjects offered per class."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ name: "", level: "", sections: "", active: true })}>
                <Plus className="mr-2 h-4 w-4" />New class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Edit class" : "New class"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Name *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Form 1" /></div>
                <div><Label>Level</Label><Input value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })} placeholder="Lower Secondary" /></div>
                <div><Label>Sections (comma-separated)</Label><Input value={editing.sections} onChange={(e) => setEditing({ ...editing, sections: e.target.value })} placeholder="A, B, C" /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {classes.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No classes yet. Create one to get started.</CardContent></Card>
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
                    (c.sections ?? []).map((s) => <Badge key={s} variant="outline">{s}</Badge>)
                  )}
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setSubjectsFor({ id: c.id, name: c.name })}>
                    <BookOpen className="mr-1 h-3.5 w-3.5" />Subjects
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing({ id: c.id, name: c.name, level: c.level ?? "", sections: (c.sections ?? []).join(", "), active: c.active }); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => { if (confirm(`Delete class ${c.name}? Students on it will remain but lose their class assignment.`)) { await del({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["classes-list"] }); } }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {subjectsFor && <SubjectsDialog classId={subjectsFor.id} className={subjectsFor.name} onClose={() => setSubjectsFor(null)} />}
    </div>
  );
}

function SubjectsDialog({ classId, className, onClose }: { classId: string; className: string; onClose: () => void }) {
  const fetch = useServerFn(listClassSubjects);
  const save = useServerFn(upsertClassSubject);
  const del = useServerFn(deleteClassSubject);
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery({ queryKey: ["class-subjects", classId], queryFn: () => fetch({ data: { classId } }) });
  const [subject, setSubject] = useState("");
  const [coefficient, setCoefficient] = useState(1);

  async function add() {
    if (!subject.trim()) { toast.error("Subject required"); return; }
    try {
      await save({ data: { class_id: classId, subject: subject.trim(), coefficient } });
      setSubject(""); setCoefficient(1);
      qc.invalidateQueries({ queryKey: ["class-subjects", classId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Subjects · {className}</DialogTitle></DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" /></div>
          <div className="w-24"><Label>Coefficient</Label><Input type="number" min={0.5} step={0.5} value={coefficient} onChange={(e) => setCoefficient(Number(e.target.value))} /></div>
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        <Card><CardContent className="p-0">
          {subjects.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No subjects yet.</div>
          ) : (
            <div className="divide-y">
              {subjects.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{s.subject}</div>
                    <div className="text-xs text-muted-foreground">Coeff. {s.coefficient}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: ["class-subjects", classId] }); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </DialogContent>
    </Dialog>
  );
}
