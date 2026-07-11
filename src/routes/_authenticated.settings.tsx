import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentSchool, updateSchool, updateProfile } from "@/lib/school.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["current-school"],
    queryFn: () => getCurrentSchool(),
  });

  const [school, setSchool] = useState({ name: "", code: "", city: "", region: "", motto: "" });
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (data?.school) {
      setSchool({
        name: data.school.name ?? "",
        code: data.school.code ?? "",
        city: data.school.city ?? "",
        region: data.school.region ?? "",
        motto: data.school.motto ?? "",
      });
    }
    if (data?.profile) setFullName(data.profile.full_name ?? "");
  }, [data]);

  const schoolMut = useMutation({
    mutationFn: (input: typeof school) => updateSchool({ data: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["current-school"] });
      toast.success("School profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profileMut = useMutation({
    mutationFn: (name: string) => updateProfile({ data: { fullName: name } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["current-school"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitSchool = (e: FormEvent) => {
    e.preventDefault();
    if (!school.name || !school.code) {
      toast.error("Name and code are required");
      return;
    }
    schoolMut.mutate(school);
  };

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Name is required");
    profileMut.mutate(fullName.trim());
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6">
      <PageHeader
        title="Settings"
        description="School profile and your account"
      />

      <form onSubmit={submitSchool}>
        <Card>
          <CardHeader><CardTitle className="text-base">School profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="School name" required>
              <Input value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} />
            </Field>
            <Field label="Code" required>
              <Input value={school.code} onChange={(e) => setSchool({ ...school, code: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={school.city} onChange={(e) => setSchool({ ...school, city: e.target.value })} />
            </Field>
            <Field label="Region">
              <Input value={school.region} onChange={(e) => setSchool({ ...school, region: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Motto">
                <Textarea rows={2} value={school.motto} onChange={(e) => setSchool({ ...school, motto: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={schoolMut.isPending}>
                {schoolMut.isPending ? "Saving…" : "Save school"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <form onSubmit={submitProfile}>
        <Card>
          <CardHeader><CardTitle className="text-base">Your account</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={data?.profile?.email ?? ""} disabled />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={profileMut.isPending}>
                {profileMut.isPending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
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
