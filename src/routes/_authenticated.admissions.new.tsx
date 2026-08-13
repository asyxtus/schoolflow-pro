import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Upload } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createApplicant } from "@/lib/admissions.functions";
import { useClassOptions } from "@/hooks/use-classes";

const FALLBACK_CLASSES = [
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4 Science",
  "Form 4 Arts",
  "Form 5 Science",
  "Form 5 Arts",
  "Lower Sixth Science",
  "Upper Sixth Arts",
];

export const Route = createFileRoute("/_authenticated/admissions/new")({
  component: NewApplicationPage,
});

function NewApplicationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: classesData = [] } = useClassOptions();
  const classNames =
    classesData.length > 0
      ? classesData.filter((c) => c.active).map((c) => c.name)
      : FALLBACK_CLASSES;
  const [gender, setGender] = useState<"male" | "female">("male");
  const [desiredClass, setDesiredClass] = useState(classNames[0] ?? "");

  const mutation = useMutation({
    mutationFn: createApplicant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicants"] });
      toast.success("Application submitted", {
        description: "The applicant has been added to the New enquiry column.",
      });
      navigate({ to: "/admissions" });
    },
    onError: (error) => {
      toast.error("Submission failed", { description: error.message });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    mutation.mutate({
      data: {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        dateOfBirth: String(form.get("dob") ?? ""),
        gender,
        desiredClass,
        previousSchool: String(form.get("previousSchool") ?? ""),
        guardianName: String(form.get("guardianName") ?? ""),
        guardianPhone: String(form.get("guardianPhone") ?? ""),
        guardianEmail: String(form.get("guardianEmail") ?? ""),
        guardianRelationship: String(form.get("relationship") ?? ""),
        notes: String(form.get("notes") ?? ""),
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/admissions">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to pipeline
          </Link>
        </Button>
      </div>

      <PageHeader
        title="New application"
        description="Capture an applicant enquiry — they'll enter the pipeline at 'New enquiry'."
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <div className="h-1 bg-primary" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Applicant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" name="firstName" label="First name" required />
            <Field id="lastName" name="lastName" label="Last name" required />
            <Field id="dob" name="dob" label="Date of birth" type="date" />
            <div className="space-y-2">
              <Label>Gender</Label>
              <RadioGroup
                value={gender}
                onValueChange={(v) => setGender(v as "male" | "female")}
                className="flex gap-4 pt-1"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="male" /> Male
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="female" /> Female
                </label>
              </RadioGroup>
            </div>
            <Field
              id="nationality"
              name="nationality"
              label="Nationality"
              defaultValue="Cameroonian"
            />
            <Field id="religion" name="religion" label="Religion" />
          </CardContent>
        </Card>

        <Card>
          <div className="h-1 bg-accent" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Academic</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="desiredClass">Desired class</Label>
              <Select value={desiredClass} onValueChange={setDesiredClass}>
                <SelectTrigger id="desiredClass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classNames.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field id="previousSchool" name="previousSchool" label="Previous school" />
            <Field id="lastClass" name="lastClass" label="Last class attended" />
            <Field
              id="lastAverage"
              name="lastAverage"
              label="Last term average (/20)"
              type="number"
            />
          </CardContent>
        </Card>

        <Card>
          <div className="h-1" style={{ background: "hsl(var(--sidebar-primary-foreground))" }} />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Guardian</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="guardianName" name="guardianName" label="Full name" required />
            <Field
              id="relationship"
              name="relationship"
              label="Relationship"
              placeholder="Father, Mother, Uncle…"
            />
            <Field
              id="guardianPhone"
              name="guardianPhone"
              label="Phone"
              placeholder="+237 6XX XXX XXX"
              required
            />
            <Field id="guardianEmail" name="guardianEmail" label="Email" type="email" />
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address">Home address</Label>
              <Textarea id="address" name="address" rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DocumentRow label="Birth certificate" required />
            <DocumentRow label="Last school report" required />
            <DocumentRow label="Passport photograph" />
            <DocumentRow label="Baptism / medical certificate" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notes for admissions team</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea name="notes" rows={3} placeholder="Anything the interviewer should know…" />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link to="/admissions">Cancel</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  required,
  type = "text",
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}

function DocumentRow({ label, required }: { label: string; required?: boolean }) {
  const [uploaded, setUploaded] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3">
      <div>
        <div className="text-sm text-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </div>
        <div className="text-xs text-muted-foreground">PDF or image · up to 5 MB</div>
      </div>
      {uploaded ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <CheckCircle2 className="h-4 w-4" /> Uploaded
        </span>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setUploaded(true)}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
        </Button>
      )}
    </div>
  );
}
