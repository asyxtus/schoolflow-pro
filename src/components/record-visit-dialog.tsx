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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordClinicVisit } from "@/lib/clinic.functions";

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string | null;
};

export function RecordVisitDialog({
  open,
  onClose,
  onRecorded,
  students,
  fixedStudent,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
  students?: StudentOption[];
  fixedStudent?: { id: string; name: string };
}) {
  const recordFn = useServerFn(recordClinicVisit);
  const [studentId, setStudentId] = useState(fixedStudent?.id ?? "");
  const [visitedOn, setVisitedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [complaint, setComplaint] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [temperature, setTemperature] = useState("");
  const [referredOut, setReferredOut] = useState(false);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStudentId(fixedStudent?.id ?? "");
    setVisitedOn(new Date().toISOString().slice(0, 10));
    setComplaint("");
    setTreatmentGiven("");
    setTemperature("");
    setReferredOut(false);
    setFollowUpNeeded(false);
    setNotes("");
  };

  const submit = async () => {
    const finalStudentId = fixedStudent?.id ?? studentId;
    if (!finalStudentId) {
      toast.error("Select a student");
      return;
    }
    if (!complaint.trim()) {
      toast.error("Enter the complaint / reason for the visit");
      return;
    }
    setBusy(true);
    try {
      await recordFn({
        data: {
          studentId: finalStudentId,
          visitedOn,
          complaint,
          treatmentGiven: treatmentGiven || undefined,
          temperatureC: temperature ? Number(temperature) : undefined,
          referredOut,
          followUpNeeded,
          notes: notes || undefined,
        },
      });
      toast.success("Visit recorded");
      reset();
      onRecorded();
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
          <DialogTitle>
            Record clinic visit{fixedStudent ? ` — ${fixedStudent.name}` : ""}
          </DialogTitle>
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
              <Input type="date" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Temperature °C (optional)</Label>
              <Input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Complaint / reason for visit</Label>
            <Textarea rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Treatment given (optional)</Label>
            <Textarea
              rows={2}
              value={treatmentGiven}
              onChange={(e) => setTreatmentGiven(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={referredOut} onCheckedChange={(v) => setReferredOut(!!v)} />
              Referred to hospital
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={followUpNeeded} onCheckedChange={(v) => setFollowUpNeeded(!!v)} />
              Needs follow-up
            </label>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
