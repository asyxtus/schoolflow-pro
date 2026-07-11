import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate, useServerFn } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.school_id) throw redirect({ to: "/" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const submit = useServerFn(completeOnboarding);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    region: "",
    motto: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submit({
        data: {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          city: form.city.trim() || null,
          region: form.region.trim() || null,
          motto: form.motto.trim() || null,
        },
      });
      toast.success("School created", { description: "You're set up as principal." });
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Set up your school</h1>
          <p className="text-sm text-muted-foreground">
            Create your school workspace. You'll be assigned as principal.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">School details</CardTitle>
            <CardDescription>You can update these later in Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">School name</Label>
                <Input id="name" value={form.name} onChange={set("name")} required minLength={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="code">Short code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={set("code")}
                    required
                    minLength={2}
                    placeholder="e.g. SJB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" value={form.region} onChange={set("region")} placeholder="Centre" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={set("city")} placeholder="Yaoundé" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motto">Motto (optional)</Label>
                <Input id="motto" value={form.motto} onChange={set("motto")} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating…" : "Create school"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
