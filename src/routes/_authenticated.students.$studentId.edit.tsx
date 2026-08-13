import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStudentById } from "@/lib/students.functions";
import { updateStudent } from "@/lib/student-edit.functions";

const studentQueryOptions = (id: string) => ({
  queryKey: ["student", id] as const,
  queryFn: () => getStudentById({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/students/$studentId/edit")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(studentQueryOptions(params.studentId));
  },
  component: StudentEditPage,
});

function StudentEditPage() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const { data: student } = useSuspenseQuery(studentQueryOptions(studentId));
  const updateFn = useServerFn(updateStudent);
  const guardian = student.guardians?.find((g) => g.is_primary) ?? student.guardians?.[0];

  const [firstName, setFirstName] = useState(student.first_name ?? "");
  const [lastName, setLastName] = useState(student.last_name ?? "");
  const [matricule, setMatricule] = useState(student.matricule ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(student.date_of_birth ?? "");
  const [gender, setGender] = useState<"male" | "female" | "">(student.gender ?? "");
  const [className, setClassName] = useState(student.class_name ?? "");
  const [section, setSection] = useState(student.section ?? "");
  const [status, setStatus] = useState(student.status ?? "active");
  const [notes, setNotes] = useState(student.notes ?? "");
  const [guardianName, setGuardianName] = useState(guardian?.full_name ?? "");
  const [guardianPhone, setGuardianPhone] = useState(guardian?.phone ?? student.guardian_phone ?? "");
  const [guardianEmail, setGuardianEmail] = useState(guardian?.email ?? student.guardian_email ?? "");
  const [guardianRelationship, setGuardianRelationship] = useState(guardian?.relationship ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: studentId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          matricule,
          dateOfBirth,
          gender: gender || undefined,
          className,
          section,
          status: status as "active" | "inactive" | "graduated" | "withdrawn" | "suspended",
          notes,
          guardianName,
          guardianPhone,
          guardianEmail,
          guardianRelationship,
        },
      });
      await navigate({ to: "/students/$studentId", params: { studentId }, replace: true });
      toast.success("Student information updated");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await navigate({ to: "/students/$studentId", params: { studentId }, replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/students/$studentId" params={{ studentId }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to student
        </Link>
      </Button>
      <PageHeader title="Edit student" description={`${student.last_name} ${student.first_name}`} />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Student information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
            <Field label="Last name"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
            <Field label="Matricule"><Input value={matricule} onChange={(e) => setMatricule(e.target.value)} /></Field>
            <Field label="Date of birth"><Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></Field>
            <Field label="Gender">
              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female") }>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class"><Input value={className} onChange={(e) => setClassName(e.target.value)} /></Field>
            <Field label="Section"><Input value={section} onChange={(e) => setSection(e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Primary guardian</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
            <Field label="Relationship"><Input value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)} /></Field>
            <Field label="Phone"><Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline"><Link to="/students/$studentId" params={{ studentId }}>Cancel</Link></Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
