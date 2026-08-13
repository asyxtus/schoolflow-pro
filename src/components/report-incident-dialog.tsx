import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  reportDisciplineIncident,
  DISCIPLINE_CATEGORIES,
  type DisciplineSeverity,
} from "@/lib/discipline.functions";

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string | null;
};

export function ReportIncidentDialog({
  open,
  onClose,
  onReported,
  students,
  fixedStudent,
}: {
  open: boolean;
  onClose: () => void;
  onReported: () => void;
  students?: StudentOption[];
  fixedStudent?: { id: string; name: string };
}) {
  const reportFn = useServerFn(reportDisciplineIncident);
  const [studentId, setStudentId] = useState(fixedStudent?.id ?? "");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>(DISCIPLINE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [severity, setSeverity] = useState<DisciplineSeverity>("minor");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStudentId(fixedStudent?.id ?? "");
    setOccurredOn(new Date().toISOString().slice(0, 10));
    setCategory(DISCIPLINE_CATEGORIES[0]);
    setCustomCategory("");
    setSeverity("minor");
    setDescription("");
    setActionTaken("");
  };

  const submit = async () => {
    const finalStudentId = fixedStudent?.id ?? studentId;
    if (!finalStudentId) {
      toast.error("Select a student");
      return;
    }
    const finalCategory = category === "Other" ? customCategory.trim() : category;
    if (!finalCategory) {
      toast.error("Enter a category");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    setBusy(true);
    try {
      await reportFn({
        data: {
          studentId: finalStudentId,
          occurredOn,
          category: finalCategory,
          severity,
          description,
          actionTaken: actionTaken || undefined,
        },
      });
      toast.success("Incident reported");
      reset();
      onReported();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report incident{fixedStudent ? ` — ${fixedStudent.name}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedStudent && (
            <div className="grid gap-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(students ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                      {s.class_name ? ` · ${s.class_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as DisciplineSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category === "Other" && (
              <Input
                className="mt-1"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Describe the category"
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>What happened</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Action taken (optional)</Label>
            <Textarea
              rows={2}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Report incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
