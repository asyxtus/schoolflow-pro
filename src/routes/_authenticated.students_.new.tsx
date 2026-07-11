import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createStudent } from "@/lib/students.functions";

export const Route = createFileRoute("/_authenticated/students_/new")({
  component: NewStudentPage,
});

function NewStudentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    matricule: "",
    dateOfBirth: "",
    gender: "" as "" | "male" | "female",
    className: "",
    section: "",
    status: "active" as const,
    feeBalance: "",
    notes: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof createStudent>[0]) => createStudent(input),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Student added");
      navigate({ to: "/students/$studentId", params: { studentId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.matricule) {
      toast.error("First name, last name and matricule are required");
      return;
    }
    mutation.mutate({
      data: {
        firstName: form.firstName,
        lastName: form.lastName,
        matricule: form.matricule,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        className: form.className || undefined,
        section: form.section || undefined,
        status: form.status,
        feeBalance: form.feeBalance ? Number(form.feeBalance) : undefined,
        notes: form.notes || undefined,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        guardianEmail: form.guardianEmail || undefined,
        guardianRelationship: form.guardianRelationship || undefined,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeader
        title="Add student"
        description="Register a new learner into your school"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/students">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name" required>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
            <Field label="Matricule" required>
              <Input value={form.matricule} onChange={(e) => set("matricule", e.target.value)} placeholder="SHC-2025-001" />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => set("gender", v as "male" | "female")}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Class">
              <Input value={form.className} onChange={(e) => set("className", e.target.value)} placeholder="Form 1" />
            </Field>
            <Field label="Section">
              <Input value={form.section} onChange={(e) => set("section", e.target.value)} placeholder="A" />
            </Field>
            <Field label="Fee balance (FCFA)">
              <Input type="number" min={0} value={form.feeBalance} onChange={(e) => set("feeBalance", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Primary guardian (optional)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
            </Field>
            <Field label="Relationship">
              <Input value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} placeholder="Father / Mother / Uncle" />
            </Field>
            <Field label="Phone">
              <Input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} placeholder="+237 6…" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Health, boarding, scholarships…" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/students">Cancel</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Add student"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}